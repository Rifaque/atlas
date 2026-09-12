import fs from 'node:fs';

const root = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const desktop = JSON.parse(fs.readFileSync('apps/desktop/package.json', 'utf8'));
const tauri = JSON.parse(fs.readFileSync('apps/desktop/src-tauri/tauri.conf.json', 'utf8'));
const cargo = fs.readFileSync('apps/desktop/src-tauri/Cargo.toml', 'utf8');
const cargoLock = fs.readFileSync('apps/desktop/src-tauri/Cargo.lock', 'utf8');
const settings = fs.readFileSync('apps/desktop/src/components/SettingsModal.tsx', 'utf8');
const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');

const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const cargoLockVersion = cargoLock.match(/\[\[package\]\]\s*\r?\nname = "app"\s*\r?\nversion = "([^"]+)"/)?.[1];
const expected = root.version;
const expectedFlag = process.argv.indexOf('--expected');
const releaseVersion = expectedFlag >= 0 ? process.argv[expectedFlag + 1] : undefined;
const versions = {
  'root package': root.version,
  'desktop package': desktop.version,
  'Cargo package': cargoVersion,
  'Cargo lockfile': cargoLockVersion,
  'Tauri configuration': tauri.version,
};

const failures = Object.entries(versions)
  .filter(([, version]) => version !== expected)
  .map(([name, version]) => `${name}: expected ${expected}, found ${version ?? 'missing'}`);

if (!settings.includes(`Atlas ${expected}`)) {
  failures.push(`Settings UI: expected Atlas ${expected}`);
}
if (!changelog.includes(`## [${expected}]`)) {
  failures.push(`CHANGELOG.md: missing ${expected} release heading`);
}
if (releaseVersion && releaseVersion !== expected) {
  failures.push(`release tag: expected ${expected}, found ${releaseVersion}`);
}

if (failures.length) {
  console.error(`Atlas version metadata is inconsistent:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Atlas version metadata is consistent at ${expected}.`);
