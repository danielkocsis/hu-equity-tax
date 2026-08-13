/**
 * Stock lookup module — Yahoo Finance unofficial API price hint.
 * AGENTS.md: NEVER call automatically. Only on explicit user action.
 * Every resolved price must be shown as a hint with a verify link and liability note.
 */

/**
 * Looks up the historical closing price for a ticker on or near a given date.
 * Uses Yahoo Finance unofficial API — convenience only, not authoritative.
 *
 * @param {string} ticker - Stock ticker symbol (e.g. 'TSCO.L', 'MSFT')
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {Promise<{price: number, currency: string, source_date: string, is_exact: boolean}>}
 * @throws {Error} On network failure or invalid ticker; message includes Yahoo Finance direct URL
 */
export async function lookupPrice(ticker, dateStr) {
  const yahooUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}/history/`;

  const date = new Date(dateStr + 'T00:00:00Z');
  const period1 = Math.floor(date.getTime() / 1000);
  // Look ahead 3 days to handle weekends/holidays
  const period2 = period1 + 3 * 24 * 3600;

  const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${period1}&period2=${period2}`;

  let resp;
  try {
    resp = await fetch(apiUrl);
  } catch (err) {
    throw new Error(`[stock-lookup] Network error for ticker "${ticker}". Verify manually: ${yahooUrl}`);
  }

  if (!resp.ok) {
    throw new Error(`[stock-lookup] Yahoo Finance returned ${resp.status} for ticker "${ticker}". Verify manually: ${yahooUrl}`);
  }

  let data;
  try {
    data = await resp.json();
  } catch {
    throw new Error(`[stock-lookup] Invalid JSON response for ticker "${ticker}". Verify manually: ${yahooUrl}`);
  }

  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`[stock-lookup] No data returned for ticker "${ticker}". Verify manually: ${yahooUrl}`);
  }

  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const currency = result.meta?.currency ?? 'USD';

  if (timestamps.length === 0 || closes.length === 0) {
    throw new Error(`[stock-lookup] No price history found for ticker "${ticker}" around ${dateStr}. Verify manually: ${yahooUrl}`);
  }

  // Find the closest date on or after the requested date
  let best_idx = 0;
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] != null) {
      best_idx = i;
      break;
    }
  }

  const source_ts = timestamps[best_idx];
  const source_date = new Date(source_ts * 1000).toISOString().slice(0, 10);
  const price = closes[best_idx];

  if (price == null) {
    throw new Error(`[stock-lookup] No valid closing price for ticker "${ticker}" around ${dateStr}. Verify manually: ${yahooUrl}`);
  }

  const is_exact = source_date === dateStr;

  return { price, currency, source_date, is_exact };
}
