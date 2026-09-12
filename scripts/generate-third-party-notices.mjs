import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const outputPath = path.join(root, 'THIRD_PARTY_NOTICES.md');
const checkOnly = process.argv.includes('--check');

const normalize = (value) => value.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
const escapeCell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const compareText = (left, right) => (left === right ? 0 : (left < right ? -1 : 1));

function command(name, args, cwd = root) {
  if (process.platform === 'win32' && name === 'pnpm') {
    return execFileSync(process.env.ComSpec, ['/d', '/s', '/c', `pnpm ${args.join(' ')}`], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  }
  return execFileSync(name, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function licenseFiles(packageDir) {
  if (!packageDir || !fs.existsSync(packageDir)) return [];
  return fs.readdirSync(packageDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^(license|copying|notice)(?:[._-].*)?$/i.test(entry.name))
    .sort((a, b) => compareText(a.name, b.name))
    .map((entry) => path.join(packageDir, entry.name));
}

function javascriptPackages() {
  const grouped = JSON.parse(command('pnpm', ['licenses', 'list', '--prod', '--json']));
  const packages = [];
  for (const entries of Object.values(grouped)) {
    for (const entry of entries) {
      // Type declaration packages are not executable material in the Vite bundle.
      if (entry.name.startsWith('@types/')) continue;
      for (let index = 0; index < entry.versions.length; index += 1) {
        packages.push({
          ecosystem: 'JavaScript',
          name: entry.name,
          version: entry.versions[index],
          license: entry.license,
          authors: typeof entry.author === 'string' ? entry.author : entry.author?.name ?? '',
          homepage: entry.homepage ?? '',
          packageDir: entry.paths[index] ?? entry.paths[0],
        });
      }
    }
  }
  return packages;
}

function rustPackages() {
  const manifest = path.join(root, 'apps', 'desktop', 'src-tauri', 'Cargo.toml');
  const metadata = JSON.parse(command('cargo', [
    'metadata', '--format-version', '1', '--filter-platform', 'x86_64-pc-windows-msvc',
    '--manifest-path', manifest,
  ]));
  // `cargo metadata` retains inactive target-specific edges. `cargo tree` applies
  // Cargo's target-expression evaluation, so use its normal-edge package list to
  // select only components participating in this Windows binary.
  const tree = command('cargo', [
    'tree', '--manifest-path', manifest, '--target', 'x86_64-pc-windows-msvc',
    '--edges', 'normal', '--prefix', 'none', '--format', '{p}',
  ]);
  const active = new Set(tree.split(/\r?\n/).filter(Boolean).map((line) => line.replace(/ \(\*\)$/, '')));
  return [...active].map((display) => {
    const match = /^(\S+) v(\S+)/.exec(display);
    if (!match) throw new Error(`Could not parse cargo tree package: ${display}`);
    const [, name, version] = match;
    if (name === 'app' && version === '1.0.0') return null;
    const pkg = metadata.packages.find((candidate) => candidate.name === name && candidate.version === version);
    if (!pkg) throw new Error(`Cargo metadata missing active package: ${name}@${version}`);
    return {
      ecosystem: 'Rust',
      name,
      version,
      license: pkg.license ?? (pkg.license_file ? 'See included license file' : 'UNDECLARED'),
      authors: (pkg.authors ?? []).join(', '),
      homepage: pkg.homepage ?? pkg.repository ?? '',
      packageDir: path.dirname(pkg.manifest_path),
    };
  }).filter(Boolean);
}

function render() {
  const packages = [...javascriptPackages(), ...rustPackages()]
    .sort((a, b) => compareText(a.ecosystem, b.ecosystem)
      || compareText(a.name, b.name)
      || compareText(a.version, b.version));
  const missingMetadata = packages.filter((pkg) => pkg.license === 'UNDECLARED');
  if (missingMetadata.length) {
    throw new Error(`Dependencies without license metadata: ${missingMetadata.map((pkg) => `${pkg.name}@${pkg.version}`).join(', ')}`);
  }

  const texts = new Map();
  const withoutLocalText = [];
  for (const pkg of packages) {
    const files = licenseFiles(pkg.packageDir);
    if (!files.length) withoutLocalText.push(`${pkg.ecosystem}: ${pkg.name}@${pkg.version} (${pkg.license})`);
    for (const file of files) {
      const content = normalize(fs.readFileSync(file, 'utf8'));
      if (!content) continue;
      const hash = sha256(content);
      const item = texts.get(hash) ?? { content, components: [] };
      item.components.push(`${pkg.name}@${pkg.version} (${path.basename(file)})`);
      texts.set(hash, item);
    }
  }

  const byLicense = new Map();
  for (const pkg of packages) byLicense.set(pkg.license, (byLicense.get(pkg.license) ?? 0) + 1);
  const lines = [
    '# Atlas 1.0 Third-Party Notices',
    '',
    'This artifact inventories third-party software incorporated into the Atlas 1.0.0 Windows x64 desktop distribution. It was generated from the locked production JavaScript dependency graph and the normal, Windows-target Rust dependency graph. Development-only dependencies and external prerequisites such as Ollama and Microsoft WebView2 Runtime are not included.',
    '',
    'Atlas itself is licensed separately under the repository `LICENSE` file. This notice is an engineering inventory and is not legal advice.',
    '',
    `Generated inventory: ${packages.filter((pkg) => pkg.ecosystem === 'JavaScript').length} JavaScript packages and ${packages.filter((pkg) => pkg.ecosystem === 'Rust').length} Rust crates.`,
    '',
    '## License summary',
    '',
    '| Declared license expression | Components |',
    '| --- | ---: |',
    ...[...byLicense.entries()].sort(([a], [b]) => compareText(a, b)).map(([license, count]) => `| ${escapeCell(license)} | ${count} |`),
    '',
    '## Shipped component inventory',
    '',
    '| Ecosystem | Component | Version | Declared license | Attribution | Project |',
    '| --- | --- | --- | --- | --- | --- |',
    ...packages.map((pkg) => `| ${pkg.ecosystem} | ${escapeCell(pkg.name)} | ${pkg.version} | ${escapeCell(pkg.license)} | ${escapeCell(pkg.authors)} | ${pkg.homepage ? `[link](${pkg.homepage})` : ''} |`),
    '',
    '## Components without a package-local license file',
    '',
    'The following components declare an SPDX license in their package metadata but do not contain a package-local license or notice file in the installed dependency cache. Their declared expressions remain recorded in the inventory above.',
    '',
    ...(withoutLocalText.length ? withoutLocalText.map((item) => `- ${item}`) : ['None.']),
    '',
    '## License and notice texts',
    '',
    'Identical texts are reproduced once and list every component that supplied that text.',
    '',
  ];

  let index = 0;
  for (const item of [...texts.values()].sort((a, b) => compareText(a.components[0], b.components[0]))) {
    index += 1;
    lines.push(
      `<details><summary>License text ${index}: ${escapeCell(item.components.slice(0, 3).join(', '))}${item.components.length > 3 ? ` and ${item.components.length - 3} more` : ''}</summary>`,
      '',
      `Components: ${item.components.map((component) => `\`${component}\``).join(', ')}`,
      '',
      '<pre>',
      item.content.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
      '</pre>',
      '',
      '</details>',
      '',
    );
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function inventoryKeys(document) {
  return new Set(
    [...document.matchAll(/^\| (JavaScript|Rust) \| ([^|]+) \| ([^|]+) \|/gm)]
      .map(([, ecosystem, name, version]) => `${ecosystem}:${name.trim()}@${version.trim()}`),
  );
}

function noticeTextGroups(document) {
  const groups = new Map();
  for (const match of document.matchAll(/<details><summary>License text \d+: ([\s\S]*?)<\/summary>[\s\S]*?<pre>\n([\s\S]*?)\n<\/pre>/g)) {
    const [, summary, text] = match;
    groups.set(sha256(normalize(text)), summary);
  }
  return groups;
}

function reportMismatch(expected, generated) {
  const expectedKeys = inventoryKeys(expected);
  const generatedKeys = inventoryKeys(generated);
  const missing = [...expectedKeys].filter((key) => !generatedKeys.has(key)).sort(compareText);
  const unexpected = [...generatedKeys].filter((key) => !expectedKeys.has(key)).sort(compareText);

  console.error(`THIRD_PARTY_NOTICES.md is missing or stale. expected=${sha256(normalize(expected))} generated=${sha256(normalize(generated))}`);
  if (missing.length || unexpected.length) {
    console.error(`Inventory difference: missing=[${missing.join(', ')}] unexpected=[${unexpected.join(', ')}]`);
  }

  const expectedGroups = noticeTextGroups(expected);
  const generatedGroups = noticeTextGroups(generated);
  const missingGroups = [...expectedGroups.keys()].filter((key) => !generatedGroups.has(key)).map((key) => expectedGroups.get(key)).sort(compareText);
  const unexpectedGroups = [...generatedGroups.keys()].filter((key) => !expectedGroups.has(key)).map((key) => generatedGroups.get(key)).sort(compareText);
  if (missingGroups.length || unexpectedGroups.length) {
    console.error(`License-text difference: missing=[${missingGroups.join(', ')}] unexpected=[${unexpectedGroups.join(', ')}]`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const generated = render();
  if (checkOnly) {
    const expected = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
    if (!expected || normalize(expected) !== normalize(generated)) {
      reportMismatch(expected, generated);
      console.error('Run pnpm notices:generate on the Windows packaging host.');
      process.exit(1);
    }
    console.log('THIRD_PARTY_NOTICES.md matches the locked Windows runtime dependency graphs.');
  } else {
    fs.writeFileSync(outputPath, generated);
    console.log(`Wrote ${path.relative(root, outputPath)}.`);
  }
}
