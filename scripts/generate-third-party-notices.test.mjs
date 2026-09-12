import assert from 'node:assert/strict';
import test from 'node:test';
import { compareText } from './generate-third-party-notices.mjs';

test('notice ordering uses stable code-unit comparison instead of locale-sensitive collation', () => {
  const values = ['zeta', 'Alpha', 'alpha', 'äther', 'Beta'];
  assert.deepEqual([...values].sort(compareText), ['Alpha', 'Beta', 'alpha', 'zeta', 'äther']);
  assert.equal(compareText('same', 'same'), 0);
});
