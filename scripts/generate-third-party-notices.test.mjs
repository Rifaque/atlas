import assert from 'node:assert/strict';
import test from 'node:test';
import { compareText, dedupeNoticePackages } from './generate-third-party-notices.mjs';

test('notice ordering uses stable code-unit comparison instead of locale-sensitive collation', () => {
  const values = ['zeta', 'Alpha', 'alpha', 'äther', 'Beta'];
  assert.deepEqual([...values].sort(compareText), ['Alpha', 'Beta', 'alpha', 'zeta', 'äther']);
  assert.equal(compareText('same', 'same'), 0);
});

test('notice inventory deduplicates source-qualified Cargo tree entries by public component identity', () => {
  const packages = dedupeNoticePackages([
    { ecosystem: 'Rust', name: 'same-crate', version: '1.2.3', source: 'registry-a' },
    { ecosystem: 'Rust', name: 'same-crate', version: '1.2.3', source: 'registry-b' },
    { ecosystem: 'Rust', name: 'other-crate', version: '1.2.3', source: 'registry-a' },
  ]);
  assert.deepEqual(packages.map(({ name, version }) => `${name}@${version}`), ['same-crate@1.2.3', 'other-crate@1.2.3']);
});
