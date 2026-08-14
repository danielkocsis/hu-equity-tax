/**
 * Vercel serverless function — Yahoo Finance stock price proxy.
 * Solves the browser CORS block by fetching Yahoo Finance server-side.
 *
 * Route:  GET /api/stock?ticker=TSCO.L&date=2024-01-15
 * Returns: { price, currency, source_date, is_exact }
 *
 * Zero npm dependencies — Node 20 built-in fetch() only.
 * AGENTS.md constraint: no require(), no npm packages.
 */

const TICKER_RE = /^[A-Z0-9.^=-]{1,12}$/i;
const DATE_RE   = /^\d{4}-\d{2}-\d{2}$/;

/** Hard timeout in ms — leaves headroom for cold start + two sequential Yahoo fetches. */
const TIMEOUT_MS = 9_000;

/**
 * Builds a Yahoo Finance v8/chart URL for the given host, ticker, and ±4-day window.
 * @param {string} host   - 'query1' or 'query2'
 * @param {string} ticker
 * @param {number} p1     - Unix timestamp: target date minus 4 days
 * @param {number} p2     - Unix timestamp: target date plus 4 days
 * @returns {string}
 */
function buildUrl(host, ticker, p1, p2) {
  return (
    `https://${host}.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(ticker)}` +
    `?interval=1d&period1=${p1}&period2=${p2}&includePrePost=false`
  );
}

/**
 * Fetches Yahoo Finance data from the given URL with a shared AbortSignal.
 * Returns parsed JSON or null on network / non-200 error.
 * @param {string} url
 * @param {AbortSignal} signal
 * @returns {Promise<object|null>}
 */
async function fetchYahoo(url, signal) {
  try {
    const resp = await fetch(url, { signal });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (err) {
    if (err.name === 'AbortError') throw err; // propagate timeout to outer handler
    return null;
  }
}

/**
 * Extracts { price, currency, source_date, is_exact } from a Yahoo Finance
 * v8/chart JSON response, picking the trading day closest to targetTs.
 * Returns null if no usable data is found.
 * @param {object} data        - Parsed Yahoo Finance JSON
 * @param {number} targetTs    - Unix timestamp of the requested date (midnight UTC)
 * @param {string} dateStr     - Requested date string YYYY-MM-DD
 * @returns {{ price: number, currency: string, source_date: string, is_exact: boolean }|null}
 */
function extractClosest(data, targetTs, dateStr) {
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const timestamps = result.timestamp ?? [];
  const closes     = result.indicators?.quote?.[0]?.close ?? [];
  const currency   = result.meta?.currency ?? 'USD';

  if (timestamps.length === 0) return null;

  // Find the index with minimum |timestamp − target| where close is non-null
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
 * Vercel serverless handler.
 * @param {import('@vercel/node').VercelRequest}  req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {
  // CORS headers on every response (including errors and OPTIONS)
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { ticker, date } = req.query;

  // Validate ticker
  if (!ticker || !TICKER_RE.test(ticker)) {
    return res.status(400).json({ error: 'Invalid ticker. Expected 1–12 alphanumeric characters (e.g. AAPL, TSCO.L).' });
  }

  // Validate date
  if (!date || !DATE_RE.test(date)) {
    return res.status(400).json({ error: 'Invalid date. Expected YYYY-MM-DD format.' });
  }

  // Build ±4-day window
  const targetDate = new Date(date + 'T00:00:00Z');
  if (isNaN(targetDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date value.' });
  }

  const targetTs = Math.floor(targetDate.getTime() / 1000);
  const p1       = targetTs - 4 * 24 * 3600;
  const p2       = targetTs + 4 * 24 * 3600;

  // Shared abort controller for the 9s hard timeout
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Attempt query2 first, fall back to query1 on failure
    for (const host of ['query2', 'query1']) {
      const url  = buildUrl(host, ticker, p1, p2);
      const data = await fetchYahoo(url, controller.signal);

      if (data) {
        const result = extractClosest(data, targetTs, date);
        if (result) {
          return res.status(200).json(result);
        }
      }
    }

    // Both hosts returned no usable data
    return res.status(404).json({
      error: `No price data found for ticker "${ticker}" around ${date}. ` +
             `Verify manually: https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}/history/`,
    });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Yahoo Finance request timed out. Please try again.' });
    }
    return res.status(502).json({ error: 'Failed to fetch data from Yahoo Finance. Please try again.' });
  } finally {
    clearTimeout(timeoutId);
  }
}
