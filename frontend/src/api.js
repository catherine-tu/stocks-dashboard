// In local dev, Vite proxies /api → localhost:5001
// In production on Render, VITE_API_URL is set to the backend service URL

const API_HOST = import.meta.env.VITE_API_URL?.trim();
const BASE = API_HOST ? `${API_HOST.replace(/\/$/, "")}/api` : "/api";

async function handleResponse(response, label) {
  if (response.ok) return response.json();
  const body = await response.text();
  const missingEnvHint = !API_HOST
    ? " VITE_API_URL is not set; set this frontend env to your backend host."
    : "";
  throw new Error(
    `${label} failed: ${response.status} ${response.statusText} ${body}${missingEnvHint}`,
  );
}

export async function fetchQuote(ticker) {
  const r = await fetch(`${BASE}/quote/${ticker}`);
  return handleResponse(r, `Quote fetch for ${ticker}`);
}

export async function fetchHistory(ticker, range = "6m") {
  const r = await fetch(`${BASE}/history/${ticker}?range=${range}`);
  return handleResponse(r, `History fetch for ${ticker}`);
}

export async function fetchWatchlist(tickers) {
  const param = tickers ? `?tickers=${tickers.join(",")}` : "";
  const r = await fetch(`${BASE}/watchlist${param}`);
  return handleResponse(r, "Watchlist fetch");
}

export async function searchTickers(query) {
  const r = await fetch(`${BASE}/search/${encodeURIComponent(query)}`);
  return handleResponse(r, `Search for ${query}`);
}

// ── SMA calculation (client-side for instant slider response) ────────────────
export function calcSMA(bars, window) {
  return bars.map((b, i) => {
    if (i < window - 1) return { ...b, sma: null };
    const slice = bars.slice(i - window + 1, i + 1);
    const avg = slice.reduce((s, x) => s + x.close, 0) / window;
    return { ...b, sma: parseFloat(avg.toFixed(4)) };
  });
}

export function calcCrossoverSignals(bars, shortW, longW) {
  const short = calcSMA(bars, shortW);
  const long = calcSMA(bars, longW);
  let position = null;
  let cash = 10000,
    shares = 0;
  const trades = [];

  const combined = bars.map((b, i) => {
    const s = short[i].sma;
    const l = long[i].sma;
    let signal = null;

    if (s !== null && l !== null && i > 0) {
      const ps = short[i - 1].sma;
      const pl = long[i - 1].sma;
      if (ps !== null && pl !== null) {
        if (ps <= pl && s > l && position !== "long") {
          signal = "BUY";
          shares = cash / b.close;
          cash = 0;
          position = "long";
          trades.push({ ...b, signal: "BUY" });
        } else if (ps >= pl && s < l && position === "long") {
          signal = "SELL";
          cash = shares * b.close;
          shares = 0;
          position = null;
          trades.push({ ...b, signal: "SELL" });
        }
      }
    }

    const portfolioValue = position === "long" ? cash + shares * b.close : cash;
    return {
      ...b,
      shortSMA: s,
      longSMA: l,
      signal,
      portfolioValue: parseFloat(portfolioValue.toFixed(2)),
    };
  });

  const finalValue =
    position === "long"
      ? cash + shares * combined[combined.length - 1].close
      : cash;
  const buyHoldShares = 10000 / bars[0].close;
  const buyHoldFinal = buyHoldShares * bars[bars.length - 1].close;

  return {
    chartData: combined,
    trades,
    finalValue: parseFloat(finalValue.toFixed(2)),
    buyHoldFinal: parseFloat(buyHoldFinal.toFixed(2)),
    totalReturn: (((finalValue - 10000) / 10000) * 100).toFixed(2),
    buyHoldReturn: (((buyHoldFinal - 10000) / 10000) * 100).toFixed(2),
    numTrades: trades.length,
  };
}
