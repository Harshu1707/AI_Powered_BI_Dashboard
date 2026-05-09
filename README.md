# AI Powered BI Dashboard

A full-stack business intelligence dashboard that combines **React**, **SQLite**, and the **Gemini 2.5 Flash API**. The app ships with a seeded SQL analytics warehouse, executive charts, and a natural-language question box that asks Gemini to generate safe read-only SQL.

## Features

- React dashboard with KPI cards, revenue trends, region bars, and category mix charts.
- Node.js API backed by SQLite through the local `sqlite3` command-line engine.
- Gemini model integration using the Google Generative Language REST API with `gemini-2.5-flash`.
- SQL guardrails that allow only single-statement `SELECT` queries against approved BI tables.
- Deterministic fallback SQL when `GEMINI_API_KEY` is not configured, so the project works immediately.

## Tech stack

- Frontend: React and Recharts loaded as browser ES modules
- Backend: Node.js built-in HTTP server
- AI: Google Gemini API (`gemini-2.5-flash`)
- SQL database: SQLite

## Getting started

```bash
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key
npm run dev
```

Open the app and API at <http://localhost:3001>.

## Environment variables

| Variable | Description |
| --- | --- |
| `GEMINI_API_KEY` | Google AI Studio API key used by Gemini 2.5 Flash. If omitted, fallback SQL is used. |
| `PORT` | Dashboard and API port. Defaults to `3001`. |
| `DATABASE_PATH` | SQLite database path. Defaults to `./data/bi-dashboard.db`. |

## Useful commands

```bash
npm run dev      # Run the dashboard and API
npm start        # Run the dashboard and API
npm test         # Run Node tests
```

## Notes

The frontend imports React and Recharts as browser ES modules, so no package download is required for the committed source. The application still needs internet access in the browser the first time those modules are loaded from the CDN.

## API endpoints

- `GET /api/health` - Server status, Gemini configuration, and model name.
- `GET /api/metrics` - Dashboard-ready KPIs and chart series.
- `POST /api/ask` - Converts a natural-language BI question to SQL, runs it, and returns rows plus an insight.

Example body for `/api/ask`:

```json
{
  "question": "Which region generated the most revenue?"
}
```

## Data model

The seeded SQLite warehouse contains:

- `sales_orders` for revenue, cost, units, region, channel, category, and segment.
- `marketing_spend` for campaign spend, impressions, and clicks.
- `targets` for monthly revenue targets by region.
