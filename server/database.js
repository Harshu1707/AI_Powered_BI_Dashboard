import fs from 'node:fs';
import path from 'node:path';
import { executeSqlScript, runSql } from './sqlite.js';

const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America'];
const channels = ['Direct', 'Partner', 'Marketplace', 'Paid Search', 'Social'];
const categories = ['Analytics Suite', 'Data Connectors', 'AI Insights', 'Governance', 'Automation'];
const segments = ['Enterprise', 'Mid-Market', 'SMB'];

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

function isoDate(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function quote(value) {
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function openDatabase(databasePath = process.env.DATABASE_PATH || './data/bi-dashboard.db') {
  const absolutePath = path.resolve(databasePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  initializeDatabase(absolutePath);
  return {
    path: absolutePath,
    all(sql) {
      return runSql(absolutePath, sql);
    },
    get(sql) {
      return runSql(absolutePath, sql)[0] || null;
    }
  };
}

export function initializeDatabase(databasePath) {
  executeSqlScript(databasePath, `
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sales_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_date TEXT NOT NULL,
      region TEXT NOT NULL,
      channel TEXT NOT NULL,
      product_category TEXT NOT NULL,
      customer_segment TEXT NOT NULL,
      revenue REAL NOT NULL,
      cost REAL NOT NULL,
      units INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS marketing_spend (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spend_date TEXT NOT NULL,
      channel TEXT NOT NULL,
      campaign TEXT NOT NULL,
      spend REAL NOT NULL,
      impressions INTEGER NOT NULL,
      clicks INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_month TEXT NOT NULL,
      region TEXT NOT NULL,
      revenue_target REAL NOT NULL
    );
  `);

  const existingRows = runSql(databasePath, 'SELECT COUNT(*) AS count FROM sales_orders')[0].count;
  if (existingRows === 0) {
    seedDatabase(databasePath);
  }
}

function seedDatabase(databasePath) {
  const statements = ['BEGIN TRANSACTION;'];

  for (let month = 0; month < 12; month += 1) {
    const monthDate = new Date(Date.UTC(2025, month, 1));
    regions.forEach((region, regionIndex) => {
      statements.push(`INSERT INTO targets (target_month, region, revenue_target) VALUES (${quote(monthKey(monthDate))}, ${quote(region)}, ${105000 + month * 5500 + regionIndex * 12500});`);
    });

    for (let i = 1; i <= 34; i += 1) {
      const region = regions[(i + month) % regions.length];
      const channel = channels[(i * 2 + month) % channels.length];
      const product_category = categories[(i + region.length + month) % categories.length];
      const customer_segment = segments[(i + month) % segments.length];
      const units = 8 + ((i * 7 + month) % 58);
      const unitPrice = 1150 + categories.indexOf(product_category) * 320 + segments.indexOf(customer_segment) * 180;
      const seasonalLift = 1 + month * 0.025;
      const revenue = Math.round(units * unitPrice * seasonalLift);
      const cost = Math.round(revenue * (0.42 + ((i + month) % 5) * 0.025));

      statements.push(`INSERT INTO sales_orders (order_date, region, channel, product_category, customer_segment, revenue, cost, units) VALUES (${[
        isoDate(2025, month, ((i * 3) % 27) + 1), region, channel, product_category, customer_segment, revenue, cost, units
      ].map(quote).join(', ')});`);
    }

    channels.forEach((channel, channelIndex) => {
      statements.push(`INSERT INTO marketing_spend (spend_date, channel, campaign, spend, impressions, clicks) VALUES (${[
        isoDate(2025, month, 3 + channelIndex * 5), channel, `${channel} growth ${month + 1}`, Math.round(17000 + month * 1300 + channelIndex * 4200), 180000 + month * 9500 + channelIndex * 36000, 7200 + month * 420 + channelIndex * 1100
      ].map(quote).join(', ')});`);
    });
  }

  statements.push('COMMIT;');
  executeSqlScript(databasePath, statements.join('\n'));
}
