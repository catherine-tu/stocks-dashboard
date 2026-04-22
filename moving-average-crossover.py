import yfinance as yf
import pandas as pd
import matplotlib.pyplot as plt

# ── 1. fetch real price data ──────────────────────────────────────
ticker = "AAPL"
raw = yf.download(ticker, start="2023-01-01", end="2024-12-31")

# yfinance returns multi-level columns now: flatten them
df = raw["Close"].squeeze().to_frame(name="Close")

# ── 2. calculate SMAs ─────────────────────────────────────────────
short_window = 20
long_window  = 50

df["SMA_short"] = df["Close"].rolling(window=short_window).mean()
df["SMA_long"]  = df["Close"].rolling(window=long_window).mean()

# ── 3. generate signals ───────────────────────────────────────────
# 1 = holding stock, 0 = in cash
# when the short-term moving average is greater than the long-term moving average, set signal = 1.
df["signal"] = 0
df.loc[df["SMA_short"] > df["SMA_long"], "signal"] = 1

# Signal CHANGES are the actual trade events
# detects when the signal changes, not just signal itself
df["trade"] = df["signal"].diff()
# trade == +1 → BUY,  trade == -1 → SELL

# ── 4. Backtest ───────────────────────────────────────────────────
cash   = 10_000
shares = 0

for date, row in df.iterrows():
    if row["trade"] == 1:          # Golden Cross → BUY
        shares = cash / row["Close"]
        cash   = 0
        print(f"BUY  on {date.date()} @ ${row['Close']:.2f}")
    elif row["trade"] == -1:       # Death Cross → SELL
        cash   = shares * row["Close"]
        shares = 0
        print(f"SELL on {date.date()} @ ${row['Close']:.2f}")

final_value = cash + shares * df["Close"].iloc[-1]
print(f"\nStrategy final value: ${final_value:,.2f}")
print(f"Return: {((final_value - 10000) / 10000 * 100):.1f}%")

# ── 5. Plot ───────────────────────────────────────────────────────
plt.figure(figsize=(14, 6))
plt.plot(df["Close"],     label="Price",               color="steelblue", lw=1.2)
plt.plot(df["SMA_short"], label=f"SMA {short_window}", color="orange",    lw=1.5)
plt.plot(df["SMA_long"],  label=f"SMA {long_window}",  color="red",       lw=1.5)

buys  = df[df["trade"] ==  1]
sells = df[df["trade"] == -1]
plt.scatter(buys.index,  buys["Close"],  marker="^", color="green", s=100, zorder=5, label="BUY")
plt.scatter(sells.index, sells["Close"], marker="v", color="red",   s=100, zorder=5, label="SELL")

plt.title(f"{ticker} — MA Crossover Strategy")
plt.legend()
plt.tight_layout()
plt.show()