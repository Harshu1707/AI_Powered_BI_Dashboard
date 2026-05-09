import { allowedTables } from './schema.js';

const blockedTokens = /\b(insert|update|delete|drop|alter|create|replace|truncate|attach|detach|pragma|vacuum|reindex)\b/i;

export function normalizeSql(sql) {
  return String(sql || '')
    .replace(/```sql/gi, '')
    .replace(/```/g, '')
    .trim()
    .replace(/;$/, '');
}

export function validateReadOnlySql(sql) {
  const normalized = normalizeSql(sql);
  if (!normalized) {
    throw new Error('Gemini did not return a SQL query.');
  }

  if (!/^select\b/i.test(normalized)) {
    throw new Error('Only SELECT queries are allowed.');
  }

  if (blockedTokens.test(normalized)) {
    throw new Error('The query contains a blocked SQL keyword.');
  }

  const statements = normalized.split(';').filter(Boolean);
  if (statements.length !== 1) {
    throw new Error('Only one SQL statement can be executed.');
  }

  const referencedTables = [...normalized.matchAll(/\b(?:from|join)\s+([a-zA-Z_][\w]*)/gi)].map((match) => match[1]);
  const unknownTables = referencedTables.filter((table) => !allowedTables.includes(table));
  if (unknownTables.length > 0) {
    throw new Error(`Query references unsupported table(s): ${unknownTables.join(', ')}.`);
  }

  const limited = /\blimit\s+\d+\b/i.test(normalized) ? normalized : `${normalized} LIMIT 100`;
  return limited;
}
