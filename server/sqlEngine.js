function round(value, digits = 2) {
  return Number((value || 0).toFixed(digits));
}

function monthFromDate(value) {
  return String(value).slice(0, 7);
}

function normalize(sql) {
  return String(sql || '').replace(/\s+/g, ' ').trim().replace(/;$/, '').toLowerCase();
}

function sortRows(rows, sql) {
  const normalized = normalize(sql);
  const orderMatch = normalized.match(/order by\s+([\w.]+)(?:\s+(asc|desc))?/i);
  if (!orderMatch) return rows;

  const [, orderColumn, direction = 'asc'] = orderMatch;
  const column = orderColumn.includes('.') ? orderColumn.split('.').pop() : orderColumn;
  return [...rows].sort((left, right) => {
    const leftValue = left[column];
    const rightValue = right[column];
    const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue));
    return direction.toLowerCase() === 'desc' ? comparison * -1 : comparison;
  });
}

function applyLimit(rows, sql) {
  const limitMatch = normalize(sql).match(/\blimit\s+(\d+)\b/i);
  return limitMatch ? rows.slice(0, Number(limitMatch[1])) : rows;
}

function groupBy(rows, keySelector) {
  return rows.reduce((groups, row) => {
    const key = keySelector(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
    return groups;
  }, new Map());
}

function aggregateSalesRows(rows) {
  return {
    revenue: round(rows.reduce((total, row) => total + row.revenue, 0)),
    profit: round(rows.reduce((total, row) => total + row.revenue - row.cost, 0)),
    units: rows.reduce((total, row) => total + row.units, 0),
    orders: rows.length
  };
}

function salesGroupQuery(tables, sql, keyName, keySelector) {
  const grouped = groupBy(tables.sales_orders, keySelector);
  const rows = [...grouped.entries()].map(([key, records]) => ({
    [keyName]: key,
    ...aggregateSalesRows(records)
  }));
  return applyLimit(sortRows(rows, sql), sql);
}

function targetAttainmentQuery(tables, sql) {
  const rows = [...groupBy(tables.targets, (row) => row.region).entries()].map(([region, targets]) => {
    const revenue = tables.sales_orders
      .filter((order) => order.region === region)
      .reduce((total, order) => total + order.revenue, 0);
    const target = targets.reduce((total, row) => total + row.revenue_target, 0);
    return {
      region,
      revenue: round(revenue),
      target: round(target),
      attainment: round((revenue * 100) / target, 1)
    };
  });
  return applyLimit(sortRows(rows, sql), sql);
}

function marketingRoiQuery(tables, sql) {
  const rows = [...groupBy(tables.marketing_spend, (row) => row.channel).entries()].map(([channel, spendRows]) => {
    const spend = spendRows.reduce((total, row) => total + row.spend, 0);
    const clicks = spendRows.reduce((total, row) => total + row.clicks, 0);
    const revenue = tables.sales_orders
      .filter((order) => order.channel === channel)
      .reduce((total, order) => total + order.revenue, 0);
    return {
      channel,
      spend: round(spend),
      clicks,
      revenue_to_spend: round(revenue / spend)
    };
  });
  return applyLimit(sortRows(rows, sql), sql);
}

export function runSql(tables, sql) {
  const normalized = normalize(sql);

  if (normalized.includes('from targets') && normalized.includes('join sales_orders')) {
    return targetAttainmentQuery(tables, sql);
  }

  if (normalized.includes('from marketing_spend') && normalized.includes('join sales_orders')) {
    return marketingRoiQuery(tables, sql);
  }

  if (normalized.includes('from sales_orders')) {
    if (normalized.includes('group by month') || normalized.includes('group by substr(order_date')) {
      return salesGroupQuery(tables, sql, 'month', (row) => monthFromDate(row.order_date));
    }
    if (normalized.includes('group by region')) {
      return salesGroupQuery(tables, sql, 'region', (row) => row.region);
    }
    if (normalized.includes('group by product_category')) {
      return salesGroupQuery(tables, sql, 'category', (row) => row.product_category).map(({ category, revenue }) => ({ category, revenue }));
    }
    if (normalized.includes('group by channel')) {
      return salesGroupQuery(tables, sql, 'channel', (row) => row.channel);
    }
    if (normalized.includes('group by customer_segment')) {
      return salesGroupQuery(tables, sql, 'customer_segment', (row) => row.customer_segment);
    }
    if (normalized.includes('count(*)') || normalized.includes('sum(revenue)')) {
      return [aggregateSalesRows(tables.sales_orders)];
    }
    return applyLimit(sortRows(tables.sales_orders, sql), sql);
  }

  if (normalized.includes('from marketing_spend') && normalized.includes('group by channel')) {
    const rows = [...groupBy(tables.marketing_spend, (row) => row.channel).entries()].map(([channel, records]) => ({
      channel,
      spend: round(records.reduce((total, row) => total + row.spend, 0)),
      impressions: records.reduce((total, row) => total + row.impressions, 0),
      clicks: records.reduce((total, row) => total + row.clicks, 0)
    }));
    return applyLimit(sortRows(rows, sql), sql);
  }

  throw new Error('This SQL shape is not supported by the embedded analytics engine. Try grouping sales by month, region, product_category, channel, or customer_segment.');
}
