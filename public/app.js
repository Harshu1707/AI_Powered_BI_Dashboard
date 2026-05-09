import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@19.2.1';
import { createRoot } from 'https://esm.sh/react-dom@19.2.1/client';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'https://esm.sh/recharts@3.5.0?external=react,react-dom';

const h = React.createElement;
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat('en-US');
const palette = ['#7c3aed', '#06b6d4', '#22c55e', '#f97316', '#e11d48'];

function formatMetric(value, type = 'number') {
  if (type === 'currency') return currencyFormatter.format(value || 0);
  if (type === 'percent') return `${Number(value || 0).toFixed(1)}%`;
  return numberFormatter.format(value || 0);
}

function Icon({ label }) {
  const icons = { Revenue: '📈', Profit: '✨', 'Units Sold': '🎯', Orders: '🗄️' };
  return h('span', { className: 'icon', 'aria-hidden': true }, icons[label] || '🤖');
}

function App() {
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [question, setQuestion] = useState('Show monthly revenue and profit trends');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/metrics').then((response) => response.json()),
      fetch('/api/health').then((response) => response.json())
    ])
      .then(([metricsPayload, healthPayload]) => {
        setMetrics(metricsPayload);
        setHealth(healthPayload);
      })
      .catch(() => setError('Unable to load dashboard data. Is the API server running?'));
  }, []);

  const cards = useMemo(() => {
    if (!metrics) return [];
    return [
      { label: 'Revenue', value: formatMetric(metrics.totals.revenue, 'currency') },
      { label: 'Profit', value: formatMetric(metrics.totals.profit, 'currency') },
      { label: 'Units Sold', value: formatMetric(metrics.totals.units) },
      { label: 'Orders', value: formatMetric(metrics.totals.orders) }
    ];
  }, [metrics]);

  async function askGemini(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setAnswer(null);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Gemini request failed.');
      setAnswer(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return h('main', { className: 'app-shell' },
    h('section', { className: 'hero panel' },
      h('div', null,
        h('p', { className: 'eyebrow' }, '🤖 Gemini 2.5 Flash + SQL'),
        h('h1', null, 'AI Powered BI Dashboard'),
        h('p', { className: 'hero-copy' }, 'Ask business questions in plain English, let Gemini generate safe SQLite queries, and explore executive-ready charts from a seeded analytics warehouse.')
      ),
      h('div', { className: 'status-card' },
        h('span', null, 'AI Model'),
        h('strong', null, health?.model || 'gemini-2.5-flash'),
        h('small', { className: health?.geminiConfigured ? 'ready' : 'warning' }, health?.geminiConfigured ? 'Gemini API connected' : 'Using fallback until GEMINI_API_KEY is set')
      )
    ),
    error && h('div', { className: 'error-banner' }, error),
    h('section', { className: 'metric-grid' }, cards.map((card) => h('article', { className: 'metric-card panel', key: card.label }, h(Icon, { label: card.label }), h('span', null, card.label), h('strong', null, card.value)))),
    h('section', { className: 'dashboard-grid' },
      h('article', { className: 'panel chart-card wide' },
        h('h2', null, 'Revenue and profit trend'),
        h(ResponsiveContainer, { width: '100%', height: 320 },
          h(AreaChart, { data: metrics?.monthlyRevenue || [] },
            h('defs', null, h('linearGradient', { id: 'revenue', x1: '0', y1: '0', x2: '0', y2: '1' }, h('stop', { offset: '5%', stopColor: '#7c3aed', stopOpacity: 0.45 }), h('stop', { offset: '95%', stopColor: '#7c3aed', stopOpacity: 0 }))),
            h(CartesianGrid, { strokeDasharray: '3 3', stroke: '#243047' }),
            h(XAxis, { dataKey: 'month', stroke: '#94a3b8' }),
            h(YAxis, { stroke: '#94a3b8', tickFormatter: (value) => `$${Math.round(value / 1000)}k` }),
            h(Tooltip, { formatter: (value) => currencyFormatter.format(value), contentStyle: { background: '#111827', border: '1px solid #334155' } }),
            h(Legend),
            h(Area, { type: 'monotone', dataKey: 'revenue', stroke: '#8b5cf6', fill: 'url(#revenue)', strokeWidth: 3 }),
            h(Area, { type: 'monotone', dataKey: 'profit', stroke: '#22c55e', fill: '#22c55e22', strokeWidth: 3 })
          )
        )
      ),
      h('article', { className: 'panel chart-card' },
        h('h2', null, 'Revenue by region'),
        h(ResponsiveContainer, { width: '100%', height: 280 },
          h(BarChart, { data: metrics?.revenueByRegion || [] },
            h(CartesianGrid, { strokeDasharray: '3 3', stroke: '#243047' }),
            h(XAxis, { dataKey: 'region', stroke: '#94a3b8', tick: { fontSize: 11 } }),
            h(YAxis, { stroke: '#94a3b8', tickFormatter: (value) => `$${Math.round(value / 1000)}k` }),
            h(Tooltip, { formatter: (value) => currencyFormatter.format(value), contentStyle: { background: '#111827', border: '1px solid #334155' } }),
            h(Bar, { dataKey: 'revenue', radius: [10, 10, 0, 0], fill: '#06b6d4' })
          )
        )
      ),
      h('article', { className: 'panel chart-card' },
        h('h2', null, 'Category mix'),
        h(ResponsiveContainer, { width: '100%', height: 280 },
          h(PieChart, null,
            h(Pie, { data: metrics?.revenueByCategory || [], dataKey: 'revenue', nameKey: 'category', innerRadius: 58, outerRadius: 100, paddingAngle: 4 }, (metrics?.revenueByCategory || []).map((entry, index) => h(Cell, { key: entry.category, fill: palette[index % palette.length] }))),
            h(Tooltip, { formatter: (value) => currencyFormatter.format(value), contentStyle: { background: '#111827', border: '1px solid #334155' } }),
            h(Legend)
          )
        )
      )
    ),
    h('section', { className: 'panel ai-panel' },
      h('div', { className: 'section-heading' }, h('div', null, h('p', { className: 'eyebrow' }, '✨ Ask your data'), h('h2', null, 'Natural language SQL analyst')), h('span', null, 'SQLite warehouse')),
      h('form', { onSubmit: askGemini, className: 'ask-form' }, h('input', { value: question, onChange: (event) => setQuestion(event.target.value), placeholder: 'Ask about revenue, region performance, marketing ROI...' }), h('button', { type: 'submit', disabled: loading }, loading ? 'Thinking...' : '➤ Ask Gemini')),
      answer && h('div', { className: 'answer-grid' },
        h('div', null, h('h3', null, 'Insight'), h('p', { className: 'insight' }, answer.insight), h('h3', null, 'Generated SQL'), h('pre', null, answer.sql)),
        h('div', { className: 'table-wrap' }, h('h3', null, 'Result rows'), h('table', null,
          h('thead', null, h('tr', null, Object.keys(answer.rows[0] || {}).map((key) => h('th', { key }, key)))),
          h('tbody', null, answer.rows.map((row, index) => h('tr', { key: index }, Object.values(row).map((value, cellIndex) => h('td', { key: cellIndex }, String(value))))))
        ))
      )
    )
  );
}

createRoot(document.getElementById('root')).render(h(App));
