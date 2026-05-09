import { schemaDescription } from './schema.js';
import { normalizeSql, validateReadOnlySql } from './sqlGuard.js';

const model = 'gemini-2.5-flash';
const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function generateSqlFromQuestion(question) {
  if (!isGeminiConfigured()) {
    return fallbackSql(question);
  }

  const prompt = `You are a senior BI analyst. Convert the user's business question into one safe SQLite SELECT query.

Rules:
- Use only the tables and columns in this schema.
- Return SQL only. No prose and no markdown.
- Never modify data.
- Prefer aliases that are readable in a BI dashboard.
- Include a LIMIT when the result may return detailed rows.
- Supported GROUP BY dimensions are month via substr(order_date, 1, 7), region, product_category, channel, and customer_segment.
- Avoid WHERE, CTEs, window functions, and nested subqueries in this demo project.

Schema:
${schemaDescription}

Question: ${question}`;

  const text = await callGemini(prompt, { temperature: 0.1, maxOutputTokens: 512 });

  return validateReadOnlySql(normalizeSql(text));
}

export async function generateInsight({ question, sql, rows }) {
  if (!isGeminiConfigured()) {
    return 'Gemini API key is not configured, so this dashboard used a deterministic sample SQL answer. Add GEMINI_API_KEY to enable AI-generated SQL and narrative insights.';
  }

  const prompt = `Summarize the BI result for an executive in 3 concise bullets.
Question: ${question}
SQL: ${sql}
Rows JSON: ${JSON.stringify(rows).slice(0, 12000)}`;

  return callGemini(prompt, { temperature: 0.3, maxOutputTokens: 280 });
}


async function callGemini(prompt, { temperature, maxOutputTokens }) {
  const response = await fetch(`${geminiEndpoint}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || 'Gemini API request failed.';
    throw new Error(message);
  }

  return payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || '';
}

function fallbackSql(question) {
  const normalizedQuestion = String(question).toLowerCase();

  if (normalizedQuestion.includes('region')) {
    return validateReadOnlySql(`
      SELECT region, ROUND(SUM(revenue), 2) AS revenue, ROUND(SUM(revenue - cost), 2) AS profit, SUM(units) AS units
      FROM sales_orders
      GROUP BY region
      ORDER BY revenue DESC
    `);
  }

  if (normalizedQuestion.includes('marketing') || normalizedQuestion.includes('spend') || normalizedQuestion.includes('roi')) {
    return validateReadOnlySql(`
      SELECT m.channel, ROUND(SUM(m.spend), 2) AS spend, SUM(m.clicks) AS clicks,
             ROUND(SUM(s.revenue) / NULLIF(SUM(m.spend), 0), 2) AS revenue_to_spend
      FROM marketing_spend m
      LEFT JOIN sales_orders s ON s.channel = m.channel AND substr(s.order_date, 1, 7) = substr(m.spend_date, 1, 7)
      GROUP BY m.channel
      ORDER BY revenue_to_spend DESC
    `);
  }

  return validateReadOnlySql(`
    SELECT substr(order_date, 1, 7) AS month, ROUND(SUM(revenue), 2) AS revenue, ROUND(SUM(revenue - cost), 2) AS profit, SUM(units) AS units
    FROM sales_orders
    GROUP BY month
    ORDER BY month
  `);
}
