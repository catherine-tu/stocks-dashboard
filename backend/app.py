from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import os
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

POLYGON_API_KEY = os.getenv("POLYGON_API_KEY", "")
BASE_URL = "https://api.polygon.io"

# ── File-based cache (survives server restarts) ──────────────────────────────
import json, hashlib
CACHE_DIR = "/tmp/quantdash_cache"
os.makedirs(CACHE_DIR, exist_ok=True)
CACHE_TTL = 60 * 60 * 6 # 6 hrs

def _cache_path(key):
    safe = hashlib.md5(key.encode()).hexdigest()
    return os.path.join(CACHE_DIR, f"{safe}.json")

def cache_get(key):
    try:
        path = _cache_path(key)
        if not os.path.exists(path):
            return None
        with open(path) as f:
            entry = json.load(f)
        if time.time() < entry["expires"]:
            return entry["data"]
        os.remove(path)
    except:
        pass
    return None

def cache_set(key, data, ttl=CACHE_TTL):
    try:
        with open(_cache_path(key), "w") as f:
            json.dump({"data": data, "expires": time.time() + ttl}, f)
    except:
        pass  # cache failure is non-fatal

# ── Rate limiter: max 4 requests per 60s to stay under free tier limit ───────
_request_times = []


def rate_limited_get(path, params={}):
    p = dict(params)
    p["apiKey"] = POLYGON_API_KEY

    for attempt in range(3):
        try:
            r = requests.get(
                f"{BASE_URL}{path}",
                params=p,
                timeout=20   # ⬅️ faster fail, but not too short
            )
            if r.status_code == 429:
                print("[Polygon] Rate limited, retrying...")
                time.sleep(1.5 * (attempt + 1))
                continue

            r.raise_for_status()
            return r.json()

        except requests.exceptions.Timeout:
            print(f"[Timeout] attempt {attempt+1}/3")
            if attempt == 2:
                raise
            time.sleep(1.5 * (attempt + 1))

def polygon_get(path, params={}, cache_key=None):
    """Fetch from cache first, then Polygon."""
    if cache_key:
        cached = cache_get(cache_key)
        if cached is not None:
            print(f"[Cache HIT] {cache_key}")
            return cached
    data = rate_limited_get(path, params)
    if cache_key:
        cache_set(cache_key, data)
    return data

@app.route("/")
def home():
    return {"message": "Stock API is running 🚀"}

# pre-warm the cache
@app.route("/warm")
def warm():
    for t in ["SPY", "QQQ", "AAPL"]:
        try:
            get_history(t)
        except:
            pass
    return {"status": "warmed"}


@app.route("/health")
def health():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat()})

# ── /api/quote/<ticker> ──────────────────────────────────────────────────────
@app.route("/api/quote/<ticker>")
def get_quote(ticker):
    t = ticker.upper()
    try:
        data = polygon_get(
            f"/v2/aggs/ticker/{t}/prev",
            cache_key=f"quote:{t}:{datetime.today().strftime('%Y-%m-%d')}"
        )
        results = data.get("results") or []
        if not results:
            return jsonify({"error": f"No quote data for {t}"}), 404
        r = results[0]
        change = r["c"] - r["o"]
        return jsonify({
            "ticker":     t,
            "close":      round(r["c"], 2),
            "open":       round(r["o"], 2),
            "high":       round(r["h"], 2),
            "low":        round(r["l"], 2),
            "volume":     r["v"],
            "change":     round(change, 2),
            "change_pct": round((change / r["o"]) * 100, 2),
        })
    except Exception as e:
        print(f"[quote/{t}] ERROR: {e}")
        return jsonify({"error": str(e)}), 500

# ── /api/history/<ticker> ────────────────────────────────────────────────────
@app.route("/api/history/<ticker>")
def get_history(ticker):
    t = ticker.upper()
    range_param = request.args.get("range", "6m")
    try:
        # range_map = {"1m": 30, "3m": 90, "6m": 180, "1y": 365, "2y": 730, "5y": 1825}
        range_map = {
            "1m": 30,
            "3m": 90,
            "6m": 180,
            "1y": 365,
            # "2y": 365,   # cap
            # "5y": 365    # cap HARD
        }
        days_back = range_map.get(range_param, 180)
        today     = datetime.today()
        from_date = (today - timedelta(days=days_back)).strftime("%Y-%m-%d")
        to_date   = today.strftime("%Y-%m-%d")

        # cache_key = f"history:{t}:{range_param}:{today.strftime('%Y-%m-%d')}"
        cache_key = f"history:{t}:{range_param}"
        try:
            data = polygon_get(
                f"/v2/aggs/ticker/{t}/range/1/day/{from_date}/{to_date}",
                {"adjusted": "true", "sort": "asc", "limit": 2000},
                cache_key=cache_key,
            )
        except Exception as e:
            print(f"[history/{t}] primary failed, falling back: {e}")

            # fallback to 3 months
            fallback_from = (today - timedelta(days=90)).strftime("%Y-%m-%d")

            data = polygon_get(
                f"/v2/aggs/ticker/{t}/range/1/day/{fallback_from}/{to_date}",
                {"adjusted": "true", "sort": "asc", "limit": 1000},
                cache_key=f"{cache_key}:fallback",
            )

        results = data.get("results") or []
        print(f"[history/{t}] {range_param} → {len(results)} bars")

        if not results:
            msg = data.get("message") or data.get("error") or "No data returned"
            return jsonify({"error": f"{t}: {msg}"}), 404

        bars = [{
            "date":   datetime.fromtimestamp(r["t"] / 1000).strftime("%Y-%m-%d"),
            "open":   round(r["o"], 2),
            "high":   round(r["h"], 2),
            "low":    round(r["l"], 2),
            "close":  round(r["c"], 2),
            "volume": r["v"],
        } for r in results]

        return jsonify({"ticker": t, "bars": bars})

    except Exception as e:
        print(f"[history/{t}] ERROR: {e}")
        return jsonify({"error": str(e)}), 500

