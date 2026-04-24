import { useState, useEffect, useCallback } from "react";
import { Search, Plus, X, RefreshCw, BarChart2 } from "lucide-react";
import WatchlistCard from "./components/WatchlistCard";
import StockChart from "./components/StockChart";
import { fetchWatchlist, searchTickers } from "./api";

const DEFAULT_TICKERS = [
  "SPY",
  "QQQ",
  "AAPL",
  "MSFT",
  "NVDA",
  "TSLA",
  "AMZN",
  "GOOGL",
];

// ── Load watchlist from localStorage, fall back to defaults ─────────────────
function loadWatchlist() {
  try {
    const saved = localStorage.getItem("qt_watchlist");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Make sure all defaults are always present, then append any custom ones
      const custom = parsed.filter((t) => !DEFAULT_TICKERS.includes(t));
      return [...DEFAULT_TICKERS, ...custom];
    }
  } catch {}
  return DEFAULT_TICKERS;
}

export default function App() {
  const [watchlist, setWatchlist] = useState(loadWatchlist);
  const [quotes, setQuotes] = useState([]);
  const [selectedTicker, setSelected] = useState("SPY");
  const [portfolio, setPortfolio] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("qt_portfolio") || "[]");
    } catch {
      return [];
    }
  });
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [watchlistError, setWatchlistError] = useState(null);
  // Track which card is hovered so we can show the X button
  const [hoveredTicker, setHoveredTicker] = useState(null);

  // ── Persist watchlist whenever it changes ────────────────────────────────
  useEffect(() => {
    localStorage.setItem("qt_watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  // ── Fetch watchlist quotes ───────────────────────────────────────────────
  const refreshQuotes = useCallback(() => {
    setLoadingQuotes(true);
    setWatchlistError(null);
    fetchWatchlist(watchlist)
      .then((data) => {
        setQuotes(data);
        setLastRefresh(new Date());
      })
      .catch((err) => {
        console.error(err);
        setWatchlistError(err.message);
      })
      .finally(() => setLoadingQuotes(false));
  }, [watchlist]);

  useEffect(() => {
    refreshQuotes();
  }, [refreshQuotes]);

  // ── Persist portfolio ────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("qt_portfolio", JSON.stringify(portfolio));
  }, [portfolio]);

  // ── Debounced ticker search ──────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      setSearching(true);
      searchTickers(searchQuery)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function addToWatchlist(ticker) {
    const t = ticker.toUpperCase();
    if (!watchlist.includes(t)) setWatchlist((w) => [...w, t]);
    setSearchQuery("");
    setSearchResults([]);
    setSelected(t);
  }

  function removeFromWatchlist(ticker) {
    // Only allow removing non-default tickers
    if (DEFAULT_TICKERS.includes(ticker)) return;
    setWatchlist((w) => w.filter((t) => t !== ticker));
    setQuotes((q) => q.filter((q) => q.ticker !== ticker));
    if (selectedTicker === ticker) setSelected("SPY");
  }

  // ── Portfolio CRUD ───────────────────────────────────────────────────────
  function updatePortfolio(ticker, shares, avgCost) {
    setPortfolio((prev) => {
      const idx = prev.findIndex((p) => p.ticker === ticker);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ticker, shares, avgCost };
        return updated;
      }
      return [...prev, { ticker, shares, avgCost }];
    });
  }

  function removeFromPortfolio(ticker) {
    setPortfolio((prev) => prev.filter((p) => p.ticker !== ticker));
  }

  // ── Derived: movers, index quotes ───────────────────────────────────────
  const gainers = quotes
    .filter((q) => q.change_pct > 0)
    .sort((a, b) => b.change_pct - a.change_pct)
    .slice(0, 2);
  const losers = quotes
    .filter((q) => q.change_pct < 0)
    .sort((a, b) => a.change_pct - b.change_pct)
    .slice(0, 2);
  const spyQuote = quotes.find((q) => q.ticker === "SPY");
  const qqqQuote = quotes.find((q) => q.ticker === "QQQ");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* ── Top bar ── */}
      <header
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginRight: 8,
          }}
        >
          <BarChart2 size={18} color="var(--accent)" />
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 18,
              color: "#fff",
              letterSpacing: "-0.3px",
            }}
          >
            QuantDash
          </span>
        </div>

        {[spyQuote, qqqQuote].map(
          (q) =>
            q && (
              <div
                key={q.ticker}
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "3px 10px",
                }}
              >
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  {q.ticker}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text)",
                  }}
                >
                  ${q.close?.toFixed(2)}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: q.change_pct >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  {q.change_pct >= 0 ? "+" : ""}
                  {q.change_pct?.toFixed(2)}%
                </span>
              </div>
            ),
        )}

        {/* Search */}
        <div style={{ position: "relative", marginLeft: "auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--surface2)",
              border: "1px solid var(--border2)",
              borderRadius: 8,
              padding: "5px 12px",
            }}
          >
            <Search size={12} color="var(--muted)" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker…"
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text)",
                fontSize: 12,
                width: 140,
              }}
            />
            {searching && (
              <span
                style={{ fontSize: 10, color: "var(--muted)" }}
                className="pulse"
              >
                …
              </span>
            )}
          </div>
          {searchResults.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                width: 280,
                background: "var(--surface2)",
                border: "1px solid var(--border2)",
                borderRadius: 8,
                zIndex: 100,
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}
            >
              {searchResults.map((r) => (
                <div
                  key={r.ticker}
                  onClick={() => addToWatchlist(r.ticker)}
                  style={{
                    padding: "9px 14px",
                    cursor: "pointer",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    borderBottom: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--surface)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--accent)",
                      minWidth: 60,
                    }}
                  >
                    {r.ticker}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.name}
                  </span>
                  {watchlist.includes(r.ticker) ? (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 9,
                        color: "var(--green)",
                        flexShrink: 0,
                      }}
                    >
                      ✓ Added
                    </span>
                  ) : (
                    <Plus
                      size={12}
                      color="var(--muted)"
                      style={{ marginLeft: "auto", flexShrink: 0 }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={refreshQuotes}
          title="Refresh quotes"
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "5px 8px",
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <RefreshCw size={13} className={loadingQuotes ? "pulse" : ""} />
        </button>
        {lastRefresh && (
          <span style={{ fontSize: 10, color: "var(--muted2)" }}>
            {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </header>

      {watchlistError && (
        <div
          style={{
            background: "#3f1b1b",
            color: "#ffd3d3",
            padding: "10px 24px",
            borderBottom: "1px solid #7a3d3d",
            fontSize: 13,
          }}
        >
          {watchlistError}
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Sidebar ── */}
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            background: "var(--surface)",
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {/* Market movers */}
          {(gainers.length > 0 || losers.length > 0) && (
            <div
              style={{
                padding: "14px 14px 10px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "var(--muted2)",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                MARKET TODAY
              </div>
              {gainers.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  {gainers.map((q) => (
                    <div
                      key={q.ticker}
                      onClick={() => setSelected(q.ticker)}
                      style={{
                        flex: 1,
                        background: "#002a1a",
                        border: "1px solid #003d20",
                        borderRadius: 6,
                        padding: "6px 8px",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          color: "var(--green)",
                          marginBottom: 2,
                        }}
                      >
                        {q.ticker}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--green)",
                          fontWeight: 600,
                        }}
                      >
                        +{q.change_pct?.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {losers.length > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  {losers.map((q) => (
                    <div
                      key={q.ticker}
                      onClick={() => setSelected(q.ticker)}
                      style={{
                        flex: 1,
                        background: "#2a0011",
                        border: "1px solid #3d0018",
                        borderRadius: 6,
                        padding: "6px 8px",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          color: "var(--red)",
                          marginBottom: 2,
                        }}
                      >
                        {q.ticker}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--red)",
                          fontWeight: 600,
                        }}
                      >
                        {q.change_pct?.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Portfolio summary */}
          {portfolio.length > 0 && (
            <div
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "var(--muted2)",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                MY PORTFOLIO
              </div>
              {portfolio.map((p) => {
                const q = quotes.find((q) => q.ticker === p.ticker);
                const pnl = q ? (q.close - p.avgCost) * p.shares : null;
                return (
                  <div
                    key={p.ticker}
                    onClick={() => setSelected(p.ticker)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "7px 0",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color:
                            selectedTicker === p.ticker
                              ? "var(--accent)"
                              : "var(--text)",
                        }}
                      >
                        {p.ticker}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--muted)" }}>
                        {p.shares} sh @ ${Number(p.avgCost).toFixed(2)}
                      </div>
                    </div>
                    {pnl !== null && (
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: 11,
                            color: pnl >= 0 ? "var(--green)" : "var(--red)",
                            fontWeight: 600,
                          }}
                        >
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 9, color: "var(--muted2)" }}>
                          {pnl >= 0 ? "+" : ""}
                          {(((q.close - p.avgCost) / p.avgCost) * 100).toFixed(
                            1,
                          )}
                          %
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Total P&L row */}
              {(() => {
                const total = portfolio.reduce((sum, p) => {
                  const q = quotes.find((q) => q.ticker === p.ticker);
                  return q ? sum + (q.close - p.avgCost) * p.shares : sum;
                }, 0);
                return (
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        color: "var(--muted2)",
                        letterSpacing: 1,
                      }}
                    >
                      TOTAL P&L
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: total >= 0 ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {total >= 0 ? "+" : ""}${total.toFixed(2)}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Watchlist — scrollable, custom tickers show X on hover */}
          <div style={{ padding: "12px 14px", flex: 1, overflowY: "auto" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: "var(--muted2)",
                  letterSpacing: 1,
                }}
              >
                WATCHLIST
              </span>
              <span style={{ fontSize: 9, color: "var(--muted2)" }}>
                {watchlist.length} stocks
              </span>
            </div>

            {/* Default tickers — no remove button */}
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 8,
                  color: "var(--muted2)",
                  letterSpacing: 1,
                  marginBottom: 6,
                  paddingLeft: 2,
                }}
              >
                DEFAULT
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {watchlist
                  .filter((t) => DEFAULT_TICKERS.includes(t))
                  .map((ticker) => {
                    const q = quotes.find((q) => q.ticker === ticker);
                    return (
                      <WatchlistCard
                        key={ticker}
                        stock={
                          q ?? {
                            ticker,
                            close: null,
                            change: null,
                            change_pct: null,
                          }
                        }
                        onClick={() => setSelected(ticker)}
                        isSelected={selectedTicker === ticker}
                        isTracked={portfolio.some((p) => p.ticker === ticker)}
                      />
                    );
                  })}
              </div>
            </div>

            {/* Custom tickers — show X on hover */}
            {watchlist.some((t) => !DEFAULT_TICKERS.includes(t)) && (
              <div>
                <div
                  style={{
                    fontSize: 8,
                    color: "var(--muted2)",
                    letterSpacing: 1,
                    marginBottom: 6,
                    marginTop: 12,
                    paddingLeft: 2,
                  }}
                >
                  MY TICKERS
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {watchlist
                    .filter((t) => !DEFAULT_TICKERS.includes(t))
                    .map((ticker) => {
                      const q = quotes.find((q) => q.ticker === ticker);
                      const isHovered = hoveredTicker === ticker;
                      return (
                        <div
                          key={ticker}
                          style={{ position: "relative" }}
                          onMouseEnter={() => setHoveredTicker(ticker)}
                          onMouseLeave={() => setHoveredTicker(null)}
                        >
                          <WatchlistCard
                            stock={
                              q ?? {
                                ticker,
                                close: null,
                                change: null,
                                change_pct: null,
                              }
                            }
                            onClick={() => setSelected(ticker)}
                            isSelected={selectedTicker === ticker}
                            isTracked={portfolio.some(
                              (p) => p.ticker === ticker,
                            )}
                          />
                          {/* Remove button — visible on hover via React state, no querySelector needed */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromWatchlist(ticker);
                            }}
                            title={`Remove ${ticker}`}
                            style={{
                              position: "absolute",
                              top: 7,
                              right: 7,
                              background: "var(--surface2)",
                              border: "1px solid var(--border2)",
                              borderRadius: 4,
                              padding: "2px 4px",
                              color: "var(--red)",
                              cursor: "pointer",
                              opacity: isHovered ? 1 : 0,
                              transition: "opacity 0.15s",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <X size={10} />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          <StockChart
            ticker={selectedTicker}
            portfolio={portfolio}
            onUpdatePortfolio={updatePortfolio}
            onRemoveFromPortfolio={removeFromPortfolio}
          />
        </main>
      </div>
    </div>
  );
}
