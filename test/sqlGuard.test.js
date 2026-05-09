import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSql, validateReadOnlySql } from '../server/sqlGuard.js';

test('normalizes markdown fenced SQL', () => {
  assert.equal(normalizeSql('```sql\nSELECT * FROM sales_orders;\n```'), 'SELECT * FROM sales_orders');
});

test('adds a limit to safe select statements', () => {
  assert.equal(validateReadOnlySql('SELECT region FROM sales_orders'), 'SELECT region FROM sales_orders LIMIT 100');
});

test('rejects mutating statements', () => {
  assert.throws(() => validateReadOnlySql('DROP TABLE sales_orders'), /Only SELECT/);
  assert.throws(() => validateReadOnlySql('SELECT * FROM sales_orders; DELETE FROM sales_orders'), /blocked SQL keyword/);
});

test('rejects unknown tables', () => {
  assert.throws(() => validateReadOnlySql('SELECT * FROM users'), /unsupported table/);
});
