import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openDatabase } from '../server/database.js';

test('starts and queries without a system sqlite3 executable', () => {
  const databasePath = path.join(os.tmpdir(), `bi-dashboard-${process.pid}-${Date.now()}.json`);
  try {
    const db = openDatabase(databasePath);
    const totals = db.get('SELECT ROUND(SUM(revenue), 2) AS revenue, ROUND(SUM(revenue - cost), 2) AS profit, SUM(units) AS units, COUNT(*) AS orders FROM sales_orders');
    const monthlyRows = db.all('SELECT substr(order_date, 1, 7) AS month, ROUND(SUM(revenue), 2) AS revenue, ROUND(SUM(revenue - cost), 2) AS profit FROM sales_orders GROUP BY month ORDER BY month');

    assert.equal(totals.orders, 408);
    assert.equal(monthlyRows.length, 12);
    assert.equal(monthlyRows[0].month, '2025-01');
    assert.equal(fs.existsSync(databasePath), true);
  } finally {
    fs.rmSync(databasePath, { force: true });
  }
});
