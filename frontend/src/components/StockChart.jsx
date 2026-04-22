import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { fetchHistory, calcCrossoverSignals } from "../api";
import {
  AlertTriangle,
  Trash2,
  PlusCircle,
  Edit2,
  Check,
  X,
} from "lucide-react";

const RANGES = ["1m", "3m", "6m", "1y", "2y", "5y"];

// ── Tooltip ──────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#07090e",
        border: "1px solid var(--border2)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 11,
      }}
    >
      <p style={{ color: "var(--muted)", marginBottom: 6 }}>{label}</p>
      {payload.map(
        (p, i) =>
          p.value != null && (
            <p key={i} style={{ color: p.color, margin: "2px 0" }}>
              {p.name}:{" "}
              <span style={{ color: "var(--text)" }}>
                ${typeof p.value === "number" ? p.value.toFixed(2) : p.value}
              </span>
            </p>
          ),
      )}
    </div>
  );
};

// ── Small reusable stat card ─────────────────────────────────────────────────
const StatCard = ({ label, value, color }) => (
  <div
    style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "10px 14px",
    }}
  >
    <div
      style={{
        fontSize: 9,
        color: "var(--muted2)",
        letterSpacing: 1,
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    <div
      style={{ fontSize: 16, fontWeight: 700, color: color ?? "var(--text)" }}
    >
      {value}
    </div>
  </div>
);

export default function StockChart({
  ticker,
  portfolio,
  onUpdatePortfolio,
  onRemoveFromPortfolio,
}) {
  const [range, setRange] = useState("6m");
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shortW, setShortW] = useState(20);
  const [longW, setLongW] = useState(50);
  const [activeTab, setActiveTab] = useState("price");

  // Portfolio form state
  const [sharesInput, setSharesInput] = useState("");
  const [avgCostInput, setAvgCostInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const holding = portfolio.find((p) => p.ticker === ticker);

  // Pre-fill form when switching to a ticker already in portfolio
  useEffect(() => {
    if (holding) {
      setSharesInput(String(holding.shares));
      setAvgCostInput(String(holding.avgCost));
      setIsEditing(false);
    } else {
      setSharesInput("");
      setAvgCostInput("");
      setIsEditing(false);
    }
  }, [ticker]);

  // Fetch price history when ticker or range changes
  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    setBars([]);
    fetchHistory(ticker, range)
      .then((d) => setBars(d.bars || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker, range]);

  // Crossover signals — recalculated instantly on slider change (no API call)
  const signals = useMemo(() => {
    if (bars.length < longW + 2) return null;
    return calcCrossoverSignals(bars, shortW, longW);
  }, [bars, shortW, longW]);

  const latestSignal = useMemo(() => {
    if (!signals?.trades.length) return null;
    return signals.trades[signals.trades.length - 1];
  }, [signals]);

  // Unrealized P&L for held position
  const unrealizedPnL = useMemo(() => {
    if (!holding || !bars.length) return null;
    const latest = bars[bars.length - 1].close;
    const raw = (latest - holding.avgCost) * holding.shares;
    return {
      value: raw.toFixed(2),
      pct: (((latest - holding.avgCost) / holding.avgCost) * 100).toFixed(2),
    };
  }, [holding, bars]);

  function handleSavePosition() {
    const shares = parseFloat(sharesInput);
    const cost = parseFloat(avgCostInput);
    if (!shares || !cost || shares <= 0 || cost <= 0) return;
    onUpdatePortfolio(ticker, shares, cost);
    setIsEditing(false);
  }

  function handleRemove() {
    onRemoveFromPortfolio(ticker);
    setSharesInput("");
    setAvgCostInput("");
    setIsEditing(false);
  }

  // Thin data for chart performance
  const thinned = useMemo(() => {
    const data = signals?.chartData ?? bars.map((b) => ({ ...b }));
    const step = Math.max(1, Math.floor(data.length / 300));
    return data.filter((_, i) => i % step === 0 || data[i]?.signal);
  }, [signals, bars]);

  const buys = signals?.chartData.filter((d) => d.signal === "BUY") ?? [];
  const sells = signals?.chartData.filter((d) => d.signal === "SELL") ?? [];

  const stratColor =
    signals && parseFloat(signals.totalReturn) >= 0
      ? "var(--green)"
      : "var(--red)";
  const bhColor =
    signals && parseFloat(signals.buyHoldReturn) >= 0
      ? "var(--green)"
      : "var(--red)";

  if (!ticker)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 400,
          color: "var(--muted)",
        }}
      >
        ← Select a stock to analyze
      </div>
    );

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 26,
              color: "#fff",
              marginBottom: 2,
            }}
          >
            {ticker}
          </h2>
          {bars.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              Latest close:{" "}
              <span style={{ color: "var(--text)" }}>
                ${bars[bars.length - 1]?.close?.toFixed(2)}
              </span>
              &nbsp;·&nbsp;{bars.length} trading days loaded
              {holding && (
                <span style={{ color: "var(--accent)", marginLeft: 8 }}>
                  ● Tracking
                </span>
              )}
            </span>
          )}
        </div>
        {latestSignal && (
          <div
            style={{
              background: latestSignal.signal === "BUY" ? "#002a1a" : "#2a0011",
              border: `1px solid ${latestSignal.signal === "BUY" ? "var(--green)" : "var(--red)"}`,
              color:
                latestSignal.signal === "BUY" ? "var(--green)" : "var(--red)",
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            {latestSignal.signal === "BUY" ? "▲" : "▼"} Last signal:{" "}
            <strong>{latestSignal.signal}</strong> on {latestSignal.date} @ $
            {latestSignal.close?.toFixed(2)}
          </div>
        )}
      </div>

      {/* ── Strategy stats ── */}
      {signals && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 10,
          }}
        >
          <StatCard
            label="STRATEGY"
            value={`${signals.totalReturn}%`}
            color={stratColor}
          />
          <StatCard
            label="BUY & HOLD"
            value={`${signals.buyHoldReturn}%`}
            color={bhColor}
          />
          <StatCard
            label="FINAL $10K"
            value={`$${signals.finalValue.toLocaleString()}`}
          />
          <StatCard label="# TRADES" value={signals.numTrades} />
          <StatCard
            label="BEATS B&H?"
            value={
              parseFloat(signals.totalReturn) >
              parseFloat(signals.buyHoldReturn)
                ? "YES ✓"
                : "NO ✗"
            }
            color={
              parseFloat(signals.totalReturn) >
              parseFloat(signals.buyHoldReturn)
                ? "var(--green)"
                : "var(--red)"
            }
          />
        </div>
      )}

      {/* ── Controls: range + MA sliders ── */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "14px 18px",
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: "4px 10px",
                borderRadius: 5,
                fontSize: 11,
                border: `1px solid ${range === r ? "var(--accent)" : "var(--border)"}`,
                background: range === r ? "#0d2040" : "transparent",
                color: range === r ? "var(--accent)" : "var(--muted)",
              }}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 28, background: "var(--border)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1 }}
          >
            FAST MA
          </span>
          <input
            type="range"
            min={3}
            max={50}
            value={shortW}
            onChange={(e) => setShortW(Math.min(+e.target.value, longW - 1))}
            style={{ width: 90 }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--accent)",
              minWidth: 22,
            }}
          >
            {shortW}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1 }}
          >
            SLOW MA
          </span>
          <input
            type="range"
            min={10}
            max={200}
            value={longW}
            onChange={(e) => setLongW(Math.max(+e.target.value, shortW + 1))}
            style={{ width: 90 }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--accent2)",
              minWidth: 28,
            }}
          >
            {longW}
          </span>
        </div>

        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {[
            { l: "Classic", s: 20, lo: 50 },
            { l: "Fast", s: 5, lo: 20 },
            { l: "Slow", s: 50, lo: 200 },
          ].map((p) => (
            <button
              key={p.l}
              onClick={() => {
                setShortW(p.s);
                setLongW(p.lo);
              }}
              style={{
                fontSize: 10,
                padding: "4px 10px",
                borderRadius: 5,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--muted)",
              }}
            >
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 2 }}>
        {["price", "equity", "trades", "portfolio"].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              fontSize: 10,
              padding: "7px 16px",
              borderRadius: "6px 6px 0 0",
              border: "1px solid var(--border)",
              borderBottom:
                activeTab === t
                  ? "1px solid var(--surface2)"
                  : "1px solid var(--border)",
              background: activeTab === t ? "var(--surface2)" : "transparent",
              color: activeTab === t ? "var(--text)" : "var(--muted)",
              letterSpacing: 1,
              textTransform: "uppercase",
              position: "relative",
            }}
          >
            {t}
            {t === "portfolio" && holding && (
              <span
                style={{
                  marginLeft: 6,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  display: "inline-block",
                  verticalAlign: "middle",
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Chart panel ── */}
      <div
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderTop: "none",
          borderRadius: "0 8px 8px 8px",
          padding: "20px 8px 12px",
          minHeight: 340,
        }}
      >
        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 300,
              color: "var(--muted)",
              fontSize: 12,
            }}
          >
            <span className="pulse">Loading {ticker}…</span>
          </div>
        )}
        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 300,
              color: "var(--red)",
              fontSize: 12,
              gap: 8,
            }}
          >
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {!loading && !error && bars.length > 0 && (
          <>
            {/* PRICE TAB */}
            {activeTab === "price" && (
              <>
                <p
                  style={{
                    fontSize: 10,
                    color: "var(--muted2)",
                    margin: "0 16px 14px",
                    lineHeight: 1.7,
                  }}
                >
                  Price with Fast MA{" "}
                  <span style={{ color: "var(--accent)" }}>({shortW}d)</span>{" "}
                  and Slow MA{" "}
                  <span style={{ color: "var(--accent2)" }}>({longW}d)</span>.
                  &nbsp;
                  <span style={{ color: "var(--green)" }}>
                    ▲ Green = BUY (Golden Cross).
                  </span>
                  &nbsp;
                  <span style={{ color: "var(--red)" }}>
                    ▼ Red = SELL (Death Cross).
                  </span>
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart
                    data={thinned}
                    margin={{ top: 6, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#0f1220" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "var(--muted2)" }}
                      interval={Math.floor(thinned.length / 8)}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "var(--muted2)" }}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 10, color: "var(--muted)" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="#2a3558"
                      strokeWidth={1.5}
                      dot={false}
                      name="Price"
                    />
                    <Line
                      type="monotone"
                      dataKey="shortSMA"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={false}
                      name={`SMA ${shortW}`}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="longSMA"
                      stroke="var(--accent2)"
                      strokeWidth={2}
                      dot={false}
                      name={`SMA ${longW}`}
                      connectNulls
                    />
                    {buys.map((d, i) => (
                      <ReferenceLine
                        key={`b${i}`}
                        x={d.date}
                        stroke="var(--green)"
                        strokeDasharray="2 5"
                        strokeOpacity={0.5}
                      />
                    ))}
                    {sells.map((d, i) => (
                      <ReferenceLine
                        key={`s${i}`}
                        x={d.date}
                        stroke="var(--red)"
                        strokeDasharray="2 5"
                        strokeOpacity={0.5}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            )}

            {/* EQUITY TAB */}
            {activeTab === "equity" && (
              <>
                <p
                  style={{
                    fontSize: 10,
                    color: "var(--muted2)",
                    margin: "0 16px 14px",
                    lineHeight: 1.7,
                  }}
                >
                  Strategy equity curve starting from $10,000. The dashed line
                  marks your starting capital.
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart
                    data={thinned}
                    margin={{ top: 6, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#0f1220" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "var(--muted2)" }}
                      interval={Math.floor(thinned.length / 8)}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "var(--muted2)" }}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="portfolioValue"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={false}
                      name="Strategy"
                    />
                    <ReferenceLine
                      y={10000}
                      stroke="var(--border2)"
                      strokeDasharray="4 3"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            )}

            {/* TRADES TAB */}
            {activeTab === "trades" && (
              <div
                style={{ padding: "0 8px", maxHeight: 360, overflowY: "auto" }}
              >
                {!signals?.trades.length ? (
                  <p
                    style={{
                      color: "var(--muted)",
                      padding: 24,
                      textAlign: "center",
                    }}
                  >
                    No trades generated — try narrowing the MA windows.
                  </p>
                ) : (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 11,
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["#", "Date", "Signal", "Price", "Why"].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "6px 10px",
                              color: "var(--muted)",
                              fontWeight: 400,
                              textAlign: "left",
                              fontSize: 9,
                              letterSpacing: 1,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {signals.trades.map((t, i) => (
                        <tr
                          key={i}
                          style={{ borderBottom: "1px solid #0a0c12" }}
                        >
                          <td
                            style={{
                              padding: "9px 10px",
                              color: "var(--muted2)",
                            }}
                          >
                            {i + 1}
                          </td>
                          <td
                            style={{
                              padding: "9px 10px",
                              color: "var(--muted)",
                            }}
                          >
                            {t.date}
                          </td>
                          <td style={{ padding: "9px 10px" }}>
                            <span
                              style={{
                                background:
                                  t.signal === "BUY" ? "#002a1a" : "#2a0011",
                                color:
                                  t.signal === "BUY"
                                    ? "var(--green)"
                                    : "var(--red)",
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 10,
                                letterSpacing: 1,
                              }}
                            >
                              {t.signal === "BUY" ? "▲ BUY" : "▼ SELL"}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "9px 10px",
                              color: "var(--text)",
                            }}
                          >
                            ${t.close?.toFixed(2)}
                          </td>
                          <td
                            style={{
                              padding: "9px 10px",
                              color: "var(--muted)",
                              fontSize: 10,
                            }}
                          >
                            {t.signal === "BUY"
                              ? "Fast MA crossed above slow MA"
                              : "Fast MA crossed below slow MA"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* PORTFOLIO TAB */}
            {activeTab === "portfolio" && (
              <div style={{ padding: "8px 20px" }}>
                {/* ── If holding: show summary + edit/remove ── */}
                {holding && !isEditing ? (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(130px, 1fr))",
                        gap: 12,
                        marginBottom: 20,
                      }}
                    >
                      <StatCard label="SHARES HELD" value={holding.shares} />
                      <StatCard
                        label="AVG COST"
                        value={`$${Number(holding.avgCost).toFixed(2)}`}
                      />
                      <StatCard
                        label="CURRENT PRICE"
                        value={`$${bars[bars.length - 1]?.close?.toFixed(2)}`}
                      />
                      <StatCard
                        label="MARKET VALUE"
                        value={`$${(holding.shares * bars[bars.length - 1]?.close).toFixed(2)}`}
                      />
                      {unrealizedPnL && (
                        <StatCard
                          label="UNREALIZED P&L"
                          value={`${parseFloat(unrealizedPnL.value) >= 0 ? "+" : ""}$${unrealizedPnL.value} (${unrealizedPnL.pct}%)`}
                          color={
                            parseFloat(unrealizedPnL.value) >= 0
                              ? "var(--green)"
                              : "var(--red)"
                          }
                        />
                      )}
                    </div>

                    {/* Edit / Remove buttons */}
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        onClick={() => setIsEditing(true)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: "transparent",
                          border: "1px solid var(--border2)",
                          borderRadius: 6,
                          padding: "7px 16px",
                          color: "var(--muted)",
                          fontSize: 11,
                        }}
                      >
                        <Edit2 size={12} /> Edit Position
                      </button>
                      <button
                        onClick={handleRemove}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: "transparent",
                          border: "1px solid #3d0018",
                          borderRadius: 6,
                          padding: "7px 16px",
                          color: "var(--red)",
                          fontSize: 11,
                        }}
                      >
                        <Trash2 size={12} /> Remove from Portfolio
                      </button>
                    </div>
                  </>
                ) : (
                  /* ── Add or Edit form ── */
                  <>
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--muted2)",
                        marginBottom: 16,
                        lineHeight: 1.7,
                      }}
                    >
                      {holding
                        ? `Editing your ${ticker} position.`
                        : `Track your real position in ${ticker}.`}{" "}
                      Enter your shares and average cost basis.
                    </p>

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        marginBottom: 16,
                        flexWrap: "wrap",
                        alignItems: "flex-end",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: 9,
                            color: "var(--muted)",
                            display: "block",
                            marginBottom: 5,
                            letterSpacing: 1,
                          }}
                        >
                          SHARES
                        </label>
                        <input
                          value={sharesInput}
                          onChange={(e) => setSharesInput(e.target.value)}
                          type="number"
                          placeholder="e.g. 10"
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border2)",
                            borderRadius: 6,
                            padding: "7px 12px",
                            color: "var(--text)",
                            fontSize: 12,
                            width: 120,
                            outline: "none",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 9,
                            color: "var(--muted)",
                            display: "block",
                            marginBottom: 5,
                            letterSpacing: 1,
                          }}
                        >
                          AVG COST / SHARE ($)
                        </label>
                        <input
                          value={avgCostInput}
                          onChange={(e) => setAvgCostInput(e.target.value)}
                          type="number"
                          placeholder="e.g. 180.00"
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border2)",
                            borderRadius: 6,
                            padding: "7px 12px",
                            color: "var(--text)",
                            fontSize: 12,
                            width: 150,
                            outline: "none",
                          }}
                        />
                      </div>

                      <button
                        onClick={handleSavePosition}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: "var(--accent)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "8px 18px",
                          fontSize: 11,
                        }}
                      >
                        <Check size={12} />{" "}
                        {holding ? "Save Changes" : "Add to Portfolio"}
                      </button>

                      {/* Cancel edit (only shown when editing existing) */}
                      {holding && isEditing && (
                        <button
                          onClick={() => setIsEditing(false)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: "transparent",
                            border: "1px solid var(--border2)",
                            borderRadius: 6,
                            padding: "8px 14px",
                            color: "var(--muted)",
                            fontSize: 11,
                          }}
                        >
                          <X size={12} /> Cancel
                        </button>
                      )}
                    </div>

                    {/* Hint */}
                    {!holding && (
                      <p
                        style={{
                          fontSize: 10,
                          color: "var(--muted2)",
                          lineHeight: 1.7,
                        }}
                      >
                        💡 Your cost basis is what you actually paid per share
                        (including any fees). This is used to calculate your
                        unrealized P&L.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Glossary ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 10,
        }}
      >
        {[
          {
            title: "Simple Moving Average (SMA)",
            body: `Average of the last N closing prices. The ${shortW}-day (fast) reacts quickly; the ${longW}-day (slow) captures the bigger trend.`,
          },
          {
            title: "Golden Cross 🟡",
            body: "Fast MA crosses ABOVE slow MA. Signals upward momentum — the strategy opens a long position here.",
          },
          {
            title: "Death Cross 💀",
            body: "Fast MA crosses BELOW slow MA. Momentum is fading — the strategy exits the position.",
          },
          {
            title: "Unrealized P&L",
            body: "The gain or loss on shares you currently hold, based on today's price vs what you paid. It's only 'realized' when you sell.",
          },
        ].map((c) => (
          <div
            key={c.title}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "13px 16px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--muted)",
                marginBottom: 6,
              }}
            >
              {c.title}
            </div>
            <div
              style={{ fontSize: 10, color: "var(--muted2)", lineHeight: 1.75 }}
            >
              {c.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
