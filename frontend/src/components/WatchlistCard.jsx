import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function WatchlistCard({ stock, onClick, isSelected, isTracked, onAddToPortfolio }) {
  const pos = stock.change_pct > 0;
  const neg = stock.change_pct < 0;
  const color = pos ? "var(--green)" : neg ? "var(--red)" : "var(--muted)";

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? "var(--surface2)" : "var(--surface)",
        border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 10,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        position: "relative",
        userSelect: "none",
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = "var(--border2)"; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      {isTracked && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          width: 6, height: 6, borderRadius: "50%",
          background: "var(--accent)", boxShadow: "0 0 6px var(--accent)",
        }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", letterSpacing: 0.5 }}>{stock.ticker}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>${stock.close?.toFixed(2) ?? "—"}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color }}>
          {pos ? <TrendingUp size={12} /> : neg ? <TrendingDown size={12} /> : <Minus size={12} />}
          <span style={{ fontSize: 11 }}>
            {pos ? "+" : ""}{stock.change_pct?.toFixed(2)}%
          </span>
        </div>
        <span style={{ fontSize: 10, color: "var(--muted)" }}>
          {stock.change_pct > 0 ? "+" : ""}{stock.change?.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
