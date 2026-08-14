/**
 * Stock lookup module — Yahoo Finance price hint (user-triggered only).
 * AGENTS.md: NEVER call automatically. Only on explicit user button press.
 * Every resolved price must be displayed with a verify link and liability note.
 *
 * Production (Vercel): delegates to /api/stock serverless proxy — no CORS issue.
 * Local dev (file://): attempts direct Yahoo Finance endpoints as a best-effort
 *   fallback; typically CORS-blocked by the browser, so manual entry is expected.
 */

/** True when running on Vercel (or any http/https origin); false for local file:// dev. */
const USE_PROXY = (typeof window !== 'undefined') && window.location?.protocol !== 'file:';

// ── Local dev fallback ──────────────────────────────────────────────────────
// Used only when USE_PROXY is false (file:// protocol).
// Yahoo Finance CORS blocks these in most browser contexts; they are retained
// solely as a best-effort convenience for local development.

const ENDPOINTS = [
  // v8/chart — full date control
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
];

/**
 * Extracts { price, currency, source_date, is_exact } from a Yahoo Finance
 * v8/chart JSON response, picking the trading day closest to targetTs.
 * @param {object} data
 * @param {number} targetTs  Unix timestamp of the requested date (midnight UTC)
 * @param {string} dateStr   Requested date string YYYY-MM-DD
 * @returns {{ price: number, currency: string, source_date: string, is_exact: boolean }|null}
 */
function extractClosest(data, targetTs, dateStr) {
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const timestamps = result.timestamp ?? [];
  const closes     = result.indicators?.quote?.[0]?.close ?? [];
  const currency   = result.meta?.currency ?? 'USD';

  if (timestamps.length === 0) return null;

  let bestIdx  = -1;
  let bestDiff = Infinity;

  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    const diff = Math.abs(timestamps[i] - targetTs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx  = i;
    }
  }

  if (bestIdx === -1) return null;

  const price       = closes[bestIdx];
  const source_date = new Date(timestamps[bestIdx] * 1000).toISOString().slice(0, 10);
  const is_exact    = source_date === dateStr;

  return { price, currency, source_date, is_exact };
}

/**
 * Direct Yahoo Finance fetch for local file:// development fallback.
 * @param {string} ticker
 * @param {string} dateStr
 * @returns {Promise<{ price: number, currency: string, source_date: string, is_exact: boolean }>}
 */
async function lookupDirect(ticker, dateStr) {
  const yahooUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}/history/`;

  const date     = new Date(dateStr + 'T00:00:00Z');
  const targetTs = Math.floor(date.getTime() / 1000);
  const p1       = targetTs - 4 * 24 * 3600;
  const p2       = targetTs + 4 * 24 * 3600;
  const range    = '5d';

  for (const buildUrl of ENDPOINTS) {
    const url        = buildUrl(ticker, p1, p2, range);
    const controller = new AbortController();
    const tid        = setTimeout(() => controller.abort(), 10_000);

    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) continue;

      const data   = await resp.json();
      const result = extractClosest(data, targetTs, dateStr);
      if (result) return result;
    } catch {
      // CORS block or network error — try next endpoint
    } finally {
      clearTimeout(tid);
    }
  }

  throw new Error('CORS_BLOCKED');
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Looks up the historical closing price for a ticker on or near a given date.
 *
 * In production (Vercel), calls the /api/stock serverless proxy.
 * In local file:// dev, attempts direct Yahoo Finance endpoints (likely CORS-blocked).
 *
 * @param {string} ticker  - Yahoo Finance ticker (e.g. 'TSCO.L', 'MSFT', 'AAPL')
 * @param {string} dateStr - ISO date string YYYY-MM-DD
 * @returns {Promise<{ price: number, currency: string, source_date: string, is_exact: boolean }>}
 * @throws {Error} On network failure or no data found
 */
export async function lookupPrice(ticker, dateStr) {
  if (USE_PROXY) {
    // Production path: serverless proxy handles Yahoo fetch server-side
    const url  = `/api/stock?ticker=${encodeURIComponent(ticker)}&date=${encodeURIComponent(dateStr)}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error ?? 'Stock lookup failed');
    }

    return data;
  }

  // Local file:// dev fallback — direct Yahoo attempt (usually CORS-blocked)
  return lookupDirect(ticker, dateStr);
}
