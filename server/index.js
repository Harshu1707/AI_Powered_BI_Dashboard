import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.js';
import { generateInsight, generateSqlFromQuestion, isGeminiConfigured } from './gemini.js';
import { validateReadOnlySql } from './sqlGuard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const port = process.env.PORT || 3001;
const db = openDatabase();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return sendJson(response, 200, {
        status: 'ok',
        geminiConfigured: isGeminiConfigured(),
        database: 'sqlite',
        model: 'gemini-2.5-flash'
      });
    }

    if (url.pathname === '/api/metrics' && request.method === 'GET') {
      return sendJson(response, 200, getMetrics());
    }

    if (url.pathname === '/api/ask' && request.method === 'POST') {
      const body = await readJson(request);
      const question = String(body?.question || '').trim();
      if (!question) {
        return sendJson(response, 400, { error: 'Question is required.' });
      }

      const sql = validateReadOnlySql(await generateSqlFromQuestion(question));
      const rows = db.all(sql);
      const insight = await generateInsight({ question, sql, rows });
      return sendJson(response, 200, { question, sql, rows, insight, geminiConfigured: isGeminiConfigured() });
    }

    if (request.method === 'GET') {
      return serveStatic(url.pathname, response);
    }

    sendJson(response, 404, { error: 'Not found.' });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: error.message || 'Unexpected server error.' });
  }
});

function getMetrics() {
  const totals = db.get(`
    SELECT ROUND(SUM(revenue), 2) AS revenue, ROUND(SUM(revenue - cost), 2) AS profit, SUM(units) AS units, COUNT(*) AS orders
    FROM sales_orders
  `);
  const monthlyRevenue = db.all(`
    SELECT substr(order_date, 1, 7) AS month, ROUND(SUM(revenue), 2) AS revenue, ROUND(SUM(revenue - cost), 2) AS profit
    FROM sales_orders
    GROUP BY month
    ORDER BY month
  `);
  const revenueByRegion = db.all(`
    SELECT region, ROUND(SUM(revenue), 2) AS revenue
    FROM sales_orders
    GROUP BY region
    ORDER BY revenue DESC
  `);
  const revenueByCategory = db.all(`
    SELECT product_category AS category, ROUND(SUM(revenue), 2) AS revenue
    FROM sales_orders
    GROUP BY product_category
    ORDER BY revenue DESC
  `);
  const targetAttainment = db.all(`
    SELECT t.region,
           ROUND(SUM(s.revenue), 2) AS revenue,
           ROUND(SUM(t.revenue_target), 2) AS target,
           ROUND(SUM(s.revenue) * 100.0 / NULLIF(SUM(t.revenue_target), 0), 1) AS attainment
    FROM targets t
    LEFT JOIN sales_orders s ON s.region = t.region AND substr(s.order_date, 1, 7) = t.target_month
    GROUP BY t.region
    ORDER BY attainment DESC
  `);
  return { totals, monthlyRevenue, revenueByRegion, revenueByCategory, targetAttainment };
}

async function serveStatic(urlPath, response) {
  const safePath = urlPath === '/' ? '/index.html' : urlPath;
  const requestedPath = path.normalize(safePath).replace(/^\.{2,}/, '');
  const filePath = path.join(publicDir, requestedPath);
  if (!filePath.startsWith(publicDir)) {
    return sendJson(response, 403, { error: 'Forbidden.' });
  }

  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(data);
  } catch {
    const data = await fs.readFile(path.join(publicDir, 'index.html'));
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(data);
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy(new Error('Request body is too large.'));
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

server.listen(port, () => {
  console.log(`AI BI Dashboard listening on http://localhost:${port}`);
});
