import fs from 'node:fs';
import path from 'node:path';
import { runSql } from './sqlEngine.js';

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

export function openDatabase(databasePath = process.env.DATABASE_PATH || './data/bi-dashboard.json') {
  const absolutePath = path.resolve(databasePath);
  const tables = initializeDatabase(absolutePath);
  return {
    path: absolutePath,
    tables,
    all(sql) {
      return runSql(tables, sql);
    },
    get(sql) {
      return runSql(tables, sql)[0] || null;
    }
  };
}

export function initializeDatabase(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  if (fs.existsSync(databasePath)) {
    const existing = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
    if (existing.sales_orders?.length && existing.marketing_spend?.length && existing.targets?.length) {
      return existing;
    }
  }

  const seeded = seedDatabase();
  fs.writeFileSync(databasePath, JSON.stringify(seeded, null, 2));
  return seeded;
}

function seedDatabase() {
  const tables = {
    sales_orders: [],
    marketing_spend: [],
    targets: []
  };
  let orderId = 1;
  let spendId = 1;
  let targetId = 1;

  for (let month = 0; month < 12; month += 1) {
    const monthDate = new Date(Date.UTC(2025, month, 1));
    regions.forEach((region, regionIndex) => {
      tables.targets.push({
        id: targetId,
        target_month: monthKey(monthDate),
        region,
        revenue_target: 105000 + month * 5500 + regionIndex * 12500
      });
      targetId += 1;
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

      tables.sales_orders.push({
        id: orderId,
        order_date: isoDate(2025, month, ((i * 3) % 27) + 1),
        region,
        channel,
        product_category,
        customer_segment,
        revenue,
        cost,
        units
      });
      orderId += 1;
    }

    channels.forEach((channel, channelIndex) => {
      tables.marketing_spend.push({
        id: spendId,
        spend_date: isoDate(2025, month, 3 + channelIndex * 5),
        channel,
        campaign: `${channel} growth ${month + 1}`,
        spend: Math.round(17000 + month * 1300 + channelIndex * 4200),
        impressions: 180000 + month * 9500 + channelIndex * 36000,
        clicks: 7200 + month * 420 + channelIndex * 1100
      });
      spendId += 1;
    });
  }

  return tables;
}