# ── /api/watchlist ── fetches all quotes in one batched snapshot ─────────────
@app.route("/api/watchlist")
def get_watchlist():
    tickers = request.args.get("tickers", "SPY,QQQ,AAPL,MSFT,NVDA,TSLA,AMZN,GOOGL").split(",")
    results = []

    # Use Polygon's grouped daily endpoint for a single-request snapshot
    # This costs only 1 API call instead of N calls
    today_str = datetime.today().strftime("%Y-%m-%d")
    cache_key = f"grouped:{today_str}"

    try:
        # Try yesterday if today has no data (market may not have closed yet)
        for days_back in [1, 2, 3]:
            date_str = (datetime.today() - timedelta(days=days_back)).strftime("%Y-%m-%d")
            cache_key = f"grouped:{date_str}"
            try:
                data = polygon_get(
                    f"/v2/aggs/grouped/locale/us/market/stocks/{date_str}",
                    {"adjusted": "true"},
                    cache_key=cache_key,
                )
                grouped = {r["T"]: r for r in (data.get("results") or [])}
                if grouped:
                    break
            except:
                continue

        for t in tickers[:15]:
            t = t.upper()
            r = grouped.get(t)
            if r:
                change = r["c"] - r["o"]
                results.append({
                    "ticker":     t,
                    "close":      round(r["c"], 2),
                    "change":     round(change, 2),
                    "change_pct": round((change / r["o"]) * 100, 2),
                    "volume":     r.get("v", 0),
                })

    except Exception as e:
        print(f"[watchlist] grouped endpoint failed ({e}), falling back to individual quotes")
        # Fallback: fetch individually but slowly
        for t in tickers[:8]:
            t = t.upper()
            try:
                data = polygon_get(
                    f"/v2/aggs/ticker/{t}/prev",
                    cache_key=f"quote:{t}:{datetime.today().strftime('%Y-%m-%d')}"
                )
                rs = data.get("results") or []
                if rs:
                    r = rs[0]
                    change = r["c"] - r["o"]
                    results.append({
                        "ticker":     t,
                        "close":      round(r["c"], 2),
                        "change":     round(change, 2),
                        "change_pct": round((change / r["o"]) * 100, 2),
                        "volume":     r["v"],
                    })
            except Exception as inner_e:
                print(f"[watchlist/{t}] skipped: {inner_e}")

    print(f"[watchlist] returning {len(results)} quotes")
    return jsonify(results)

# ── /api/search/<query> ──────────────────────────────────────────────────────
@app.route("/api/search/<query>")
def search_tickers(query):
    try:
        q = query.strip()
        cache_key = f"search:{q.upper()}"

        # Search twice: once by exact ticker, once by name — merge results
        results_map = {}

        # Pass 1: exact/prefix ticker match (uppercase)
        data = polygon_get(
            "/v3/reference/tickers",
            {"ticker": q.upper(), "active": "true", "limit": 5, "market": "stocks"},
            cache_key=f"ticker_exact:{q.upper()}"
        )
        for r in data.get("results", []):
            results_map[r["ticker"]] = r

        # Pass 2: full-text search (original casing — Polygon matches company names)
        data2 = polygon_get(
            "/v3/reference/tickers",
            {"search": q, "active": "true", "limit": 8, "market": "stocks"},
            cache_key=f"search_name:{q.lower()}"
        )
        for r in data2.get("results", []):
            results_map[r["ticker"]] = r  # deduplicated by ticker

        results = [{"ticker": r["ticker"], "name": r.get("name", "")}
                   for r in results_map.values()][:8]
        return jsonify(results)
    except Exception as e:
        print(f"[search/{query}] ERROR: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print(f"API key loaded: {'YES ✓' if POLYGON_API_KEY else 'NO ✗ — check your .env file'}")
    app.run(debug=True, port=5001)