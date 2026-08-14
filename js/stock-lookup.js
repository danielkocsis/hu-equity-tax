/**
 * Stock lookup module — Yahoo Finance price hint (user-triggered only).
 * AGENTS.md: NEVER call automatically. Only on explicit user button press.
 * Every resolved price must be displayed with a verify link and liability note.
 *
 * ⚠️  BROWSER CORS CONSTRAINT
 * Yahoo Finance query endpoints do not emit Access-Control-Allow-Origin headers.
 * All four Yahoo hosts (query1/query2 × v8/chart + v7/spark) return data from
 * Node/curl but are blocked by the browser before the request is even sent.
 * Public CORS proxies (corsproxy.io, allorigins.win) also block Yahoo Finance.
 *
 * This module makes a best-effort attempt and throws when all paths fail, so
 * the UI can surface the direct Yahoo Finance link for manual lookup.
 *
 * A server-side solution (GitHub Action pre-fetching known tickers) would be
 * needed for reliable programmatic price retrieval in a zero-server SPA.
 */

const ENDPOINTS = [
  // v8/chart — full date control; blocked by CORS in browser, kept for forward-compat
  (ticker, p1, p2) =>
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?interval=1d&period1=${p1}&period2=${p2}&includePrePost=false`,
  (ticker, p1, p2) =>
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?interval=1d&period1=${p1}&period2=${p2}&includePrePost=false`,
  // v7/spark — broader CORS support observed in some browser contexts
  (ticker, _p1, _p2, range) =>
    `https://query1.finance.yahoo.com/v7/finance/spark` +
    `?symbols=${encodeURIComponent(ticker)}&range=${range}&interval=1d`,
  (ticker, _p1, _p2, range) =>
    `https://query2.finance.yahoo.com/v7/finance/spark` +
    `?symbols=${encodeURIComponent(ticker)}&range=${range}&interval=1d`,
];

/**
 * Picks the closest trading day to targetTs from parallel timestamp/close arrays.
 * @param {number[]} timestamps
 * @param {number[]} closes
 * @param {number}   targetTs  - Unix seconds
 * @param {string}   dateStr
 * @returns {{ price: number, source_date: string, is_exact: boolean } | null}
 */
function pickClosest(timestamps, closes, targetTs, dateStr) {
  let bestIdx = -1;
  let bestDelta = Infinity;
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    const delta = Math.abs(timestamps[i] - targetTs);
    if (delta < bestDelta) { bestDelta = delta; bestIdx = i; }
  }
  if (bestIdx === -1) return null;
  const source_date = new Date(timestamps[bestIdx] * 1000).toISOString().slice(0, 10);
  return {
    price: Math.round(closes[bestIdx] * 10000) / 10000,
    source_date,
    is_exact: source_date === dateStr,
  };
}

/**
 * Looks up the historical closing price for a ticker on or near a given date.
 *
 * @param {string} ticker  - Yahoo Finance ticker (e.g. 'TSCO.L', 'MSFT', 'AAPL')
 * @param {string} dateStr - ISO date string YYYY-MM-DD
 * @returns {Promise<{ price: number, currency: string, source_date: string, is_exact: boolean }>}
 * @throws {Error} When all endpoints fail (typically CORS-blocked in browser)
 */
export async function lookupPrice(ticker, dateStr) {
  const targetTs = Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 1000);
  const period1  = targetTs - 4 * 86400;
  const period2  = targetTs + 4 * 86400;

  const daysAgo = Math.ceil((Date.now() / 1000 - targetTs) / 86400);
  const range =
    daysAgo <= 5    ? '5d'  :
    daysAgo <= 30   ? '1mo' :
    daysAgo <= 90   ? '3mo' :
    daysAgo <= 180  ? '6mo' :
    daysAgo <= 365  ? '1y'  :
    daysAgo <= 730  ? '2y'  :
    daysAgo <= 1825 ? '5y'  : 'max';

  for (const buildUrl of ENDPOINTS) {
    const url = buildUrl(ticker, period1, period2, range);
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    let data = null;

    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      if (resp.ok) data = await resp.json();
    } catch {
      // CORS block or network error — try next endpoint
    } finally {
      clearTimeout(tid);
    }

    if (!data) continue;

    // v8/chart shape: data.chart.result[0]
    const chartResult = data?.chart?.result?.[0];
    if (chartResult) {
      const found = pickClosest(
        chartResult.timestamp ?? [],
        chartResult.indicators?.quote?.[0]?.close ?? [],
        targetTs, dateStr,
      );
      if (found) return { ...found, currency: chartResult.meta?.currency ?? 'USD' };
    }

    // v7/spark shape: data.spark.result[0].response[0]
    const sparkResult = data?.spark?.result?.[0]?.response?.[0];
    if (sparkResult) {
      const found = pickClosest(
        sparkResult.timestamp ?? [],
        sparkResult.indicators?.quote?.[0]?.close ?? [],
        targetTs, dateStr,
      );
      if (found) return { ...found, currency: sparkResult.meta?.currency ?? 'USD' };
    }
  }

  throw new Error('CORS_BLOCKED');
}
