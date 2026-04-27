import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { AreaChart, Area, BarChart, Bar, Line, Cell, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from "recharts";
import { Search, Settings, RefreshCw, Zap, ArrowUpRight, ArrowDownRight, Building2, BarChart2, Activity, Star } from "lucide-react";

const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_KEY;
const BASE = "https://finnhub.io/api/v1";

// In-memory API cache — 60 s TTL for Finnhub, 5 min for chart data
const _apiCache = new Map();
const api = (path) => {
  const hit = _apiCache.get(path);
  if (hit && Date.now() - hit.ts < 60_000) return Promise.resolve(hit.data);
  return fetch(BASE + path + "&token=" + FINNHUB_KEY)
    .then(r => r.json())
    .then(data => { _apiCache.set(path, { data, ts: Date.now() }); return data; });
};

// Chart data cache — 5 min TTL (OHLCV data doesn't change rapidly)
const _chartCache = new Map();
const fetchChart = (ticker, range, interval) => {
  const key = ticker + "|" + range + "|" + interval;
  const hit = _chartCache.get(key);
  if (hit && Date.now() - hit.ts < 300_000) return Promise.resolve(hit.data);
  return fetch("/api/chart?ticker=" + encodeURIComponent(ticker) + "&range=" + range + "&interval=" + interval)
    .then(r => r.json())
    .then(data => { _chartCache.set(key, { data, ts: Date.now() }); return data; });
};

// Persistent settings helpers
const loadSettings = () => {
  try { return JSON.parse(localStorage.getItem("ov_settings") || "{}"); } catch { return {}; }
};
const saveSettings = (s) => {
  try { localStorage.setItem("ov_settings", JSON.stringify(s)); } catch {}
};

const fmt = {
  price: (v) => v?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  pct: (v) => (v >= 0 ? "+" : "") + v?.toFixed(2) + "%",
  change: (v) => (v >= 0 ? "+" : "") + v?.toFixed(2),
  large: (v) => { if (!v) return "N/A"; if (v >= 1e12) return "$" + (v/1e12).toFixed(2) + "T"; if (v >= 1e9) return "$" + (v/1e9).toFixed(2) + "B"; if (v >= 1e6) return "$" + (v/1e6).toFixed(2) + "M"; return "$" + v?.toLocaleString(); },
  volume: (v) => { if (!v) return "N/A"; if (v >= 1e6) return (v/1e6).toFixed(2) + "M"; if (v >= 1e3) return (v/1e3).toFixed(1) + "K"; return v?.toString(); },
};
const clr = (v) => (v >= 0 ? "#3fb950" : "#f85149");
const bg = (v) => (v >= 0 ? "rgba(63,185,80,0.1)" : "rgba(248,81,73,0.1)");
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const WATCHLIST = ["SPY", "QQQ", "MSFT", "NVDA", "TSLA", "GOOGL", "AMZN", "META"];


function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&family=Inter:wght@300;400;500;600;700&display=swap');

      /* ── Design tokens ────────────────────────────────────────── */
      :root {
        --bg:        #0d1117;
        --surface-0: #0d1117;
        --surface-1: #161b22;
        --surface-2: #1c2230;
        --surface-3: #21262d;

        --border-subtle: rgba(99,110,123,0.10);
        --border:        rgba(99,110,123,0.20);
        --border-hover:  rgba(99,110,123,0.35);
        --border-active: rgba(88,166,255,0.45);
        --border-solid:  #21262d;

        --text-1: #e6edf3;
        --text-2: #8b949e;
        --text-3: #484f58;

        --blue:   #58a6ff;  --blue-dim:  rgba(88,166,255,0.12);
        --green:  #3fb950;  --green-dim: rgba(63,185,80,0.12);
        --red:    #f85149;  --red-dim:   rgba(248,81,73,0.12);
        --yellow: #e3b341;
        --purple: #bc8cff;
        --orange: #f0883e;

        --r-xs: 4px;
        --r-sm: 6px;
        --r:    10px;
        --r-lg: 14px;
        --r-xl: 20px;

        --shadow-xs: 0 1px 2px rgba(0,0,0,0.3);
        --shadow-sm: 0 1px 4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03);
        --shadow:    0 4px 16px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.04);
        --shadow-lg: 0 8px 32px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.05);
        --shadow-blue: 0 0 0 3px rgba(88,166,255,0.14);
        --shadow-glow: 0 0 0 3px rgba(88,166,255,0.14), 0 4px 16px rgba(0,0,0,0.4);

        --ease:     cubic-bezier(0.4, 0, 0.2, 1);
        --ease-out: cubic-bezier(0, 0, 0.2, 1);
        --t-xs:   0.10s cubic-bezier(0.4, 0, 0.2, 1);
        --t-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        --t:      0.20s cubic-bezier(0.4, 0, 0.2, 1);
        --t-slow: 0.30s cubic-bezier(0.4, 0, 0.2, 1);
      }

      * { box-sizing: border-box; }

      body {
        background: var(--bg);
        color: var(--text-1);
        font-family: 'IBM Plex Mono', monospace;
      }

      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(99,110,123,0.28); border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(99,110,123,0.48); }

      /* ── Core panel ─────────────────────────────────────────── */
      .terminal-glow {
        box-shadow: var(--shadow);
      }

      .terminal-panel {
        background: var(--surface-1) !important;
        border: 1px solid var(--border) !important;
        border-radius: var(--r) !important;
        box-shadow: var(--shadow-sm) !important;
        position: relative;
      }

      /* ── Typography ─────────────────────────────────────────── */
      .terminal-header {
        color: var(--text-3) !important;
        font-family: 'IBM Plex Mono', monospace !important;
        letter-spacing: 0.08em !important;
        font-size: 10px !important;
        text-transform: uppercase !important;
        font-weight: 500 !important;
      }
      .terminal-value {
        color: var(--text-1) !important;
        font-family: 'IBM Plex Mono', monospace !important;
      }
      .terminal-muted {
        color: var(--text-3) !important;
        font-family: 'IBM Plex Mono', monospace !important;
      }

      /* ── Navigation ─────────────────────────────────────────── */
      .terminal-nav {
        background: rgba(10,14,20,0.97) !important;
        border-bottom: 1px solid var(--border) !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
      }
      .terminal-nav button {
        font-family: 'IBM Plex Mono', monospace !important;
        letter-spacing: 0.05em !important;
        border-radius: var(--r-sm) !important;
        transition: color var(--t-fast), background var(--t-fast) !important;
      }
      .terminal-nav button:hover {
        color: var(--text-1) !important;
        background: rgba(99,110,123,0.10) !important;
      }
      .terminal-active {
        color: var(--blue) !important;
        border-bottom-color: var(--blue) !important;
      }

      .ticker-tape {
        background: rgba(7,10,16,0.98) !important;
        border-bottom: 1px solid var(--border) !important;
      }
      .top-nav {
        background: rgba(7,10,16,0.98) !important;
        border-bottom: 1px solid var(--border) !important;
      }
      .status-bar {
        background: rgba(7,10,16,0.98) !important;
        border-top: 1px solid var(--border) !important;
        color: var(--text-3) !important;
      }

      /* ── Search ─────────────────────────────────────────────── */
      .search-box {
        background: var(--surface-0) !important;
        border: 1px solid var(--border) !important;
        border-radius: var(--r) !important;
        transition: border-color var(--t-fast), box-shadow var(--t-fast) !important;
      }
      .search-box:focus-within {
        border-color: var(--border-active) !important;
        box-shadow: var(--shadow-blue) !important;
      }

      input {
        font-family: 'IBM Plex Mono', monospace !important;
        color: var(--text-1) !important;
      }
      input::placeholder { color: var(--text-3) !important; }
      button { font-family: 'IBM Plex Mono', monospace !important; cursor: pointer; }

      /* ── Data rows ──────────────────────────────────────────── */
      .metric-row {
        border-bottom: 1px solid var(--border-subtle) !important;
        transition: background var(--t-fast) !important;
      }
      .metric-row:hover { background: rgba(255,255,255,0.018) !important; }

      .watchlist-row { transition: background var(--t-fast) !important; }
      .watchlist-row:hover { background: rgba(255,255,255,0.022) !important; }

      .holding-row { transition: background var(--t-fast) !important; }
      .holding-row:hover { background: rgba(255,255,255,0.022) !important; }

      tr { transition: background var(--t-fast); }
      tr:hover td { background: rgba(255,255,255,0.018) !important; }

      /* ── Interactive cards ──────────────────────────────────── */
      .crypto-card {
        background: var(--surface-0) !important;
        border: 1px solid var(--border) !important;
        border-radius: var(--r) !important;
        transition: border-color var(--t), box-shadow var(--t), transform var(--t) !important;
        box-shadow: var(--shadow-sm) !important;
      }
      .crypto-card:hover {
        border-color: var(--border-hover) !important;
        box-shadow: var(--shadow) !important;
        transform: translateY(-2px) !important;
      }
      .crypto-card.active {
        border-color: var(--border-active) !important;
        background: rgba(31,111,235,0.08) !important;
        box-shadow: var(--shadow-glow) !important;
      }

      .tf-button {
        font-family: 'IBM Plex Mono', monospace !important;
        font-size: 10px !important;
        border-radius: var(--r-sm) !important;
        transition: all var(--t-fast) !important;
      }
      .tf-button:hover { background: rgba(99,110,123,0.09) !important; }
      .tf-button.active {
        background: rgba(31,111,235,0.14) !important;
        color: var(--blue) !important;
        box-shadow: inset 0 0 0 1px rgba(88,166,255,0.28) !important;
      }

      .news-card {
        border: 1px solid var(--border) !important;
        border-radius: var(--r) !important;
        transition: border-color var(--t), background var(--t),
                    box-shadow var(--t), transform var(--t) !important;
      }
      .news-card:hover {
        border-color: var(--border-hover) !important;
        background: var(--surface-2) !important;
        box-shadow: var(--shadow) !important;
        transform: translateY(-1px) !important;
      }

      .eye-card {
        background: var(--surface-0) !important;
        border: 1px solid var(--border) !important;
        border-radius: var(--r) !important;
        transition: border-color var(--t), background var(--t),
                    box-shadow var(--t), transform var(--t) !important;
        box-shadow: var(--shadow-sm) !important;
      }
      .eye-card:hover {
        border-color: var(--border-active) !important;
        background: rgba(88,166,255,0.05) !important;
        box-shadow: var(--shadow-glow) !important;
        transform: translateY(-3px) !important;
      }
      .eye-card.active {
        border-color: var(--border-active) !important;
        background: rgba(31,111,235,0.08) !important;
        box-shadow: var(--shadow-glow) !important;
      }

      /* ── Branding ────────────────────────────────────────────── */
      .logo-text {
        font-family: 'IBM Plex Sans', sans-serif !important;
        font-weight: 600 !important;
        color: var(--text-1) !important;
        letter-spacing: 0.15em !important;
      }

      .live-dot {
        background: var(--green) !important;
        box-shadow: 0 0 5px rgba(63,185,80,0.55) !important;
        animation: live-pulse 2.4s ease-in-out infinite !important;
      }
      @keyframes live-pulse {
        0%, 100% { box-shadow: 0 0 4px rgba(63,185,80,0.45); }
        50%       { box-shadow: 0 0 9px rgba(63,185,80,0.80); }
      }

      .positive { color: var(--green) !important; }
      .negative { color: var(--red)   !important; }

      .coming-soon-badge {
        border-color: var(--border) !important;
        color: var(--text-2) !important;
        border-radius: var(--r-sm) !important;
      }
      .feature-badge {
        border-color: var(--border-subtle) !important;
        color: var(--text-3) !important;
        border-radius: var(--r-sm) !important;
      }

      /* ── Form focus ──────────────────────────────────────────── */
      .pf-input:focus {
        border-color: var(--border-active) !important;
        box-shadow: var(--shadow-blue) !important;
        outline: none !important;
      }

      /* ── Utility animations ──────────────────────────────────── */
      @keyframes fade-up {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0);   }
      }
      .fade-up { animation: fade-up 0.22s var(--ease) both; }

      /* Smooth page-level entries */
      @keyframes fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      /* Recharts tooltip polish */
      .recharts-tooltip-wrapper { filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5)) !important; }

      /* ── App shell grid ──────────────────────────────────────── */
      .app-shell {
        display: grid !important;
        grid-template-areas:
          "topbar  topbar  topbar"
          "sidebar main    right"
          "status  status  status" !important;
        grid-template-rows: 40px 1fr 22px !important;
        grid-template-columns: var(--sidebar-w, 48px) 1fr 260px !important;
        height: 100vh !important;
        overflow: hidden !important;
        transition: grid-template-columns 0.22s var(--ease) !important;
      }
      .app-shell.sidebar-open {
        --sidebar-w: 180px !important;
      }

      /* ── Global top bar ──────────────────────────────────────── */
      .global-topbar {
        grid-area: topbar !important;
        background: rgba(7,10,16,0.98) !important;
        border-bottom: 1px solid var(--border) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        display: flex !important;
        align-items: center !important;
        gap: 0 !important;
        padding: 0 12px !important;
        z-index: 100 !important;
        flex-shrink: 0 !important;
      }

      /* ── Left sidebar ────────────────────────────────────────── */
      .app-sidebar {
        grid-area: sidebar !important;
        background: rgba(7,10,16,0.98) !important;
        border-right: 1px solid var(--border) !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        z-index: 50 !important;
      }
      .sidebar-item {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        padding: 9px 14px !important;
        cursor: pointer !important;
        border-left: 2px solid transparent !important;
        transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast) !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        font-family: 'Inter', 'IBM Plex Sans', sans-serif !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        color: var(--text-2) !important;
        text-decoration: none !important;
        border-radius: 0 !important;
      }
      .sidebar-item:hover {
        background: rgba(99,110,123,0.09) !important;
        color: var(--text-1) !important;
      }
      .sidebar-item.active {
        border-left-color: var(--blue) !important;
        color: var(--blue) !important;
        background: rgba(88,166,255,0.07) !important;
      }
      .sidebar-icon {
        font-size: 15px !important;
        flex-shrink: 0 !important;
        width: 20px !important;
        text-align: center !important;
      }
      .sidebar-label {
        opacity: 0 !important;
        transition: opacity 0.18s var(--ease) !important;
        pointer-events: none !important;
        font-size: 12px !important;
      }
      .app-shell.sidebar-open .sidebar-label {
        opacity: 1 !important;
      }

      /* ── Main content ────────────────────────────────────────── */
      .app-main {
        grid-area: main !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
      }

      /* ── Right panel ─────────────────────────────────────────── */
      .app-right {
        grid-area: right !important;
        background: rgba(7,10,16,0.98) !important;
        border-left: 1px solid var(--border) !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }
      .right-section-header {
        font-family: 'Inter', sans-serif !important;
        font-size: 10px !important;
        font-weight: 600 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.09em !important;
        color: var(--text-3) !important;
        padding: 8px 12px 6px !important;
        border-bottom: 1px solid var(--border-subtle) !important;
      }

      /* ── Asset view tiers ────────────────────────────────────── */
      .asset-hero {
        flex-shrink: 0 !important;
        padding: 12px 14px 10px !important;
        border-bottom: 1px solid var(--border-subtle) !important;
      }
      .asset-ticker-name {
        font-family: 'Inter', sans-serif !important;
        font-size: 11px !important;
        font-weight: 600 !important;
        color: var(--text-2) !important;
        letter-spacing: 0.04em !important;
        text-transform: uppercase !important;
      }
      .asset-price {
        font-family: 'IBM Plex Mono', monospace !important;
        font-size: 28px !important;
        font-weight: 600 !important;
        color: var(--text-1) !important;
        letter-spacing: -0.02em !important;
        line-height: 1 !important;
      }
      .asset-change {
        font-family: 'IBM Plex Mono', monospace !important;
        font-size: 13px !important;
        font-weight: 500 !important;
      }
      .asset-metrics-grid {
        display: grid !important;
        grid-template-columns: repeat(4, 1fr) !important;
        border-bottom: 1px solid var(--border-subtle) !important;
        flex-shrink: 0 !important;
      }
      .metric-cell {
        padding: 7px 12px !important;
        border-right: 1px solid var(--border-subtle) !important;
        border-bottom: 1px solid var(--border-subtle) !important;
      }
      .metric-cell:nth-child(4n) { border-right: none !important; }
      .metric-cell-label {
        font-family: 'Inter', sans-serif !important;
        font-size: 9px !important;
        font-weight: 600 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.08em !important;
        color: var(--text-3) !important;
        margin-bottom: 2px !important;
      }
      .metric-cell-value {
        font-family: 'IBM Plex Mono', monospace !important;
        font-size: 11px !important;
        font-weight: 500 !important;
        color: var(--text-1) !important;
      }
      .asset-tabs-bar {
        display: flex !important;
        border-bottom: 1px solid var(--border-subtle) !important;
        flex-shrink: 0 !important;
        overflow-x: auto !important;
        padding: 0 4px !important;
      }
      .asset-tab-btn {
        font-family: 'Inter', sans-serif !important;
        font-size: 11px !important;
        font-weight: 500 !important;
        padding: 7px 14px !important;
        background: none !important;
        border: none !important;
        border-bottom: 2px solid transparent !important;
        color: var(--text-2) !important;
        cursor: pointer !important;
        white-space: nowrap !important;
        transition: color var(--t-fast), border-color var(--t-fast) !important;
        flex-shrink: 0 !important;
      }
      .asset-tab-btn:hover { color: var(--text-1) !important; }
      .asset-tab-btn.active {
        color: var(--blue) !important;
        border-bottom-color: var(--blue) !important;
      }
      .asset-tab-content {
        flex: 1 !important;
        overflow-y: auto !important;
        padding: 10px 14px !important;
      }

      /* ── Dense data tables ───────────────────────────────────── */
      .dense-table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-family: 'IBM Plex Mono', monospace !important;
        font-size: 11px !important;
      }
      .dense-table thead tr {
        position: sticky !important;
        top: -10px !important;
        z-index: 10 !important;
        background: var(--bg) !important;
      }
      .dense-table th {
        font-family: 'Inter', sans-serif !important;
        font-size: 9px !important;
        font-weight: 600 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.08em !important;
        color: var(--text-3) !important;
        padding: 5px 8px 6px !important;
        border-bottom: 1px solid var(--border-subtle) !important;
        text-align: right !important;
      }
      .dense-table th:first-child { text-align: left !important; }
      .dense-table td {
        padding: 4px 8px !important;
        border-bottom: 1px solid rgba(99,110,123,0.06) !important;
        color: var(--text-1) !important;
        text-align: right !important;
      }
      .dense-table td:first-child { text-align: left !important; }
      .dense-table tr:hover td { background: rgba(255,255,255,0.02) !important; }

      /* ── Order ticket ────────────────────────────────────────── */
      .order-ticket-input {
        width: 100% !important;
        background: var(--surface-2) !important;
        border: 1px solid var(--border) !important;
        border-radius: var(--r-sm) !important;
        color: var(--text-1) !important;
        font-family: 'IBM Plex Mono', monospace !important;
        font-size: 12px !important;
        padding: 5px 8px !important;
        outline: none !important;
        transition: border-color var(--t-fast) !important;
      }
      .order-ticket-input:focus {
        border-color: var(--border-active) !important;
        box-shadow: var(--shadow-blue) !important;
      }

      /* ── TF range buttons ────────────────────────────────────── */
      .tf-btn-group {
        display: flex !important;
        gap: 2px !important;
        padding: 2px !important;
        background: var(--surface-2) !important;
        border-radius: var(--r-sm) !important;
      }
      .tf-btn {
        font-family: 'Inter', sans-serif !important;
        font-size: 10px !important;
        font-weight: 600 !important;
        padding: 3px 8px !important;
        border: none !important;
        border-radius: 4px !important;
        background: transparent !important;
        color: var(--text-2) !important;
        cursor: pointer !important;
        transition: all var(--t-fast) !important;
      }
      .tf-btn:hover { color: var(--text-1) !important; background: rgba(99,110,123,0.12) !important; }
      .tf-btn.active {
        background: var(--surface-3) !important;
        color: var(--text-1) !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.4) !important;
      }
    `}</style>
  );
}


function CommoditiesDashboard() {
  const COMMODITIES = [
    { ticker: "GC=F", label: "Gold", symbol: "XAU", unit: "$/oz", category: "Metals" },
    { ticker: "SI=F", label: "Silver", symbol: "XAG", unit: "$/oz", category: "Metals" },
    { ticker: "HG=F", label: "Copper", symbol: "XCU", unit: "$/lb", category: "Metals" },
    { ticker: "PL=F", label: "Platinum", symbol: "XPT", unit: "$/oz", category: "Metals" },
    { ticker: "CL=F", label: "WTI Crude", symbol: "WTI", unit: "$/bbl", category: "Energy" },
    { ticker: "BZ=F", label: "Brent Crude", symbol: "BRT", unit: "$/bbl", category: "Energy" },
    { ticker: "NG=F", label: "Natural Gas", symbol: "NG", unit: "$/MMBtu", category: "Energy" },
    { ticker: "RB=F", label: "Gasoline", symbol: "RB", unit: "$/gal", category: "Energy" },
    { ticker: "ZW=F", label: "Wheat", symbol: "ZW", unit: "$/bu", category: "Agriculture" },
    { ticker: "ZC=F", label: "Corn", symbol: "ZC", unit: "$/bu", category: "Agriculture" },
    { ticker: "ZS=F", label: "Soybeans", symbol: "ZS", unit: "$/bu", category: "Agriculture" },
    { ticker: "KC=F", label: "Coffee", symbol: "KC", unit: "$/lb", category: "Agriculture" },
  ];

  const [prices,   setPrices]   = useState({});
  const [active,   setActive]   = useState("GC=F");
  const [category, setCategory] = useState("Metals");

  useEffect(() => {
    Promise.all(
      COMMODITIES.map(c =>
        fetchChart(c.ticker, "1d", "1m")
          .then(d => {
            const meta = d?.chart?.result?.[0]?.meta;
            const price = meta?.regularMarketPrice;
            const prev  = meta?.previousClose;
            const changePct = price && prev ? ((price - prev) / prev) * 100 : null;
            return [c.ticker, { price, changePct }];
          })
          .catch(() => [c.ticker, null])
      )
    ).then(results => setPrices(Object.fromEntries(results)));
  }, []); // eslint-disable-line

  const activeCommodity = COMMODITIES.find(c => c.ticker === active);
  const categories = ["Metals", "Energy", "Agriculture"];
  const filtered = COMMODITIES.filter(c => c.category === category);

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "340px 1fr", gridTemplateRows: "auto 1fr" }}>
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "1/3", overflowY: "auto" }}>
        <div className="terminal-header mb-3">🛢 Commodities Futures</div>
        <div className="flex gap-2 mb-3">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className="px-3 py-1 text-xs font-mono border rounded transition-colors"
              style={{ borderColor: category === cat ? "#58a6ff" : "#21262d", color: category === cat ? "#58a6ff" : "#7d8590", background: category === cat ? "#0c2044" : "transparent" }}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {filtered.map(c => {
            const d = prices[c.ticker];
            const isActive = active === c.ticker;
            return (
              <div key={c.ticker} onClick={() => setActive(c.ticker)}
                className="flex items-center justify-between p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "#0c2044" : "transparent", border: "1px solid", borderColor: isActive ? "#58a6ff44" : "#1c2128" }}>
                <div>
                  <div className="text-xs font-mono font-bold" style={{ color: isActive ? "#58a6ff" : "#e6edf3" }}>{c.label}</div>
                  <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{c.symbol} · {c.unit}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{d ? "$" + fmt.price(d.price) : "..."}</div>
                  {d && (
                    <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#58a6ff" : "#f85149" }}>
                      {d.changePct >= 0 ? "▲" : "▼"} {Math.abs(d.changePct).toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "1/2" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="terminal-header">{activeCommodity?.label}</span>
          <span className="font-mono" style={{ color:"#484f58", fontSize:9 }}>{activeCommodity?.unit}</span>
          {prices[active]?.price && (
            <span className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:14, marginLeft:4 }}>${fmt.price(prices[active].price)}</span>
          )}
          {prices[active]?.changePct != null && (
            <span className="font-mono" style={{ color:clr(prices[active].changePct), fontSize:11 }}>
              {prices[active].changePct >= 0 ? "▲" : "▼"} {Math.abs(prices[active].changePct).toFixed(2)}%
            </span>
          )}
        </div>
        <div style={{ height: 280 }}>
          <UniversalChart ticker={active} height={280} showVolume defaultTf="3M" />
        </div>
      </div>
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "2/3" }}>
        <div className="terminal-header mb-3">Market Summary</div>
        <div className="grid grid-cols-3 gap-2">
          {COMMODITIES.map(c => {
            const d = prices[c.ticker];
            return (
              <div key={c.ticker} onClick={() => { setActive(c.ticker); setCategory(c.category); }}
                className="p-2 rounded cursor-pointer transition-colors"
                style={{ background: "#0d1117", border: "1px solid #1c2128" }}>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{c.symbol}</div>
                <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{d ? "$" + fmt.price(d.price) : "..."}</div>
                {d && <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#58a6ff" : "#f85149" }}>{d.changePct >= 0 ? "▲" : "▼"}{Math.abs(d.changePct).toFixed(2)}%</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function CryptoDashboard() {
  const COINS = [
    { ticker: "BTC-USD", label: "Bitcoin", symbol: "BTC" },
    { ticker: "ETH-USD", label: "Ethereum", symbol: "ETH" },
    { ticker: "SOL-USD", label: "Solana", symbol: "SOL" },
    { ticker: "BNB-USD", label: "BNB", symbol: "BNB" },
    { ticker: "XRP-USD", label: "XRP", symbol: "XRP" },
    { ticker: "DOGE-USD", label: "Dogecoin", symbol: "DOGE" },
    { ticker: "ADA-USD", label: "Cardano", symbol: "ADA" },
    { ticker: "AVAX-USD", label: "Avalanche", symbol: "AVAX" },
    { ticker: "LINK-USD", label: "Chainlink", symbol: "LINK" },
    { ticker: "DOT-USD", label: "Polkadot", symbol: "DOT" },
    { ticker: "MATIC-USD", label: "Polygon", symbol: "MATIC" },
    { ticker: "UNI7083-USD", label: "Uniswap", symbol: "UNI" },
  ];

  const [prices, setPrices] = useState({});
  const [active, setActive] = useState("BTC-USD");
  const activeCoin = COINS.find(c => c.ticker === active);

  useEffect(() => {
    Promise.all(
      COINS.map(c =>
        fetchChart(c.ticker, "1d", "1m")
          .then(d => {
            const meta = d?.chart?.result?.[0]?.meta;
            const price = meta?.regularMarketPrice;
            const prev  = meta?.previousClose;
            const changePct = price && prev ? ((price - prev) / prev) * 100 : null;
            return [c.ticker, { price, changePct }];
          })
          .catch(() => [c.ticker, null])
      )
    ).then(results => setPrices(Object.fromEntries(results)));
  }, []); // eslint-disable-line

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "280px 1fr", gridTemplateRows: "1fr auto" }}>
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "1/3", overflowY: "auto" }}>
        <div className="terminal-header mb-3">₿ Crypto Markets</div>
        <div className="flex flex-col gap-1">
          {COINS.map(c => {
            const d = prices[c.ticker];
            const isActive = active === c.ticker;
            return (
              <div key={c.ticker} onClick={() => setActive(c.ticker)}
                className="flex items-center justify-between p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "#0c2044" : "transparent", border: "1px solid", borderColor: isActive ? "#58a6ff44" : "#1c2128" }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold"
                    style={{ background: "#1c2128", color: isActive ? "#58a6ff" : "#7d8590" }}>{c.symbol.slice(0,1)}</div>
                  <div>
                    <div className="text-xs font-mono font-bold" style={{ color: isActive ? "#58a6ff" : "#e6edf3" }}>{c.label}</div>
                    <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{c.symbol}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{d?.price ? "$" + fmt.price(d.price) : "..."}</div>
                  {d?.changePct != null && <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#58a6ff" : "#f85149" }}>{d.changePct >= 0 ? "▲" : "▼"}{Math.abs(d.changePct).toFixed(2)}%</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3 flex flex-col" style={{ gridColumn: "2/3", gridRow: "1/2" }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="terminal-header">{activeCoin?.label} ({activeCoin?.symbol})</span>
          {prices[active]?.price && <span className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:18 }}>${fmt.price(prices[active].price)}</span>}
          {prices[active]?.changePct != null && <span className="font-mono" style={{ color:clr(prices[active].changePct), fontSize:12 }}>{prices[active].changePct>=0?"▲":"▼"}{Math.abs(prices[active].changePct).toFixed(2)}%</span>}
        </div>
        <div style={{ flex:1, minHeight:280 }}>
          <UniversalChart ticker={active} height={280} showVolume defaultTf="1M" />
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "2/3" }}>
        <div className="terminal-header mb-3">24h Market Overview</div>
        <div className="grid grid-cols-4 gap-2">
          {COINS.slice(0, 8).map(c => {
            const d = prices[c.ticker];
            return (
              <div key={c.ticker} onClick={() => setActive(c.ticker)}
                className="p-2 rounded cursor-pointer"
                style={{ background: "#0d1117", border: "1px solid #1c2128" }}>
                <div className="text-xs font-mono font-bold" style={{ color: "#7d8590" }}>{c.symbol}</div>
                <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{d?.price ? "$" + fmt.price(d.price) : "..."}</div>
                {d?.changePct != null && <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#58a6ff" : "#f85149" }}>{d.changePct >= 0 ? "▲" : "▼"}{Math.abs(d.changePct).toFixed(2)}%</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}





function FXDashboard({ onOpenResearch }) {
  const FX_PAIRS = [
    { ticker: "EURUSD=X",  label: "EUR/USD",  region: "Eurozone", dec: 4 },
    { ticker: "GBPUSD=X",  label: "GBP/USD",  region: "UK",       dec: 4 },
    { ticker: "USDJPY=X",  label: "USD/JPY",  region: "Japan",    dec: 2 },
    { ticker: "USDCHF=X",  label: "USD/CHF",  region: "Switzerland", dec: 4 },
    { ticker: "AUDUSD=X",  label: "AUD/USD",  region: "Australia",dec: 4 },
    { ticker: "USDCAD=X",  label: "USD/CAD",  region: "Canada",   dec: 4 },
    { ticker: "USDCNY=X",  label: "USD/CNY",  region: "China",    dec: 4 },
    { ticker: "DX=F",      label: "DXY Index",region: "Global",   dec: 3 },
    { ticker: "USDINR=X",  label: "USD/INR",  region: "India",    dec: 2 },
    { ticker: "USDMXN=X",  label: "USD/MXN",  region: "Mexico",   dec: 4 },
    { ticker: "USDBRL=X",  label: "USD/BRL",  region: "Brazil",   dec: 4 },
    { ticker: "USDKRW=X",  label: "USD/KRW",  region: "S. Korea", dec: 0 },
  ];

  const CB_SERIES = [
    { id: "FEDFUNDS",          label: "Fed Funds",    flag: "🇺🇸", bank: "Federal Reserve"  },
    { id: "ECBDFR",            label: "ECB Rate",     flag: "🇪🇺", bank: "ECB"              },
    { id: "INTDSRGBM193N",     label: "BoE Rate",     flag: "🇬🇧", bank: "Bank of England"  },
    { id: "IRSTCI01CHM156N",   label: "SNB Rate",     flag: "🇨🇭", bank: "Swiss Natl Bank"  },
    { id: "IRSTCI01AUM156N",   label: "RBA Rate",     flag: "🇦🇺", bank: "Reserve Bank Au"  },
    { id: "IRSTCI01CAM156N",   label: "BoC Rate",     flag: "🇨🇦", bank: "Bank of Canada"   },
  ];

  const [prices,    setPrices]    = useState({});
  const [active,    setActive]    = useState("EURUSD=X");
  const [cbRates,   setCbRates]   = useState({});

  // Fetch all FX prices (Yahoo Finance via /api/chart)
  useEffect(() => {
    Promise.all(
      FX_PAIRS.map(p =>
        fetch("/api/chart?ticker=" + encodeURIComponent(p.ticker) + "&range=1d&interval=1m")
          .then(r => r.json())
          .then(d => {
            const meta = d?.chart?.result?.[0]?.meta;
            const price = meta?.regularMarketPrice;
            const prev  = meta?.previousClose;
            const changePct = price && prev ? ((price - prev) / prev) * 100 : null;
            return [p.ticker, { price, changePct }];
          })
          .catch(() => [p.ticker, null])
      )
    ).then(results => setPrices(Object.fromEntries(results)));
  }, []); // eslint-disable-line

  // Fetch central bank rates from FRED
  useEffect(() => {
    Promise.all(
      CB_SERIES.map(s =>
        fetch("/api/fred?series=" + s.id)
          .then(r => r.json())
          .then(d => {
            const valid = (d.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
            const latest = valid[valid.length - 1];
            return [s.id, { ...s, value: latest ? parseFloat(latest.value) : null, date: latest?.date }];
          })
          .catch(() => [s.id, { ...s, value: null }])
      )
    ).then(results => setCbRates(Object.fromEntries(results)));
  }, []); // eslint-disable-line

  const activePairCfg = FX_PAIRS.find(p => p.ticker === active);
  const activeDec = activePairCfg?.dec ?? 4;
  const activePrice = prices[active];

  return (
    <div className="flex-1 p-3" style={{ display:"grid", gridTemplateColumns:"240px 1fr 200px", gridTemplateRows:"1fr auto", gap:12, height:"calc(100vh - 90px)", overflow:"hidden" }}>

      {/* Left: FX pairs list */}
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn:"1/2", gridRow:"1/3", overflowY:"auto" }}>
        <div className="terminal-header mb-3">💱 FX Pairs</div>
        <div className="flex flex-col gap-1">
          {FX_PAIRS.map(p => {
            const d = prices[p.ticker];
            const isActive = active === p.ticker;
            return (
              <div key={p.ticker} onClick={() => setActive(p.ticker)}
                className="flex items-center justify-between p-2 rounded cursor-pointer"
                style={{ background:isActive?"#0c2044":"transparent", border:"1px solid", borderColor:isActive?"#3fb95044":"#1c2128" }}>
                <div>
                  <div className="text-xs font-mono font-bold" style={{ color:isActive?"#3fb950":"#e6edf3" }}>{p.label}</div>
                  <div className="text-xs font-mono" style={{ color:"#484f58" }}>{p.region}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold" style={{ color:"#e6edf3" }}>
                    {d?.price != null ? d.price.toFixed(p.dec) : "…"}
                  </div>
                  {d?.changePct != null && (
                    <div className="text-xs font-mono" style={{ color:d.changePct>=0?"#3fb950":"#f85149" }}>
                      {d.changePct>=0?"▲":"▼"}{Math.abs(d.changePct).toFixed(3)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center: Chart */}
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn:"2/3", gridRow:"1/2" }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="terminal-header">{activePairCfg?.label} · {activePairCfg?.region}</div>
            {activePrice && (
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:22 }}>
                  {activePrice.price != null ? activePrice.price.toFixed(activeDec) : "—"}
                </span>
                {activePrice.changePct != null && (
                  <span className="text-xs font-mono" style={{ color:clr(activePrice.changePct) }}>
                    {activePrice.changePct>=0?"▲":"▼"} {Math.abs(activePrice.changePct).toFixed(3)}%
                  </span>
                )}
              </div>
            )}
          </div>
          {onOpenResearch && (
            <button onClick={() => onOpenResearch({ id:active, label:activePairCfg?.label||active, type:"fx", ticker:active, category:"FX" })}
              className="font-mono px-2 py-1 text-xs rounded"
              style={{ background:"#0c2044", border:"1px solid #3fb95033", color:"#3fb950", cursor:"pointer" }}>
              → Research
            </button>
          )}
        </div>
        <UniversalChart ticker={active} height={260} defaultTf="3M" prefix="" decimals={activeDec} label={activePairCfg?.label} />
      </div>

      {/* Right: Central bank rates */}
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn:"3/4", gridRow:"1/2", overflowY:"auto" }}>
        <div className="terminal-header mb-3">🏦 Central Bank Rates</div>
        <div className="flex flex-col gap-2">
          {CB_SERIES.map(s => {
            const r = cbRates[s.id];
            return (
              <div key={s.id} className="p-2 rounded" style={{ background:"#0d1117", border:"1px solid #1c2128" }}>
                <div className="text-xs font-mono" style={{ color:"#484f58" }}>{s.flag} {s.bank}</div>
                <div className="font-mono font-bold text-sm mt-0.5" style={{ color:"#e3b341" }}>
                  {r?.value != null ? r.value.toFixed(2) + "%" : "—"}
                </div>
                <div className="text-xs font-mono" style={{ color:"#7d8590" }}>{s.label}</div>
                {r?.date && <div className="text-xs font-mono" style={{ color:"#21262d" }}>As of {r.date}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom: FX heat map */}
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn:"2/4", gridRow:"2/3" }}>
        <div className="terminal-header mb-3">📊 Day Change Heat Map</div>
        <div className="grid gap-2" style={{ gridTemplateColumns:"repeat(auto-fill, minmax(110px, 1fr))" }}>
          {FX_PAIRS.map(p => {
            const d = prices[p.ticker];
            const pct = d?.changePct;
            const intensity = pct != null ? Math.min(Math.abs(pct)/0.8, 1) : 0;
            const bgColor = pct == null ? "#0d1117"
              : pct >= 0 ? "rgba(63,185,80," + (0.08 + intensity*0.15) + ")"
              : "rgba(248,81,73," + (0.08 + intensity*0.15) + ")";
            return (
              <div key={p.ticker} onClick={() => setActive(p.ticker)} className="p-2 rounded cursor-pointer"
                style={{ background:bgColor, border:"1px solid", borderColor:active===p.ticker?"#3fb95066":"#1c2128" }}>
                <div className="text-xs font-mono font-bold" style={{ color:"#e6edf3" }}>{p.label}</div>
                <div className="text-xs font-mono" style={{ color:pct==null?"#7d8590":clr(pct) }}>
                  {pct != null ? (pct>=0?"▲":"▼") + Math.abs(pct).toFixed(3)+"%" : "…"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SupplyChainDashboard({ onOpenResearch }) {
  const FRED_SERIES = [
    { id: "FEDFUNDS",    label: "Fed Funds Rate",          note: "FOMC policy rate",                src: "Federal Reserve", suffix: "%",  freq: "Monthly" },
    { id: "DGS10",       label: "US 10Y Treasury",         note: "Risk-free rate benchmark",        src: "US Treasury",     suffix: "%",  freq: "Daily"   },
    { id: "DGS2",        label: "US 2Y Treasury",          note: "Short-term rate expectation",     src: "US Treasury",     suffix: "%",  freq: "Daily"   },
    { id: "T10Y2Y",      label: "Yield Curve (10Y-2Y)",    note: "Inversion = recession signal",    src: "Fed",             suffix: "%",  freq: "Daily"   },
    { id: "T10YIE",      label: "10Y Breakeven Inflation", note: "Market inflation expectation",    src: "Fed",             suffix: "%",  freq: "Daily"   },
    { id: "CPIAUCSL",    label: "CPI (Urban)",             note: "Consumer price inflation",        src: "BLS",             suffix: "",   freq: "Monthly" },
    { id: "PCEPI",       label: "PCE Price Index",         note: "Fed's preferred inflation gauge", src: "BEA",             suffix: "",   freq: "Monthly" },
    { id: "PPIACO",      label: "PPI All Commodities",     note: "Producer price inflation",        src: "BLS",             suffix: "",   freq: "Monthly" },
    { id: "UNRATE",      label: "Unemployment Rate",       note: "US labor market health",          src: "BLS",             suffix: "%",  freq: "Monthly" },
    { id: "GDP",         label: "US Real GDP",             note: "Quarterly economic output",       src: "BEA",             suffix: "",   freq: "Quarterly"},
    { id: "M2SL",        label: "M2 Money Supply",         note: "Broad money supply ($B)",         src: "Federal Reserve", suffix: "B",  freq: "Monthly" },
    { id: "BOPGSTB",     label: "US Trade Balance",        note: "Monthly goods trade deficit",     src: "Census",          suffix: "M",  freq: "Monthly" },
  ];

  const INDICES = [
    { ticker: "HG=F", label: "Copper (Dr. Copper)", symbol: "HG", desc: "Global economic health proxy" },
    { ticker: "NG=F", label: "Natural Gas", symbol: "NG", desc: "Energy & heating cost" },
    { ticker: "CL=F", label: "WTI Crude Oil", symbol: "WTI", desc: "Global transport cost" },
    { ticker: "ZW=F", label: "Wheat", symbol: "ZW", desc: "Food supply stress indicator" },
  ];





  const [prices, setPrices] = useState({});
  const [active, setActive] = useState("CL=F");
  const [fredData, setFredData] = useState({});

  useEffect(() => {
    Promise.all(
      FRED_SERIES.map(s =>
        fetch("/api/fred?series=" + s.id)
          .then(r => r.json())
          .then(d => {
            const valid = (d.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
            const latest = valid[valid.length - 1];
            const prev   = valid[valid.length - 2];
            const val    = latest ? parseFloat(latest.value) : NaN;
            const prevVal = prev ? parseFloat(prev.value) : NaN;
            const change = !isNaN(val) && !isNaN(prevVal) ? val - prevVal : null;
            return [s.id, { value: !isNaN(val) ? val : null, change, date: latest?.date }];
          })
          .catch(() => [s.id, null])
      )
    ).then(results => setFredData(Object.fromEntries(results)));
  }, []); // eslint-disable-line

  useEffect(() => {
    Promise.all(
      INDICES.map(c =>
        fetch("/api/chart?ticker=" + encodeURIComponent(c.ticker) + "&range=1d&interval=1m")
          .then(r => r.json())
          .then(d => {
            const meta = d?.chart?.result?.[0]?.meta;
            const price = meta?.regularMarketPrice;
            const prev = meta?.previousClose;
            const change = price - prev;
            const changePct = (change / prev) * 100;
            return [c.ticker, { price, change, changePct }];
          })
          .catch(() => [c.ticker, null])
      )
    ).then(results => setPrices(Object.fromEntries(results)));
  }, []); // eslint-disable-line

  const activeIndex = INDICES.find(c => c.ticker === active);

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "280px 1fr" }}>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "1/3", overflowY: "auto" }}>
        <div className="terminal-header mb-1">📊 Macro Indicators</div>
        <div className="text-xs font-mono mb-3" style={{ color: "#7d8590" }}>Monthly published figures</div>
        <div className="flex flex-col gap-1">
          {FRED_SERIES.map(s => {
            const d = fredData[s.id];
            const val = d?.value;
            const chg = d?.change;
            const display = val != null
              ? s.id === "BOPGSTB" ? "$" + (val/1000).toFixed(1) + "B"
              : s.id === "M2SL"    ? "$" + (val/1000).toFixed(2) + "T"
              : s.id === "GDP"     ? "$" + (val/1000).toFixed(1) + "T"
              : val.toFixed(2) + s.suffix
              : "Loading...";
            const chgDisplay = chg != null ? (chg >= 0 ? "+" : "") + chg.toFixed(2) + s.suffix : "—";
            const chgColor = chg == null ? "#7d8590" : chg >= 0 ? "#58a6ff" : "#f85149";
            const researchItem = { id: s.id, label: s.label, type: "macro", series: s.id, category: "Macro" };
            return (
              <div key={s.id} className="p-2 rounded" onClick={() => onOpenResearch && onOpenResearch(researchItem)}
                style={{ background: "#0d1117", border: "1px solid #1c2128", cursor: onOpenResearch ? "pointer" : "default" }}
                onMouseEnter={e => { if (onOpenResearch) e.currentTarget.style.borderColor="rgba(99,110,123,0.40)"; }}
                onMouseLeave={e => { if (onOpenResearch) e.currentTarget.style.borderColor="#1c2128"; }}>
                <div className="flex items-center justify-between mb-0.5">
                  <div>
                    <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{s.label}</div>
                    <div className="text-xs font-mono" style={{ color: "#21262d" }}>{s.src} · {s.freq}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold" style={{ color: "#e3b341" }}>{display}</div>
                    <div className="text-xs font-mono" style={{ color: chgColor }}>{chgDisplay}</div>
                  </div>
                </div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{s.note}</div>
                {d?.date && <div className="text-xs font-mono" style={{ color: "#21262d" }}>As of {d.date}</div>}
              </div>
            );
          })}
        </div>

        <div className="terminal-header mt-4 mb-2">⚡ Live Market Proxies</div>
        <div className="flex flex-col gap-1">
          {INDICES.map(c => {
            const d = prices[c.ticker];
            const isActive = active === c.ticker;
            return (
              <div key={c.ticker} onClick={() => setActive(c.ticker)}
                className="p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "#0c2044" : "#0d1117", border: "1px solid", borderColor: isActive ? "#58a6ff44" : "#1c2128" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono font-bold" style={{ color: isActive ? "#58a6ff" : "#e6edf3" }}>{c.label}</div>
                    <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{c.desc}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{d ? (d.price > 100 ? d.price.toFixed(0) : d.price.toFixed(2)) : "..."}</div>
                    {d && <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#58a6ff" : "#f85149" }}>{d.changePct >= 0 ? "▲" : "▼"}{Math.abs(d.changePct).toFixed(2)}%</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "1/2" }}>
        <div className="mb-2">
          <div className="terminal-header">{activeIndex?.label}</div>
          <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{activeIndex?.desc}</div>
          {prices[active] && (
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono font-bold" style={{ color: "#e6edf3", fontSize: 20 }}>
                {prices[active]?.price > 100 ? prices[active]?.price?.toFixed(0) : prices[active]?.price?.toFixed(2)}
              </span>
              <span className="text-xs font-mono" style={{ color: clr(prices[active]?.changePct) }}>
                {prices[active]?.changePct >= 0 ? "▲" : "▼"} {Math.abs(prices[active]?.changePct || 0).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <UniversalChart ticker={active} height={240} showVolume defaultTf="1Y" label={activeIndex?.label} />
      </div>



    </div>
  );
}


function TechnicalAnalysis({ ticker }) {
  const [data, setData] = useState([]);
  const [tf, setTf] = useState("3M");
  const [loading, setLoading] = useState(true);
  // const [indicator, setIndicator] = useState("rsi");
  const TF_RANGE = { "1M": "1mo", "3M": "3mo", "6M": "6mo", "1Y": "1y" };

  useEffect(() => {
    setLoading(true);
    fetch("/api/chart?ticker=" + encodeURIComponent(ticker) + "&range=" + TF_RANGE[tf] + "&interval=1d")
      .then(r => r.json())
      .then(d => {
        const result = d?.chart?.result?.[0];
        if (result) {
          const closes = result.indicators.quote[0].close;
          const timestamps = result.timestamp;
          const volumes = result.indicators.quote[0].volume;

          const mapped = timestamps.map((t, i) => ({
            date: new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            close: closes[i] ? +closes[i].toFixed(2) : null,
            volume: volumes[i] || 0,
          })).filter(d => d.close !== null);

          // Calculate RSI (14)
          const calcRSI = (prices, period = 14) => {
            const rsi = new Array(prices.length).fill(null);
            let gains = 0, losses = 0;
            for (let i = 1; i <= period; i++) {
              const diff = prices[i] - prices[i-1];
              if (diff > 0) gains += diff;
              else losses -= diff;
            }
            let avgGain = gains / period;
            let avgLoss = losses / period;
            rsi[period] = 100 - 100 / (1 + avgGain / (avgLoss || 0.001));
            for (let i = period + 1; i < prices.length; i++) {
              const diff = prices[i] - prices[i-1];
              avgGain = (avgGain * (period-1) + Math.max(diff, 0)) / period;
              avgLoss = (avgLoss * (period-1) + Math.max(-diff, 0)) / period;
              rsi[i] = 100 - 100 / (1 + avgGain / (avgLoss || 0.001));
            }
            return rsi;
          };

          // Calculate MACD (12, 26, 9)
          const calcEMA = (prices, period) => {
            const k = 2 / (period + 1);
            const ema = [prices[0]];
            for (let i = 1; i < prices.length; i++) {
              ema.push(prices[i] * k + ema[i-1] * (1-k));
            }
            return ema;
          };

          const prices = mapped.map(d => d.close);
          const ema12 = calcEMA(prices, 12);
          const ema26 = calcEMA(prices, 26);
          const macdLine = ema12.map((v, i) => +(v - ema26[i]).toFixed(4));
          const signal = calcEMA(macdLine, 9).map(v => +v.toFixed(4));
          const histogram = macdLine.map((v, i) => +(v - signal[i]).toFixed(4));

          // Bollinger Bands (20, 2)
          const bb = mapped.map((d, i) => {
            if (i < 19) return { upper: null, middle: null, lower: null };
            const slice = prices.slice(i-19, i+1);
            const mean = slice.reduce((a,b) => a+b, 0) / 20;
            const std = Math.sqrt(slice.reduce((a,b) => a + Math.pow(b-mean,2), 0) / 20);
            return { upper: +(mean + 2*std).toFixed(2), middle: +mean.toFixed(2), lower: +(mean - 2*std).toFixed(2) };
          });

          const rsiValues = calcRSI(prices);

          const finalData = mapped.map((d, i) => ({
            ...d,
            rsi: rsiValues[i] ? +rsiValues[i].toFixed(1) : null,
            macd: macdLine[i],
            signal: signal[i],
            histogram: histogram[i],
            bbUpper: bb[i].upper,
            bbMiddle: bb[i].middle,
            bbLower: bb[i].lower,
          }));

          setData(finalData);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ticker, tf]); // eslint-disable-line

  const lastRSI = data[data.length-1]?.rsi;
  const lastMACD = data[data.length-1]?.macd;
  const lastSignal = data[data.length-1]?.signal;
  const lastClose = data[data.length-1]?.close;
  const lastBBU = data[data.length-1]?.bbUpper;
  const lastBBL = data[data.length-1]?.bbLower;

  const rsiColor = lastRSI > 70 ? "#f85149" : lastRSI < 30 ? "#3fb950" : "#e6edf3";
  const rsiLabel = lastRSI > 70 ? "OVERBOUGHT" : lastRSI < 30 ? "OVERSOLD" : "NEUTRAL";
  const macdSignal = lastMACD > lastSignal ? "BULLISH" : "BEARISH";
  const bbSignal = lastClose > lastBBU ? "OVERBOUGHT" : lastClose < lastBBL ? "OVERSOLD" : "NEUTRAL";

  const minP = data.length ? Math.min(...data.map(d => d.close)) * 0.99 : 0;
  const maxP = data.length ? Math.max(...data.map(d => d.close)) * 1.01 : 0;
  const xi = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "1fr 280px", gridTemplateRows: "280px 180px 180px", height: "calc(100vh - 90px)", overflow: "hidden" }}>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "1/2" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="terminal-header">{ticker} · Price + Bollinger Bands (20,2)</span>
          </div>
          <div className="flex gap-1">
            {Object.keys(TF_RANGE).map(t => (
              <button key={t} onClick={() => setTf(t)} className="px-2 py-0.5 text-xs font-mono rounded transition-colors"
                style={{ background: tf === t ? "#1f6feb22" : "transparent", color: tf === t ? "#58a6ff" : "#7d8590", border: "1px solid " + (tf === t ? "#1f6feb" : "#30363d") }}>{t}</button>
            ))}
          </div>
        </div>
        {loading ? <div className="flex items-center justify-center h-48 text-xs font-mono animate-pulse" style={{ color: "#7d8590" }}>Loading...</div> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="techGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#58a6ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={xi} />
              <YAxis domain={[minP, maxP]} tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={v => "$" + v.toFixed(0)} width={52} />
              <Tooltip contentStyle={{ background:"#1c2230", border:"1px solid rgba(99,110,123,0.28)", borderRadius:10, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }} labelStyle={{ color: "#7d8590" }} />
              <Area type="monotone" dataKey="bbUpper" stroke="#e3b341" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} name="BB Upper" />
              <Area type="monotone" dataKey="bbLower" stroke="#e3b341" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} name="BB Lower" />
              <Area type="monotone" dataKey="bbMiddle" stroke="#7d8590" strokeWidth={1} fill="none" dot={false} name="BB Middle" />
              <Area type="monotone" dataKey="close" stroke="#58a6ff" strokeWidth={1.5} fill="url(#techGrad)" dot={false} name="Price" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "1/3" }}>
        <div className="terminal-header mb-3">📊 Technical Signals</div>
        <div className="flex flex-col gap-3">
          <div className="p-3 rounded" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
            <div className="terminal-header mb-1">RSI (14)</div>
            <div className="text-2xl font-mono font-bold" style={{ color: rsiColor }}>{lastRSI?.toFixed(1) || "—"}</div>
            <div className="text-xs font-mono mt-1" style={{ color: rsiColor }}>{rsiLabel}</div>
            <div className="relative h-2 rounded-full mt-2" style={{ background: "#21262d" }}>
              <div style={{ position: "absolute", left: "30%", top: -4, bottom: -4, width: 1, background: "#3fb950" }} />
              <div style={{ position: "absolute", left: "70%", top: -4, bottom: -4, width: 1, background: "#f85149" }} />
              <div style={{ position: "absolute", left: Math.min(Math.max((lastRSI||50), 0), 100) + "%", top: -3, width: 8, height: 8, borderRadius: "50%", background: rsiColor, transform: "translateX(-50%)" }} />
            </div>
            <div className="flex justify-between text-xs font-mono mt-1" style={{ color: "#484f58" }}>
              <span>0</span><span>30</span><span>70</span><span>100</span>
            </div>
          </div>

          <div className="p-3 rounded" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
            <div className="terminal-header mb-1">MACD (12,26,9)</div>
            <div className="flex gap-3">
              <div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>MACD</div>
                <div className="text-sm font-mono font-bold" style={{ color: lastMACD >= 0 ? "#3fb950" : "#f85149" }}>{lastMACD?.toFixed(3) || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Signal</div>
                <div className="text-sm font-mono font-bold" style={{ color: "#e3b341" }}>{lastSignal?.toFixed(3) || "—"}</div>
              </div>
            </div>
            <div className="text-xs font-mono mt-2 px-2 py-1 rounded" style={{ background: lastMACD > lastSignal ? "rgba(63,185,80,0.1)" : "rgba(248,81,73,0.1)", color: lastMACD > lastSignal ? "#3fb950" : "#f85149" }}>
              {macdSignal} — MACD {lastMACD > lastSignal ? "above" : "below"} signal
            </div>
          </div>

          <div className="p-3 rounded" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
            <div className="terminal-header mb-1">Bollinger Bands (20,2)</div>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {[["Upper", lastBBU, "#e3b341"], ["Middle", lastBBL ? ((lastBBU+lastBBL)/2).toFixed(2) : null, "#7d8590"], ["Lower", lastBBL, "#58a6ff"]].map(([l, v, c]) => (
                <div key={l}>
                  <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{l}</div>
                  <div className="text-xs font-mono font-bold" style={{ color: c }}>{v ? "$" + (+v).toFixed(2) : "—"}</div>
                </div>
              ))}
            </div>
            <div className="text-xs font-mono px-2 py-1 rounded" style={{ background: bbSignal === "NEUTRAL" ? "rgba(125,133,144,0.1)" : bbSignal === "OVERBOUGHT" ? "rgba(248,81,73,0.1)" : "rgba(63,185,80,0.1)", color: bbSignal === "NEUTRAL" ? "#7d8590" : bbSignal === "OVERBOUGHT" ? "#f85149" : "#3fb950" }}>
              {bbSignal}
            </div>
          </div>

          <div className="p-3 rounded" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
            <div className="terminal-header mb-2">Overall Signal</div>
            {(() => {
              let bull = 0, bear = 0;
              if (lastRSI < 50) bear++; else bull++;
              if (lastRSI < 30) bull += 2;
              if (lastRSI > 70) bear += 2;
              if (lastMACD > lastSignal) bull++; else bear++;
              if (bbSignal === "OVERSOLD") bull++; else if (bbSignal === "OVERBOUGHT") bear++;
              const total = bull + bear;
              const bullPct = Math.round(bull/total*100);
              return (
                <div>
                  <div className="flex gap-1 mb-2" style={{ height: 8, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ width: bullPct + "%", background: "#3fb950", transition: "width 0.3s" }} />
                    <div style={{ width: (100-bullPct) + "%", background: "#f85149" }} />
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span style={{ color: "#3fb950" }}>Bullish {bullPct}%</span>
                    <span style={{ color: "#f85149" }}>Bearish {100-bullPct}%</span>
                  </div>
                  <div className="text-xs font-mono mt-2 font-bold" style={{ color: bullPct > 60 ? "#3fb950" : bullPct < 40 ? "#f85149" : "#e3b341" }}>
                    {bullPct > 60 ? "BUY SIGNAL" : bullPct < 40 ? "SELL SIGNAL" : "NEUTRAL"}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "2/3" }}>
        <div className="terminal-header mb-2">RSI (14) — Relative Strength Index</div>
        {loading ? <div className="text-xs font-mono animate-pulse" style={{ color: "#7d8590" }}>Loading...</div> : (
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={xi} />
              <YAxis domain={[0, 100]} tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} width={30} />
              <Tooltip contentStyle={{ background:"#1c2230", border:"1px solid rgba(99,110,123,0.28)", borderRadius:10, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }} labelStyle={{ color: "#7d8590" }} />
              <ReferenceLine y={70} stroke="#f85149" strokeDasharray="3 3" strokeWidth={1} />
              <ReferenceLine y={30} stroke="#3fb950" strokeDasharray="3 3" strokeWidth={1} />
              <Area type="monotone" dataKey="rsi" stroke="#58a6ff" strokeWidth={1.5} fill="rgba(88,166,255,0.05)" dot={false} name="RSI" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "3/4" }}>
        <div className="terminal-header mb-2">MACD (12,26,9) — Moving Average Convergence Divergence</div>
        {loading ? <div className="text-xs font-mono animate-pulse" style={{ color: "#7d8590" }}>Loading...</div> : (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={xi} />
              <YAxis tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={{ background:"#1c2230", border:"1px solid rgba(99,110,123,0.28)", borderRadius:10, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }} labelStyle={{ color: "#7d8590" }} />
              <ReferenceLine y={0} stroke="#30363d" strokeWidth={1} />
              <Bar dataKey="histogram" name="Histogram" radius={[1,1,0,0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.histogram >= 0 ? "#3fb950" : "#f85149"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "3/4" }}>
        <div className="terminal-header mb-2">📖 Indicator Guide</div>
        <div className="flex flex-col gap-2 text-xs font-mono" style={{ color: "#7d8590" }}>
          <div><span style={{ color: "#58a6ff" }}>RSI {">"} 70</span> — Overbought, potential sell signal</div>
          <div><span style={{ color: "#3fb950" }}>RSI {"<"} 30</span> — Oversold, potential buy signal</div>
          <div><span style={{ color: "#3fb950" }}>MACD above Signal</span> — Bullish momentum</div>
          <div><span style={{ color: "#f85149" }}>MACD below Signal</span> — Bearish momentum</div>
          <div><span style={{ color: "#e3b341" }}>BB Upper breach</span> — Overbought condition</div>
          <div><span style={{ color: "#e3b341" }}>BB Lower breach</span> — Oversold condition</div>
        </div>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GEOPOLITICAL EVENTS INTELLIGENCE MODULE
// ─────────────────────────────────────────────────────────────

// Keywords are intentionally multi-word or unambiguous to prevent cross-category pollution.
// "war" / "attack" / "strike" are NOT in Conflict — they appear in "trade war", "oil price attack" etc.
const GEO_CATEGORIES = {
  "Central Bank": {
    keywords: [
      "federal reserve","interest rate","rate hike","rate cut","fomc",
      "ecb","bank of japan","boj","pboc","monetary policy","basis point",
      "central bank","powell","lagarde","ueda","rate decision","hawkish",
      "dovish","rate pause","fed funds","bond yield","yield curve",
      "treasury yield","quantitative easing","quantitative tightening",
      "rate increase","rate decrease","inflation target","fed meeting",
      "rate hold","rate outlook","fed chair","rate cycle","fed pivot",
    ],
    color: "#bc8cff", bg: "rgba(188,140,255,0.08)",
    assets: [
      { id:"DGS10", label:"10Y Treasury", type:"macro",     series:"DGS10", category:"Macro" },
      { id:"SPY",   label:"S&P 500",      type:"equity",    ticker:"SPY",   category:"Indices" },
      { id:"GC=F",  label:"Gold",         type:"commodity", ticker:"GC=F",  category:"Commodities" },
      { id:"DX=F",  label:"USD Index",    type:"fx",        ticker:"DX=F",  category:"FX" },
    ],
    why: "Rate decisions move bond yields, equity discount rates, and currency strength simultaneously across all asset classes.",
  },
  "Trade / Sanctions": {
    keywords: [
      "tariff","sanction","trade war","embargo","export ban","import ban",
      "wto","trade deal","export control","trade restriction","trade deficit",
      "decoupling","blacklist","trade dispute","import duty","trade policy",
      "trade tension","economic sanction","trade barrier","trade agreement",
      "trade war","counter-tariff","technology ban","chip ban","export license",
    ],
    color: "#e3b341", bg: "rgba(227,179,65,0.08)",
    assets: [
      { id:"EURUSD=X", label:"EUR/USD",  type:"fx",        ticker:"EURUSD=X", category:"FX" },
      { id:"HG=F",     label:"Copper",   type:"commodity", ticker:"HG=F",     category:"Commodities" },
      { id:"SPY",      label:"S&P 500",  type:"equity",    ticker:"SPY",      category:"Indices" },
      { id:"USDCNY=X", label:"USD/CNY",  type:"fx",        ticker:"USDCNY=X", category:"FX" },
    ],
    why: "Trade barriers raise input costs, compress corporate margins, and force currency adjustments in affected economies.",
  },
  "Elections / Politics": {
    keywords: [
      "election","referendum","snap election","general election","presidential election",
      "political crisis","impeachment","government collapse","political turmoil",
      "election result","coup","regime change","political instability","civil unrest",
      "protest","opposition leader","ballot","polling","vote count","political tension",
      "legislative","parliament","head of state","prime minister","chancellor",
    ],
    color: "#58a6ff", bg: "rgba(88,166,255,0.08)",
    assets: [
      { id:"SPY",      label:"S&P 500", type:"equity",    ticker:"SPY",      category:"Indices" },
      { id:"EURUSD=X", label:"EUR/USD", type:"fx",        ticker:"EURUSD=X", category:"FX" },
      { id:"GC=F",     label:"Gold",    type:"commodity", ticker:"GC=F",     category:"Commodities" },
    ],
    why: "Political uncertainty elevates risk premia, weakens local currencies, and can abruptly reverse fiscal and regulatory trajectories.",
  },
  "Energy": {
    keywords: [
      "opec","crude oil","oil price","natural gas","brent crude","wti crude",
      "oil barrel","energy crisis","oil production","gas supply","lng",
      "oil output","refinery","oil supply","energy supply","energy market",
      "gas pipeline","oil reserves","energy security","production quota",
      "oil demand","gas price","electricity price","oil cut","oil output cut",
      "energy price","gas shortage","fuel price","opec+","oil inventory",
    ],
    color: "#f0883e", bg: "rgba(240,136,62,0.08)",
    assets: [
      { id:"CL=F",     label:"Crude Oil (WTI)", type:"commodity", ticker:"CL=F",     category:"Commodities" },
      { id:"NG=F",     label:"Natural Gas",      type:"commodity", ticker:"NG=F",     category:"Commodities" },
      { id:"CPIAUCSL", label:"CPI Inflation",    type:"macro",     series:"CPIAUCSL", category:"Macro" },
    ],
    why: "Energy supply disruptions feed directly into CPI, widen trade deficits in import-dependent economies, and pressure corporate margins globally.",
  },
  "Supply Chain": {
    keywords: [
      "supply chain","chip shortage","semiconductor","freight rate","shipping disruption",
      "port strike","container ship","manufacturing slowdown","inventory shortage",
      "supply disruption","chip supply","logistics","factory shutdown","supply bottleneck",
      "global shortage","production delay","microchip","fab","foundry","chip maker",
      "wafer","shortage","congestion","cargo","freight","ocean freight",
    ],
    color: "#3fb950", bg: "rgba(63,185,80,0.08)",
    assets: [
      { id:"HG=F", label:"Copper",     type:"commodity", ticker:"HG=F", category:"Commodities" },
      { id:"NVDA", label:"NVIDIA",     type:"equity",    ticker:"NVDA", category:"Equities" },
      { id:"QQQ",  label:"Nasdaq 100", type:"equity",    ticker:"QQQ",  category:"Indices" },
    ],
    why: "Supply constraints elevate input costs, delay product cycles, and create concentrated earnings risk in technology and manufacturing sectors.",
  },
  "Conflict": {
    // Only unambiguous military terms — "war"/"attack"/"strike" intentionally excluded
    keywords: [
      "troops","ceasefire","airstrike","air strike","artillery","frontline",
      "shelling","drone strike","rocket fire","military operation","armed forces",
      "warplane","missile launch","military offensive","war crimes","bombardment",
      "invasion","fighter jet","ground troops","naval battle","military escalation",
      "military conflict","armed attack","military base","casualt","hostage",
      "nato forces","peacekeeping","demilitariz","occupied territory","siege",
    ],
    color: "#f85149", bg: "rgba(248,81,73,0.08)",
    assets: [
      { id:"GC=F", label:"Gold",             type:"commodity", ticker:"GC=F", category:"Commodities" },
      { id:"CL=F", label:"Crude Oil",         type:"commodity", ticker:"CL=F", category:"Commodities" },
      { id:"ITA",  label:"Defense ETF (ITA)", type:"equity",    ticker:"ITA",  category:"Equities" },
      { id:"DX=F", label:"USD Index",         type:"fx",        ticker:"DX=F", category:"FX" },
    ],
    why: "Military escalation drives safe-haven flows into gold and USD, lifts energy prices on supply-risk fears, and boosts defense sector revenues.",
  },
};

const GEO_REGIONS = {
  "🇺🇸 US":         ["united states","u.s. ","american","washington dc","biden","trump","congress","federal reserve","white house","pentagon","u.s. economy","u.s. dollar","treasury secretary"],
  "🇨🇳 China":       ["china","chinese","beijing","xi jinping","pboc","ccp","taiwan","hong kong","shanghai","yuan","renminbi","chinese economy"],
  "🇷🇺 Russia":      ["russia","russian","moscow","putin","kremlin","ukraine","rouble","gazprom","russian economy"],
  "🇪🇺 Europe":      ["europe","european","eurozone","ecb","germany","france","united kingdom","britain","euro zone","sterling","european union","eu trade"],
  "🌍 Middle East":  ["iran","israel","saudi","opec","gulf state","iraq","syria","yemen","palestin","hamas","hezbollah","middle east","riyadh","tehran"],
  "🌏 Asia Pacific": ["japan","south korea","india","australia","singapore","bank of japan","asia pacific","southeast asia","asean","indian rupee","japanese yen"],
  "🌎 LatAm":        ["brazil","mexico","argentina","venezuela","chile","colombia","latin america","brazilian real","mexican peso"],
};

const GEO_ASSET_COLOR = { equity:"#58a6ff", commodity:"#e3b341", fx:"#3fb950", macro:"#bc8cff", topic:"#f0883e" };

const BULLISH_WORDS = ["ceasefire","peace deal","diplomatic agreement","de-escalat","easing tension","recovery","stimulus","rate cut","rate cuts","trade deal signed","accord","truce","resolution","normalization"];
const BEARISH_WORDS = ["invasion","crisis","default","collapse","recession","escalat","new sanction","tariff hike","production cut","blockade","restrict","ultimatum","hostile","military offensive","coup","regime collapse"];

function classifyGeoArticle(article) {
  const text = ((article.headline || "") + " " + (article.summary || "")).toLowerCase();

  // Score each category; higher score = better match
  const scores = {};
  for (const [cat, cfg] of Object.entries(GEO_CATEGORIES)) {
    scores[cat] = cfg.keywords.filter(kw => text.includes(kw)).length;
  }
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return null;

  // Pick category with highest score; on tie prefer the non-Conflict category
  // (Conflict is last in the object, so iterating in reverse for tie-breaking)
  const entries = Object.entries(scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];           // higher score wins
    if (a[0] === "Conflict") return 1;                // Conflict loses ties
    if (b[0] === "Conflict") return -1;
    return 0;
  });
  const category = entries[0][0];

  const regions = Object.entries(GEO_REGIONS)
    .filter(([, kws]) => kws.some(kw => text.includes(kw)))
    .map(([r]) => r);

  let impact = maxScore >= 4 ? "High" : maxScore >= 2 ? "Medium" : "Low";

  const bullish = BULLISH_WORDS.filter(w => text.includes(w)).length;
  const bearish = BEARISH_WORDS.filter(w => text.includes(w)).length;
  const signal = bearish > bullish + 1 ? "Bearish" : bullish > bearish + 1 ? "Bullish" : "Neutral";

  const catCfg = GEO_CATEGORIES[category];
  return { category, regions, impact, signal, assets: catCfg.assets, why: catCfg.why };
}

function geoTimeAgo(ts) {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return "Just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

const GEO_IMPACT_COLOR = { High:"#f85149", Medium:"#e3b341", Low:"#3fb950" };
const GEO_SIGNAL_COLOR = { Bullish:"#3fb950", Bearish:"#f85149", Neutral:"#7d8590" };
const GEO_SIGNAL_ICON  = { Bullish:"▲", Bearish:"▼", Neutral:"◆" };

function GeopoliticalEvents({ onOpenResearch }) {
  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [filterImpact, setFilterImpact] = useState("All");
  const [filterCat, setFilterCat]   = useState("All");
  const [filterTime, setFilterTime] = useState("24H");

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const [general, forex] = await Promise.all([
        api("/news?category=general"),
        delay(300).then(() => api("/news?category=forex")),
      ]);
      const raw = [...(Array.isArray(general) ? general : []), ...(Array.isArray(forex) ? forex : [])];
      const seen = new Set();
      const unique = raw.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
      const classified = unique
        .map(a => { const m = classifyGeoArticle(a); return m ? { ...a, ...m } : null; })
        .filter(Boolean);
      const order = { High:0, Medium:1, Low:2 };
      classified.sort((a, b) => order[a.impact] !== order[b.impact] ? order[a.impact] - order[b.impact] : b.datetime - a.datetime);
      setEvents(classified);
      if (classified.length > 0) setSelected(classified[0]);
      setLastRefresh(Date.now());
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
    const iv = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line

  const nowSec = Date.now() / 1000;
  const timeWindow = { "1H":3600, "6H":21600, "24H":86400 }[filterTime];
  const filtered = events.filter(e =>
    (filterImpact === "All" || e.impact === filterImpact) &&
    (filterCat    === "All" || e.category === filterCat) &&
    (nowSec - e.datetime <= timeWindow)
  );


  return (
    <div className="flex flex-col" style={{ height:"100%", overflow:"hidden" }}>

      {/* ── Filter bar ── */}
      <div className="px-4 py-2 flex items-center gap-3 flex-wrap" style={{ borderBottom:"1px solid rgba(99,110,123,0.12)", background:"#010409", flexShrink:0 }}>
        <span className="font-mono" style={{ background:"#0c2044", color:"#58a6ff", border:"1px solid #58a6ff33", borderRadius:6, padding:"2px 8px", fontSize:10 }}>● LIVE</span>

        <div className="flex items-center gap-1">
          <span className="font-mono" style={{ color:"#484f58", fontSize:9 }}>IMPACT:</span>
          {["All","High","Medium","Low"].map(v => (
            <button key={v} onClick={() => setFilterImpact(v)} className="font-mono"
              style={{ padding:"2px 8px", fontSize:10, borderRadius:6, border:"1px solid", cursor:"pointer",
                background: filterImpact===v ? (GEO_IMPACT_COLOR[v]||"#21262d")+"22" : "transparent",
                borderColor: filterImpact===v ? (GEO_IMPACT_COLOR[v]||"#58a6ff") : "#21262d",
                color: filterImpact===v ? (GEO_IMPACT_COLOR[v]||"#58a6ff") : "#7d8590" }}>
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="font-mono" style={{ color:"#484f58", fontSize:9 }}>CATEGORY:</span>
          {["All",...Object.keys(GEO_CATEGORIES)].map(v => {
            const cfg = GEO_CATEGORIES[v];
            return (
              <button key={v} onClick={() => setFilterCat(v)} className="font-mono"
                style={{ padding:"2px 8px", fontSize:10, borderRadius:6, border:"1px solid", cursor:"pointer",
                  background: filterCat===v ? (cfg?.bg||"#21262d") : "transparent",
                  borderColor: filterCat===v ? (cfg?.color||"#58a6ff") : "#21262d",
                  color: filterCat===v ? (cfg?.color||"#58a6ff") : "#7d8590" }}>
                {v}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <span className="font-mono" style={{ color:"#484f58", fontSize:9 }}>TIME:</span>
          {["1H","6H","24H"].map(v => (
            <button key={v} onClick={() => setFilterTime(v)} className="font-mono"
              style={{ padding:"2px 8px", fontSize:10, borderRadius:6, border:"1px solid", cursor:"pointer",
                background: filterTime===v ? "#0c2044" : "transparent",
                borderColor: filterTime===v ? "#58a6ff" : "#21262d",
                color: filterTime===v ? "#58a6ff" : "#7d8590" }}>
              {v}
            </button>
          ))}
        </div>

        <button onClick={fetchEvents} disabled={loading} className="font-mono"
          style={{ padding:"2px 10px", fontSize:10, borderRadius:6, border:"1px solid #30363d", background:"transparent", color:loading?"#7d8590":"#58a6ff", cursor:loading?"wait":"pointer", marginLeft:"auto" }}>
          {loading ? "⟳ Updating…" : "⟳ Refresh"}
        </button>
        {lastRefresh && (
          <span className="font-mono" style={{ color:"#484f58", fontSize:9 }}>
            {filtered.length} events · {new Date(lastRefresh).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* ── Two-column workspace ── */}
      <div className="flex flex-1" style={{ overflow:"hidden" }}>

        {/* Left: scrollable event feed */}
        <div style={{ width:460, flexShrink:0, borderRight:"1px solid #21262d", overflowY:"auto" }}>
          {loading && events.length === 0 ? (
            <div className="flex items-center justify-center p-10 font-mono" style={{ color:"#7d8590", fontSize:12 }}>Fetching intelligence feed…</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center p-10 font-mono" style={{ color:"#7d8590", fontSize:12 }}>No events match current filters.</div>
          ) : filtered.map(event => {
            const cfg = GEO_CATEGORIES[event.category];
            const isSelected = selected?.id === event.id;
            const ageSec = nowSec - event.datetime;
            const isBreaking = event.impact === "High" && ageSec < 3600;
            const isNew      = ageSec < 1800 && !isBreaking;
            return (
              <div key={event.id} onClick={() => setSelected(event)}
                style={{ borderBottom:"1px solid rgba(99,110,123,0.07)", borderLeft:"3px solid " + (isSelected ? cfg.color : GEO_IMPACT_COLOR[event.impact]),
                  background: isSelected ? cfg.bg : "transparent", padding:"10px 14px", cursor:"pointer", transition:"background 0.15s" }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background="#0d1117"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background="transparent"; }}>

                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  {isBreaking && <span className="font-mono" style={{ background:"#f8514922", border:"1px solid #f85149", borderRadius:2, padding:"0 5px", fontSize:8, color:"#f85149", textTransform:"uppercase" }}>⚡ Breaking</span>}
                  {isNew      && <span className="font-mono" style={{ background:"#3fb95022", border:"1px solid #3fb950", borderRadius:2, padding:"0 5px", fontSize:8, color:"#3fb950", textTransform:"uppercase" }}>● New</span>}
                  <span className="font-mono" style={{ background:cfg.bg, border:"1px solid "+cfg.color+"55", borderRadius:2, padding:"0 6px", fontSize:9, color:cfg.color, textTransform:"uppercase" }}>{event.category}</span>
                  <span className="font-mono" style={{ border:"1px solid "+GEO_IMPACT_COLOR[event.impact]+"44", borderRadius:2, padding:"0 5px", fontSize:9, color:GEO_IMPACT_COLOR[event.impact] }}>{event.impact}</span>
                  <span className="font-mono ml-auto" style={{ color:"#484f58", fontSize:9 }}>{geoTimeAgo(event.datetime)}</span>
                </div>

                <div className="font-mono leading-snug mb-1.5" style={{ color:"#e6edf3", fontSize:12, fontWeight:isBreaking?600:400 }}>
                  {event.headline}
                </div>

                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono" style={{ color:"#7d8590", fontSize:10 }}>{event.source}</span>
                  {event.regions.slice(0,3).map(r => <span key={r} className="font-mono" style={{ color:"#484f58", fontSize:10 }}>{r}</span>)}
                </div>

                <div className="flex flex-wrap gap-1 items-center">
                  {event.assets.slice(0,3).map(a => (
                    <span key={a.id} className="font-mono" style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:2, padding:"1px 6px", fontSize:9, color:"#7d8590" }}>
                      {a.label}
                    </span>
                  ))}
                  <span className="font-mono ml-auto" style={{ fontSize:10, color:GEO_SIGNAL_COLOR[event.signal] }}>
                    {GEO_SIGNAL_ICON[event.signal]} {event.signal}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: event detail */}
        <div className="flex-1 p-5" style={{ overflowY:"auto" }}>
          {!selected ? (
            <div className="flex items-center justify-center h-full font-mono" style={{ color:"#484f58", fontSize:12 }}>
              Select an event to view intelligence detail
            </div>
          ) : (() => {
            const cfg = GEO_CATEGORIES[selected.category];
            const ageSec = nowSec - selected.datetime;
            const isBreaking = selected.impact === "High" && ageSec < 3600;
            return (
              <div>
                {/* Badges */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {isBreaking && <span className="font-mono" style={{ background:"#f8514922", border:"1px solid #f85149", borderRadius:6, padding:"3px 10px", fontSize:10, color:"#f85149" }}>⚡ BREAKING</span>}
                  <span className="font-mono" style={{ background:cfg.bg, border:"1px solid "+cfg.color, borderRadius:6, padding:"3px 10px", fontSize:10, color:cfg.color }}>{selected.category.toUpperCase()}</span>
                  <span className="font-mono" style={{ border:"1px solid "+GEO_IMPACT_COLOR[selected.impact], borderRadius:6, padding:"3px 10px", fontSize:10, color:GEO_IMPACT_COLOR[selected.impact] }}>{selected.impact.toUpperCase()} IMPACT</span>
                  <span className="font-mono ml-auto" style={{ color:"#7d8590", fontSize:10 }}>{selected.source} · {geoTimeAgo(selected.datetime)}</span>
                </div>

                {/* Headline */}
                <h2 className="font-mono font-bold leading-snug mb-3" style={{ color:"#e6edf3", fontSize:16 }}>{selected.headline}</h2>

                {/* Regions */}
                {selected.regions.length > 0 && (
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>Region:</span>
                    {selected.regions.map(r => (
                      <span key={r} className="font-mono" style={{ background:"#21262d", borderRadius:6, padding:"2px 8px", fontSize:11, color:"#7d8590" }}>{r}</span>
                    ))}
                  </div>
                )}

                {/* Summary */}
                {selected.summary && (
                  <div className="mb-4 p-3" style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:4 }}>
                    <div className="font-mono mb-1.5" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Summary</div>
                    <p className="font-mono leading-relaxed" style={{ color:"#7d8590", fontSize:12 }}>{selected.summary}</p>
                  </div>
                )}

                {/* Why it matters */}
                <div className="mb-4 p-3" style={{ background:cfg.bg, border:"1px solid "+cfg.color+"44", borderRadius:4 }}>
                  <div className="font-mono mb-1.5" style={{ color:cfg.color, fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Why It Matters</div>
                  <p className="font-mono leading-relaxed" style={{ color:"#e6edf3", fontSize:12 }}>{cfg.why}</p>
                </div>

                {/* Signal + link row */}
                <div className="flex items-center gap-4 mb-4 p-3" style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:4 }}>
                  <div>
                    <div className="font-mono mb-1" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>Directional Signal</div>
                    <div className="font-mono font-bold" style={{ color:GEO_SIGNAL_COLOR[selected.signal], fontSize:18 }}>
                      {GEO_SIGNAL_ICON[selected.signal]} {selected.signal}
                    </div>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <a href={selected.url} target="_blank" rel="noopener noreferrer"
                      className="font-mono"
                      style={{ background:"#1f6feb", borderRadius:10, padding:"7px 14px", color:"#fff", fontSize:11, textDecoration:"none" }}>
                      Full Article ↗
                    </a>
                  </div>
                </div>

                {/* Impacted assets */}
                <div className="mb-4">
                  <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                    Impacted Assets {onOpenResearch ? "— Click to Research" : ""}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.assets.map(a => (
                      <button key={a.id}
                        onClick={() => onOpenResearch && onOpenResearch(a)}
                        className="font-mono"
                        style={{ background:"#0d1117", border:"1px solid #30363d", borderRadius:10, padding:"7px 14px", fontSize:12, color:GEO_ASSET_COLOR[a.type]||"#7d8590", cursor:onOpenResearch?"pointer":"default", transition:"all 0.15s" }}
                        onMouseEnter={e => { if (onOpenResearch) { e.currentTarget.style.borderColor=cfg.color; e.currentTarget.style.background=cfg.bg; } }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(99,110,123,0.40)"; e.currentTarget.style.background="#0d1117"; }}>
                        {a.label}{onOpenResearch ? " ↗" : ""}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Intelligence metadata grid */}
                <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Intelligence Classification</div>
                <div className="grid" style={{ gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                  {[
                    ["Category",  selected.category],
                    ["Impact",    selected.impact],
                    ["Signal",    selected.signal],
                    ["Source",    selected.source],
                    ["Regions",   selected.regions.length ? selected.regions.map(r => r.split(" ").slice(1).join(" ")).join(", ") : "Global"],
                    ["Published", geoTimeAgo(selected.datetime)],
                  ].map(([k, v]) => (
                    <div key={k} className="p-2" style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:4 }}>
                      <div className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>{k}</div>
                      <div className="font-mono" style={{ color:"#e6edf3", fontSize:11 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// GLOBAL INTELLIGENCE GLOBE — data + component
// ============================================================

// ── Module-level style tables (pure constants, never cause re-renders) ──
const ARC_STYLE = {
  oilRoutes:  { color:"rgba(240,165,0,0.85)",   stroke:0.85, altitude:0.18 },
  pipelines:  { color:"rgba(232,93,4,0.90)",    stroke:0.70, altitude:0.04 },
  seaCables:  { color:"rgba(88,166,255,0.75)",  stroke:0.50, altitude:0.07 },
  tradeFlows: { color:"rgba(167,139,250,0.75)", stroke:0.65, altitude:0.27 },
};
const PT_STYLE = {
  chokepoints:   { color:"#f85149", r:0.55, alt:0.016 },
  cableLandings: { color:"#3fb950", r:0.22, alt:0.005 },
  majorPorts:    { color:"#06b6d4", r:0.30, alt:0.008 },
  conflictZones: { color:"#ff3333", r:0.70, alt:0.014 },
  sanctioned:    { color:"#e3b341", r:0.50, alt:0.008 },
};
const arcCol = d => ARC_STYLE[d._layer]?.color    || "rgba(255,255,255,0.6)";
const arcStr = d => ARC_STYLE[d._layer]?.stroke   || 0.5;
const arcAlt = d => ARC_STYLE[d._layer]?.altitude || 0.1;
const ptCol  = d => PT_STYLE[d._layer]?.color || "#fff";
const ptRad  = d => PT_STYLE[d._layer]?.r     || 0.3;
const ptAlt  = d => PT_STYLE[d._layer]?.alt   || 0.01;

// ── Region filter definitions ──
const GLOBE_REGIONS = {
  all:        { label:"All Regions",   bounds:null,                                                 pov:{ lat:20, lng:10,  altitude:2.3 } },
  americas:   { label:"Americas",      bounds:{ latMin:-60, latMax:75,  lngMin:-180, lngMax:-30 },  pov:{ lat:10, lng:-80, altitude:1.8 } },
  europe:     { label:"Europe",        bounds:{ latMin:35,  latMax:72,  lngMin:-30,  lngMax:50  },  pov:{ lat:52, lng:15,  altitude:1.6 } },
  middleeast: { label:"Middle East",   bounds:{ latMin:12,  latMax:42,  lngMin:25,   lngMax:65  },  pov:{ lat:27, lng:45,  altitude:1.5 } },
  asia:       { label:"Asia-Pacific",  bounds:{ latMin:-50, latMax:55,  lngMin:60,   lngMax:180 },  pov:{ lat:20, lng:110, altitude:1.8 } },
  africa:     { label:"Africa",        bounds:{ latMin:-35, latMax:38,  lngMin:-20,  lngMax:55  },  pov:{ lat:5,  lng:20,  altitude:1.8 } },
  russia:     { label:"Russia / FSU",  bounds:{ latMin:40,  latMax:82,  lngMin:20,   lngMax:180 },  pov:{ lat:60, lng:80,  altitude:1.8 } },
};

// ── Filter helpers ──
const inRegion = (lat, lng, key) => {
  const b = GLOBE_REGIONS[key]?.bounds;
  if (!b) return true;
  return lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax;
};
const meetsImp = (imp, filter) => {
  if (filter === "all") return true;
  if (filter === "critical") return imp === "critical";
  return imp === "critical" || imp === "major";
};

// ── Data: Strategic Chokepoints ──
const CHOKEPOINTS = [
  { id:"hormuz",    name:"Strait of Hormuz",    lat:26.40, lng:56.40,  type:"Strait", oil:"21M bbl/day",  importance:"critical", note:"Persian Gulf oil gateway — Iran/Oman border" },
  { id:"malacca",   name:"Strait of Malacca",   lat:1.25,  lng:103.50, type:"Strait", oil:"19M bbl/day",  importance:"critical", note:"SE Asia chokepoint — Singapore/Malaysia/Indonesia" },
  { id:"suez",      name:"Suez Canal",           lat:30.50, lng:32.40,  type:"Canal",  oil:"9.5M bbl/day", importance:"critical", note:"Europe–Asia shortcut through Egypt" },
  { id:"bab",       name:"Bab el-Mandeb",        lat:12.58, lng:43.47,  type:"Strait", oil:"6.2M bbl/day", importance:"critical", note:"Red Sea entry — Yemen/Djibouti coast" },
  { id:"bosphorus", name:"Turkish Straits",      lat:41.12, lng:29.07,  type:"Strait", oil:"3.0M bbl/day", importance:"major",    note:"Black Sea to Mediterranean — Turkey" },
  { id:"panama",    name:"Panama Canal",         lat:9.00,  lng:-79.60, type:"Canal",  oil:"0.9M bbl/day", importance:"major",    note:"Pacific–Atlantic shortcut — Panama" },
  { id:"goodhope",  name:"Cape of Good Hope",    lat:-34.40,lng:18.50,  type:"Cape",   oil:"Bypass route", importance:"major",    note:"Suez Canal alternative for VLCCs" },
  { id:"horn",      name:"Cape Horn",            lat:-55.90,lng:-67.30, type:"Cape",   oil:"Bypass route", importance:"minor",    note:"Drake Passage — South America tip" },
  { id:"danish",    name:"Danish Straits",       lat:57.50, lng:10.00,  type:"Strait", oil:"3.3M bbl/day", importance:"major",    note:"Baltic Sea access — Skagerrak/Kattegat" },
  { id:"lombok",    name:"Lombok Strait",        lat:-8.75, lng:115.75, type:"Strait", oil:"1.3M bbl/day", importance:"major",    note:"Malacca bypass — Indonesia" },
  { id:"taiwan",    name:"Taiwan Strait",        lat:24.50, lng:120.50, type:"Strait", oil:"1.8M bbl/day", importance:"critical", note:"China–Japan shipping corridor" },
];

// ── Data: Oil Shipping Routes ──
const OIL_ROUTES = [
  { id:"pg-china",    name:"Persian Gulf → China",         startLat:26.40, startLng:56.40,  endLat:30.00,  endLng:121.00, vol:"4.5M bbl/day", importance:"critical", region:"Middle East → China" },
  { id:"pg-japan",    name:"Persian Gulf → Japan",         startLat:26.40, startLng:56.40,  endLat:34.70,  endLng:136.90, vol:"3.2M bbl/day", importance:"critical", region:"Middle East → Japan" },
  { id:"pg-india",    name:"Persian Gulf → India",         startLat:24.50, startLng:58.50,  endLat:19.10,  endLng:72.90,  vol:"1.5M bbl/day", importance:"major",    region:"Middle East → India" },
  { id:"pg-europe",   name:"Persian Gulf → Europe",        startLat:26.40, startLng:56.40,  endLat:51.50,  endLng:0.10,   vol:"2.4M bbl/day", importance:"critical", region:"Middle East → Europe" },
  { id:"pg-us",       name:"Persian Gulf → US Gulf",       startLat:24.50, startLng:55.00,  endLat:29.90,  endLng:-90.10, vol:"0.8M bbl/day", importance:"major",    region:"Middle East → US" },
  { id:"ru-europe",   name:"Russia/Baltic → Europe",       startLat:59.90, startLng:30.20,  endLat:53.90,  endLng:14.10,  vol:"1.8M bbl/day", importance:"critical", region:"Russia → Europe" },
  { id:"ru-china",    name:"Russia (ESPO) → China",        startLat:52.00, startLng:131.50, endLat:39.90,  endLng:116.40, vol:"0.9M bbl/day", importance:"major",    region:"Russia → China" },
  { id:"waf-europe",  name:"West Africa → Europe",         startLat:0.40,  startLng:9.50,   endLat:51.50,  endLng:0.10,   vol:"1.0M bbl/day", importance:"major",    region:"West Africa → Europe" },
  { id:"waf-us",      name:"West Africa → US East",        startLat:-8.80, startLng:13.20,  endLat:40.70,  endLng:-74.00, vol:"0.8M bbl/day", importance:"major",    region:"West Africa → Americas" },
  { id:"waf-china",   name:"West Africa → China",          startLat:0.40,  startLng:9.50,   endLat:22.30,  endLng:114.20, vol:"1.2M bbl/day", importance:"major",    region:"West Africa → China" },
  { id:"nafr-europe", name:"North Africa → Europe",        startLat:32.90, startLng:13.20,  endLat:40.80,  endLng:14.30,  vol:"0.7M bbl/day", importance:"major",    region:"N. Africa → Europe" },
  { id:"us-europe",   name:"US Gulf Coast → Europe",       startLat:29.90, startLng:-90.10, endLat:51.50,  endLng:0.10,   vol:"1.0M bbl/day", importance:"major",    region:"Americas → Europe" },
  { id:"can-us",      name:"Canada → US (pipeline)",       startLat:53.50, startLng:-113.50,endLat:29.70,  endLng:-95.40, vol:"3.9M bbl/day", importance:"critical", region:"Canada → US" },
  { id:"venezuela",   name:"Venezuela → US/China",         startLat:10.50, startLng:-66.90, endLat:29.90,  endLng:-90.10, vol:"0.6M bbl/day", importance:"minor",    region:"Americas → US" },
  { id:"nsea-uk",     name:"North Sea → Europe",           startLat:57.00, startLng:3.00,   endLat:51.50,  endLng:0.10,   vol:"1.4M bbl/day", importance:"major",    region:"North Sea" },
  { id:"oman-asia",   name:"Oman/UAE → Asia",              startLat:23.60, startLng:58.59,  endLat:1.35,   endLng:103.82, vol:"2.5M bbl/day", importance:"critical", region:"Gulf → SE Asia" },
];

// ── Data: Major Pipelines ──
const PIPELINES = [
  { id:"druzhba",   name:"Druzhba Pipeline",          startLat:52.0, startLng:45.0,   endLat:52.2,  endLng:13.4,  type:"Oil", vol:"1.4M bbl/day", importance:"critical", region:"Russia → Central Europe" },
  { id:"nordstream",name:"Nord Stream route",         startLat:57.5, startLng:22.5,   endLat:54.5,  endLng:13.5,  type:"Gas", vol:"55 Bcm/yr",    importance:"major",    region:"Russia → Germany (Baltic)" },
  { id:"tanap",     name:"TANAP",                     startLat:41.6, startLng:47.1,   endLat:41.0,  endLng:28.0,  type:"Gas", vol:"16 Bcm/yr",    importance:"major",    region:"Azerbaijan → Turkey" },
  { id:"tap",       name:"Trans Adriatic Pipeline",   startLat:41.0, startLng:28.0,   endLat:41.5,  endLng:16.0,  type:"Gas", vol:"10 Bcm/yr",    importance:"major",    region:"Turkey → Italy" },
  { id:"keystone",  name:"Keystone Corridor",         startLat:53.5, startLng:-113.5, endLat:29.7,  endLng:-95.4, type:"Oil", vol:"590k bbl/day", importance:"critical", region:"Canada → US Gulf" },
  { id:"espo",      name:"ESPO Pipeline",             startLat:55.0, startLng:110.0,  endLat:38.3,  endLng:121.5, type:"Oil", vol:"600k bbl/day", importance:"major",    region:"Russia → China/Pacific" },
  { id:"taap",      name:"Trans-Arabian Pipeline",    startLat:22.5, startLng:46.0,   endLat:33.0,  endLng:35.0,  type:"Oil", vol:"500k bbl/day", importance:"major",    region:"Saudi Arabia → Levant" },
  { id:"kaz-cn",    name:"Kazakhstan–China Pipeline", startLat:44.0, startLng:62.0,   endLat:44.0,  endLng:87.0,  type:"Oil", vol:"240k bbl/day", importance:"major",    region:"Kazakhstan → China" },
  { id:"langeled",  name:"Langeled (North Sea gas)",  startLat:60.5, startLng:4.0,    endLat:53.8,  endLng:-0.3,  type:"Gas", vol:"25 Bcm/yr",    importance:"major",    region:"Norway → UK" },
];

// ── Data: Subsea Internet Cables ──
const SEA_CABLES = [
  { id:"marea",      name:"MAREA",              startLat:36.83, startLng:-76.00, endLat:43.26, endLng:-2.93,  importance:"critical", capacity:"200 Tbps",  operators:"Microsoft, Facebook" },
  { id:"aeconnect",  name:"AEConnect",          startLat:40.72, startLng:-73.97, endLat:54.22, endLng:-9.22,  importance:"major",    capacity:"200 Tbps",  operators:"Aqua Comms" },
  { id:"tat14",      name:"TAT-14",             startLat:39.37, startLng:-74.43, endLat:50.83, endLng:-4.55,  importance:"major",    capacity:"3.2 Tbps",  operators:"Multi-operator consortium" },
  { id:"dunant",     name:"Dunant",             startLat:40.72, startLng:-73.97, endLat:43.30, endLng:5.37,   importance:"critical", capacity:"250 Tbps",  operators:"Google" },
  { id:"amitie",     name:"Amitié",             startLat:40.72, startLng:-73.97, endLat:47.38, endLng:-2.21,  importance:"critical", capacity:"400 Tbps",  operators:"Facebook, Microsoft, Aqua Comms" },
  { id:"sam1",       name:"SAm-1",              startLat:25.77, startLng:-80.19, endLat:-3.72, endLng:-38.58, importance:"major",    capacity:"40 Gbps",   operators:"Telefónica" },
  { id:"sas",        name:"SAS (S. Atlantic)",  startLat:-3.72, startLng:-38.58, endLat:-33.93,endLng:18.42,  importance:"major",    capacity:"12.8 Tbps", operators:"Angola Cables" },
  { id:"seamewe3",   name:"SEA-ME-WE 3",        startLat:50.83, startLng:-4.55,  endLat:1.35,  endLng:103.82, importance:"critical", capacity:"960 Gbps",  operators:"Consortium (16 telcos)" },
  { id:"seamewe5",   name:"SEA-ME-WE 5",        startLat:43.30, startLng:5.37,   endLat:1.35,  endLng:103.82, importance:"critical", capacity:"24 Tbps",   operators:"Consortium (15 telcos)" },
  { id:"flag",       name:"FLAG (FEA)",         startLat:50.83, startLng:-4.55,  endLat:35.61, endLng:140.12, importance:"major",    capacity:"10 Gbps",   operators:"GCX" },
  { id:"peace",      name:"PEACE",              startLat:24.86, startLng:67.01,  endLat:43.30, endLng:5.37,   importance:"major",    capacity:"16 Tbps",   operators:"PEACE Cable International" },
  { id:"eig",        name:"EIG",                startLat:51.50, startLng:-0.12,  endLat:19.08, endLng:72.88,  importance:"major",    capacity:"3.84 Tbps", operators:"Alcatel Submarine Networks" },
  { id:"faster",     name:"FASTER",             startLat:45.73, startLng:-123.95,endLat:35.61, endLng:140.12, importance:"critical", capacity:"60 Tbps",   operators:"Google, China Mobile" },
  { id:"jupiter",    name:"Jupiter",            startLat:36.98, startLng:-122.03,endLat:34.69, endLng:135.50, importance:"critical", capacity:"60 Tbps",   operators:"Amazon, Facebook, SoftBank" },
  { id:"aag",        name:"AAG",                startLat:35.37, startLng:-120.86,endLat:1.35,  endLng:103.82, importance:"major",    capacity:"40 Tbps",   operators:"Multi-operator" },
  { id:"hawaiki",    name:"Hawaiki",            startLat:45.73, startLng:-123.95,endLat:-33.87,endLng:151.21, importance:"major",    capacity:"30 Tbps",   operators:"Hawaiki Submarine Cable" },
  { id:"indigo",     name:"Indigo",             startLat:-31.95,startLng:115.84, endLat:19.08, endLng:72.88,  importance:"major",    capacity:"36 Tbps",   operators:"Google, Telstra" },
  { id:"apx",        name:"APX-East",           startLat:-33.87,startLng:151.21, endLat:22.28, endLng:114.16, importance:"major",    capacity:"80 Tbps",   operators:"AARNet, SubPartners" },
  { id:"seacom",     name:"SEACOM",             startLat:-33.93,startLng:18.42,  endLat:19.08, endLng:72.88,  importance:"major",    capacity:"1.28 Tbps", operators:"SEACOM" },
  { id:"eassy",      name:"EASSy",              startLat:-33.93,startLng:18.42,  endLat:-11.70,endLng:43.24,  importance:"major",    capacity:"4.72 Tbps", operators:"Multi-operator" },
  { id:"ace",        name:"ACE",                startLat:50.83, startLng:-4.55,  endLat:-33.93,endLng:18.42,  importance:"major",    capacity:"5.12 Tbps", operators:"Orange et al." },
  { id:"wacs",       name:"WACS",               startLat:38.71, startLng:-9.14,  endLat:-33.93,endLng:18.42,  importance:"major",    capacity:"5.12 Tbps", operators:"Multi-operator" },
  { id:"trans-pac",  name:"Trans-Pacific Express",startLat:35.37,startLng:-120.86,endLat:34.69,endLng:135.50, importance:"major",    capacity:"2.56 Tbps", operators:"China Telecom, AT&T" },
];

// ── Data: Cable Landing Points ──
const CABLE_LANDINGS = [
  { id:"shirley",   name:"Shirley, NY",           lat:40.88, lng:-72.89, importance:"major",  country:"USA",       cables:["TAT-14","SeaLink"] },
  { id:"vbeach",    name:"Virginia Beach, VA",    lat:36.83, lng:-76.00, importance:"critical",country:"USA",       cables:["MAREA","ACMA"] },
  { id:"miami",     name:"Miami, FL",             lat:25.77, lng:-80.19, importance:"major",  country:"USA",       cables:["SAm-1","Maya-1"] },
  { id:"morro",     name:"Morro Bay, CA",         lat:35.37, lng:-120.86,importance:"critical",country:"USA",       cables:["AAG","TPE"] },
  { id:"nedonna",   name:"Nedonna Beach, OR",     lat:45.73, lng:-123.95,importance:"critical",country:"USA",       cables:["FASTER","Hawaiki"] },
  { id:"bude",      name:"Bude, UK",              lat:50.83, lng:-4.55,  importance:"critical",country:"UK",        cables:["TAT-14","FLAG","ACE"] },
  { id:"killala",   name:"Killala, Ireland",      lat:54.22, lng:-9.22,  importance:"major",  country:"Ireland",   cables:["AEConnect"] },
  { id:"marseille", name:"Marseille, France",     lat:43.30, lng:5.37,   importance:"critical",country:"France",    cables:["SEA-ME-WE 3","Dunant"] },
  { id:"bilbao",    name:"Bilbao, Spain",         lat:43.26, lng:-2.93,  importance:"major",  country:"Spain",     cables:["MAREA"] },
  { id:"lisbon",    name:"Lisbon, Portugal",      lat:38.71, lng:-9.14,  importance:"major",  country:"Portugal",  cables:["WACS","Atlantis-2"] },
  { id:"fortaleza", name:"Fortaleza, Brazil",     lat:-3.72, lng:-38.58, importance:"major",  country:"Brazil",    cables:["SAm-1","SEABRAS-1"] },
  { id:"dakar",     name:"Dakar, Senegal",        lat:14.73, lng:-17.47, importance:"major",  country:"Senegal",   cables:["ACE","Atlantis-2"] },
  { id:"mumbai",    name:"Mumbai, India",         lat:19.08, lng:72.88,  importance:"critical",country:"India",     cables:["SEA-ME-WE 3","EIG","Indigo"] },
  { id:"chennai",   name:"Chennai, India",        lat:13.08, lng:80.29,  importance:"major",  country:"India",     cables:["SEA-ME-WE 3"] },
  { id:"karachi",   name:"Karachi, Pakistan",     lat:24.86, lng:67.01,  importance:"major",  country:"Pakistan",  cables:["PEACE","SEA-ME-WE 3"] },
  { id:"singapore", name:"Singapore",             lat:1.35,  lng:103.82, importance:"critical",country:"Singapore", cables:["SEA-ME-WE 3","AAG","SEA-ME-WE 5"] },
  { id:"hongkong",  name:"Hong Kong",             lat:22.28, lng:114.16, importance:"critical",country:"China",     cables:["AAG","APX-East"] },
  { id:"chiba",     name:"Chiba, Japan",          lat:35.61, lng:140.12, importance:"critical",country:"Japan",     cables:["FASTER","FLAG"] },
  { id:"sydney",    name:"Sydney, Australia",     lat:-33.87,lng:151.21, importance:"critical",country:"Australia", cables:["Hawaiki","APX-East"] },
  { id:"perth",     name:"Perth, Australia",      lat:-31.95,lng:115.84, importance:"major",  country:"Australia", cables:["Indigo"] },
  { id:"capetown",  name:"Cape Town, S. Africa",  lat:-33.93,lng:18.42,  importance:"critical",country:"S. Africa", cables:["SEACOM","WACS","SAT3","EASSy"] },
];

// ── Data: Active Conflict Zones ──
const CONFLICT_ZONES = [
  { id:"ukraine",  name:"Ukraine War",           lat:49.0,  lng:31.5,  intensity:"High",   type:"State Conflict",  started:"Feb 2022", impact:"European energy, grain markets",      note:"Russia-Ukraine war; frontline in eastern/southern Ukraine" },
  { id:"gaza",     name:"Gaza / Israel",          lat:31.5,  lng:34.5,  intensity:"High",   type:"State Conflict",  started:"Oct 2023", impact:"Middle East stability, oil risk",      note:"Israel-Hamas conflict; humanitarian crisis, regional escalation risk" },
  { id:"sudan",    name:"Sudan Civil War",        lat:15.5,  lng:30.5,  intensity:"High",   type:"Civil War",       started:"Apr 2023", impact:"African stability, refugee flows",     note:"SAF vs RSF; one of world's worst humanitarian crises" },
  { id:"yemen",    name:"Yemen / Red Sea",        lat:15.5,  lng:44.5,  intensity:"High",   type:"Civil War",       started:"Sep 2014", impact:"Bab el-Mandeb, global shipping",      note:"Houthi attacks on Red Sea shipping; major supply chain disruption" },
  { id:"myanmar",  name:"Myanmar",               lat:21.0,  lng:96.5,  intensity:"Medium", type:"Civil War",       started:"Feb 2021", impact:"SE Asia stability, supply chains",    note:"Military junta vs resistance forces; humanitarian crisis" },
  { id:"sahel",    name:"Sahel (Mali/BF/Niger)",  lat:13.5,  lng:-2.5,  intensity:"High",   type:"Insurgency",      started:"2012",     impact:"African trade routes, resource access", note:"Jihadist insurgency; coup belt across West Africa" },
  { id:"ethiopia", name:"Ethiopia",              lat:9.5,   lng:39.5,  intensity:"Medium", type:"Civil Conflict",  started:"Nov 2020", impact:"Horn of Africa stability",            note:"Multiple internal conflicts; post-Tigray fragility" },
  { id:"drc",      name:"DR Congo (East)",       lat:-4.0,  lng:28.5,  intensity:"Medium", type:"Civil Conflict",  started:"1997",     impact:"Cobalt, coltan supply chains",        note:"M23 rebels, FDLR; critical minerals region" },
  { id:"russia",   name:"Russia-Ukraine Front",  lat:47.8,  lng:37.5,  intensity:"High",   type:"Active Front",    started:"Feb 2022", impact:"Energy, grain, metals markets",       note:"Active frontline; Zaporizhzhia nuclear plant at risk" },
];

// ── Data: Sanctioned Regions ──
const SANCTIONED_REGIONS = [
  { id:"russia_s",  name:"Russia",          lat:61.5,  lng:90.0,  regime:"US / EU / UK / G7", impact:"Energy, metals, grains, finance", note:"SWIFT exclusion, energy embargo, export controls post-Ukraine invasion" },
  { id:"iran_s",    name:"Iran",            lat:32.4,  lng:53.7,  regime:"US / EU / UN",       impact:"Oil supply, OPEC+ dynamics",      note:"JCPOA breakdown; oil, banking, defense sectors sanctioned" },
  { id:"nkorea_s",  name:"North Korea",     lat:40.0,  lng:127.0, regime:"US / EU / UN",       impact:"Regional stability",              note:"Comprehensive UN sanctions; weapons proliferation, coal/iron exports" },
  { id:"venezuela_s",name:"Venezuela",      lat:6.4,   lng:-66.6, regime:"US",                 impact:"Latin America oil",               note:"Oil sector, financial, political sanctions; Maduro regime" },
  { id:"belarus_s", name:"Belarus",         lat:53.7,  lng:28.0,  regime:"US / EU",            impact:"European stability",              note:"Lukashenko regime; human rights violations post-2020 election" },
  { id:"syria_s",   name:"Syria",           lat:35.0,  lng:38.0,  regime:"US / EU / Arab League", impact:"Refugee crisis, Levant",      note:"Civil war; comprehensive trade restrictions on Assad regime" },
  { id:"myanmar_s", name:"Myanmar (junta)", lat:17.0,  lng:96.0,  regime:"US / EU",            impact:"SE Asia supply chains",          note:"Military coup 2021; targeted sanctions on generals and entities" },
  { id:"cuba_s",    name:"Cuba",            lat:21.5,  lng:-79.5, regime:"US",                 impact:"Caribbean trade",                note:"Decades-long embargo; banking and trade restrictions" },
];

// ── Data: Global Trade Flows ──
const TRADE_FLOWS = [
  { id:"china-us",     name:"China → US (Pacific)",     startLat:31.2,  startLng:121.5,  endLat:34.0,  endLng:-118.3, vol:"$582B/yr",  type:"Goods",          importance:"critical", region:"Asia → Americas" },
  { id:"china-eu",     name:"China → EU",               startLat:31.2,  startLng:121.5,  endLat:51.5,  endLng:10.0,   vol:"$845B/yr",  type:"Goods",          importance:"critical", region:"Asia → Europe" },
  { id:"us-eu",        name:"US ↔ EU Trans-Atlantic",    startLat:40.7,  startLng:-74.0,  endLat:51.5,  endLng:0.1,    vol:"$1.1T/yr",  type:"Goods+Services", importance:"critical", region:"Americas ↔ Europe" },
  { id:"japan-us",     name:"Japan → US",               startLat:35.7,  startLng:139.7,  endLat:37.8,  endLng:-122.4, vol:"$225B/yr",  type:"Goods",          importance:"major",    region:"Asia → Americas" },
  { id:"intraasia",    name:"Intra-Asia Trade",         startLat:1.35,  startLng:103.8,  endLat:22.3,  endLng:114.2,  vol:"$2.8T/yr",  type:"Goods",          importance:"critical", region:"Asia" },
  { id:"me-asia",      name:"Middle East → Asia Energy",startLat:24.5,  startLng:56.5,   endLat:22.3,  endLng:114.2,  vol:"$480B/yr",  type:"Energy",         importance:"critical", region:"Middle East → Asia" },
  { id:"africa-eu",    name:"Africa → EU Resources",   startLat:6.0,   startLng:2.4,    endLat:51.5,  endLng:10.0,   vol:"$260B/yr",  type:"Resources",      importance:"major",    region:"Africa → Europe" },
  { id:"latam-us",     name:"Latin America → US",      startLat:-23.5, startLng:-46.6,  endLat:29.9,  endLng:-90.1,  vol:"$430B/yr",  type:"Goods",          importance:"major",    region:"Americas" },
  { id:"aus-asia",     name:"Australia → Asia Resources",startLat:-33.9,startLng:151.2,  endLat:35.7,  endLng:139.7,  vol:"$180B/yr",  type:"Resources",      importance:"major",    region:"Asia-Pacific" },
  { id:"brazil-china", name:"Brazil → China (Agri/Iron)",startLat:-23.5,startLng:-46.6, endLat:31.2,  endLng:121.5,  vol:"$150B/yr",  type:"Resources",      importance:"major",    region:"Americas → Asia" },
];

// ── Data: Major Ports ──
const MAJOR_PORTS = [
  { id:"shanghai",   name:"Port of Shanghai",      lat:31.23, lng:121.50, country:"China",       vol:"47M TEU/yr",   type:"Container",        rank:1 },
  { id:"singapore_p",name:"Port of Singapore",     lat:1.26,  lng:103.82, country:"Singapore",   vol:"37M TEU/yr",   type:"Container+Energy", rank:2 },
  { id:"ningbo",     name:"Port of Ningbo",         lat:29.87, lng:121.55, country:"China",       vol:"33M TEU/yr",   type:"Container",        rank:3 },
  { id:"shenzhen_p", name:"Port of Shenzhen",       lat:22.50, lng:113.90, country:"China",       vol:"29M TEU/yr",   type:"Container",        rank:4 },
  { id:"qingdao",    name:"Port of Qingdao",        lat:36.07, lng:120.38, country:"China",       vol:"23M TEU/yr",   type:"Container",        rank:7 },
  { id:"busan",      name:"Port of Busan",          lat:35.18, lng:129.08, country:"S. Korea",    vol:"22M TEU/yr",   type:"Container",        rank:8 },
  { id:"hongkong_p", name:"Port of Hong Kong",      lat:22.30, lng:114.17, country:"China",       vol:"18M TEU/yr",   type:"Container",        rank:9 },
  { id:"rotterdam",  name:"Port of Rotterdam",      lat:51.90, lng:4.48,   country:"Netherlands", vol:"15M TEU/yr",   type:"Container+Energy", rank:11 },
  { id:"antwerp",    name:"Port of Antwerp-Bruges", lat:51.26, lng:4.40,   country:"Belgium",     vol:"12M TEU/yr",   type:"Container",        rank:12 },
  { id:"dubai_p",    name:"Port of Jebel Ali",      lat:24.99, lng:55.06,  country:"UAE",         vol:"14M TEU/yr",   type:"Container",        rank:10 },
  { id:"losangeles_p",name:"Port of LA/Long Beach", lat:33.75, lng:-118.27,country:"USA",         vol:"9M TEU/yr",    type:"Container",        rank:14 },
  { id:"hamburg_p",  name:"Port of Hamburg",        lat:53.54, lng:9.99,   country:"Germany",     vol:"8.7M TEU/yr",  type:"Container",        rank:16 },
  { id:"rastanura",  name:"Ras Tanura Terminal",    lat:26.64, lng:50.08,  country:"Saudi Arabia",vol:"6.5M bbl/day", type:"Oil Terminal",     rank:1 },
  { id:"fujairah_p", name:"Port of Fujairah",       lat:25.12, lng:56.34,  country:"UAE",         vol:"3.0M bbl/day", type:"Oil Terminal",     rank:2 },
  { id:"houston",    name:"Port of Houston",        lat:29.76, lng:-95.11, country:"USA",         vol:"2.8M bbl/day", type:"Energy+Container", rank:3 },
  { id:"rotterdam_e",name:"Rotterdam Energy Hub",   lat:51.95, lng:4.10,   country:"Netherlands", vol:"2.1M bbl/day", type:"Energy",           rank:4 },
];

// ── Layer configuration ──
const GLOBE_LAYER_CONFIG = {
  // Infrastructure
  oilRoutes:     { label:"Oil Shipping Routes",    icon:"🛢",  color:"#f0a500", cat:"infrastructure", desc:"Major global oil tanker routes",    enabled:true,  count:OIL_ROUTES.length },
  pipelines:     { label:"Pipelines",              icon:"⚡",  color:"#e85d04", cat:"infrastructure", desc:"Major oil and gas pipelines",        enabled:false, count:0 },
  seaCables:     { label:"Subsea Internet Cables", icon:"🌐",  color:"#58a6ff", cat:"infrastructure", desc:"Global undersea fiber-optic cables", enabled:true,  count:SEA_CABLES.length },
  cableLandings: { label:"Cable Landing Points",   icon:"📡",  color:"#3fb950", cat:"infrastructure", desc:"Coastal cable terminal stations",    enabled:false, count:0 },
  // Transportation
  majorPorts:    { label:"Major Ports",            icon:"🚢",  color:"#06b6d4", cat:"transportation", desc:"World's top container & energy ports",enabled:false, count:0 },
  // Geopolitics
  chokepoints:   { label:"Strategic Chokepoints",  icon:"⚓",  color:"#f85149", cat:"geopolitics",    desc:"Critical maritime chokepoints",      enabled:true,  count:CHOKEPOINTS.length },
  conflictZones: { label:"Conflict Zones",         icon:"⚔️",  color:"#ff3333", cat:"geopolitics",    desc:"Active conflicts and instability",   enabled:false, count:0 },
  sanctioned:    { label:"Sanctioned Regions",     icon:"🚫",  color:"#e3b341", cat:"geopolitics",    desc:"Sanctioned countries and embargoes", enabled:false, count:0 },
  // Markets
  tradeFlows:    { label:"Global Trade Flows",     icon:"📦",  color:"#a78bfa", cat:"markets",        desc:"Major global trade corridors",       enabled:false, count:0 },
};

const GLOBE_CATEGORIES = [
  { id:"infrastructure", label:"Infrastructure", icon:"🏗" },
  { id:"transportation", label:"Transportation", icon:"🚢" },
  { id:"geopolitics",    label:"Geopolitics",    icon:"🌏" },
  { id:"markets",        label:"Markets",        icon:"📊" },
];

const GLOBE_FUTURE_LAYERS = [
  { icon:"🛳",  label:"AIS Ship Tracking",    cat:"transportation" },
  { icon:"✈️", label:"Aircraft (ADS-B)",      cat:"transportation" },
  { icon:"🌪",  label:"Weather Systems",       cat:"environment"    },
  { icon:"🌊",  label:"Ocean Currents",        cat:"environment"    },
  { icon:"🛰",  label:"Satellite Coverage",    cat:"infrastructure" },
  { icon:"💻",  label:"Cyber Infrastructure",  cat:"infrastructure" },
];

// ── Research context resolver (which research item to open per globe element) ──
const resolveResearch = (d) => {
  if (!d) return null;
  if (d._layer === "oilRoutes" || d._layer === "pipelines")
    return { id:"CL=F", label:"WTI Crude Oil", ticker:"CL=F", type:"commodity", category:"Commodities" };
  if (d._layer === "seaCables" || d._layer === "cableLandings")
    return null; // no direct research link
  if (d._layer === "conflictZones")
    return { id:d.id, label:d.name, type:"event", category:"Geopolitics" };
  if (d._layer === "tradeFlows")
    return { id:"macro", label:"Global Trade", type:"macro", category:"Macro" };
  if (d._layer === "sanctioned" && d.id === "russia_s")
    return { id:"NG=F", label:"Natural Gas", ticker:"NG=F", type:"commodity", category:"Commodities" };
  if (d._layer === "sanctioned" && d.id === "iran_s")
    return { id:"CL=F", label:"WTI Crude Oil", ticker:"CL=F", type:"commodity", category:"Commodities" };
  return null;
};

// ── Tooltip HTML helper ──
const TIP = "background:#0d1117;border:1px solid #30363d;padding:5px 10px;border-radius:3px;font-family:monospace;font-size:10px;color:#e6edf3;pointer-events:none";

function GlobalIntelligenceGlobe({ onOpenResearch }) {
  const containerRef = useRef();
  const globeEl      = useRef();
  const [GlobeComp,  setGlobeComp]  = useState(null);
  const [layers,     setLayers]     = useState(GLOBE_LAYER_CONFIG);
  const [selected,   setSelected]   = useState(null);
  const [hovered,    setHovered]    = useState(null);
  const [dims,       setDims]       = useState({ w:800, h:600 });
  const [region,     setRegion]     = useState("all");
  const [importance, setImportance] = useState("all");
  const [openCats,   setOpenCats]   = useState({ infrastructure:true, transportation:false, geopolitics:true, markets:false, soon:false });

  // ── Lazy-load react-globe.gl ──
  useEffect(() => {
    import("react-globe.gl")
      .then(mod => setGlobeComp(() => mod.default))
      .catch(err => console.error("Globe load failed:", err));
  }, []);

  // ── Responsive container sizing ──
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDims({ w:Math.floor(width), h:Math.floor(height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Globe ready: controls + constant daylight lighting ──
  const onGlobeReady = useCallback(() => {
    if (!globeEl.current) return;
    const ctrl = globeEl.current.controls();
    ctrl.autoRotate    = false;
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.12;
    ctrl.minDistance   = 150;
    ctrl.maxDistance   = 700;
    globeEl.current.pointOfView({ lat:20, lng:10, altitude:2.3 }, 800);
    globeEl.current.scene().traverse(obj => {
      if (obj.isAmbientLight)     obj.intensity = 3.5;
      if (obj.isDirectionalLight) obj.intensity = 0;
    });
  }, []);

  const toggleLayer = useCallback((id) => {
    setLayers(prev => ({ ...prev, [id]: { ...prev[id], enabled:!prev[id].enabled } }));
  }, []);

  const toggleCat = useCallback((id) => {
    setOpenCats(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleRegionChange = useCallback((key) => {
    setRegion(key);
    if (globeEl.current && GLOBE_REGIONS[key]?.pov) {
      globeEl.current.pointOfView(GLOBE_REGIONS[key].pov, 900);
    }
  }, []);

  // ── Arc dataset (oil routes + pipelines + cables + trade flows) ──
  const arcsData = useMemo(() => {
    const out = [];
    const add = (arr, layerKey) => {
      if (!layers[layerKey]?.enabled) return;
      arr.forEach(item => {
        if (!meetsImp(item.importance, importance)) return;
        if (region !== "all" &&
            !inRegion(item.startLat, item.startLng, region) &&
            !inRegion(item.endLat,   item.endLng,   region)) return;
        out.push({ ...item, _layer:layerKey });
      });
    };
    add(OIL_ROUTES,   "oilRoutes");
    add(PIPELINES,    "pipelines");
    add(SEA_CABLES,   "seaCables");
    add(TRADE_FLOWS,  "tradeFlows");
    return out;
  }, [layers, region, importance]);

  // ── Point dataset (chokepoints + landings + ports + conflicts + sanctions) ──
  const pointsData = useMemo(() => {
    const out = [];
    const add = (arr, layerKey) => {
      if (!layers[layerKey]?.enabled) return;
      arr.forEach(item => {
        if (!meetsImp(item.importance, importance)) return;
        if (region !== "all" && !inRegion(item.lat, item.lng, region)) return;
        out.push({ ...item, _layer:layerKey });
      });
    };
    add(CHOKEPOINTS,       "chokepoints");
    add(CABLE_LANDINGS,    "cableLandings");
    add(MAJOR_PORTS,       "majorPorts");
    add(CONFLICT_ZONES,    "conflictZones");
    add(SANCTIONED_REGIONS,"sanctioned");
    return out;
  }, [layers, region, importance]);

  // ── Info panel renderer ──
  const badge = (text, color) => (
    <span className="text-xs font-mono px-1.5 py-0.5 rounded"
      style={{ background:color+"22", border:`1px solid ${color}44`, color }}>{text}</span>
  );

  const renderInfo = (d) => {
    if (!d) return null;
    const research = resolveResearch(d);
    return (
      <div className="p-3 rounded mt-3" style={{ background:"#0d1117", border:"1px solid #30363d" }}>
        <div className="font-mono font-bold text-xs mb-2" style={{ color:"#e6edf3" }}>{d.name}</div>

        {d._layer === "chokepoints" && <>
          <div className="flex gap-1 mb-2 flex-wrap">{badge(d.type,"#e3b341")}{badge(d.importance||"","#7d8590")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"#7d8590" }}>Oil flow: <span style={{ color:"#f0a500" }}>{d.oil}</span></div>
          <div className="text-xs font-mono leading-relaxed" style={{ color:"#484f58" }}>{d.note}</div>
        </>}

        {d._layer === "oilRoutes" && <>
          <div className="flex gap-1 mb-2">{badge("Oil Route","#f0a500")}{badge(d.importance||"","#7d8590")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"#7d8590" }}>Region: <span style={{ color:"#e6edf3" }}>{d.region}</span></div>
          <div className="text-xs font-mono" style={{ color:"#f0a500" }}>Volume: {d.vol}</div>
        </>}

        {d._layer === "pipelines" && <>
          <div className="flex gap-1 mb-2">{badge(d.type,"#e85d04")}{badge(d.importance||"","#7d8590")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"#7d8590" }}>Region: <span style={{ color:"#e6edf3" }}>{d.region}</span></div>
          <div className="text-xs font-mono" style={{ color:"#e85d04" }}>Volume: {d.vol}</div>
        </>}

        {d._layer === "seaCables" && <>
          <div className="flex gap-1 mb-2">{badge("Subsea Cable","#58a6ff")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"#7d8590" }}>Capacity: <span style={{ color:"#58a6ff" }}>{d.capacity}</span></div>
          <div className="text-xs font-mono leading-relaxed" style={{ color:"#484f58" }}>{d.operators}</div>
        </>}

        {d._layer === "cableLandings" && <>
          <div className="flex gap-1 mb-2">{badge("Landing Stn","#3fb950")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"#7d8590" }}>Country: <span style={{ color:"#e6edf3" }}>{d.country}</span></div>
          <div className="text-xs font-mono leading-relaxed" style={{ color:"#3fb950" }}>{d.cables?.join(", ")}</div>
        </>}

        {d._layer === "conflictZones" && <>
          <div className="flex gap-1 mb-2 flex-wrap">{badge(d.intensity+" Risk","#ff3333")}{badge(d.type,"#7d8590")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"#7d8590" }}>Since: <span style={{ color:"#e6edf3" }}>{d.started}</span></div>
          <div className="text-xs font-mono mb-1" style={{ color:"#f85149" }}>Market impact: {d.impact}</div>
          <div className="text-xs font-mono leading-relaxed" style={{ color:"#484f58" }}>{d.note}</div>
        </>}

        {d._layer === "sanctioned" && <>
          <div className="flex gap-1 mb-2">{badge("Sanctioned","#e3b341")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"#7d8590" }}>Regime: <span style={{ color:"#e3b341" }}>{d.regime}</span></div>
          <div className="text-xs font-mono mb-1" style={{ color:"#7d8590" }}>Impact: <span style={{ color:"#e6edf3" }}>{d.impact}</span></div>
          <div className="text-xs font-mono leading-relaxed" style={{ color:"#484f58" }}>{d.note}</div>
        </>}

        {d._layer === "majorPorts" && <>
          <div className="flex gap-1 mb-2">{badge(d.type,"#06b6d4")}{badge(`Rank #${d.rank}`,"#7d8590")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"#7d8590" }}>Country: <span style={{ color:"#e6edf3" }}>{d.country}</span></div>
          <div className="text-xs font-mono" style={{ color:"#06b6d4" }}>Volume: {d.vol}</div>
        </>}

        {d._layer === "tradeFlows" && <>
          <div className="flex gap-1 mb-2">{badge(d.type,"#a78bfa")}{badge(d.importance||"","#7d8590")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"#7d8590" }}>Corridor: <span style={{ color:"#e6edf3" }}>{d.region}</span></div>
          <div className="text-xs font-mono" style={{ color:"#a78bfa" }}>Trade volume: {d.vol}</div>
        </>}

        <div className="flex gap-2 mt-3">
          {research && onOpenResearch && (
            <button onClick={() => onOpenResearch(research)}
              className="text-xs font-mono px-2 py-1 rounded"
              style={{ background:"#0c2044", border:"1px solid #58a6ff33", color:"#58a6ff", cursor:"pointer" }}>
              → Research
            </button>
          )}
          <button onClick={() => setSelected(null)}
            className="text-xs font-mono px-2 py-1 rounded"
            style={{ background:"transparent", border:"1px solid rgba(99,110,123,0.18)", color:"#484f58", cursor:"pointer" }}>
            ✕ Close
          </button>
        </div>
      </div>
    );
  };

  // ── Active count per category ──
  const catActiveCounts = useMemo(() => {
    const counts = {};
    GLOBE_CATEGORIES.forEach(cat => {
      const layersInCat = Object.entries(layers).filter(([,l]) => l.cat === cat.id);
      counts[cat.id] = { active: layersInCat.filter(([,l]) => l.enabled).length, total: layersInCat.length };
    });
    return counts;
  }, [layers]);

  // ── Visible element counts ──
  const activeCounts = useMemo(() => ({
    arcs: arcsData.length,
    points: pointsData.length,
    layers: Object.values(layers).filter(l => l.enabled).length,
  }), [arcsData.length, pointsData.length, layers]);

  return (
    <div className="flex" style={{ height:"calc(100vh - 90px)", overflow:"hidden" }}>

      {/* ── Left panel: filters + layer controls ── */}
      <div className="terminal-panel flex flex-col"
        style={{ width:240, flexShrink:0, overflowY:"auto", borderRight:"1px solid #21262d" }}>

        {/* Header */}
        <div className="px-3 pt-3 pb-2" style={{ borderBottom:"1px solid #1c2128" }}>
          <div className="terminal-header text-sm mb-1">🌐 Globe Controls</div>
          <div className="text-xs font-mono" style={{ color:"#484f58" }}>
            {activeCounts.layers} layer{activeCounts.layers !== 1 ? "s" : ""} · {activeCounts.arcs + activeCounts.points} elements
          </div>
        </div>

        {/* Region filter */}
        <div className="px-3 py-2" style={{ borderBottom:"1px solid #1c2128" }}>
          <div className="text-xs font-mono mb-1.5" style={{ color:"#484f58", textTransform:"uppercase", letterSpacing:"0.07em" }}>Region Focus</div>
          <select value={region} onChange={e => handleRegionChange(e.target.value)}
            className="w-full font-mono text-xs p-1.5 rounded"
            style={{ background:"#0d1117", border:"1px solid #30363d", color:"#e6edf3", outline:"none", cursor:"pointer" }}>
            {Object.entries(GLOBE_REGIONS).map(([key, r]) => (
              <option key={key} value={key}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Importance filter */}
        <div className="px-3 py-2" style={{ borderBottom:"1px solid #1c2128" }}>
          <div className="text-xs font-mono mb-1.5" style={{ color:"#484f58", textTransform:"uppercase", letterSpacing:"0.07em" }}>Importance</div>
          <div className="flex gap-1">
            {[["all","All"],["major","Major"],["critical","Critical"]].map(([val, lbl]) => (
              <button key={val} onClick={() => setImportance(val)}
                className="flex-1 text-xs font-mono py-1 rounded"
                style={{
                  background: importance === val ? "#0c2044" : "transparent",
                  border:"1px solid",
                  borderColor: importance === val ? "#58a6ff44" : "#1c2128",
                  color: importance === val ? "#58a6ff" : "#484f58",
                  cursor:"pointer",
                }}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* Category sections */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {GLOBE_CATEGORIES.map(cat => {
            const layersInCat = Object.entries(layers).filter(([,l]) => l.cat === cat.id);
            const counts = catActiveCounts[cat.id];
            const isOpen = openCats[cat.id];
            return (
              <div key={cat.id} className="mb-2">
                {/* Category header */}
                <button onClick={() => toggleCat(cat.id)}
                  className="w-full flex items-center justify-between py-1.5 px-1"
                  style={{ cursor:"pointer", background:"transparent", border:"none" }}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{cat.icon}</span>
                    <span className="text-xs font-mono font-bold" style={{ color:"#e6edf3" }}>{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {counts.active > 0 && (
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background:"#0c2044", color:"#58a6ff", fontSize:9 }}>
                        {counts.active}/{counts.total}
                      </span>
                    )}
                    <span className="text-xs font-mono" style={{ color:"#484f58" }}>{isOpen ? "▾" : "▸"}</span>
                  </div>
                </button>

                {/* Layer buttons */}
                {isOpen && (
                  <div className="flex flex-col gap-1 ml-1 mb-1">
                    {layersInCat.map(([id, layer]) => (
                      <button key={id} onClick={() => toggleLayer(id)}
                        className="w-full flex items-start gap-2 p-2 rounded text-left"
                        style={{
                          background: layer.enabled ? "#0c2044" : "transparent",
                          border:"1px solid",
                          borderColor: layer.enabled ? layer.color+"44" : "#1c2128",
                          cursor:"pointer",
                        }}>
                        <div style={{ width:7, height:7, borderRadius:"50%", background:layer.enabled ? layer.color : "#484f58", flexShrink:0, marginTop:3 }} />
                        <div>
                          <div className="font-mono font-bold" style={{ fontSize:11, color:layer.enabled?"#e6edf3":"#7d8590" }}>
                            {layer.icon} {layer.label}
                          </div>
                          <div className="font-mono" style={{ fontSize:9, color:"#484f58", lineHeight:1.4 }}>{layer.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Coming soon section */}
          <div className="mb-2">
            <button onClick={() => toggleCat("soon")}
              className="w-full flex items-center justify-between py-1.5 px-1"
              style={{ cursor:"pointer", background:"transparent", border:"none" }}>
              <span className="text-xs font-mono font-bold" style={{ color:"#484f58" }}>Coming Soon</span>
              <span className="text-xs font-mono" style={{ color:"#21262d" }}>{openCats.soon ? "▾" : "▸"}</span>
            </button>
            {openCats.soon && (
              <div className="flex flex-col gap-1 ml-1">
                {GLOBE_FUTURE_LAYERS.map(f => (
                  <div key={f.label} className="flex items-center gap-2 p-2 rounded"
                    style={{ border:"1px solid #1c2128", opacity:0.4 }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:"#21262d" }} />
                    <div className="font-mono" style={{ fontSize:10, color:"#484f58" }}>{f.icon} {f.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected element info */}
        {selected && (
          <div className="px-3 pb-3" style={{ borderTop:"1px solid #1c2128" }}>
            {renderInfo(selected)}
          </div>
        )}
      </div>

      {/* ── Globe canvas ── */}
      <div ref={containerRef} className="flex-1 relative" style={{ background:"#050c18" }}>
        {!GlobeComp ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="text-xs font-mono animate-pulse" style={{ color:"#7d8590" }}>Initializing WebGL renderer…</div>
            <div className="text-xs font-mono" style={{ color:"#484f58" }}>Loading globe assets</div>
          </div>
        ) : (
          <GlobeComp
            ref={globeEl}
            width={dims.w}
            height={dims.h}
            onGlobeReady={onGlobeReady}

            /* Globe: constant daylight, blue-marble texture */
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            showAtmosphere={true}
            atmosphereColor="#4a8fd4"
            atmosphereAltitude={0.12}

            /* Arcs — all layers */
            arcsData={arcsData}
            arcStartLat="startLat"
            arcStartLng="startLng"
            arcEndLat="endLat"
            arcEndLng="endLng"
            arcColor={arcCol}
            arcStroke={arcStr}
            arcDashLength={1}
            arcDashGap={0}
            arcDashAnimateTime={0}
            arcAltitude={arcAlt}
            arcLabel={d => `<div style="${TIP}"><b>${d.name}</b>${d.vol ? `<br/>Vol: ${d.vol}` : ""}${d.capacity ? `<br/>Cap: ${d.capacity}` : ""}${d.type ? `<br/>${d.type}` : ""}</div>`}
            onArcClick={d => setSelected(d)}
            onArcHover={d => setHovered(d)}

            /* Points — all layers */
            pointsData={pointsData}
            pointLat="lat"
            pointLng="lng"
            pointColor={ptCol}
            pointRadius={ptRad}
            pointAltitude={ptAlt}
            pointResolution={12}
            pointLabel={d => `<div style="${TIP}"><b>${d.name}</b>${d.oil ? `<br/>Oil: ${d.oil}` : ""}${d.vol ? `<br/>Vol: ${d.vol}` : ""}${d.country ? `<br/>${d.country}` : ""}${d.intensity ? `<br/>Risk: ${d.intensity}` : ""}</div>`}
            onPointClick={d => setSelected(d)}
            onPointHover={d => setHovered(d)}
          />
        )}

        {/* Status bar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-1.5"
          style={{ background:"#0d111799", borderTop:"1px solid #1c2128", pointerEvents:"none" }}>
          <div className="text-xs font-mono" style={{ color: hovered ? "#e6edf3" : "#484f58" }}>
            {hovered ? hovered.name : "Drag to rotate · Scroll to zoom · Click for detail"}
          </div>
          <div className="flex items-center gap-3">
            {region !== "all" && (
              <span className="text-xs font-mono" style={{ color:"#58a6ff" }}>
                ◉ {GLOBE_REGIONS[region]?.label}
              </span>
            )}
            {importance !== "all" && (
              <span className="text-xs font-mono" style={{ color:"#e3b341" }}>
                ▲ {importance[0].toUpperCase() + importance.slice(1)} only
              </span>
            )}
            <span className="text-xs font-mono" style={{ color:"#484f58" }}>
              {activeCounts.arcs + activeCounts.points} elements
            </span>
          </div>
        </div>

        {/* Layer legend overlay */}
        <div className="absolute top-3 right-3 flex flex-col gap-1" style={{ pointerEvents:"none" }}>
          {Object.entries(layers).filter(([,l]) => l.enabled).map(([id, layer]) => (
            <div key={id} className="text-xs font-mono px-2 py-1 rounded flex items-center gap-1.5"
              style={{ background:"#0d111799", border:`1px solid ${layer.color}33`, color:layer.color }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:layer.color }} />
              {layer.icon} {layer.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EyeOfSauron({ onOpenResearch }) {
  const [active, setActive] = useState(null);

  const MODULES = [
    { id: "globe",   icon: "🌐", title: "Infrastructure Globe", desc: "Interactive 3D globe — oil routes, subsea cables, strategic chokepoints" },
    { id: "weather", icon: "🌦", title: "Global Weather",       desc: "Live weather across major financial centers worldwide" },
    { id: "vessels", icon: "🛢", title: "Vessel Tracker",       desc: "Live oil tankers and cargo ships via MarineTraffic" },
    { id: "flights", icon: "✈️", title: "Flight Tracker",       desc: "Real-time global flight tracking via ADS-B Exchange" },
    { id: "energy",  icon: "⚡", title: "Energy Grid",          desc: "Live US electricity grid demand and generation mix" },
    { id: "tankers", icon: "🚢", title: "Shipping Routes",      desc: "Major shipping lane congestion and freight rates", tag: "Coming Soon" },
    { id: "geo",     icon: "🌍", title: "Geopolitical Events",  desc: "Live intelligence feed — market-moving events classified by impact and region" },
  ];

  const renderModule = (id) => {
    if (id === "globe")   return <GlobalIntelligenceGlobe onOpenResearch={onOpenResearch} />;
    if (id === "weather") return <WeatherDashboard />;
    if (id === "vessels") return <TankerMap />;
    if (id === "flights") return <FlightTracker />;
    if (id === "energy")  return <EnergyGrid />;
    if (id === "geo")     return <GeopoliticalEvents onOpenResearch={onOpenResearch} />;
    return null;
  };

  if (active) {
    const mod = MODULES.find(m => m.id === active);
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: "1px solid #21262d" }}>
          <button onClick={() => setActive(null)}
            className="text-xs font-mono px-3 py-1 rounded transition-colors"
            style={{ background: "#0c2044", color: "#58a6ff", border: "1px solid #58a6ff33" }}>
            ← Back
          </button>
          <span style={{ fontSize: 18 }}>{mod.icon}</span>
          <span className="terminal-header">{mod.title}</span>
        </div>
        <div className="flex-1">
          {renderModule(active)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4">
      <div className="mb-4">
        <div className="terminal-header text-lg mb-1">👁 Eye of Sauron</div>
        <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Global intelligence feeds — click any module to expand</div>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        {MODULES.map(mod => (
          <div key={mod.id}
            onClick={() => !mod.tag && setActive(mod.id)}
            className="eye-card p-4 transition-all"
            style={{ cursor: mod.tag ? "default" : "pointer", minHeight: 140 }}>
            <div style={{ fontSize: 36 }} className="mb-3">{mod.icon}</div>
            <div className="font-mono font-bold text-sm mb-1" style={{ color: mod.tag ? "#7d8590" : "#e6edf3" }}>{mod.title}</div>
            <div className="font-mono text-xs leading-relaxed mb-3" style={{ color: "#7d8590" }}>{mod.desc}</div>
            {mod.tag ? (
              <span className="text-xs font-mono px-2 py-1 rounded" style={{ border: "1px solid #7d8590", color: "#58a6ff44" }}>Coming Soon</span>
            ) : (
              <span className="text-xs font-mono px-2 py-1 rounded" style={{ border: "1px solid #58a6ff33", color: "#58a6ff" }}>● Click to Open</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TankerMap() {
  return (
    <div className="flex flex-col" style={{ borderTop: "1px solid #21262d" }}>
      <div className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: "1px solid #21262d" }}>
        <span className="terminal-header">🛢 Live Vessel Tracker — MarineTraffic</span>
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "#0c2044", color: "#58a6ff", border: "1px solid #58a6ff33" }}>● LIVE</span>
      </div>
      <iframe
        src="https://www.marinetraffic.com/en/ais/embed/maptype:0/mmsi:0/vesseltype:80/zoom:4/shownames:true/bgcolor:000000"
        style={{ width: "100%", height: 450, border: "none" }}
        title="Live Vessel Tracker"
      />
    </div>
  );
}


function FlightTracker() {
  return (
    <div className="flex flex-col" style={{ borderTop: "1px solid #21262d" }}>
      <div className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: "1px solid #21262d" }}>
        <span className="terminal-header">✈️ Live Flight Tracker — FlightRadar24</span>
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "#0c2044", color: "#58a6ff", border: "1px solid #58a6ff33" }}>● LIVE</span>
      </div>
      <iframe
        src="https://globe.adsbexchange.com/?largeMode=1"
        style={{ width: "100%", height: 450, border: "none" }}
        title="Live Flight Tracker"
      />
    </div>
  );
}


function EnergyGrid() {
  return (
    <div className="flex flex-col" style={{ borderTop: "1px solid #21262d" }}>
      <div className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: "1px solid #21262d" }}>
        <span className="terminal-header">⚡ Live Energy Grid — Electricity Maps</span>
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "#0c2044", color: "#58a6ff", border: "1px solid #58a6ff33" }}>● LIVE</span>
        <span className="text-xs font-mono" style={{ color: "#7d8590" }}>Carbon intensity & energy mix by country</span>
      </div>
      <iframe
        src="https://www.eia.gov/electricity/gridmonitor/dashboard/electric_overview/US48/US48"
        style={{ width: "100%", height: 450, border: "none" }}
        title="Live Energy Grid"
      />
    </div>
  );
}

function WeatherDashboard() {
  const CITIES = [
    { name: "New York", lat: 40.71, lon: -74.01, tz: "America/New_York", flag: "🇺🇸" },
    { name: "London", lat: 51.51, lon: -0.13, tz: "Europe/London", flag: "🇬🇧" },
    { name: "Tokyo", lat: 35.68, lon: 139.69, tz: "Asia/Tokyo", flag: "🇯🇵" },
    { name: "Hong Kong", lat: 22.32, lon: 114.17, tz: "Asia/Hong_Kong", flag: "🇭🇰" },
    { name: "Dubai", lat: 25.20, lon: 55.27, tz: "Asia/Dubai", flag: "🇦🇪" },
    { name: "Shanghai", lat: 31.23, lon: 121.47, tz: "Asia/Shanghai", flag: "🇨🇳" },
    { name: "Frankfurt", lat: 50.11, lon: 8.68, tz: "Europe/Berlin", flag: "🇩🇪" },
    { name: "Singapore", lat: 1.35, lon: 103.82, tz: "Asia/Singapore", flag: "🇸🇬" },
    { name: "Sydney", lat: -33.87, lon: 151.21, tz: "Australia/Sydney", flag: "🇦🇺" },
    { name: "Toronto", lat: 43.65, lon: -79.38, tz: "America/Toronto", flag: "🇨🇦" },
    { name: "Riyadh", lat: 24.69, lon: 46.72, tz: "Asia/Riyadh", flag: "🇸🇦" },
    { name: "Mumbai", lat: 19.08, lon: 72.88, tz: "Asia/Kolkata", flag: "🇮🇳" },
  ];

  const WMO = {
    0: { label: "Clear", icon: "☀️" },
    1: { label: "Mostly Clear", icon: "🌤" },
    2: { label: "Partly Cloudy", icon: "⛅️" },
    3: { label: "Overcast", icon: "☁️" },
    45: { label: "Foggy", icon: "🌫" },
    48: { label: "Icy Fog", icon: "🌫" },
    51: { label: "Light Drizzle", icon: "🌦" },
    53: { label: "Drizzle", icon: "🌦" },
    55: { label: "Heavy Drizzle", icon: "🌧" },
    61: { label: "Light Rain", icon: "🌧" },
    63: { label: "Rain", icon: "🌧" },
    65: { label: "Heavy Rain", icon: "🌧" },
    71: { label: "Light Snow", icon: "🌨" },
    73: { label: "Snow", icon: "❄️" },
    75: { label: "Heavy Snow", icon: "❄️" },
    80: { label: "Showers", icon: "🌦" },
    81: { label: "Showers", icon: "🌧" },
    82: { label: "Heavy Showers", icon: "⛈" },
    95: { label: "Thunderstorm", icon: "⛈" },
    99: { label: "Hail Storm", icon: "⛈" },
  };

  const [weather, setWeather] = useState({});
  const [active, setActive] = useState("New York");
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lats = CITIES.map(c => c.lat).join(",");
    const lons = CITIES.map(c => c.lon).join(",");
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + lats + "&longitude=" + lons + "&current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m&temperature_unit=celsius&windspeed_unit=mph")
      .then(r => r.json())
      .then(results => {
        const arr = Array.isArray(results) ? results : [results];
        const weatherMap = {};
        CITIES.forEach((c, i) => {
          const d = arr[i];
          weatherMap[c.name] = {
            temp: d?.current?.temperature_2m,
            code: d?.current?.weathercode,
            wind: d?.current?.windspeed_10m,
            humidity: d?.current?.relativehumidity_2m,
          };
        });
        setWeather(weatherMap);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []); // eslint-disable-line

  useEffect(() => {
    const city = CITIES.find(c => c.name === active);
    if (!city) return;
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + city.lat + "&longitude=" + city.lon + "&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=celsius&timezone=" + city.tz)
      .then(r => r.json())
      .then(d => {
        if (d.daily) {
          const days = d.daily.time.map((t, i) => ({
            date: new Date(t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            max: d.daily.temperature_2m_max[i],
            min: d.daily.temperature_2m_min[i],
            code: d.daily.weathercode[i],
          }));
          setForecast(days);
        }
      })
      .catch(() => {});
  }, [active]); // eslint-disable-line

  const activeCity = CITIES.find(c => c.name === active);
  // const activeWeather = weather[active];
  const wmo = (code) => WMO[code] || WMO[Math.floor(code/10)*10] || { label: "Clear", icon: "🌤" };

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", gridTemplateRows: "auto auto" }}>
      
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/3", gridRow: "1/2" }}>
        <div className="terminal-header mb-3">🌍 Global Financial Centers — Weather</div>
        <div className="grid grid-cols-3 gap-2">
          {CITIES.slice(0, 6).map(c => {
            const w = weather[c.name];
            const isActive = active === c.name;
            return (
              <div key={c.name} onClick={() => setActive(c.name)}
                className="p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "#0c2044" : "#0d1117", border: "1px solid", borderColor: isActive ? "#58a6ff44" : "#1c2128" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold" style={{ color: isActive ? "#58a6ff" : "#e6edf3" }}>{c.flag} {c.name}</span>
                  <span style={{ fontSize: 16 }}>{wmo(w?.code).icon}</span>
                </div>
                <div className="text-lg font-mono font-bold" style={{ color: "#e6edf3" }}>{w ? w.temp + "°C" : "..."}</div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{wmo(w?.code).label}</div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>💨 {w?.wind || "—"} mph</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "3/5", gridRow: "1/2" }}>
        <div className="terminal-header mb-3">🌍 Asia Pacific & Middle East</div>
        <div className="grid grid-cols-3 gap-2">
          {CITIES.slice(6, 12).map(c => {
            const w = weather[c.name];
            const isActive = active === c.name;
            return (
              <div key={c.name} onClick={() => setActive(c.name)}
                className="p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "#0c2044" : "#0d1117", border: "1px solid", borderColor: isActive ? "#58a6ff44" : "#1c2128" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold" style={{ color: isActive ? "#58a6ff" : "#e6edf3" }}>{c.flag} {c.name}</span>
                  <span style={{ fontSize: 16 }}>{wmo(w?.code).icon}</span>
                </div>
                <div className="text-lg font-mono font-bold" style={{ color: "#e6edf3" }}>{w ? w.temp + "°C" : "..."}</div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{wmo(w?.code).label}</div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>💨 {w?.wind || "—"} mph</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/3", gridRow: "2/3" }}>
        <div className="terminal-header mb-3">{activeCity?.flag} {active} — 7 Day Forecast</div>
        <div className="grid grid-cols-7 gap-1">
          {forecast.slice(0, 7).map((f, i) => (
            <div key={i} className="flex flex-col items-center p-1.5 rounded" style={{ background: "#0d1117", border: "1px solid #1c2128" }}>
              <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{f.date.split(",")[0]}</div>
              <div style={{ fontSize: 20, margin: "4px 0" }}>{wmo(f.code).icon}</div>
              <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{f.max}°</div>
              <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{f.min}°</div>
            </div>
          ))}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "3/5", gridRow: "2/3" }}>
        <div className="terminal-header mb-3">⚠️ Market Weather Alerts</div>
        <div className="flex flex-col gap-2">
          {loading ? (
            <div className="text-xs font-mono animate-pulse" style={{ color: "#7d8590" }}>Loading weather data...</div>
          ) : (
            CITIES.map(c => {
              const w = weather[c.name];
              if (!w) return null;
              const alerts = [];
              if (w.temp > 38) alerts.push({ msg: "Extreme heat may affect energy demand", color: "#f85149" });
              if (w.temp < -10) alerts.push({ msg: "Extreme cold driving heating demand", color: "#4444ff" });
              if (w.wind > 40) alerts.push({ msg: "High winds may disrupt operations", color: "#e3b341" });
              if ([95, 99, 82].includes(w.code)) alerts.push({ msg: "Severe storms reported", color: "#f85149" });
              if (alerts.length === 0) return null;
              return alerts.map((alert, i) => (
                <div key={c.name + i} className="flex items-start gap-2 p-2 rounded" style={{ background: "#0d1117", border: "1px solid #1a0a0a" }}>
                  <span className="text-xs" style={{ color: alert.color }}>⚠</span>
                  <div>
                    <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{c.flag} {c.name}</div>
                    <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{alert.msg}</div>
                  </div>
                </div>
              ));
            })
          )}
          {!loading && CITIES.every(c => {
            const w = weather[c.name];
            if (!w) return true;
            return w.temp <= 38 && w.temp >= -10 && w.wind <= 40 && ![95,99,82].includes(w.code);
          }) && (
            <div className="text-xs font-mono" style={{ color: "#7d8590" }}>✓ No significant weather alerts across major financial centers</div>
          )}
        </div>
      </div>
    </div>
  );
}



function AnalystData({ ticker }) {
  const [data, setData] = useState(null);
  const [targets, setTargets] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [insider, setInsider] = useState(null);

  useEffect(() => {
    Promise.all([
      api("/stock/recommendation?symbol=" + ticker),
      api("/stock/price-target?symbol=" + ticker),
      api("/stock/earnings?symbol=" + ticker + "&limit=4"),
      api("/stock/insider-transactions?symbol=" + ticker),
    ]).then(([rec, tgt, earn, ins]) => {
      setData(rec?.[0] || null);
      setTargets(tgt || null);
      setEarnings(earn?.data?.slice(0, 4) || []);
      setInsider(ins?.data?.slice(0, 6) || []);
    }).catch(() => {});
  }, [ticker]);

  const total = data ? (data.buy + data.hold + data.sell + data.strongBuy + data.strongSell) : 0;
  const bullPct = total ? Math.round(((data.buy + data.strongBuy) / total) * 100) : 0;
  const bearPct = total ? Math.round(((data.sell + data.strongSell) / total) * 100) : 0;
  const holdPct = total ? Math.round((data.hold / total) * 100) : 0;

  return (
    <div className="h-full grid gap-2" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
      
      <div>
        <div className="terminal-header mb-2">📊 Analyst Ratings</div>
        {!data ? <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Loading...</div> : (
          <div>
            <div className="flex gap-1 mb-2" style={{ height: 8, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ width: bullPct + "%", background: "#3fb950" }} />
              <div style={{ width: holdPct + "%", background: "#e3b341" }} />
              <div style={{ width: bearPct + "%", background: "#f85149" }} />
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[["Strong Buy", data.strongBuy, "#3fb950"], ["Buy", data.buy, "#3fb950"], ["Hold", data.hold, "#e3b341"], ["Sell", data.sell, "#f85149"], ["Strong Sell", data.strongSell, "#f85149"]].map(([l, v, c]) => (
                <div key={l} className="p-1 rounded" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                  <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{l}</div>
                  <div className="text-sm font-mono font-bold" style={{ color: c }}>{v}</div>
                </div>
              ))}
              <div className="p-1 rounded" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Period</div>
                <div className="text-xs font-mono" style={{ color: "#e6edf3" }}>{data.period}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="terminal-header mb-2">🎯 Price Targets</div>
        {!targets ? <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Loading...</div> : 
         !targets.targetMean ? <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Not available on free tier</div> : (
          <div className="flex flex-col gap-1">
            {[["High", targets.targetHigh, "#3fb950"], ["Average", targets.targetMean, "#58a6ff"], ["Low", targets.targetLow, "#f85149"], ["Updated", targets.lastUpdated, "#7d8590"]].map(([l, v, c]) => (
              <div key={l} className="flex justify-between py-1" style={{ borderBottom: "1px solid #21262d" }}>
                <span className="text-xs font-mono" style={{ color: "#7d8590" }}>{l}</span>
                <span className="text-xs font-mono font-bold" style={{ color: c }}>{l === "Updated" ? v?.slice(0,10) : v ? "$" + v.toFixed(2) : "N/A"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ overflowY: "auto" }}>
        <div className="terminal-header mb-2">📈 Earnings Surprises</div>
        {!earnings ? <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Loading...</div> : (
          <div className="flex flex-col gap-1">
            {earnings.map((e, i) => {
              const surprise = e.actual - e.estimate;
              const pct = e.estimate ? (surprise / Math.abs(e.estimate) * 100).toFixed(1) : 0;
              return (
                <div key={i} className="flex justify-between items-center py-1" style={{ borderBottom: "1px solid #21262d" }}>
                  <span className="text-xs font-mono" style={{ color: "#7d8590" }}>{e.period}</span>
                  <span className="text-xs font-mono" style={{ color: "#7d8590" }}>Est: ${e.estimate?.toFixed(2)}</span>
                  <span className="text-xs font-mono" style={{ color: "#e6edf3" }}>Act: ${e.actual?.toFixed(2)}</span>
                  <span className="text-xs font-mono font-bold" style={{ color: surprise >= 0 ? "#3fb950" : "#f85149" }}>{surprise >= 0 ? "+" : ""}{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ overflowY: "auto" }}>
        <div className="terminal-header mb-2">🏦 Insider Transactions</div>
        {!insider ? <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Loading...</div> : (
          <div className="flex flex-col gap-1">
            {insider.map((t, i) => (
              <div key={i} className="flex justify-between items-center py-1" style={{ borderBottom: "1px solid #21262d" }}>
                <div>
                  <div className="text-xs font-mono" style={{ color: "#e6edf3" }}>{t.name?.split(" ").slice(-1)[0]}</div>
                  <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{t.transactionDate}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold" style={{ color: t.change > 0 ? "#3fb950" : "#f85149" }}>
                    {t.change > 0 ? "BUY" : "SELL"} {Math.abs(t.change).toLocaleString()}
                  </div>
                  <div className="text-xs font-mono" style={{ color: "#7d8590" }}>${t.transactionPrice?.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function PeerComparison({ ticker, metrics, quote }) {
  const [peers, setPeers] = useState([]);
  const [peerData, setPeerData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/stock/peers?symbol=" + ticker)
      .then(p => {
        const peerList = (p || []).slice(0, 6);
        setPeers(peerList);
        return Promise.all(
          peerList.map((s, i) =>
            delay(i * 300).then(() =>
              Promise.all([
                api("/quote?symbol=" + s),
                api("/stock/metric?symbol=" + s + "&metric=all"),
              ]).then(([q, m]) => [s, { quote: q, metrics: m }])
            )
          )
        );
      })
      .then(results => {
        setPeerData(Object.fromEntries(results));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ticker]); // eslint-disable-line

  const allTickers = [ticker, ...peers.filter(p => p !== ticker)];
  const allData = {
    [ticker]: { quote, metrics },
    ...peerData,
  };

  const METRICS = [
    { label: "Price", fn: (q, m) => q?.c ? "$" + fmt.price(q.c) : "N/A", compare: false },
    { label: "Change %", fn: (q, m) => q?.dp ? fmt.pct(q.dp) : "N/A", compare: true, higher: true },
    { label: "Market Cap", fn: (q, m) => m?.metric?.marketCapitalization ? fmt.large(m.metric.marketCapitalization * 1e6) : "N/A", compare: false },
    { label: "P/E (TTM)", fn: (q, m) => m?.metric?.peBasicExclExtraTTM ? m.metric.peBasicExclExtraTTM.toFixed(1) : "N/A", compare: true, higher: false },
    { label: "Fwd P/E", fn: (q, m) => m?.metric?.peExclExtraAnnual ? m.metric.peExclExtraAnnual.toFixed(1) : "N/A", compare: true, higher: false },
    { label: "EPS (TTM)", fn: (q, m) => m?.metric?.epsBasicExclExtraItemsTTM ? "$" + m.metric.epsBasicExclExtraItemsTTM.toFixed(2) : "N/A", compare: true, higher: true },
    { label: "Revenue TTM", fn: (q, m) => m?.metric?.revenuePerShareTTM ? fmt.large(m.metric.revenuePerShareTTM * (m.metric.marketCapitalization || 0) / (m.metric?.["52WeekHigh"] || 1)) : (m?.metric?.revenue ? fmt.large(m.metric.revenue) : "N/A"), compare: false },
    { label: "Gross Margin", fn: (q, m) => m?.metric?.grossMarginTTM ? m.metric.grossMarginTTM.toFixed(1) + "%" : "N/A", compare: true, higher: true },
    { label: "Net Margin", fn: (q, m) => m?.metric?.netProfitMarginTTM ? m.metric.netProfitMarginTTM.toFixed(1) + "%" : "N/A", compare: true, higher: true },
    { label: "ROE", fn: (q, m) => m?.metric?.roeTTM ? m.metric.roeTTM.toFixed(1) + "%" : "N/A", compare: true, higher: true },
    { label: "Beta", fn: (q, m) => m?.metric?.beta ? m.metric.beta.toFixed(2) : "N/A", compare: false },
    { label: "Div Yield", fn: (q, m) => m?.metric?.dividendYieldIndicatedAnnual ? m.metric.dividendYieldIndicatedAnnual.toFixed(2) + "%" : "N/A", compare: true, higher: true },
    { label: "52W High", fn: (q, m) => m?.metric?.["52WeekHigh"] ? "$" + fmt.price(m.metric["52WeekHigh"]) : "N/A", compare: false },
    { label: "52W Low", fn: (q, m) => m?.metric?.["52WeekLow"] ? "$" + fmt.price(m.metric["52WeekLow"]) : "N/A", compare: false },
    { label: "Price/Book", fn: (q, m) => m?.metric?.pbAnnual ? m.metric.pbAnnual.toFixed(1) : "N/A", compare: true, higher: false },
  ];

  const getBest = (metric, tickers, data) => {
    if (!metric.compare) return null;
    let best = null;
    let bestVal = metric.higher ? -Infinity : Infinity;
    tickers.forEach(t => {
      const d = data[t];
      if (!d) return;
      const raw = metric.fn(d.quote, d.metrics);
      const num = parseFloat(raw.replace(/[$%,]/g, ""));
      if (isNaN(num)) return;
      if (metric.higher ? num > bestVal : num < bestVal) {
        bestVal = num;
        best = t;
      }
    });
    return best;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full text-xs font-mono animate-pulse" style={{ color: "#7d8590" }}>
      Loading peer data...
    </div>
  );

  return (
    <div style={{ overflowX: "auto", overflowY: "auto", height: "100%" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace", minWidth: 600 }}>
        <thead>
          <tr style={{ position: "sticky", top: 0, background: "#161b22", zIndex: 1 }}>
            <th style={{ textAlign: "left", padding: "6px 10px", color: "#7d8590", fontWeight: 500, borderBottom: "2px solid #30363d", minWidth: 120 }}>Metric</th>
            {allTickers.map(t => (
              <th key={t} style={{ textAlign: "right", padding: "6px 10px", borderBottom: "2px solid #30363d", minWidth: 90, color: t === ticker ? "#58a6ff" : "#7d8590", fontWeight: t === ticker ? 700 : 500 }}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map(m => {
            const best = getBest(m, allTickers, allData);
            return (
              <tr key={m.label} style={{ borderBottom: "1px solid #21262d" }}
                onMouseEnter={e => e.currentTarget.style.background = "#161b22"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "5px 10px", color: "#7d8590", fontWeight: 500 }}>{m.label}</td>
                {allTickers.map(t => {
                  const d = allData[t];
                  const val = d ? m.fn(d.quote, d.metrics) : "...";
                  const isBest = best === t;
                  const isMain = t === ticker;
                  return (
                    <td key={t} style={{ textAlign: "right", padding: "5px 10px", color: isBest ? "#3fb950" : isMain ? "#e6edf3" : "#7d8590", fontWeight: isMain ? 600 : 400, background: isBest ? "rgba(63,185,80,0.05)" : "transparent" }}>
                      {val}
                      {isBest && " ★"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
const TickerTape = memo(function TickerTape({ tapeData }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let x = 0;
    const animate = () => {
      x -= 0.4;
      if (x < -el.scrollWidth / 2) x = 0;
      el.style.transform = "translateX(" + x + "px)";
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);
  // Duplicate items so seamless loop never shows a gap
  const items = useMemo(() => [...tapeData, ...tapeData], [tapeData]);
  return (
    <div className="ticker-tape overflow-hidden" style={{ height: 28 }}>
      <div ref={ref} className="flex items-center gap-6 whitespace-nowrap" style={{ paddingTop: 5 }}>
        {items.map((t, i) => (
          <span key={t.symbol + i} className="flex items-center gap-1.5 text-xs font-mono">
            <span style={{ color: "#7d8590", fontWeight: 600 }}>{t.symbol}</span>
            <span style={{ color: "#e6edf3" }}>${fmt.price(t.price)}</span>
            <span style={{ color: clr(t.changePct) }}>{t.changePct >= 0 ? "▲" : "▼"}{Math.abs(t.changePct || 0).toFixed(2)}%</span>
            <span style={{ color: "#21262d", marginLeft: 8 }}>|</span>
          </span>
        ))}
      </div>
    </div>
  );
});

// eslint-disable-next-line no-unused-vars
function TopNav({ ticker, setTicker, quote, loading, onSettingsClick }) {
  const [input, setInput] = useState(ticker);
  const [focused, setFocused] = useState(false);

  // Sync search box when ticker changes externally (watchlist click, etc.)
  useEffect(() => { setInput(ticker); }, [ticker]);

  const handleRefresh = useCallback(() => {
    // Bust cache for current ticker then re-trigger the fetch effect
    _apiCache.forEach((_, k) => { if (k.includes(ticker)) _apiCache.delete(k); });
    setTicker(ticker + " "); // force state change then normalize
    setTimeout(() => setTicker(ticker), 0);
  }, [ticker, setTicker]);

  return (
    <div className="top-nav flex items-center gap-4 px-4 py-2"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
        <Zap size={14} style={{ color: "#58a6ff" }} />
        <span className="logo-text" style={{ fontSize: 12 }}>OMNES VIDENTES</span>
      </div>

      <div className="flex items-center gap-2 px-2 py-1.5"
        style={{ background: "#0d1117", border: "1px solid " + (focused ? "#1f6feb" : "#30363d"),
          borderRadius: 5, transition: "border-color 0.15s", minWidth: 220, maxWidth: 300 }}>
        <Search size={11} style={{ color: "#7d8590", flexShrink: 0 }} />
        <input
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === "Enter") setTicker(input.trim()); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ticker… (Enter to load)"
          style={{ background: "transparent", border: "none", color: "#e6edf3", fontSize: 12,
            fontFamily: "'IBM Plex Mono', monospace", outline: "none", width: "100%" }}
        />
      </div>

      {quote ? (
        <div className="flex items-center gap-3" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          <span style={{ color: "#e6edf3", fontWeight: 700, fontSize: 14 }}>{ticker}</span>
          <span style={{ color: "#e6edf3", fontSize: 16, fontWeight: 600 }}>${fmt.price(quote.c)}</span>
          <span className="flex items-center gap-1" style={{ color: clr(quote.dp), background: bg(quote.dp),
            fontSize: 12, padding: "2px 8px", borderRadius: 10 }}>
            {quote.dp >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {fmt.change(quote.d)} ({fmt.pct(quote.dp)})
          </span>
          <span style={{ color: "#484f58", fontSize: 11 }}>Vol {fmt.volume(quote.v > 0 ? quote.v : null)}</span>
          <span style={{ color: "#484f58", fontSize: 11 }}>O {fmt.price(quote.o)}</span>
          <span style={{ color: "#484f58", fontSize: 11 }}>H {fmt.price(quote.h)}</span>
          <span style={{ color: "#484f58", fontSize: 11 }}>L {fmt.price(quote.l)}</span>
        </div>
      ) : loading ? (
        <span style={{ color: "#e3b341", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>● Loading {ticker}…</span>
      ) : null}

      <div className="ml-auto flex items-center gap-3" style={{ flexShrink: 0 }}>
        <button onClick={handleRefresh} title="Refresh data" style={{ color: "#7d8590", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <RefreshCw size={13} />
        </button>
        <button onClick={onSettingsClick} title="Settings" style={{ color: "#7d8590", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Settings size={13} />
        </button>
        <div style={{ width: 1, height: 14, background: "#21262d" }} />
        <span style={{ color: "#484f58", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>LIVE</span>
        <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", display: "inline-block" }} />
      </div>
    </div>
  );
}

const TIMEFRAMES = ["1W", "1M", "3M", "1Y"];
const TF_CFG = {
  "1W": { range: "5d",  interval: "1h",  days: 7   },
  "1M": { range: "1mo", interval: "1d",  days: 30  },
  "3M": { range: "3mo", interval: "1d",  days: 90  },
  "1Y": { range: "1y",  interval: "1d",  days: 365 },
};

// Candlestick bar rendered as a custom Recharts shape
function CandlestickBar(props) {
  const { x, y, width, payload } = props;
  if (!payload || payload.open == null) return null;
  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const color = isUp ? "#3fb950" : "#f85149";
  const bodyTop    = Math.min(open, close);
  const bodyBottom = Math.max(open, close);
  const bodyH = Math.max(1, bodyBottom - bodyTop);
  const cx = x + width / 2;
  // y scale: props gives us the Y coordinate of the bar's "value", which is the high.
  // We get yScale via the scaleLinear from recharts internal.
  // Instead we rely on the parent ComposedChart's YAxis domain being set to [minL, maxH].
  // The "y" prop here is the pixel top of the bar rect — recharts computes it from the dataKey.
  // We use a custom approach: pass yScale via the shape function's numeric props.
  // recharts passes: x (left edge), y (pixel top of high), width, height (pixel span high→low)
  const totalH = props.height; // pixel height from high to low
  if (totalH <= 0 || isNaN(totalH)) return null;
  const domainSpan = high - low;
  if (domainSpan <= 0) return null;
  const pxPerUnit = totalH / domainSpan;
  const bodyTopPx    = y + (high - bodyBottom) * pxPerUnit;
  const bodyH_px     = Math.max(1, bodyH * pxPerUnit);
  const wickTopPx    = y;
  const wickBottomPx = y + totalH;
  return (
    <g>
      {/* Wick */}
      <line x1={cx} y1={wickTopPx} x2={cx} y2={wickBottomPx} stroke={color} strokeWidth={1} />
      {/* Body */}
      <rect x={x + 1} y={bodyTopPx} width={Math.max(1, width - 2)} height={bodyH_px}
        fill={isUp ? "rgba(63,185,80,0.85)" : "rgba(248,81,73,0.85)"}
        stroke={color} strokeWidth={0.5} />
    </g>
  );
}

function useOHLC(ticker, tf) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { range, interval } = TF_CFG[tf] || TF_CFG["3M"];
    fetchChart(ticker, range, interval).then(d => {
      if (cancelled) return;
      const result = d?.chart?.result?.[0];
      if (result) {
        const q       = result.indicators.quote[0];
        const ts      = result.timestamp || [];
        const closes  = q.close  || [];
        const opens   = q.open   || [];
        const highs   = q.high   || [];
        const lows    = q.low    || [];
        const volumes = q.volume || [];
        const raw = ts.map((t, i) => ({
          ts:    t,
          date:  new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          close:  closes[i]  != null ? +closes[i].toFixed(4)  : null,
          open:   opens[i]   != null ? +opens[i].toFixed(4)   : null,
          high:   highs[i]   != null ? +highs[i].toFixed(4)   : null,
          low:    lows[i]    != null ? +lows[i].toFixed(4)    : null,
          volume: volumes[i] || 0,
        })).filter(d => d.close != null && d.open != null && d.high != null && d.low != null);

        // SMA-20 on close
        raw.forEach((item, i) => {
          if (i >= 19) {
            const slice = raw.slice(i - 19, i + 1);
            item.sma20 = +(slice.reduce((s, x) => s + x.close, 0) / 20).toFixed(4);
          }
        });

        setData(raw);
      }
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker, tf]);

  return { data, loading };
}

function ChartTypeBtn({ value, active, onClick, children }) {
  return (
    <button onClick={() => onClick(value)} className="font-mono"
      style={{ padding:"2px 8px", fontSize:10, borderRadius:6, border:"1px solid",
        background: active ? "#0c2044" : "transparent",
        borderColor: active ? "#58a6ff" : "#21262d",
        color: active ? "#58a6ff" : "#7d8590", cursor:"pointer" }}>
      {children}
    </button>
  );
}

function UniversalChart({ ticker, height = 220, showVolume = false, colorUp = "#3fb950", colorDown = "#f85149", defaultType = "area", defaultTf = "3M", prefix = "$", decimals = 2, label }) {
  const [tf,        setTf]        = useState(defaultTf);
  const [chartType, setChartType] = useState(defaultType);
  const { data, loading } = useOHLC(ticker, tf);

  const startC  = data[0]?.close  || 0;
  const endC    = data[data.length - 1]?.close || 0;
  const chg     = endC - startC;
  const pct     = startC ? (chg / startC) * 100 : 0;
  const lc      = chg >= 0 ? colorUp : colorDown;
  const allLows  = data.map(d => d.low);
  const allHighs = data.map(d => d.high);
  const minP = data.length ? Math.min(...allLows)  * 0.9995 : 0;
  const maxP = data.length ? Math.max(...allHighs) * 1.0005 : 0;
  const xi   = Math.max(1, Math.floor(data.length / 6));
  const gradId = "ucg_" + ticker.replace(/[^a-z0-9]/gi, "") + "_" + tf;
  const tooltipStyle = { background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:10, fontSize:10, fontFamily:"'IBM Plex Mono',monospace" };
  const tickStyle    = { fill:"#484f58", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" };
  const fmt2 = v => v != null ? prefix + (+v).toFixed(decimals) : "—";

  const commonAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#161b22" vertical={false} />
      <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} interval={xi} />
      <YAxis domain={[minP, maxP]} tick={tickStyle} tickLine={false} axisLine={false}
        tickFormatter={v => prefix + v.toFixed(decimals <= 2 ? 0 : decimals)} width={decimals > 2 ? 68 : 52} />
      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color:"#7d8590" }}
        formatter={(v, name) => [fmt2(v), name]} />
    </>
  );

  const renderChart = () => {
    if (chartType === "candle") {
      return (
        <ComposedChart data={data} margin={{ top:4, right:2, left:0, bottom:0 }}>
          {commonAxes}
          {/* Candlestick via Bar with custom shape */}
          <Bar dataKey="high" shape={<CandlestickBar />} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={d.close >= d.open ? colorUp : colorDown} />)}
          </Bar>
          {data.some(d => d.sma20) && (
            <Line type="monotone" dataKey="sma20" stroke="#e3b341" strokeWidth={1} dot={false} isAnimationActive={false} name="SMA 20" connectNulls />
          )}
        </ComposedChart>
      );
    }
    if (chartType === "line") {
      return (
        <ComposedChart data={data} margin={{ top:4, right:2, left:0, bottom:0 }}>
          {commonAxes}
          <Line type="monotone" dataKey="close" stroke={lc} strokeWidth={1.5} dot={false} isAnimationActive={false} name="Price" />
          {data.some(d => d.sma20) && (
            <Line type="monotone" dataKey="sma20" stroke="#e3b341" strokeWidth={1} dot={false} isAnimationActive={false} name="SMA 20" connectNulls strokeDasharray="4 2" />
          )}
        </ComposedChart>
      );
    }
    // area (default)
    return (
      <ComposedChart data={data} margin={{ top:4, right:2, left:0, bottom:0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={lc} stopOpacity={0.18} />
            <stop offset="95%" stopColor={lc} stopOpacity={0}    />
          </linearGradient>
        </defs>
        {commonAxes}
        <Area type="monotone" dataKey="close" stroke={lc} strokeWidth={1.5} fill={"url(#" + gradId + ")"} dot={false} isAnimationActive={false} name="Price" />
        {data.some(d => d.sma20) && (
          <Line type="monotone" dataKey="sma20" stroke="#e3b341" strokeWidth={1} dot={false} isAnimationActive={false} name="SMA 20" connectNulls strokeDasharray="4 2" />
        )}
      </ComposedChart>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls row */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <div className="flex items-center gap-2">
          {label && <span className="font-mono" style={{ color:"#7d8590", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</span>}
          {data.length > 0 && (
            <span className="font-mono" style={{ fontSize:10, color:lc, background:lc+"18", border:"1px solid "+lc+"33", borderRadius:6, padding:"1px 6px" }}>
              {chg >= 0 ? "+" : ""}{fmt2(chg)} ({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%) {tf}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Chart type */}
          <div className="flex gap-1">
            <ChartTypeBtn value="area"   active={chartType==="area"}   onClick={setChartType}>Area</ChartTypeBtn>
            <ChartTypeBtn value="line"   active={chartType==="line"}   onClick={setChartType}>Line</ChartTypeBtn>
            <ChartTypeBtn value="candle" active={chartType==="candle"} onClick={setChartType}>Candle</ChartTypeBtn>
          </div>
          {/* Timeframe */}
          <div className="flex overflow-hidden rounded" style={{ border:"1px solid rgba(99,110,123,0.18)" }}>
            {TIMEFRAMES.map(t => (
              <button key={t} onClick={() => setTf(t)} className="font-mono"
                style={{ padding:"2px 8px", fontSize:10, background:tf===t?"#0c2044":"transparent", color:tf===t?"#58a6ff":"#7d8590", borderRight:"1px solid #21262d", cursor:"pointer" }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Chart area */}
      <div style={{ flex:1, minHeight: height }}>
        {loading ? (
          <div className="flex items-center justify-center h-full font-mono" style={{ color:"#484f58", fontSize:11 }}>Loading…</div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-full font-mono" style={{ color:"#484f58", fontSize:11 }}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>
      {/* Volume bar (optional) */}
      {showVolume && !loading && data.length > 0 && (
        <div style={{ height:36, marginTop:2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top:0, right:2, left:0, bottom:0 }}>
              <YAxis hide domain={[0,"auto"]} />
              <Bar dataKey="volume" isAnimationActive={false} radius={[1,1,0,0]}>
                {data.map((d, i) => <Cell key={i} fill={d.close >= d.open ? "rgba(63,185,80,0.5)" : "rgba(248,81,73,0.5)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function PriceChart({ ticker }) {
  return <UniversalChart ticker={ticker} height={200} showVolume defaultTf="3M" label="Price Chart" />;
}

// eslint-disable-next-line no-unused-vars
function KeyMetrics({ quote, metrics }) {
  if (!quote || !metrics) return <div className="text-gray-600 text-xs font-mono animate-pulse">Loading metrics...</div>;
  const m = metrics.metric || {};
  const high = m["52WeekHigh"] || quote.c;
  const low = m["52WeekLow"] || quote.c;
  const pct = ((quote.c - low) / (high - low) * 100).toFixed(1);
  const rows1 = [["Current Price", "$" + fmt.price(quote.c)], ["52W High", m["52WeekHigh"] ? "$" + fmt.price(m["52WeekHigh"]) : "N/A"], ["52W Low", m["52WeekLow"] ? "$" + fmt.price(m["52WeekLow"]) : "N/A"], ["Market Cap", m.marketCapitalization ? fmt.large(m.marketCapitalization * 1e6) : "N/A"], ["Volume", fmt.volume(quote.v)], ["Avg Vol", m["10DayAverageTradingVolume"] ? fmt.volume(m["10DayAverageTradingVolume"] * 1e6) : "N/A"]];
  const rows2 = [["Trailing P/E", m.peBasicExclExtraTTM ? m.peBasicExclExtraTTM.toFixed(1) : "N/A"], ["Forward P/E", m.peExclExtraAnnual ? m.peExclExtraAnnual.toFixed(1) : "N/A"], ["EPS (TTM)", m.epsBasicExclExtraItemsTTM ? "$" + m.epsBasicExclExtraItemsTTM.toFixed(2) : "N/A"], ["Beta", m.beta ? m.beta.toFixed(2) : "N/A"], ["Div Yield", m.dividendYieldIndicatedAnnual ? m.dividendYieldIndicatedAnnual.toFixed(2) + "%" : "N/A"], ["Price/Book", m.pbAnnual ? m.pbAnnual.toFixed(1) : "N/A"]];
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2"><span className="terminal-header"><BarChart2 size={12} /></span><span className="terminal-header">Key Metrics</span></div>
      <div className="grid grid-cols-2 gap-x-6 mt-2">
        <div>{rows1.map(([l, v]) => <div key={l} className="metric-row flex justify-between items-center py-1.5"><span className="text-gray-500 text-xs font-mono">{l}</span><span className="text-gray-200 text-xs font-mono font-semibold">{v}</span></div>)}</div>
        <div>{rows2.map(([l, v]) => <div key={l} className="metric-row flex justify-between items-center py-1.5"><span className="text-gray-500 text-xs font-mono">{l}</span><span className="text-gray-200 text-xs font-mono font-semibold">{v}</span></div>)}</div>
      </div>
      <div className="mt-3">
        <div className="text-xs font-mono text-gray-500 mb-1">52-Week Range</div>
        <div className="relative h-1.5 bg-gray-800 rounded-full">
          <div className="h-full bg-blue-900 rounded-full" style={{ width: pct + "%" }} />
          <div style={{ position: "absolute", top: -2, left: pct + "%", width: 8, height: 8, borderRadius: "50%", background: "#60a5fa", transform: "translateX(-50%)" }} />
        </div>
        <div className="flex justify-between text-xs font-mono text-gray-600 mt-1"><span>${fmt.price(low)}</span><span>${fmt.price(high)}</span></div>
      </div>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function CompanyProfile({ profile }) {
  if (!profile) return <div className="text-gray-600 text-xs font-mono animate-pulse">Loading profile...</div>;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2"><span className="terminal-header"><Building2 size={12} /></span><span className="terminal-header">Company Profile</span></div>
      <div className="grid grid-cols-3 gap-2 mt-2 mb-3">
        {[["Sector", profile.finnhubIndustry], ["Country", profile.country], ["Employees", profile.employeeTotal ? profile.employeeTotal.toLocaleString() : (profile.shareOutstanding ? (profile.shareOutstanding/1000).toFixed(0)+"K shares" : "N/A")], ["Founded", profile.ipo?.split("-")[0]], ["Exchange", profile.exchange], ["Currency", profile.currency]].map(([k, v]) => (
          <div key={k} className="terminal-panel p-1.5"><div className="text-gray-600 text-xs font-mono">{k}</div><div className="text-gray-200 text-xs font-mono font-semibold truncate">{v || "N/A"}</div></div>
        ))}
      </div>
      <div className="flex items-center gap-3 bg-gray-900 rounded p-2">
        {profile.logo && <img src={profile.logo} alt="logo" className="w-8 h-8 rounded object-contain bg-white p-0.5" />}
        <div><div className="text-gray-200 text-xs font-mono font-semibold">{profile.name}</div><a href={profile.weburl} target="_blank" rel="noreferrer" className="text-blue-400 text-xs font-mono hover:underline">{profile.weburl}</a></div>
        <div className="ml-auto text-right"><div className="text-gray-400 text-xs font-mono">{fmt.large((profile.marketCapitalization || 0) * 1e6)}</div><div className="text-gray-600 text-xs font-mono">Mkt Cap</div></div>
      </div>
    </div>
  );
}

const sentimentStyle = {
  bullish: { color: "#3fb950", bg: "rgba(63,185,80,0.1)", label: "BULLISH" },
  bearish: { color: "#f85149", bg: "rgba(248,81,73,0.1)", label: "BEARISH" },
  neutral: { color: "#9ca3af", bg: "rgba(156,163,175,0.1)", label: "NEUTRAL" },
};
function getSentiment(headline) {
  const h = headline.toLowerCase();
  if (["beat", "record", "surge", "growth", "profit", "gain", "rise", "strong", "buy", "upgrade"].some(w => h.includes(w))) return "bullish";
  if (["miss", "fall", "drop", "loss", "weak", "cut", "probe", "lawsuit", "fine", "sell", "downgrade"].some(w => h.includes(w))) return "bearish";
  return "neutral";
}

// eslint-disable-next-line no-unused-vars
function NewsFeed({ news }) {
  if (!news) return <div className="text-gray-600 text-xs font-mono animate-pulse">Loading news...</div>;
  return (
    <div className="flex flex-col gap-2">
      {news.slice(0, 6).map((n, i) => {
        const s = sentimentStyle[getSentiment(n.headline)];
        return (
          <a key={i} href={n.url} target="_blank" rel="noreferrer" className="news-card block p-2.5">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-xs font-mono text-gray-200 leading-snug">{n.headline}</span>
              <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: s.color, background: s.bg }}>{s.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-xs font-mono">{n.source}</span>
              <span className="text-gray-700">·</span>
              <span className="text-gray-600 text-xs font-mono">{Math.floor((Date.now()/1000 - n.datetime)/3600)}h ago</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function EventsCalendar({ earnings }) {
  if (!earnings) return <div className="text-gray-600 text-xs font-mono animate-pulse">Loading events...</div>;
  const upcoming = earnings.filter(e => new Date(e.date) >= new Date()).slice(0, 5);
  return (
    <div className="flex flex-col gap-2">
      {upcoming.length === 0 && <div className="text-gray-600 text-xs font-mono">No upcoming events found.</div>}
      {upcoming.map((e, i) => {
        const daysAway = Math.ceil((new Date(e.date) - new Date()) / (1000*60*60*24));
        return (
          <div key={i} className="flex items-center gap-3 border border-gray-800 rounded p-2.5">
            <div className="flex flex-col items-center justify-center w-10 h-10 rounded bg-gray-900 flex-shrink-0">
              <span className="text-yellow-500 text-xs font-mono font-bold">{daysAway}d</span>
              <span className="text-yellow-500 text-xs">💰</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono text-gray-200 font-semibold">Earnings Report</div>
              <div className="text-xs font-mono text-gray-600">{e.date}</div>
              {e.epsEstimate && <div className="text-xs font-mono text-gray-500">EPS Est: ${e.epsEstimate}</div>}
            </div>
            <span className="text-xs font-mono text-yellow-500 border border-yellow-800 rounded px-1.5 py-0.5">KEY</span>
          </div>
        );
      })}
    </div>
  );
}

function FinancialStatements({ ticker }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState("income");
  const [data, setData] = useState(null);
  useEffect(() => {
    api("/stock/financials-reported?symbol=" + ticker + "&freq=quarterly").then(d => setData(d.data?.slice(0,40) || []));
  }, [ticker]);
  const tabs = [{ key: "income", label: "Income Stmt" }, { key: "balance", label: "Balance Sheet" }, { key: "cashflow", label: "Cash Flow" }];
  const find = (arr, key) => arr?.find(x=>x.concept.includes(key))?.value/1e9||0;
  const extractIC = r => ({ revenue: find(r?.ic,"RevenueFromContractWithCustomer"), netIncome: find(r?.ic,"NetIncomeLoss"), grossProfit: find(r?.ic,"GrossProfit") });
  const extractBS = r => ({ totalAssets: find(r?.bs,"Assets"), totalLiabilities: find(r?.bs,"Liabilities"), cash: find(r?.bs,"CashAndCashEquivalentsAtCarryingValue") });
  const extractCF = r => ({ operatingCF: find(r?.cf,"NetCashProvidedByUsedInOperatingActivities"), capEx: find(r?.cf,"PaymentsToAcquirePropertyPlantAndEquipment") });
  if (!data) return <div className="text-gray-600 text-xs font-mono animate-pulse">Loading financials...</div>;
  const getQuarter = (d) => {
    const end = d.endDate || d.startDate || d.filed || "";
    const date = new Date(end);
    const month = date.getMonth() + 1;
    const yr = date.getFullYear();
    if (month <= 3) return "Q1 " + yr;
    if (month <= 6) return "Q2 " + yr;
    if (month <= 9) return "Q3 " + yr;
    return "Q4 " + yr;
  };
  const rows = data.map(d => ({ period: getQuarter(d), ...(tab==="income"?extractIC(d.report):tab==="balance"?extractBS(d.report):extractCF(d.report)) }));
  const colMap = { income: [["revenue","Revenue"],["grossProfit","Gross Profit"],["netIncome","Net Income"]], balance: [["totalAssets","Total Assets"],["totalLiabilities","Total Liab."],["cash","Cash"]], cashflow: [["operatingCF","Operating CF"],["capEx","CapEx"]] };
  const cols = colMap[tab];
  if (expanded) {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: "#0d1117", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid #21262d" }}>
          <div className="flex items-center gap-3">
            <span className="terminal-header">📊 Financial Statements — {ticker}</span>
            <div className="flex">
              {tabs.map(t => <button key={t.key} onClick={()=>setTab(t.key)} className="px-3 py-1 text-xs font-mono border-b-2 transition-colors" style={{ borderBottomColor: tab===t.key?"#58a6ff":"transparent", color: tab===t.key?"#58a6ff":"#7d8590", background:"transparent" }}>{t.label}</button>)}
            </div>
          </div>
          <button onClick={() => setExpanded(false)} style={{ color: "#7d8590", background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>✕ Close</button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace" }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: "#161b22", zIndex: 1 }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "#7d8590", fontWeight: 500, borderBottom: "2px solid #30363d", minWidth: 180 }}>Metric ($B)</th>
                {rows.map(r => <th key={r.period} style={{ textAlign: "right", padding: "8px 12px", color: "#7d8590", fontWeight: 500, borderBottom: "2px solid #30363d", minWidth: 100 }}>{r.period}</th>)}
              </tr>
            </thead>
            <tbody>
              {cols.map(([key, label]) => (
                <tr key={key} style={{ borderBottom: "1px solid #21262d" }} onMouseEnter={e => e.currentTarget.style.background="#161b22"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <td style={{ padding: "7px 12px", color: "#7d8590", fontWeight: 500 }}>{label}</td>
                  {rows.map((r, i) => (
                    <td key={i} style={{ textAlign: "right", padding: "7px 12px", color: r[key] < 0 ? "#f85149" : "#e6edf3", fontWeight: 500 }}>
                      {r[key] < 0 ? "-$" + Math.abs(r[key]).toFixed(2) : "$" + (r[key] || 0).toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b mb-2" style={{ borderColor: "#21262d" }}>
        <div className="flex">
          {tabs.map(t => <button key={t.key} onClick={()=>setTab(t.key)} className="px-3 py-1.5 text-xs font-mono border-b-2 transition-colors" style={{ borderBottomColor: tab===t.key?"#58a6ff":"transparent", color: tab===t.key?"#58a6ff":"#7d8590", background:"transparent" }}>{t.label}</button>)}
        </div>
        <button onClick={() => setExpanded(true)} style={{ color: "#7d8590", background: "none", border: "none", cursor: "pointer", fontSize: 10, fontFamily: "monospace", padding: "2px 8px" }}>⤢ Expand</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead><tr><th className="text-left text-gray-600 py-1 pr-3 font-normal">Metric ($B)</th>{rows.map(r=><th key={r.period} className="text-right text-gray-500 py-1 px-2 font-normal">{r.period}</th>)}</tr></thead>
          <tbody>{cols.map(([key,label])=><tr key={key} className="border-t border-gray-800"><td className="text-gray-400 py-1.5 pr-3">{label}</td>{rows.map((r,i)=><td key={i} className="text-right py-1.5 px-2 font-semibold" style={{color:r[key]<0?"#f85149":"#e5e7eb"}}>{r[key]<0?"-$"+Math.abs(r[key]).toFixed(2):"$"+(r[key]||0).toFixed(2)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function QuickStats({ quote, metrics }) {
  if (!quote) return <div className="text-gray-600 text-xs font-mono animate-pulse">Loading...</div>;
  const m = metrics?.metric || {};
  const rows = [["Open","$"+fmt.price(quote.o)],["Day High","$"+fmt.price(quote.h)],["Day Low","$"+fmt.price(quote.l)],["Prev Close","$"+fmt.price(quote.pc)],["EPS (TTM)",m.epsBasicExclExtraItemsTTM?"$"+m.epsBasicExclExtraItemsTTM.toFixed(2):"N/A"],["P/E",m.peBasicExclExtraTTM?m.peBasicExclExtraTTM.toFixed(1):"N/A"],["Fwd P/E",m.peExclExtraAnnual?m.peExclExtraAnnual.toFixed(1):"N/A"],["Beta",m.beta?m.beta.toFixed(2):"N/A"],["Mkt Cap",m.marketCapitalization?fmt.large(m.marketCapitalization*1e6):"N/A"],["Div Yield",m.dividendYieldIndicatedAnnual?m.dividendYieldIndicatedAnnual.toFixed(2)+"%":"N/A"],["Price/Book",m.pbAnnual?m.pbAnnual.toFixed(1):"N/A"],["ROE",m.roeTTM?m.roeTTM.toFixed(1)+"%":"N/A"]];
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2"><span className="terminal-header"><Activity size={12} /></span><span className="terminal-header">Quick Stats</span></div>
      <div className="mt-2">{rows.map(([k,v])=><div key={k} className="flex justify-between text-xs font-mono border-b border-gray-800 py-1.5"><span className="text-gray-600">{k}</span><span className="text-gray-200 font-semibold">{v}</span></div>)}</div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// RESEARCH BROWSER
// ─────────────────────────────────────────────────────────────

const RESEARCH_CATALOG = [
  { id: "SPY",           label: "S&P 500 ETF",           type: "equity",    ticker: "SPY",          category: "Indices" },
  { id: "QQQ",           label: "Nasdaq 100 ETF",         type: "equity",    ticker: "QQQ",          category: "Indices" },
  { id: "IWM",           label: "Russell 2000 ETF",       type: "equity",    ticker: "IWM",          category: "Indices" },
  { id: "DIA",           label: "Dow Jones ETF",          type: "equity",    ticker: "DIA",          category: "Indices" },
  { id: "AAPL",          label: "Apple Inc.",             type: "equity",    ticker: "AAPL",         category: "Equities" },
  { id: "MSFT",          label: "Microsoft Corp.",        type: "equity",    ticker: "MSFT",         category: "Equities" },
  { id: "NVDA",          label: "NVIDIA Corp.",           type: "equity",    ticker: "NVDA",         category: "Equities" },
  { id: "GOOGL",         label: "Alphabet Inc.",          type: "equity",    ticker: "GOOGL",        category: "Equities" },
  { id: "AMZN",          label: "Amazon.com",             type: "equity",    ticker: "AMZN",         category: "Equities" },
  { id: "META",          label: "Meta Platforms",         type: "equity",    ticker: "META",         category: "Equities" },
  { id: "TSLA",          label: "Tesla Inc.",             type: "equity",    ticker: "TSLA",         category: "Equities" },
  { id: "JPM",           label: "JPMorgan Chase",         type: "equity",    ticker: "JPM",          category: "Banks" },
  { id: "GS",            label: "Goldman Sachs",          type: "equity",    ticker: "GS",           category: "Banks" },
  { id: "BAC",           label: "Bank of America",        type: "equity",    ticker: "BAC",          category: "Banks" },
  { id: "MS",            label: "Morgan Stanley",         type: "equity",    ticker: "MS",           category: "Banks" },
  { id: "C",             label: "Citigroup",              type: "equity",    ticker: "C",            category: "Banks" },
  { id: "GC=F",          label: "Gold",                   type: "commodity", ticker: "GC=F",         category: "Commodities" },
  { id: "CL=F",          label: "Crude Oil (WTI)",        type: "commodity", ticker: "CL=F",         category: "Commodities" },
  { id: "SI=F",          label: "Silver",                 type: "commodity", ticker: "SI=F",         category: "Commodities" },
  { id: "NG=F",          label: "Natural Gas",            type: "commodity", ticker: "NG=F",         category: "Commodities" },
  { id: "HG=F",          label: "Copper",                 type: "commodity", ticker: "HG=F",         category: "Commodities" },
  { id: "ZW=F",          label: "Wheat",                  type: "commodity", ticker: "ZW=F",         category: "Commodities" },
  { id: "EURUSD=X",      label: "EUR/USD",                type: "fx",        ticker: "EURUSD=X",     category: "FX" },
  { id: "GBPUSD=X",      label: "GBP/USD",                type: "fx",        ticker: "GBPUSD=X",     category: "FX" },
  { id: "USDJPY=X",      label: "USD/JPY",                type: "fx",        ticker: "USDJPY=X",     category: "FX" },
  { id: "USDCNY=X",      label: "USD/CNY",                type: "fx",        ticker: "USDCNY=X",     category: "FX" },
  { id: "DX=F",          label: "US Dollar Index",        type: "fx",        ticker: "DX=F",         category: "FX" },
  { id: "FEDFUNDS",      label: "Fed Funds Rate",         type: "macro",     series: "FEDFUNDS",     category: "Macro" },
  { id: "DGS10",         label: "10-Year Treasury",       type: "macro",     series: "DGS10",        category: "Macro" },
  { id: "DGS2",          label: "2-Year Treasury",        type: "macro",     series: "DGS2",         category: "Macro" },
  { id: "CPIAUCSL",      label: "CPI (Inflation)",        type: "macro",     series: "CPIAUCSL",     category: "Macro" },
  { id: "PCEPI",         label: "PCE Price Index",        type: "macro",     series: "PCEPI",        category: "Macro" },
  { id: "UNRATE",        label: "Unemployment Rate",      type: "macro",     series: "UNRATE",       category: "Macro" },
  { id: "GDP",           label: "US GDP",                 type: "macro",     series: "GDP",          category: "Macro" },
  { id: "T10Y2Y",        label: "Yield Curve (10Y-2Y)",   type: "macro",     series: "T10Y2Y",       category: "Macro" },
  { id: "topic-inflation", label: "Inflation",            type: "topic",                             category: "Topics" },
  { id: "topic-rates",     label: "Interest Rates",       type: "topic",                             category: "Topics" },
  { id: "topic-energy",    label: "Energy Markets",       type: "topic",                             category: "Topics" },
  { id: "topic-credit",    label: "Credit Markets",       type: "topic",                             category: "Topics" },
];

const RELATED_MAP = {
  "SPY":      [{ id:"QQQ", label:"Nasdaq 100 ETF", type:"equity", ticker:"QQQ", category:"Indices" }, { id:"IWM", label:"Russell 2000", type:"equity", ticker:"IWM", category:"Indices" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"topic-rates", label:"Interest Rates", type:"topic", category:"Topics" }],
  "QQQ":      [{ id:"AAPL", label:"Apple", type:"equity", ticker:"AAPL", category:"Equities" }, { id:"MSFT", label:"Microsoft", type:"equity", ticker:"MSFT", category:"Equities" }, { id:"NVDA", label:"NVIDIA", type:"equity", ticker:"NVDA", category:"Equities" }, { id:"topic-rates", label:"Interest Rates", type:"topic", category:"Topics" }],
  "AAPL":     [{ id:"MSFT", label:"Microsoft", type:"equity", ticker:"MSFT", category:"Equities" }, { id:"GOOGL", label:"Alphabet", type:"equity", ticker:"GOOGL", category:"Equities" }, { id:"QQQ", label:"Nasdaq 100", type:"equity", ticker:"QQQ", category:"Indices" }, { id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }],
  "MSFT":     [{ id:"AAPL", label:"Apple", type:"equity", ticker:"AAPL", category:"Equities" }, { id:"NVDA", label:"NVIDIA", type:"equity", ticker:"NVDA", category:"Equities" }, { id:"QQQ", label:"Nasdaq 100", type:"equity", ticker:"QQQ", category:"Indices" }],
  "NVDA":     [{ id:"AAPL", label:"Apple", type:"equity", ticker:"AAPL", category:"Equities" }, { id:"QQQ", label:"Nasdaq 100", type:"equity", ticker:"QQQ", category:"Indices" }, { id:"TSLA", label:"Tesla", type:"equity", ticker:"TSLA", category:"Equities" }],
  "TSLA":     [{ id:"NVDA", label:"NVIDIA", type:"equity", ticker:"NVDA", category:"Equities" }, { id:"QQQ", label:"Nasdaq 100", type:"equity", ticker:"QQQ", category:"Indices" }, { id:"CL=F", label:"Crude Oil", type:"commodity", ticker:"CL=F", category:"Commodities" }],
  "JPM":      [{ id:"GS", label:"Goldman Sachs", type:"equity", ticker:"GS", category:"Banks" }, { id:"BAC", label:"Bank of America", type:"equity", ticker:"BAC", category:"Banks" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }],
  "GS":       [{ id:"JPM", label:"JPMorgan", type:"equity", ticker:"JPM", category:"Banks" }, { id:"MS", label:"Morgan Stanley", type:"equity", ticker:"MS", category:"Banks" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }],
  "BAC":      [{ id:"JPM", label:"JPMorgan", type:"equity", ticker:"JPM", category:"Banks" }, { id:"C", label:"Citigroup", type:"equity", ticker:"C", category:"Banks" }, { id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }],
  "GC=F":     [{ id:"SI=F", label:"Silver", type:"commodity", ticker:"SI=F", category:"Commodities" }, { id:"EURUSD=X", label:"EUR/USD", type:"fx", ticker:"EURUSD=X", category:"FX" }, { id:"CPIAUCSL", label:"CPI Inflation", type:"macro", series:"CPIAUCSL", category:"Macro" }, { id:"DX=F", label:"USD Index", type:"fx", ticker:"DX=F", category:"FX" }],
  "CL=F":     [{ id:"NG=F", label:"Natural Gas", type:"commodity", ticker:"NG=F", category:"Commodities" }, { id:"HG=F", label:"Copper", type:"commodity", ticker:"HG=F", category:"Commodities" }, { id:"topic-energy", label:"Energy Markets", type:"topic", category:"Topics" }, { id:"EURUSD=X", label:"EUR/USD", type:"fx", ticker:"EURUSD=X", category:"FX" }],
  "NG=F":     [{ id:"CL=F", label:"Crude Oil", type:"commodity", ticker:"CL=F", category:"Commodities" }, { id:"topic-energy", label:"Energy Markets", type:"topic", category:"Topics" }],
  "HG=F":     [{ id:"CL=F", label:"Crude Oil", type:"commodity", ticker:"CL=F", category:"Commodities" }, { id:"GC=F", label:"Gold", type:"commodity", ticker:"GC=F", category:"Commodities" }, { id:"CPIAUCSL", label:"CPI Inflation", type:"macro", series:"CPIAUCSL", category:"Macro" }],
  "EURUSD=X": [{ id:"GBPUSD=X", label:"GBP/USD", type:"fx", ticker:"GBPUSD=X", category:"FX" }, { id:"DX=F", label:"USD Index", type:"fx", ticker:"DX=F", category:"FX" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }],
  "DX=F":     [{ id:"EURUSD=X", label:"EUR/USD", type:"fx", ticker:"EURUSD=X", category:"FX" }, { id:"GC=F", label:"Gold", type:"commodity", ticker:"GC=F", category:"Commodities" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }],
  "GBPUSD=X": [{ id:"EURUSD=X", label:"EUR/USD", type:"fx", ticker:"EURUSD=X", category:"FX" }, { id:"DX=F", label:"USD Index", type:"fx", ticker:"DX=F", category:"FX" }],
  "USDJPY=X": [{ id:"DX=F", label:"USD Index", type:"fx", ticker:"DX=F", category:"FX" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }],
  "FEDFUNDS": [{ id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }, { id:"DGS2", label:"2Y Treasury", type:"macro", series:"DGS2", category:"Macro" }, { id:"T10Y2Y", label:"Yield Curve", type:"macro", series:"T10Y2Y", category:"Macro" }, { id:"topic-rates", label:"Interest Rates", type:"topic", category:"Topics" }],
  "DGS10":    [{ id:"DGS2", label:"2Y Treasury", type:"macro", series:"DGS2", category:"Macro" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"T10Y2Y", label:"Yield Curve", type:"macro", series:"T10Y2Y", category:"Macro" }, { id:"topic-rates", label:"Interest Rates", type:"topic", category:"Topics" }],
  "DGS2":     [{ id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"T10Y2Y", label:"Yield Curve", type:"macro", series:"T10Y2Y", category:"Macro" }],
  "CPIAUCSL": [{ id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }, { id:"GC=F", label:"Gold", type:"commodity", ticker:"GC=F", category:"Commodities" }, { id:"topic-inflation", label:"Inflation", type:"topic", category:"Topics" }],
  "T10Y2Y":   [{ id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }, { id:"DGS2", label:"2Y Treasury", type:"macro", series:"DGS2", category:"Macro" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"topic-credit", label:"Credit Markets", type:"topic", category:"Topics" }],
  "UNRATE":   [{ id:"CPIAUCSL", label:"CPI Inflation", type:"macro", series:"CPIAUCSL", category:"Macro" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"topic-inflation", label:"Inflation", type:"topic", category:"Topics" }],
  "topic-inflation": [{ id:"CPIAUCSL", label:"CPI", type:"macro", series:"CPIAUCSL", category:"Macro" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"GC=F", label:"Gold", type:"commodity", ticker:"GC=F", category:"Commodities" }, { id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }],
  "topic-rates":     [{ id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }, { id:"T10Y2Y", label:"Yield Curve", type:"macro", series:"T10Y2Y", category:"Macro" }, { id:"JPM", label:"JPMorgan", type:"equity", ticker:"JPM", category:"Banks" }],
  "topic-energy":    [{ id:"CL=F", label:"Crude Oil", type:"commodity", ticker:"CL=F", category:"Commodities" }, { id:"NG=F", label:"Natural Gas", type:"commodity", ticker:"NG=F", category:"Commodities" }, { id:"HG=F", label:"Copper", type:"commodity", ticker:"HG=F", category:"Commodities" }, { id:"EURUSD=X", label:"EUR/USD", type:"fx", ticker:"EURUSD=X", category:"FX" }],
  "topic-credit":    [{ id:"T10Y2Y", label:"Yield Curve", type:"macro", series:"T10Y2Y", category:"Macro" }, { id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }, { id:"JPM", label:"JPMorgan", type:"equity", ticker:"JPM", category:"Banks" }, { id:"GS", label:"Goldman Sachs", type:"equity", ticker:"GS", category:"Banks" }],
};

const TOPIC_CONFIG = {
  "topic-inflation": {
    title: "Inflation", icon: "📈",
    desc: "Consumer prices, purchasing power, and monetary policy response.",
    macro: [
      { id:"CPIAUCSL", label:"CPI",          series:"CPIAUCSL" },
      { id:"PCEPI",    label:"PCE",          series:"PCEPI" },
      { id:"FEDFUNDS", label:"Fed Funds",    series:"FEDFUNDS" },
      { id:"DGS10",    label:"10Y Treasury", series:"DGS10" },
    ],
    assets: [
      { id:"GC=F",      label:"Gold",          type:"commodity", ticker:"GC=F",      category:"Commodities" },
      { id:"EURUSD=X",  label:"EUR/USD",        type:"fx",        ticker:"EURUSD=X",  category:"FX" },
      { id:"TIP",       label:"TIP (TIPS ETF)", type:"equity",    ticker:"TIP",       category:"Equities" },
    ],
  },
  "topic-rates": {
    title: "Interest Rates", icon: "📊",
    desc: "Federal Reserve policy, Treasury yields, and the yield curve.",
    macro: [
      { id:"FEDFUNDS", label:"Fed Funds",          series:"FEDFUNDS" },
      { id:"DGS2",     label:"2Y Treasury",        series:"DGS2" },
      { id:"DGS10",    label:"10Y Treasury",       series:"DGS10" },
      { id:"T10Y2Y",   label:"Yield Curve (10-2)", series:"T10Y2Y" },
    ],
    assets: [
      { id:"TLT", label:"TLT (20Y Treasury)", type:"equity", ticker:"TLT", category:"Equities" },
      { id:"SHY", label:"SHY (1-3Y Treasury)", type:"equity", ticker:"SHY", category:"Equities" },
      { id:"JPM", label:"JPMorgan",            type:"equity", ticker:"JPM", category:"Banks" },
    ],
  },
  "topic-energy": {
    title: "Energy Markets", icon: "⚡",
    desc: "Crude oil, natural gas, and energy sector dynamics.",
    macro: [
      { id:"CPIAUCSL", label:"CPI", series:"CPIAUCSL" },
    ],
    assets: [
      { id:"CL=F", label:"Crude Oil (WTI)",  type:"commodity", ticker:"CL=F", category:"Commodities" },
      { id:"NG=F", label:"Natural Gas",       type:"commodity", ticker:"NG=F", category:"Commodities" },
      { id:"HG=F", label:"Copper",            type:"commodity", ticker:"HG=F", category:"Commodities" },
    ],
  },
  "topic-credit": {
    title: "Credit Markets", icon: "🏦",
    desc: "Corporate bonds, credit spreads, and bank lending conditions.",
    macro: [
      { id:"T10Y2Y",   label:"Yield Curve", series:"T10Y2Y" },
      { id:"DGS10",    label:"10Y Treasury", series:"DGS10" },
      { id:"FEDFUNDS", label:"Fed Funds",    series:"FEDFUNDS" },
    ],
    assets: [
      { id:"LQD", label:"LQD (IG Bonds)",        type:"equity", ticker:"LQD", category:"Equities" },
      { id:"HYG", label:"HYG (High Yield Bonds)", type:"equity", ticker:"HYG", category:"Equities" },
      { id:"JPM", label:"JPMorgan",               type:"equity", ticker:"JPM", category:"Banks" },
    ],
  },
};

// ── Entity Intelligence (static) ────────────────────────────────────────────
const ENTITY_INTEL = {
  "CL=F": {
    unit:"USD/barrel",
    whatItIs: "West Texas Intermediate (WTI) crude oil — primary US benchmark extracted from the Permian Basin, priced per barrel on NYMEX.",
    whyItMatters: "Energy backbone of the global economy. A $10/bbl move in oil shifts headline CPI by ~0.4pp, erases airline margins, and swings petro-state fiscal balances.",
    drivers: ["OPEC+ production quotas & compliance rate","US shale output + weekly EIA/API inventory draws","Global demand cycle (China & India growth critical)","USD strength — inverse correlation","Geopolitical risk (Middle East, Russia sanctions)","Seasonal demand: summer driving peak, winter heating"],
    relationships: ["Inversely correlated with USD Index (DX=F)","Feeds directly into CPI energy component","Positive correlation with energy equities (XOM, CVX)","Tracks global PMI as demand proxy","Copper & iron ore confirm global demand signal"],
    producers: [{ name:"United States", share:"13.1M bbl/d", note:"World's largest (shale)" },{ name:"Saudi Arabia", share:"10.8M bbl/d", note:"OPEC leader, swing producer" },{ name:"Russia", share:"9.5M bbl/d", note:"Major sanctions risk" },{ name:"Canada", share:"5.8M bbl/d", note:"Oil sands + conventional" },{ name:"Iraq", share:"4.4M bbl/d", note:"OPEC #2" },{ name:"UAE", share:"3.7M bbl/d", note:"OPEC member" }],
  },
  "GC=F": {
    unit:"USD/troy oz",
    whatItIs: "Gold futures — the world's oldest store of value. Priced per troy ounce in USD, traded on COMEX. Central banks hold ~35,000 tonnes.",
    whyItMatters: "The purest hedge against real rate decline and currency debasement. Central bank demand hit multi-decade highs 2022-2024. Rising gold often signals distrust in fiat or a brewing systemic crisis.",
    drivers: ["Real interest rates (10Y TIPS yield) — the key driver","USD strength (DXY inverse correlation)","Central bank buying (China, India, Turkey)","Inflation expectations & CPI surprises","Geopolitical & systemic risk events","ETF flows (GLD, IAU)"],
    relationships: ["Strong inverse to USD Index and real yields","Positive correlation with silver (monetary component)","Hedge against equity stress — low/negative S&P beta","Leads silver but silver amplifies gold moves"],
    producers: [{ name:"China", share:"370 t/yr", note:"Largest single producer" },{ name:"Russia", share:"330 t/yr", note:"Sanctions exposure" },{ name:"Australia", share:"310 t/yr", note:"Major global supplier" },{ name:"Canada", share:"195 t/yr", note:"Significant reserves" },{ name:"United States", share:"170 t/yr", note:"Nevada, Alaska" }],
  },
  "SI=F": {
    unit:"USD/troy oz",
    whatItIs: "Silver futures — a hybrid monetary-industrial metal. ~55% industrial demand (solar, electronics, EVs), ~45% investment. More volatile than gold.",
    whyItMatters: "Critical for solar panels (silver paste), EVs, and 5G. Solar demand is structural and growing rapidly. The Gold:Silver ratio (~80-90x) signals historical cheapness vs gold.",
    drivers: ["Industrial demand: solar, EV, electronics manufacturing","Gold price (high ~0.85 correlation)","Solar installation growth globally","Mining supply from Mexico, Peru, China","Real interest rates (investment demand component)"],
    relationships: ["Highly correlated with gold but more volatile","Industrial ties link it to copper and base metals","Gold:Silver ratio > 80 historically signals cheapness","Energy transition is long-run structural demand driver"],
    producers: [{ name:"Mexico", share:"6,300 t/yr", note:"Largest producer globally" },{ name:"China", share:"3,500 t/yr", note:"Also largest single consumer" },{ name:"Peru", share:"3,000 t/yr", note:"Major exporter" },{ name:"Russia", share:"1,500 t/yr", note:"Sanctions exposure" },{ name:"Chile", share:"1,300 t/yr", note:"Codelco by-product" }],
  },
  "NG=F": {
    unit:"USD/MMBtu",
    whatItIs: "Henry Hub natural gas — US benchmark priced per MMBtu at the Louisiana pipeline hub. Extremely weather-sensitive and globally linked via LNG exports.",
    whyItMatters: "Primary heating fuel and power generation input. US LNG exports created a global price link to European TTF and Asian JKM. Supply-demand is hyper-seasonal, producing extreme volatility.",
    drivers: ["Weather: heating degree days (winter) and cooling (summer)","LNG export utilization from Gulf Coast terminals","EIA weekly storage vs. 5-year average","Production from Haynesville and Marcellus shale","European energy policy & Russian supply disruptions","Coal-to-gas switching economics"],
    relationships: ["Feeds into electricity prices and utility costs","Winter weather creates extreme spike risk","LNG links US natural gas to European/Asian markets","Crude oil complex correlation — energy sector moves together"],
    producers: [{ name:"United States", share:"~36 tcf/yr", note:"Haynesville, Marcellus, Permian" },{ name:"Russia", share:"~23 tcf/yr", note:"Gazprom, Nord Stream" },{ name:"Iran", share:"~10 tcf/yr", note:"Sanctions constrain exports" },{ name:"Qatar", share:"~7 tcf/yr", note:"Major LNG exporter to Asia" },{ name:"Australia", share:"~5 tcf/yr", note:"LNG to Asia (Gorgon, etc.)" }],
  },
  "HG=F": {
    unit:"USD/lb",
    whatItIs: "Copper futures (COMEX) — industrial bellwether called 'Dr. Copper' for its ~0.80 correlation with global PMI. China consumes ~55% of global supply.",
    whyItMatters: "In every wire, motor, and circuit. The energy transition requires 4x copper per EV vs ICE vehicle. Chinese property & infrastructure cycles drive multi-year demand. Key leading indicator of global growth.",
    drivers: ["Chinese industrial activity & property sector health","Global manufacturing PMI","Mine supply from Chile & Peru (>40% global supply)","USD strength (inverse)","Energy transition: EVs, renewables, grid upgrades","Smelter disruptions & labour strikes"],
    relationships: ["Best real-time proxy for Chinese economic activity","Leads equity markets at cycle turning points","Inversely linked to USD","Correlated with EM equities and CNY strength"],
    producers: [{ name:"Chile", share:"5.7M t/yr", note:"World's largest (~27% of supply)" },{ name:"Peru", share:"2.8M t/yr", note:"Major exporter, strike risk" },{ name:"Congo (DRC)", share:"2.5M t/yr", note:"Surging production" },{ name:"China", share:"1.9M t/yr", note:"& largest consumer (~55%)" },{ name:"Russia", share:"0.9M t/yr", note:"Sanctions impact" }],
  },
  "ZW=F": {
    unit:"USD/bushel",
    whatItIs: "CBOT Wheat futures — the world's most widely traded grain, fundamental to food security across 50+ developing nations.",
    whyItMatters: "Russia & Ukraine export ~30% of global wheat. Any disruption immediately spikes food inflation in the Middle East, North Africa, and South Asia — regions that spend 30-40% of income on food.",
    drivers: ["Black Sea export flows (Russia/Ukraine conflict)","US Plains weather: drought (Kansas HRW), frost","La Niña/El Niño pattern impact globally","USDA WASDE monthly supply/demand estimates","Natural gas prices → fertiliser costs","Export competition from Australia, EU, Argentina"],
    relationships: ["Correlated with corn and soybeans (feed substitution)","Natural gas prices drive nitrogen fertiliser costs","USD inversely affects US export competitiveness","Geopolitical shocks amplify moves vs other commodities"],
    producers: [{ name:"China", share:"~133 Mt/yr", note:"Largely domestic consumption" },{ name:"India", share:"~110 Mt/yr", note:"Domestic focus, export bans" },{ name:"Russia", share:"~90 Mt/yr", note:"World's top exporter, 20% of trade" },{ name:"United States", share:"~45 Mt/yr", note:"HRW and SRW export key" },{ name:"Ukraine", share:"~20 Mt/yr", note:"Black Sea corridor critical" }],
  },
  "EURUSD=X": {
    whatItIs: "EUR/USD — the world's most liquid currency pair, ~24% of $7.5T daily FX turnover. Euro represents 20 Eurozone economies vs the US Dollar.",
    whyItMatters: "Primary gauge of USD strength vs Europe and ECB-Fed policy divergence. EUR/USD moves affect global trade, commodity prices, and US multinational earnings.",
    drivers: ["ECB vs Fed interest rate differential (the dominant factor)","Eurozone vs US economic growth divergence","Energy prices — Europe is a net energy importer","Risk sentiment: USD safe-haven in crises","Inflation differential Europe vs US","European sovereign spread widening"],
    relationships: ["Inversely correlated with DXY (EUR is 57.6% of DXY)","Strong EUR = headwind for German/French exporters","Weak EUR raises European import inflation","Commodity prices denominated in USD inversely move with EUR/USD"],
  },
  "GBPUSD=X": {
    whatItIs: "GBP/USD (Cable) — British Pound vs US Dollar. Among the most liquid FX pairs with ~9% of global volume.",
    whyItMatters: "UK runs a persistent current account deficit (~4% GDP), making GBP structurally vulnerable. BOE credibility on inflation is a key risk factor post-2022 mini-budget crisis.",
    drivers: ["BOE vs Fed rate differential","UK CPI, employment, and GDP data","UK current account deficit & capital flows","Political stability & fiscal credibility","Risk sentiment — GBP weakens in global risk-off","UK-EU trade relationship post-Brexit"],
    relationships: ["Correlated with EUR/USD (both vs USD)","FTSE 100 benefits from weak GBP (80% revenues overseas)","UK Gilt yield spread vs US Treasuries drives flows","Strong global USD = structural GBP headwind"],
  },
  "USDJPY=X": {
    whatItIs: "USD/JPY — US Dollar vs Japanese Yen. JPY is a global safe-haven and the world's largest carry trade funding currency, with an estimated $4+ trillion carry outstanding.",
    whyItMatters: "BOJ ultra-low rate policy created the world's largest interest rate differential. When this unwinds (BOJ hikes), carry trade reversal triggers global deleveraging across all risk assets.",
    drivers: ["BOJ yield curve control (YCC) policy changes","US-Japan rate differential — historically very wide","Risk sentiment: JPY strengthens sharply in crises","Japanese government intervention thresholds (~152-155)","Japanese inflation breaking the deflationary mindset","Global carry trade positioning & VIX spikes"],
    relationships: ["High USD/JPY = risk-on; sharp drop = risk-off signal","Yen carry unwind triggers correlated selling across EM, equities, crypto","Weak JPY boosts Japanese exporters (Toyota, Sony, SoftBank)","BOJ rate hike expectations = immediate JPY appreciation"],
  },
  "USDCNY=X": {
    whatItIs: "USD/CNY — US Dollar vs Chinese Renminbi. CNY trades within a ±2% daily band set by PBOC fixing. Onshore (CNY) vs offshore (CNH) spread signals capital pressure.",
    whyItMatters: "China is the world's largest trading nation. PBOC manages rate as policy tool — devaluation exports deflation globally; appreciation signals confidence. US-China tariff cycles create acute sensitivity.",
    drivers: ["PBOC daily fixing and intervention","China trade balance and current account","US-China trade policy (tariffs, restrictions)","China property sector and capital flows","Fed vs PBOC rate differential","Geopolitical tensions (Taiwan risk premium)"],
    relationships: ["Impacts all China-linked assets: copper, iron ore, EM currencies","CNY weakness = deflationary pressure for global goods","CSI 300 and HSI track CNY stability closely","USD/CNH spread signals offshore capital flight pressure"],
  },
  "DX=F": {
    whatItIs: "US Dollar Index (DXY) — measures USD against a basket: EUR 57.6%, JPY 13.6%, GBP 11.9%, CAD 9.1%, SEK 4.2%, CHF 3.6%. The global reserve currency benchmark.",
    whyItMatters: "A rising DXY tightens global dollar funding, pressures ~$4T in EM USD debt, and inversely drives commodity prices. The most watched macro variable after Fed Funds rate.",
    drivers: ["Federal Reserve rate expectations (the primary driver)","US economic outperformance vs peers","Flight to safety in crises","US current account and trade balance","EUR/USD dominance (57.6% weight)","Capital flows into US assets (equities, Treasuries)"],
    relationships: ["Inverse correlation with most commodities (gold, oil, copper)","Strong DXY = EM capital outflows and currency pressure","Negative correlation with SPY during risk-off","Key input into foreign corporate USD debt servicing costs"],
  },
  "FEDFUNDS": {
    whatItIs: "Effective Federal Funds Rate — the overnight interbank rate set by Federal Reserve at FOMC meetings (8x/year). The anchor for all USD borrowing costs globally.",
    whyItMatters: "The most influential interest rate in the world. Every basis point change ripples through mortgages, corporate bonds, EM USD debt, and equity valuations. Fed policy is the dominant driver of the global financial cycle.",
    drivers: ["CPI and PCE inflation vs 2% target","Unemployment rate vs ~4% NAIRU","GDP growth trend vs potential output","Financial stability conditions","Global spillover risks","Fed forward guidance and dot plot"],
    relationships: ["Sets floor for all short-term USD rates","Rate hikes → DXY up, gold down, EM stress, P/E compression","Rate cuts → equity multiple expansion, dollar weakening","Controls the risk-free rate used to discount all financial assets"],
  },
  "DGS10": {
    whatItIs: "10-Year US Treasury Constant Maturity Yield — return on US government bonds maturing in 10 years. The global benchmark risk-free rate, set by market supply and demand.",
    whyItMatters: "The primary discount rate for all long-duration assets — equities, real estate, infrastructure. Rising 10Y yields compress equity P/E multiples and raise mortgage rates globally.",
    drivers: ["Fed policy path expectations (short-run dominant)","Inflation breakevens and PCE forecasts","US fiscal deficit and Treasury supply (term premium)","Global safe-haven demand","Economic growth outlook (long-run anchor)"],
    relationships: ["Inverse with bond prices (TLT price falls as DGS10 rises)","Higher 10Y → compression of growth equity P/E (QQQ most sensitive)","Drives 30Y mortgage rate (spreads ~150-200bps over)","Global sovereign yields follow US 10Y with a lag"],
  },
  "CPIAUCSL": {
    whatItIs: "Consumer Price Index for All Urban Consumers — measures price changes in a basket of goods/services for ~93% of US population. The headline inflation gauge from BLS, reported monthly.",
    whyItMatters: "The primary trigger for Federal Reserve policy action. Each CPI print is a major market event — an upside surprise can send yields up 20bp and equities down 2% instantly. Fed targets 2% PCE but tracks CPI closely.",
    drivers: ["Energy prices (~8% of basket) — oil and gas most volatile","Shelter/OER (~35% — lagged by 12+ months)","Food prices — commodity & supply chain sensitivity","Labor costs flowing through to services prices","Import prices (USD strength/weakness)","Supply chain normalization"],
    relationships: ["Above 2% sustained → Fed rate hikes → higher yields, strong USD","Energy component directly tracks CL=F and NG=F","Shelter lag means CPI overstates inflation by ~6-12 months at cycle turns","Core CPI (ex food/energy) is the Fed's near-term signal"],
  },
  "T10Y2Y": {
    whatItIs: "10-Year minus 2-Year Treasury Yield Spread — the most watched yield curve indicator. Positive = normal curve; negative = inverted (recession signal). Updated daily.",
    whyItMatters: "Inverted yield curve (T10Y2Y < 0) has preceded every US recession in the past 50 years with 6-18 months lead time. Banks borrow short (2Y) and lend long (10Y) — inversion crushes bank margins.",
    drivers: ["Fed rate hikes — raise 2Y faster than 10Y","Long-run growth & inflation expectations (10Y anchor)","Term premium (demand for long-duration bonds)","Flight to safety (compresses 10Y yield)","Supply of long-duration Treasury issuance"],
    relationships: ["Deep negative → recession warning ~12-18 months ahead","Bank lending margins compress with flat/inverted curve","Positive correlation with bank equity performance","Signal for sector rotation: defensives outperform when inverted"],
  },
  "UNRATE": {
    whatItIs: "US Civilian Unemployment Rate — percentage of labor force actively seeking work but unemployed, measured by BLS Current Population Survey. Released first Friday of each month.",
    whyItMatters: "One half of the Fed's dual mandate. Below ~4% NAIRU = inflationary labor market = Fed stays hawkish. The Sahm Rule (0.5pp rise from 12-month low) has correctly signaled every recession since 1970.",
    drivers: ["Business cycle and corporate hiring/firing","Fed rate hike lag effects on employment (12-18 months)","Technological change and automation","Immigration and labor supply shifts","Sector-specific shocks (manufacturing, construction, tech)"],
    relationships: ["Rising UNRATE → Fed cuts → lower DGS10, equity re-rating","Sahm Rule trigger (0.5pp rise) = recession signal","Inversely correlated with wage growth (Phillips curve)","Lagging indicator — economy softening months before UNRATE rises"],
  },
  "GDP": {
    whatItIs: "US Real Gross Domestic Product — inflation-adjusted total economic output, reported quarterly with advance, preliminary, and final revisions. Annualized quarterly change is the standard format.",
    whyItMatters: "The broadest measure of US economic health. Two consecutive negative quarters = technical recession. Surprises vs consensus estimates drive immediate USD, equity, and bond market reactions.",
    drivers: ["Personal consumption (~70% of GDP)","Business investment & capex cycles","Government spending and fiscal policy","Net exports (USD strength → smaller net exports)","Housing investment","Inventory accumulation/depletion"],
    relationships: ["Strong GDP → risk-on, higher rates, stronger USD","GDP growth directly drives corporate EPS and equity multiples","Fed calibrates rate path to GDP vs potential growth","S&P 500 EPS growth historically runs at ~1.5x nominal GDP growth"],
  },
  "DGS2": {
    whatItIs: "2-Year US Treasury Constant Maturity Yield — a short-duration government bond yield that closely tracks expected Federal Reserve policy over the next 2 years.",
    whyItMatters: "The 2Y yield is the market's best real-time forecast of the Fed funds rate path. It reacts faster and more directly to CPI prints and Fed communication than the 10Y.",
    drivers: ["Fed rate hike/cut expectations (dominant)","Near-term inflation forecasts","Short-term growth outlook","FOMC meeting outcomes and dot plot","Supply of short-duration Treasury issuance"],
    relationships: ["Rises faster than 10Y during hikes → yield curve flattening/inversion","2Y-FEDFUNDS spread reflects policy rate premium","Strong 2Y move = key signal for equities and DXY"],
  },
  "PCEPI": {
    whatItIs: "Personal Consumption Expenditures Price Index — the Federal Reserve's preferred inflation measure, broader than CPI, covering healthcare and other services differently.",
    whyItMatters: "This is the Fed's official target (2%). PCE tends to run ~0.3pp below CPI due to methodology differences. FOMC projections and decisions explicitly reference PCE, not CPI.",
    drivers: ["Healthcare costs (larger PCE weight vs CPI)","Consumer substitution behavior (PCE adjusts dynamically)","Energy and food prices","Services inflation (labor cost pass-through)","Shelter costs (smaller weight than CPI)"],
    relationships: ["Runs below CPI by ~0.3pp on average","Fed directly targets core PCE at 2%","Above-target PCE is the formal trigger for tightening","Correlated with CPIAUCSL but diverges at turning points"],
  },
};

// ── FX Rate Differential Pairs ───────────────────────────────────────────────
const FX_RATE_PAIRS = {
  "EURUSD=X": { baseSeries:"FEDFUNDS", baseLabel:"Fed Funds (USD)", quoteSeries:"ECBDFR",         quoteLabel:"ECB Rate (EUR)", baseCCY:"USD", quoteCCY:"EUR" },
  "GBPUSD=X": { baseSeries:"FEDFUNDS", baseLabel:"Fed Funds (USD)", quoteSeries:"BOEBR",           quoteLabel:"BOE Rate (GBP)", baseCCY:"USD", quoteCCY:"GBP" },
  "USDJPY=X": { baseSeries:"FEDFUNDS", baseLabel:"Fed Funds (USD)", quoteSeries:"IRSTCI01JPM156N", quoteLabel:"BOJ Rate (JPY)", baseCCY:"USD", quoteCCY:"JPY" },
  "USDCNY=X": { baseSeries:"FEDFUNDS", baseLabel:"Fed Funds (USD)", quoteSeries:null,              quoteLabel:"PBOC (CNY)",     baseCCY:"USD", quoteCCY:"CNY" },
  "DX=F":     { baseSeries:"FEDFUNDS", baseLabel:"Fed Funds (USD)", quoteSeries:null,              quoteLabel:"Basket",         baseCCY:"USD", quoteCCY:"DXY" },
};

// Market cap from Finnhub is in millions USD
const fmtMktCap = v => { if (v == null || isNaN(v)) return "—"; if (v >= 1e6) return "$" + (v/1e6).toFixed(2) + "T"; if (v >= 1e3) return "$" + (v/1e3).toFixed(2) + "B"; return "$" + Math.round(v) + "M"; };
const fmtX   = v => v == null || isNaN(v) ? "—" : v.toFixed(1) + "x";
const fmtN   = (v, d=2) => v == null || isNaN(v) ? "—" : (+v).toFixed(d);
const fmtMgn = v => v == null || isNaN(v) ? "—" : (+v).toFixed(1) + "%";
const fmtGr  = v => v == null || isNaN(v) ? "—" : (v >= 0 ? "+" : "") + (+v).toFixed(1) + "%";
const clrM   = v => v == null ? "#7d8590" : v > 0 ? "#3fb950" : "#f85149";

const RB_TYPE_COLOR = { equity:"#58a6ff", commodity:"#e3b341", fx:"#3fb950", macro:"#bc8cff", topic:"#f0883e" };


function ResearchPanelShell({ title, subtitle, badge, onClose, children }) {
  return (
    <div className="terminal-panel terminal-glow flex flex-col" style={{ minHeight: 360 }}>
      <div className="flex items-center justify-between px-4 pt-3.5 pb-3" style={{ borderBottom:"1px solid rgba(99,110,123,0.12)", flexShrink:0 }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0">
            <div className="font-mono font-bold truncate" style={{ color:"#e6edf3", fontSize:14, letterSpacing:"-0.01em" }}>{title}</div>
            {subtitle && <div className="font-mono truncate" style={{ color:"#484f58", fontSize:9, marginTop:1 }}>{subtitle}</div>}
          </div>
          {badge && (
            <span className="font-mono" style={{ background:"rgba(99,110,123,0.10)", border:"1px solid rgba(99,110,123,0.20)", borderRadius:20, padding:"2px 8px", fontSize:9, color:"#7d8590", textTransform:"uppercase", letterSpacing:"0.06em", flexShrink:0 }}>
              {badge}
            </span>
          )}
        </div>
        <button onClick={onClose}
          style={{ color:"#484f58", background:"rgba(99,110,123,0.08)", border:"none", cursor:"pointer", fontSize:12, marginLeft:8, flexShrink:0, width:24, height:24, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background="rgba(99,110,123,0.18)"; e.currentTarget.style.color="#8b949e"; }}
          onMouseLeave={e => { e.currentTarget.style.background="rgba(99,110,123,0.08)"; e.currentTarget.style.color="#484f58"; }}>✕</button>
      </div>
      <div className="flex flex-col flex-1 p-4">{children}</div>
    </div>
  );
}

function RelatedLinks({ itemId, onOpen }) {
  const links = RELATED_MAP[itemId] || [];
  if (!links.length) return null;
  return (
    <div className="mt-auto pt-3" style={{ borderTop:"1px solid rgba(99,110,123,0.10)" }}>
      <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Related</div>
      <div className="flex flex-wrap gap-1.5">
        {links.map(link => (
          <button key={link.id} onClick={() => onOpen(link)} className="font-mono"
            style={{ background:"rgba(99,110,123,0.07)", border:"1px solid rgba(99,110,123,0.16)", borderRadius:20, padding:"3px 10px", fontSize:10, color:RB_TYPE_COLOR[link.type]||"#7d8590", cursor:"pointer", transition:"all 0.15s cubic-bezier(0.4,0,0.2,1)" }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(99,110,123,0.15)"; e.currentTarget.style.borderColor="rgba(99,110,123,0.35)"; e.currentTarget.style.transform="translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background="rgba(99,110,123,0.07)"; e.currentTarget.style.borderColor="rgba(99,110,123,0.16)"; e.currentTarget.style.transform="translateY(0)"; }}>
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Mock tear-sheet data (keyed by ticker) ───────────────────────────────────
const MOCK_RESEARCH_DATA = {
  _default: {
    flow: {
      suppliers: [
        { id:"s1", label:"TSMC", pct:38, color:"#58a6ff" },
        { id:"s2", label:"Samsung", pct:22, color:"#58a6ff" },
        { id:"s3", label:"Foxconn", pct:28, color:"#58a6ff" },
        { id:"s4", label:"Murata", pct:12, color:"#58a6ff" },
      ],
      segments: [
        { id:"r1", label:"Products", pct:52, color:"#3fb950" },
        { id:"r2", label:"Services", pct:24, color:"#7ee787" },
        { id:"r3", label:"Wearables", pct:11, color:"#e3b341" },
        { id:"r4", label:"Mac", pct:8, color:"#ffa657" },
        { id:"r5", label:"iPad", pct:5, color:"#f0883e" },
      ],
      blockTrades: [
        { side:"BUY",  strike:"$210C", expiry:"May 17", size:4200, premium:"$8.4M", note:"Sweep" },
        { side:"SELL", strike:"$195P", expiry:"Apr 26", size:3100, premium:"$3.1M", note:"OTM hedge" },
        { side:"BUY",  strike:"$220C", expiry:"Jun 21", size:1800, premium:"$5.2M", note:"Block" },
        { side:"BUY",  strike:"$200C", expiry:"May 10", size:2600, premium:"$6.8M", note:"Sweep" },
      ],
    },
    options: {
      putCallRatio: 0.72,
      putCallTrend: [0.91,0.88,0.82,0.79,0.75,0.72],
      ivTermStructure: [
        { expiry:"1W",  iv:28.4 }, { expiry:"2W", iv:26.1 }, { expiry:"1M", iv:24.8 },
        { expiry:"2M",  iv:23.5 }, { expiry:"3M", iv:22.9 }, { expiry:"6M", iv:22.1 },
        { expiry:"1Y",  iv:21.4 },
      ],
      unusualActivity: [
        { time:"09:42", type:"CALL", strike:"$210", expiry:"May-17", vol:4200, oi:1820, premium:"$8.4M", sentiment:"Bullish" },
        { time:"10:11", type:"PUT",  strike:"$195", expiry:"Apr-26", vol:3100, oi:5400, premium:"$3.1M", sentiment:"Bearish" },
        { time:"11:35", type:"CALL", strike:"$220", expiry:"Jun-21", vol:1800, oi:640,  premium:"$5.2M", sentiment:"Bullish" },
        { time:"13:02", type:"CALL", strike:"$205", expiry:"May-02", vol:6200, oi:2100, premium:"$12.1M",sentiment:"Bullish" },
        { time:"14:18", type:"PUT",  strike:"$190", expiry:"May-17", vol:2400, oi:8800, premium:"$4.8M", sentiment:"Bearish" },
      ],
    },
    insiders: {
      transactions: [
        { date:"2025-03-14", name:"Tim Cook",        title:"CEO",          type:"SELL", shares:200000, price:176.20, value:35.2 },
        { date:"2025-02-28", name:"Luca Maestri",    title:"CFO",          type:"SELL", shares:95000,  price:182.40, value:17.3 },
        { date:"2025-02-10", name:"Jeff Williams",   title:"COO",          type:"SELL", shares:75000,  price:188.60, value:14.1 },
        { date:"2025-01-22", name:"Eddy Cue",        title:"SVP Services", type:"SELL", shares:50000,  price:222.10, value:11.1 },
        { date:"2024-11-18", name:"Arthur Levinson", title:"Chairman",     type:"BUY",  shares:30000,  price:228.50, value:6.9 },
      ],
      institutionalHolders: [
        { name:"Vanguard Group",      shares:"1.28B", changePct:+0.4,  pctOwned:8.42 },
        { name:"BlackRock",           shares:"1.04B", changePct:-0.8,  pctOwned:6.82 },
        { name:"Berkshire Hathaway",  shares:"887M",  changePct: 0.0,  pctOwned:5.83 },
        { name:"State Street",        shares:"596M",  changePct:+1.1,  pctOwned:3.91 },
        { name:"Fidelity",            shares:"354M",  changePct:+2.3,  pctOwned:2.32 },
        { name:"Geode Capital",       shares:"286M",  changePct:+0.2,  pctOwned:1.88 },
        { name:"T. Rowe Price",       shares:"210M",  changePct:-3.1,  pctOwned:1.38 },
      ],
    },
  },
  NVDA: {
    flow: {
      suppliers: [
        { id:"s1", label:"TSMC",        pct:55, color:"#58a6ff" },
        { id:"s2", label:"SK Hynix",    pct:20, color:"#58a6ff" },
        { id:"s3", label:"Micron",      pct:15, color:"#58a6ff" },
        { id:"s4", label:"ASE Group",   pct:10, color:"#58a6ff" },
      ],
      segments: [
        { id:"r1", label:"Data Center", pct:78, color:"#3fb950" },
        { id:"r2", label:"Gaming",       pct:11, color:"#7ee787" },
        { id:"r3", label:"Professional", pct:6,  color:"#e3b341" },
        { id:"r4", label:"Automotive",   pct:3,  color:"#ffa657" },
        { id:"r5", label:"OEM/Other",    pct:2,  color:"#f0883e" },
      ],
      blockTrades: [
        { side:"BUY",  strike:"$950C",  expiry:"May 17", size:3200, premium:"$18.2M", note:"Sweep" },
        { side:"BUY",  strike:"$1000C", expiry:"Jun 21", size:1500, premium:"$11.4M", note:"Block" },
        { side:"SELL", strike:"$850P",  expiry:"Apr 26", size:2800, premium:"$9.6M",  note:"Hedge" },
      ],
    },
    options: {
      putCallRatio: 0.61,
      putCallTrend: [0.84,0.79,0.74,0.70,0.65,0.61],
      ivTermStructure: [
        { expiry:"1W",  iv:52.4 }, { expiry:"2W", iv:48.2 }, { expiry:"1M", iv:44.6 },
        { expiry:"2M",  iv:42.1 }, { expiry:"3M", iv:40.8 }, { expiry:"6M", iv:38.5 },
        { expiry:"1Y",  iv:36.2 },
      ],
      unusualActivity: [
        { time:"09:32", type:"CALL", strike:"$950",  expiry:"May-17", vol:3200, oi:890,  premium:"$18.2M", sentiment:"Bullish" },
        { time:"10:48", type:"CALL", strike:"$1000", expiry:"Jun-21", vol:1500, oi:420,  premium:"$11.4M", sentiment:"Bullish" },
        { time:"12:15", type:"PUT",  strike:"$850",  expiry:"Apr-26", vol:2800, oi:6100, premium:"$9.6M",  sentiment:"Bearish" },
        { time:"14:02", type:"CALL", strike:"$920",  expiry:"May-02", vol:4600, oi:1200, premium:"$22.8M", sentiment:"Bullish" },
      ],
    },
    insiders: {
      transactions: [
        { date:"2025-03-20", name:"Jensen Huang",  title:"CEO",       type:"SELL", shares:600000, price:878.50, value:527.1 },
        { date:"2025-02-14", name:"Colette Kress", title:"CFO",       type:"SELL", shares:120000, price:726.30, value:87.2 },
        { date:"2025-01-08", name:"Ajay Puri",     title:"EVP Sales", type:"SELL", shares:80000,  price:694.20, value:55.5 },
        { date:"2024-12-03", name:"Mark Stevens",  title:"Director",  type:"BUY",  shares:10000,  price:138.80, value:1.4 },
      ],
      institutionalHolders: [
        { name:"Vanguard Group",   shares:"398M", changePct:+1.2, pctOwned:1.61 },
        { name:"BlackRock",        shares:"321M", changePct:+0.6, pctOwned:1.30 },
        { name:"FMR (Fidelity)",   shares:"198M", changePct:+4.8, pctOwned:0.80 },
        { name:"State Street",     shares:"187M", changePct:-0.3, pctOwned:0.76 },
        { name:"Geode Capital",    shares:"104M", changePct:+0.8, pctOwned:0.42 },
        { name:"Norges Bank",      shares:"92M",  changePct:+2.1, pctOwned:0.37 },
        { name:"T. Rowe Price",    shares:"84M",  changePct:-5.4, pctOwned:0.34 },
      ],
    },
  },
};
function getMockData(ticker) {
  return MOCK_RESEARCH_DATA[ticker] || MOCK_RESEARCH_DATA["_default"];
}

// ── Sankey Flow Chart (pure SVG, no extra deps) ───────────────────────────────
function SankeyFlowChart({ suppliers, segments, companyLabel }) {
  const W = 620, H = 300;
  const nodeW = 110, nodeH = 28, cx = W / 2;
  const companyBox = { x: cx - 55, y: H/2 - 18, w: 110, h: 36 };

  const gap = 10;
  const leftCount = suppliers.length;
  const leftTotalH = leftCount * nodeH + (leftCount - 1) * gap;
  const leftStartY = (H - leftTotalH) / 2;

  const rightCount = segments.length;
  const rightTotalH = rightCount * nodeH + (rightCount - 1) * gap;
  const rightStartY = (H - rightTotalH) / 2;

  const leftNodes = suppliers.map((s, i) => ({
    ...s, x: 8, y: leftStartY + i * (nodeH + gap), w: nodeW, h: nodeH,
  }));
  const rightNodes = segments.map((s, i) => ({
    ...s, x: W - nodeW - 8, y: rightStartY + i * (nodeH + gap), w: nodeW, h: nodeH,
  }));

  function cubicPath(x1, y1, x2, y2) {
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:"block", overflow:"visible" }}>
      {/* Left → company links */}
      {leftNodes.map(n => {
        const x1 = n.x + n.w, y1 = n.y + n.h / 2;
        const x2 = companyBox.x, y2 = companyBox.y + companyBox.h / 2;
        const thick = Math.max(1, (n.pct / 100) * 22);
        return (
          <path key={n.id} d={cubicPath(x1, y1, x2, y2)}
            fill="none" stroke={n.color} strokeWidth={thick} strokeOpacity={0.22} />
        );
      })}
      {/* company → right links */}
      {rightNodes.map(n => {
        const x1 = companyBox.x + companyBox.w, y1 = companyBox.y + companyBox.h / 2;
        const x2 = n.x, y2 = n.y + n.h / 2;
        const thick = Math.max(1, (n.pct / 100) * 22);
        return (
          <path key={n.id} d={cubicPath(x1, y1, x2, y2)}
            fill="none" stroke={n.color} strokeWidth={thick} strokeOpacity={0.22} />
        );
      })}
      {/* Left nodes */}
      {leftNodes.map(n => (
        <g key={n.id}>
          <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={5}
            fill="rgba(88,166,255,0.07)" stroke="rgba(88,166,255,0.25)" strokeWidth={1} />
          <text x={n.x + 8} y={n.y + n.h/2} dominantBaseline="middle"
            fill="#8b949e" fontSize={10} fontFamily="'IBM Plex Mono',monospace">{n.label}</text>
          <text x={n.x + n.w - 6} y={n.y + n.h/2} dominantBaseline="middle" textAnchor="end"
            fill="#58a6ff" fontSize={9} fontFamily="'IBM Plex Mono',monospace">{n.pct}%</text>
        </g>
      ))}
      {/* Company node */}
      <rect x={companyBox.x} y={companyBox.y} width={companyBox.w} height={companyBox.h} rx={8}
        fill="rgba(88,166,255,0.12)" stroke="rgba(88,166,255,0.45)" strokeWidth={1.5} />
      <text x={cx} y={H/2} dominantBaseline="middle" textAnchor="middle"
        fill="#e6edf3" fontSize={11} fontWeight="bold" fontFamily="'IBM Plex Mono',monospace">
        {companyLabel}
      </text>
      {/* Right nodes */}
      {rightNodes.map(n => (
        <g key={n.id}>
          <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={5}
            fill="rgba(63,185,80,0.07)" stroke="rgba(63,185,80,0.22)" strokeWidth={1} />
          <text x={n.x + 6} y={n.y + n.h/2} dominantBaseline="middle"
            fill="#3fb950" fontSize={9} fontFamily="'IBM Plex Mono',monospace">{n.pct}%</text>
          <text x={n.x + n.w - 6} y={n.y + n.h/2} dominantBaseline="middle" textAnchor="end"
            fill="#8b949e" fontSize={10} fontFamily="'IBM Plex Mono',monospace">{n.label}</text>
        </g>
      ))}
      {/* Column labels */}
      <text x={8 + nodeW/2} y={8} textAnchor="middle" fill="#484f58" fontSize={8}
        fontFamily="'IBM Plex Mono',monospace" textTransform="uppercase">KEY SUPPLIERS</text>
      <text x={W - nodeW/2 - 8} y={8} textAnchor="middle" fill="#484f58" fontSize={8}
        fontFamily="'IBM Plex Mono',monospace">REVENUE SEGMENTS</text>
    </svg>
  );
}

function EquityResearchPanel({ item, onClose, onOpen }) {
  const TABS = ["Overview","Flow","Options","Insiders","Financials","Valuation","News","Peers"];
  const [activeTab, setActiveTab] = useState("Overview");
  const [quote, setQuote]         = useState(null);
  const [profile, setProfile]     = useState(null);
  const [metrics, setMetrics]     = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [earnings, setEarnings]   = useState(null);
  const [recs, setRecs]           = useState(null);
  const [pt, setPt]               = useState(undefined);
  const [news, setNews]           = useState(null);
  const [peers, setPeers]         = useState(null);
  const [peerQ, setPeerQ]         = useState({});
  const [peerM, setPeerM]         = useState({});
  const loadedTabs = useRef(new Set(["Overview"]));
  const mock = getMockData(item.ticker);

  // ── Base load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingBase(true);
    setActiveTab("Overview");
    loadedTabs.current = new Set(["Overview"]);
    setEarnings(null); setRecs(null); setPt(undefined);
    setNews(null); setPeers(null); setPeerQ({}); setPeerM({});

    Promise.all([
      api("/quote?symbol=" + item.ticker),
      delay(150).then(() => api("/stock/profile2?symbol=" + item.ticker)),
      delay(300).then(() => api("/stock/metric?symbol=" + item.ticker + "&metric=all")),
      fetch("/api/chart?ticker=" + encodeURIComponent(item.ticker) + "&range=1y&interval=1d")
        .then(r => r.json()).catch(() => null),
    ]).then(([q, p, metaRaw, c]) => {
      setQuote(q);
      setProfile(p || {});
      setMetrics(metaRaw?.metric || null);
      const result = c?.chart?.result?.[0];
      if (result) {
        const ts      = result.timestamp || [];
        const closes  = result.indicators?.quote?.[0]?.close || [];
        const raw = ts.map((t,i) => ({ t, v: closes[i] != null ? +closes[i].toFixed(2) : null })).filter(d => d.v != null);
        const withMA  = raw.map((d,i) => {
          if (i < 49) return d;
          const avg = raw.slice(i-49, i+1).reduce((s,x) => s+x.v, 0) / 50;
          return { ...d, ma50: +avg.toFixed(2) };
        });
        setChartData(withMA);
      }
      setLoadingBase(false);
    }).catch(() => setLoadingBase(false));
  }, [item.ticker]); // eslint-disable-line

  // ── Lazy tab loads ────────────────────────────────────────────────────────
  useEffect(() => {
    if (loadedTabs.current.has(activeTab)) return;
    loadedTabs.current.add(activeTab);

    if (activeTab === "Financials") {
      api("/calendar/earnings?symbol=" + item.ticker)
        .then(d => setEarnings(
          (d?.earningsCalendar || [])
            .filter(e => e.epsActual != null)
            .sort((a,b) => b.date < a.date ? -1 : 1)
            .slice(0, 8)
        ))
        .catch(() => setEarnings([]));
    }
    if (activeTab === "Valuation") {
      Promise.all([
        api("/stock/recommendation?symbol=" + item.ticker),
        delay(150).then(() => api("/stock/price-target?symbol=" + item.ticker)),
      ]).then(([r, p]) => {
        setRecs(Array.isArray(r) ? r : []);
        setPt(p?.targetMean ? p : null);
      }).catch(() => { setRecs([]); setPt(null); });
    }
    if (activeTab === "News") {
      const today = new Date().toISOString().split("T")[0];
      const ago90 = new Date(Date.now() - 90*86400*1000).toISOString().split("T")[0];
      api("/company-news?symbol=" + item.ticker + "&from=" + ago90 + "&to=" + today)
        .then(n => setNews(Array.isArray(n) ? n.slice(0, 12) : []))
        .catch(() => setNews([]));
    }
    if (activeTab === "Peers") {
      api("/stock/peers?symbol=" + item.ticker).then(async list => {
        const p5 = (list || []).filter(x => x !== item.ticker).slice(0, 5);
        setPeers(p5);
        const qMap = {}, mMap = {};
        for (let i = 0; i < p5.length; i++) {
          if (i > 0) await delay(200);
          try {
            const [pq, pm] = await Promise.all([
              api("/quote?symbol=" + p5[i]),
              api("/stock/metric?symbol=" + p5[i] + "&metric=all"),
            ]);
            qMap[p5[i]] = pq; mMap[p5[i]] = pm?.metric || {};
          } catch(e) {}
        }
        setPeerQ({...qMap}); setPeerM({...mMap});
      }).catch(() => setPeers([]));
    }
  }, [activeTab]); // eslint-disable-line

  const m   = metrics || {};
  const up  = quote?.dp >= 0;
  const priceColor = up ? "#3fb950" : "#f85149";

  const pct52 = m["52WeekHigh"] && m["52WeekLow"] && quote?.c
    ? Math.min(100, Math.max(0, ((quote.c - m["52WeekLow"]) / (m["52WeekHigh"] - m["52WeekLow"])) * 100))
    : null;

  // ── New tear-sheet renderers ──────────────────────────────────────────────
  const renderFlow = () => {
    const { suppliers, segments, blockTrades } = mock.flow;
    const ticker = profile?.ticker || item.ticker;
    return (
      <div className="flex flex-col gap-5">
        {/* Sankey */}
        <div style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.16)", borderRadius:10, padding:"16px 12px 10px" }}>
          <div className="font-mono mb-3" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.09em" }}>
            Supply Chain &amp; Revenue Flow
          </div>
          <SankeyFlowChart suppliers={suppliers} segments={segments} companyLabel={ticker} />
        </div>

        {/* Block trades */}
        <div style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.16)", borderRadius:10, padding:14 }}>
          <div className="font-mono mb-3" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.09em" }}>
            Notable Block Trades · Today
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["Side","Contract","Expiry","Volume","Premium","Note"].map((h,i) => (
                <th key={h} className="font-mono pb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right", paddingRight:i===5?0:12 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {blockTrades.map((t,i) => (
                <tr key={i} style={{ borderTop:"1px solid rgba(99,110,123,0.08)" }}>
                  <td className="font-mono py-1.5" style={{ color:t.side==="BUY"?"#3fb950":"#f85149", fontSize:10, fontWeight:"bold" }}>{t.side}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:12 }}>{t.strike}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:"#7d8590", fontSize:10, paddingRight:12 }}>{t.expiry}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:"#8b949e", fontSize:10, paddingRight:12 }}>{t.size.toLocaleString()}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:"#e3b341", fontSize:10, paddingRight:12 }}>{t.premium}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:"#484f58", fontSize:9 }}>{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderOptions = () => {
    const { putCallRatio, putCallTrend, ivTermStructure, unusualActivity } = mock.options;
    const pcSentiment = putCallRatio < 0.7 ? "Bullish" : putCallRatio > 1.0 ? "Bearish" : "Neutral";
    const pcColor = putCallRatio < 0.7 ? "#3fb950" : putCallRatio > 1.0 ? "#f85149" : "#e3b341";
    const pcMax = Math.max(...putCallTrend) * 1.05;
    return (
      <div className="flex flex-col gap-4">
        {/* Bento top row: P/C ratio + IV term structure */}
        <div className="grid gap-4" style={{ gridTemplateColumns:"220px 1fr" }}>
          {/* Put/Call ratio */}
          <div style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.16)", borderRadius:10, padding:14 }}>
            <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.09em" }}>Put / Call Ratio</div>
            <div className="font-mono" style={{ color:pcColor, fontSize:34, fontWeight:"bold", lineHeight:1 }}>{putCallRatio.toFixed(2)}</div>
            <div className="font-mono mt-1" style={{ color:pcColor, fontSize:10 }}>{pcSentiment}</div>
            <div className="mt-3">
              <div className="font-mono mb-1" style={{ color:"#484f58", fontSize:8 }}>6-SESSION TREND</div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:40 }}>
                {putCallTrend.map((v,i) => {
                  const h = Math.round((v / pcMax) * 38);
                  const isLast = i === putCallTrend.length - 1;
                  return (
                    <div key={i} style={{ flex:1, height:h, background: isLast ? pcColor : "rgba(99,110,123,0.20)", borderRadius:"2px 2px 0 0" }} />
                  );
                })}
              </div>
            </div>
          </div>

          {/* IV Term Structure */}
          <div style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.16)", borderRadius:10, padding:14 }}>
            <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.09em" }}>Implied Volatility Term Structure</div>
            <div style={{ height:140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ivTermStructure} margin={{ top:4, right:4, bottom:0, left:0 }} barSize={22}>
                  <XAxis dataKey="expiry" tick={{ fill:"#484f58", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" }} tickLine={false} axisLine={false} />
                  <YAxis domain={["auto","auto"]} tick={{ fill:"#484f58", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" }} tickLine={false} axisLine={false} tickFormatter={v=>v+"%"} width={32} />
                  <Tooltip contentStyle={{ background:"#1c2230", border:"1px solid rgba(99,110,123,0.28)", borderRadius:10, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}
                    formatter={v=>[v.toFixed(1)+"%","IV"]} />
                  <Bar dataKey="iv" radius={[3,3,0,0]}
                    fill="url(#ivGrad)"
                  />
                  <defs>
                    <linearGradient id="ivGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#58a6ff" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#58a6ff" stopOpacity={0.30} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Unusual options activity */}
        <div style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.16)", borderRadius:10, padding:14 }}>
          <div className="font-mono mb-3" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.09em" }}>
            Unusual Options Activity · Today
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["Time","Type","Strike","Expiry","Volume","OI","Premium","Signal"].map((h,i) => (
                <th key={h} className="font-mono pb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right", paddingRight:i===7?0:10 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {unusualActivity.map((u,i) => {
                const isCall = u.type === "CALL";
                const typeColor = isCall ? "#3fb950" : "#f85149";
                const sigColor  = u.sentiment === "Bullish" ? "#3fb950" : "#f85149";
                return (
                  <tr key={i} style={{ borderTop:"1px solid rgba(99,110,123,0.08)" }}>
                    <td className="font-mono py-1.5" style={{ color:"#484f58", fontSize:9 }}>{u.time}</td>
                    <td className="font-mono py-1.5 text-right" style={{ color:typeColor, fontSize:10, fontWeight:"bold", paddingRight:10 }}>{u.type}</td>
                    <td className="font-mono py-1.5 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:10 }}>{u.strike}</td>
                    <td className="font-mono py-1.5 text-right" style={{ color:"#7d8590", fontSize:10, paddingRight:10 }}>{u.expiry}</td>
                    <td className="font-mono py-1.5 text-right" style={{ color:"#8b949e", fontSize:10, paddingRight:10 }}>{u.vol.toLocaleString()}</td>
                    <td className="font-mono py-1.5 text-right" style={{ color:"#484f58", fontSize:10, paddingRight:10 }}>{u.oi.toLocaleString()}</td>
                    <td className="font-mono py-1.5 text-right" style={{ color:"#e3b341", fontSize:10, paddingRight:10 }}>{u.premium}</td>
                    <td className="font-mono py-1.5 text-right">
                      <span style={{ background: u.sentiment==="Bullish"?"rgba(63,185,80,0.12)":"rgba(248,81,73,0.12)", color:sigColor, borderRadius:20, padding:"2px 8px", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" }}>
                        {u.sentiment}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderInsiders = () => {
    const { transactions, institutionalHolders } = mock.insiders;
    return (
      <div className="flex flex-col gap-4">
        {/* Insider transactions */}
        <div style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.16)", borderRadius:10, padding:14 }}>
          <div className="font-mono mb-3" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.09em" }}>
            Insider Transactions · Last 12 Months
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["Date","Name","Title","Type","Shares","Price","Value"].map((h,i) => (
                <th key={h} className="font-mono pb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0||i===1||i===2?"left":"right", paddingRight:i===6?0:10 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {transactions.map((t,i) => {
                const isBuy = t.type === "BUY";
                return (
                  <tr key={i} style={{ borderTop:"1px solid rgba(99,110,123,0.08)" }}>
                    <td className="font-mono py-1.5" style={{ color:"#484f58", fontSize:9, paddingRight:10 }}>{t.date}</td>
                    <td className="font-mono py-1.5" style={{ color:"#e6edf3", fontSize:10, paddingRight:10 }}>{t.name}</td>
                    <td className="font-mono py-1.5" style={{ color:"#7d8590", fontSize:9, paddingRight:10 }}>{t.title}</td>
                    <td className="font-mono py-1.5 text-right" style={{ paddingRight:10 }}>
                      <span style={{ background:isBuy?"rgba(63,185,80,0.12)":"rgba(248,81,73,0.10)", color:isBuy?"#3fb950":"#f85149", borderRadius:20, padding:"2px 8px", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" }}>
                        {t.type}
                      </span>
                    </td>
                    <td className="font-mono py-1.5 text-right" style={{ color:"#8b949e", fontSize:10, paddingRight:10 }}>{t.shares.toLocaleString()}</td>
                    <td className="font-mono py-1.5 text-right" style={{ color:"#8b949e", fontSize:10, paddingRight:10 }}>${fmtN(t.price)}</td>
                    <td className="font-mono py-1.5 text-right" style={{ color: isBuy?"#3fb950":"#f85149", fontSize:10, fontWeight:"bold" }}>${t.value}M</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Institutional holders */}
        <div style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.16)", borderRadius:10, padding:14 }}>
          <div className="font-mono mb-3" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.09em" }}>
            Top Institutional Holders
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["Institution","Shares Held","% Owned","QoQ Change"].map((h,i) => (
                <th key={h} className="font-mono pb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right", paddingRight:i===3?0:14 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {institutionalHolders.map((h,i) => {
                const chgColor = h.changePct > 0 ? "#3fb950" : h.changePct < 0 ? "#f85149" : "#484f58";
                const chgStr = h.changePct === 0 ? "—" : (h.changePct > 0 ? "▲ +" : "▼ ") + h.changePct.toFixed(1) + "%";
                return (
                  <tr key={i} style={{ borderTop:"1px solid rgba(99,110,123,0.08)" }}>
                    <td className="font-mono py-1.5" style={{ color:"#e6edf3", fontSize:10, paddingRight:14 }}>{h.name}</td>
                    <td className="font-mono py-1.5 text-right" style={{ color:"#8b949e", fontSize:10, paddingRight:14 }}>{h.shares}</td>
                    <td className="font-mono py-1.5 text-right" style={{ color:"#7d8590", fontSize:10, paddingRight:14 }}>{h.pctOwned.toFixed(2)}%</td>
                    <td className="font-mono py-1.5 text-right" style={{ color:chgColor, fontSize:10, fontWeight: h.changePct!==0?"bold":"normal" }}>{chgStr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Tab renderers ─────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div>
      {/* Company info strip */}
      {profile && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {profile.logo && <img src={profile.logo} alt="" style={{ height:20, width:20, objectFit:"contain", borderRadius:6, background:"#161b22", padding:2 }} />}
          {profile.finnhubIndustry && <span className="font-mono" style={{ color:"#7d8590", fontSize:10 }}>{profile.finnhubIndustry}</span>}
          {profile.exchange         && <span className="font-mono" style={{ color:"#484f58", fontSize:10 }}>· {profile.exchange}</span>}
          {profile.country          && <span className="font-mono" style={{ color:"#484f58", fontSize:10 }}>· {profile.country}</span>}
          {profile.weburl && <a href={profile.weburl} target="_blank" rel="noopener noreferrer" className="font-mono ml-auto" style={{ color:"#1f6feb", fontSize:10 }}>{profile.weburl.replace(/^https?:\/\//,"").replace(/\/$/,"")}</a>}
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns:"1fr 300px" }}>
        {/* Left: price + chart + 52w */}
        <div>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:30 }}>${fmt.price(quote?.c)}</span>
            <span className="font-mono" style={{ color:priceColor, fontSize:14 }}>
              {quote?.d != null ? fmt.change(quote.d) : ""} ({fmt.pct(quote?.dp || 0)})
            </span>
          </div>

          {/* 1Y chart with 50MA */}
          {chartData.length > 0 && (
            <div style={{ height:220, marginBottom:10 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top:4, right:2, bottom:0, left:0 }}>
                  <defs>
                    <linearGradient id={"eqg_" + item.ticker.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={priceColor} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={priceColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t"
                    tickFormatter={t => { const d = new Date(t*1000); return (d.getMonth()+1)+"/"+(d.getDate()); }}
                    tick={{ fill:"#484f58", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" }} tickLine={false} axisLine={false} interval={35} />
                  <YAxis domain={["auto","auto"]} hide />
                  <Tooltip
                    contentStyle={{ background:"#1c2230", border:"1px solid rgba(99,110,123,0.28)", borderRadius:10, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}
                    labelFormatter={t => new Date(t*1000).toLocaleDateString()}
                    formatter={(v,n) => [v != null ? "$"+v.toFixed(2) : "—", n==="v" ? "Price" : "MA 50"]} />
                  <Area type="monotone" dataKey="v" stroke={priceColor} strokeWidth={1.5} fill={"url(#eqg_"+item.ticker.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="ma50" stroke="#e3b341" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 52-week range bar */}
          {pct52 != null && (
            <div className="mb-3">
              <div className="flex justify-between font-mono mb-1.5" style={{ color:"#484f58", fontSize:9 }}>
                <span>52W LOW ${fmtN(m["52WeekLow"])}</span>
                <span style={{ color:"#7d8590" }}>52-WEEK RANGE</span>
                <span>${fmtN(m["52WeekHigh"])} 52W HIGH</span>
              </div>
              <div style={{ position:"relative", height:4, background:"#21262d", borderRadius:2 }}>
                <div style={{ position:"absolute", left:0, width:pct52+"%", height:"100%", background: pct52>70?"#3fb950":pct52<30?"#f85149":"#e3b341", borderRadius:2 }} />
                <div style={{ position:"absolute", left:pct52+"%", top:-3, width:2, height:10, background:"#e6edf3", borderRadius:1, transform:"translateX(-50%)" }} />
              </div>
            </div>
          )}

          {/* Company description */}
          {profile?.description && (
            <div className="mt-2">
              <div className="font-mono mb-1" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>About</div>
              <p className="font-mono" style={{ color:"#7d8590", fontSize:10, lineHeight:1.7, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                {profile.description}
              </p>
            </div>
          )}
        </div>

        {/* Right: key stats */}
        <div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Key Statistics</div>
          <div style={{ borderTop:"1px solid rgba(99,110,123,0.12)" }}>
            {[
              ["Market Cap",      fmtMktCap(m.marketCapitalization)],
              ["P/E (TTM)",       fmtX(m.peBasicExclExtraTTM)],
              ["P/E (Norm.)",     fmtX(m.peNormalizedAnnual)],
              ["EV/EBITDA",       fmtX(m.evEbitdaTTM)],
              ["Price/Book",      fmtX(m.pbAnnual)],
              ["Price/Sales",     fmtX(m.psAnnual)],
              ["EPS (TTM)",       m.epsBasicExclExtraItemsTTM != null ? "$"+fmtN(m.epsBasicExclExtraItemsTTM) : "—"],
              ["Div Yield",       m.dividendYieldIndicatedAnnual != null ? fmtMgn(m.dividendYieldIndicatedAnnual) : "—"],
              ["Beta",            fmtN(m.beta)],
              ["Gross Margin",    fmtMgn(m.grossMarginTTM)],
              ["Net Margin",      fmtMgn(m.netMarginTTM)],
              ["ROE",             fmtMgn(m.roeTTM)],
              ["Volume",          quote?.v != null ? fmt.volume(quote.v) : "—"],
              ["Avg Vol (10D)",   m["10DayAverageTradingVolume"] != null ? (m["10DayAverageTradingVolume"]).toFixed(2)+"M" : "—"],
              ["Shares Out.",     m.shareOutstanding != null ? fmtMktCap(m.shareOutstanding) : "—"],
            ].map(([k,v]) => (
              <div key={k} className="flex justify-between py-1.5 font-mono" style={{ borderBottom:"1px solid rgba(99,110,123,0.07)" }}>
                <span style={{ color:"#7d8590", fontSize:10 }}>{k}</span>
                <span style={{ color:"#e6edf3", fontSize:10 }}>{v || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3"><RelatedLinks itemId={item.id} onOpen={onOpen} /></div>
    </div>
  );

  const renderFinancials = () => (
    <div>
      {/* Profitability + Returns */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns:"1fr 1fr" }}>
        <div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Profitability</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["","Annual","TTM"].map((h,i) => (
                <th key={h} className="font-mono pb-1" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {[
                ["Gross Margin",    m.grossMarginAnnual,    m.grossMarginTTM],
                ["Operating Margin",m.operatingMarginAnnual,m.operatingMarginTTM],
                ["Net Margin",      m.netMarginAnnual,      m.netMarginTTM],
                ["Pretax Margin",   m.pretaxMarginAnnual,   m.pretaxMarginTTM],
              ].map(([k,ann,ttm]) => (
                <tr key={k} style={{ borderTop:"1px solid #161b22" }}>
                  <td className="font-mono py-1.5" style={{ color:"#7d8590", fontSize:10 }}>{k}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:clrM(ann), fontSize:10 }}>{fmtMgn(ann)}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:clrM(ttm), fontSize:10 }}>{fmtMgn(ttm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Returns &amp; Efficiency</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["","Annual","TTM"].map((h,i) => (
                <th key={h} className="font-mono pb-1" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {[
                ["ROE",            m.roeRfy,   m.roeTTM],
                ["ROA",            m.roaRfy,   m.roaTTM],
                ["ROIC",           m.roiAnnual,m.roiTTM],
                ["Asset Turnover", m.assetTurnoverAnnual, m.assetTurnoverTTM],
                ["Inv. Turnover",  m.inventoryTurnoverAnnual, m.inventoryTurnoverTTM],
              ].map(([k,ann,ttm]) => (
                <tr key={k} style={{ borderTop:"1px solid #161b22" }}>
                  <td className="font-mono py-1.5" style={{ color:"#7d8590", fontSize:10 }}>{k}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:clrM(ann), fontSize:10 }}>{fmtMgn(ann)}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:clrM(ttm), fontSize:10 }}>{fmtMgn(ttm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Growth + Balance Sheet */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns:"1fr 1fr" }}>
        <div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Growth</div>
          {[
            ["Rev Growth (QoQ YoY)", m.revenueGrowthQuarterlyYoy],
            ["Rev Growth (TTM YoY)", m.revenueGrowthTTMYoy],
            ["Rev Growth (3Y CAGR)", m.revenueGrowth3Y],
            ["Rev Growth (5Y CAGR)", m.revenueGrowth5Y],
            ["EPS Growth (QoQ YoY)", m.epsGrowthQuarterlyYoy],
            ["EPS Growth (TTM YoY)", m.epsGrowthTTMYoy],
            ["EPS Growth (3Y CAGR)", m.epsGrowth3Y],
            ["EPS Growth (5Y CAGR)", m.epsGrowth5Y],
          ].map(([k,v]) => (
            <div key={k} className="flex justify-between py-1.5 font-mono" style={{ borderBottom:"1px solid rgba(99,110,123,0.07)" }}>
              <span style={{ color:"#7d8590", fontSize:10 }}>{k}</span>
              <span style={{ color:clrM(v), fontSize:10 }}>{fmtGr(v)}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Balance Sheet</div>
          {[
            ["Current Ratio",     fmtN(m.currentRatioAnnual)],
            ["Quick Ratio",       fmtN(m.quickRatioAnnual)],
            ["Debt/Equity",       fmtN(m["totalDebt/totalEquityAnnual"])],
            ["LT Debt/Equity",    fmtN(m["longTermDebt/equityAnnual"])],
            ["Book Value/Share",  m.bookValuePerShareAnnual != null ? "$"+fmtN(m.bookValuePerShareAnnual) : "—"],
            ["Cash/Share",        m.cashPerSharePerShareAnnual != null ? "$"+fmtN(m.cashPerSharePerShareAnnual) : "—"],
            ["FCF/Share (TTM)",   m.freeCashFlowPerShareTTM != null ? "$"+fmtN(m.freeCashFlowPerShareTTM) : "—"],
            ["Net Int. Coverage", fmtN(m.netInterestCoverageAnnual)],
          ].map(([k,v]) => (
            <div key={k} className="flex justify-between py-1.5 font-mono" style={{ borderBottom:"1px solid rgba(99,110,123,0.07)" }}>
              <span style={{ color:"#7d8590", fontSize:10 }}>{k}</span>
              <span style={{ color:"#e6edf3", fontSize:10 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Earnings history */}
      {earnings === null ? (
        <div className="font-mono" style={{ color:"#7d8590", fontSize:10 }}>Loading earnings history…</div>
      ) : earnings.length > 0 ? (
        <div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Earnings History (Reported)</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:560 }}>
              <thead>
                <tr>{["Quarter","Date","EPS Actual","EPS Est.","Surprise","Rev Actual","Rev Est."].map((h,i) => (
                  <th key={h} className="font-mono pb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right", paddingRight:i===6?0:8 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {earnings.map((e,i) => {
                  const surp = e.epsActual != null && e.epsEstimate ? ((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate)) * 100 : null;
                  return (
                    <tr key={i} style={{ borderTop:"1px solid #161b22" }}>
                      <td className="font-mono py-1.5" style={{ color:"#7d8590", fontSize:10 }}>Q{e.quarter} {e.year}</td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"#484f58", fontSize:10, paddingRight:8 }}>{e.date}</td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:8 }}>${fmtN(e.epsActual)}</td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"#7d8590", fontSize:10, paddingRight:8 }}>${fmtN(e.epsEstimate)}</td>
                      <td className="font-mono py-1.5 text-right" style={{ color: surp != null ? clr(surp) : "#484f58", fontSize:10, paddingRight:8 }}>
                        {surp != null ? (surp>=0?"+":"")+surp.toFixed(1)+"%" : "—"}
                      </td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:8 }}>
                        {e.revenueActual != null ? "$"+(e.revenueActual/1e9).toFixed(2)+"B" : "—"}
                      </td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"#7d8590", fontSize:10 }}>
                        {e.revenueEstimate != null ? "$"+(e.revenueEstimate/1e9).toFixed(2)+"B" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderValuation = () => {
    const latestRec = recs?.[0];
    const total = latestRec ? latestRec.strongBuy + latestRec.buy + latestRec.hold + latestRec.sell + latestRec.strongSell : 0;
    const segments = latestRec ? [
      { label:"Strong Buy", v:latestRec.strongBuy,   color:"#3fb950" },
      { label:"Buy",        v:latestRec.buy,          color:"#7ee787" },
      { label:"Hold",       v:latestRec.hold,         color:"#e3b341" },
      { label:"Sell",       v:latestRec.sell,         color:"#ffa198" },
      { label:"Strong Sell",v:latestRec.strongSell,   color:"#f85149" },
    ] : [];
    const ptLow = pt?.targetLow, ptMean = pt?.targetMean, ptHigh = pt?.targetHigh, ptMed = pt?.targetMedian;
    const cur = quote?.c;
    const ptBarPct = ptLow && ptHigh && cur ? Math.min(100, Math.max(0, ((cur-ptLow)/(ptHigh-ptLow))*100)) : null;
    const meanBarPct = ptLow && ptHigh && ptMean ? ((ptMean-ptLow)/(ptHigh-ptLow))*100 : null;
    const upside = ptMean && cur ? ((ptMean-cur)/cur)*100 : null;
    return (
      <div className="grid gap-4" style={{ gridTemplateColumns:"1fr 1fr" }}>
        {/* Multiples */}
        <div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Valuation Multiples</div>
          {[
            ["P/E (TTM)",          fmtX(m.peBasicExclExtraTTM)],
            ["P/E (Normalized)",   fmtX(m.peNormalizedAnnual)],
            ["EV/EBITDA (Annual)", fmtX(m.evEbitdaAnnual)],
            ["EV/EBITDA (TTM)",    fmtX(m.evEbitdaTTM)],
            ["Price/Sales (Ann.)", fmtX(m.psAnnual)],
            ["Price/Sales (TTM)",  fmtX(m.psTTM)],
            ["Price/Book (Ann.)",  fmtX(m.pbAnnual)],
            ["Price/FCF (Ann.)",   fmtX(m.pfcfShareAnnual)],
            ["Price/FCF (TTM)",    fmtX(m.pfcfShareTTM)],
            ["Price/Cash Flow",    fmtX(m.pcfShareTTM)],
            ["EV/FCF (Ann.)",      fmtX(m["currentEv/freeCashFlowAnnual"])],
            ["EV/FCF (TTM)",       fmtX(m["currentEv/freeCashFlowTTM"])],
          ].map(([k,v]) => (
            <div key={k} className="flex justify-between py-1.5 font-mono" style={{ borderBottom:"1px solid rgba(99,110,123,0.07)" }}>
              <span style={{ color:"#7d8590", fontSize:10 }}>{k}</span>
              <span style={{ color:"#e6edf3", fontSize:10 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Analyst ratings + PT */}
        <div>
          {recs === null ? (
            <div className="font-mono" style={{ color:"#7d8590", fontSize:10 }}>Loading analyst data…</div>
          ) : latestRec ? (
            <div className="mb-4">
              <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                Analyst Consensus · {latestRec.period?.slice(0,7)} · {total} analysts
              </div>
              {/* Stacked bar */}
              <div style={{ display:"flex", height:14, borderRadius:2, overflow:"hidden", marginBottom:8 }}>
                {segments.filter(s=>s.v>0).map(s => (
                  <div key={s.label} style={{ flex:s.v, background:s.color }} title={s.label+": "+s.v} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {segments.map(s => (
                  <div key={s.label} className="flex items-center gap-1 font-mono" style={{ fontSize:10 }}>
                    <div style={{ width:7, height:7, borderRadius:1, background:s.color, flexShrink:0 }} />
                    <span style={{ color:"#7d8590" }}>{s.label}</span>
                    <span style={{ color:"#e6edf3", fontWeight:"bold" }}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="font-mono mb-4" style={{ color:"#484f58", fontSize:10 }}>No analyst ratings available</div>
          )}

          {/* Price Target */}
          {pt && cur ? (
            <div>
              <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Analyst Price Target</div>
              {upside != null && (
                <div className="font-mono mb-2" style={{ color:clrM(upside), fontSize:13 }}>
                  {upside>=0?"▲":"▼"} {Math.abs(upside).toFixed(1)}% to mean target
                </div>
              )}
              {/* PT range bar */}
              <div className="flex justify-between font-mono mb-1" style={{ fontSize:9, color:"#484f58" }}>
                <span>Low ${fmtN(ptLow)}</span>
                <span>High ${fmtN(ptHigh)}</span>
              </div>
              <div style={{ position:"relative", height:6, background:"#21262d", borderRadius:6, marginBottom:10 }}>
                {ptBarPct != null && (
                  <div style={{ position:"absolute", left:ptBarPct+"%", top:-4, width:12, height:14, borderRadius:2, background:"#58a6ff", transform:"translateX(-50%)", border:"2px solid #010409", zIndex:2 }} title={"Current: $"+fmt.price(cur)} />
                )}
                {meanBarPct != null && (
                  <div style={{ position:"absolute", left:meanBarPct+"%", top:-5, width:2, height:16, background:"#e3b341", transform:"translateX(-50%)", zIndex:1 }} title={"Mean: $"+fmtN(ptMean)} />
                )}
              </div>
              <div className="grid" style={{ gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"4px 0" }}>
                {[["Low","$"+fmtN(ptLow)],["Mean","$"+fmtN(ptMean)],["Median","$"+fmtN(ptMed)],["High","$"+fmtN(ptHigh)]].map(([l,v]) => (
                  <div key={l} className="font-mono">
                    <div style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>{l}</div>
                    <div style={{ color:"#e6edf3", fontSize:12 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : pt === null && recs !== null ? (
            <div className="font-mono" style={{ color:"#484f58", fontSize:10 }}>No price target available</div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderNews = () => {
    if (news === null) return <div className="font-mono" style={{ color:"#7d8590", fontSize:10 }}>Loading news…</div>;
    if (!news.length) return <div className="font-mono" style={{ color:"#484f58", fontSize:10 }}>No recent news found</div>;
    return (
      <div className="flex flex-col gap-2">
        {news.map((n,i) => {
          const ts = n.datetime ? new Date(n.datetime*1000) : null;
          const dAgo = ts ? Math.floor((Date.now()-ts)/86400000) : null;
          const timeStr = dAgo===0?"Today":dAgo===1?"Yesterday":dAgo!=null?dAgo+"d ago":"";
          return (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none" }}>
              <div className="p-3" style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:4 }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(99,110,123,0.40)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#21262d"}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <span className="font-mono" style={{ color:"#e6edf3", fontSize:11, lineHeight:1.5 }}>{n.headline}</span>
                  <span className="font-mono flex-shrink-0" style={{ color:"#484f58", fontSize:9 }}>{timeStr}</span>
                </div>
                <div className="flex items-center gap-2">
                  {n.source   && <span className="font-mono" style={{ color:"#58a6ff", fontSize:9 }}>{n.source}</span>}
                  {n.category && <span className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>{n.category}</span>}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    );
  };

  const renderPeers = () => {
    const allRows = [
      { ticker:item.ticker, q:quote,  pm:metrics || {}, isSelf:true },
      ...(peers||[]).map(p => ({ ticker:p, q:peerQ[p]||null, pm:peerM[p]||{}, isSelf:false })),
    ];
    if (peers === null) return <div className="font-mono" style={{ color:"#7d8590", fontSize:10 }}>Loading peers…</div>;
    if (!peers.length && allRows.length === 1) return <div className="font-mono" style={{ color:"#484f58", fontSize:10 }}>No peer data available</div>;
    const cols = ["Ticker","Price","Day %","Mkt Cap","P/E","EV/EBITDA","P/S","Gross Mgn","Net Mgn","ROE","Rev Grw"];
    return (
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:800 }}>
          <thead>
            <tr>{cols.map((h,i) => (
              <th key={h} className="font-mono pb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right", paddingRight:i===cols.length-1?0:10, whiteSpace:"nowrap" }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {allRows.map(({ ticker, q, pm, isSelf }) => (
              <tr key={ticker} style={{ borderTop:"1px solid rgba(99,110,123,0.12)", background:isSelf?"#0d1117":"transparent" }}>
                <td className="font-mono py-2" style={{ color:isSelf?"#58a6ff":"#e6edf3", fontSize:11, fontWeight:isSelf?"bold":"normal" }}>
                  {ticker}
                  {!isSelf && <button onClick={()=>onOpen({id:ticker,label:ticker,type:"equity",ticker,category:"Equities"})}
                    className="font-mono ml-2" style={{ color:"#1f6feb", background:"none", border:"none", cursor:"pointer", fontSize:9 }}>→</button>}
                </td>
                <td className="font-mono py-2 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:10 }}>{q?.c!=null?"$"+fmt.price(q.c):"—"}</td>
                <td className="font-mono py-2 text-right" style={{ color:clr(q?.dp||0), fontSize:10, paddingRight:10 }}>{q?.dp!=null?fmt.pct(q.dp):"—"}</td>
                <td className="font-mono py-2 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:10 }}>{fmtMktCap(pm.marketCapitalization)}</td>
                <td className="font-mono py-2 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:10 }}>{fmtX(pm.peBasicExclExtraTTM)}</td>
                <td className="font-mono py-2 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:10 }}>{fmtX(pm.evEbitdaTTM)}</td>
                <td className="font-mono py-2 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:10 }}>{fmtX(pm.psAnnual)}</td>
                <td className="font-mono py-2 text-right" style={{ color:clrM(pm.grossMarginAnnual), fontSize:10, paddingRight:10 }}>{fmtMgn(pm.grossMarginAnnual)}</td>
                <td className="font-mono py-2 text-right" style={{ color:clrM(pm.netMarginAnnual), fontSize:10, paddingRight:10 }}>{fmtMgn(pm.netMarginAnnual)}</td>
                <td className="font-mono py-2 text-right" style={{ color:clrM(pm.roeRfy), fontSize:10, paddingRight:10 }}>{fmtMgn(pm.roeRfy)}</td>
                <td className="font-mono py-2 text-right" style={{ color:clr(pm.revenueGrowthQuarterlyYoy||0), fontSize:10 }}>{fmtGr(pm.revenueGrowthQuarterlyYoy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="terminal-panel terminal-glow flex flex-col" style={{ minHeight:520 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-0" style={{ borderBottom:"1px solid rgba(99,110,123,0.12)", flexShrink:0 }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:15 }}>{item.ticker}</span>
          <span className="font-mono" style={{ color:"#7d8590", fontSize:12 }}>{profile?.name || item.label}</span>
          <span className="font-mono" style={{ background:"#21262d", border:"1px solid #30363d", borderRadius:6, padding:"1px 6px", fontSize:9, color:"#58a6ff", textTransform:"uppercase" }}>Equity</span>
          {loadingBase && <span className="font-mono" style={{ color:"#484f58", fontSize:9 }}>Loading…</span>}
        </div>
        <button onClick={onClose} style={{ color:"#7d8590", background:"none", border:"none", cursor:"pointer", fontSize:14, marginLeft:8 }}>✕</button>
      </div>
      {/* Tab nav */}
      <div className="flex px-4" style={{ borderBottom:"1px solid rgba(99,110,123,0.12)", flexShrink:0, overflowX:"auto" }}>
        {TABS.map(t => {
          const isNew = t === "Flow" || t === "Options" || t === "Insiders";
          return (
            <button key={t} onClick={() => setActiveTab(t)} className="font-mono"
              style={{ background:"none", border:"none", borderBottom:activeTab===t?"2px solid #58a6ff":"2px solid transparent",
                color:activeTab===t?"#e6edf3":"#7d8590", fontSize:11, padding:"8px 12px", cursor:"pointer", transition:"color 0.15s",
                whiteSpace:"nowrap", flexShrink:0, position:"relative" }}>
              {t}
              {isNew && activeTab!==t && (
                <span style={{ position:"absolute", top:6, right:3, width:5, height:5, background:"#58a6ff", borderRadius:"50%" }} />
              )}
            </button>
          );
        })}
      </div>
      {/* Content */}
      <div className="flex-1 p-4" style={{ overflowY:"auto" }}>
        {loadingBase
          ? <div className="flex items-center justify-center font-mono" style={{ height:200, color:"#7d8590", fontSize:11 }}>Loading…</div>
          : activeTab==="Overview"   ? renderOverview()
          : activeTab==="Flow"       ? renderFlow()
          : activeTab==="Options"    ? renderOptions()
          : activeTab==="Insiders"   ? renderInsiders()
          : activeTab==="Financials" ? renderFinancials()
          : activeTab==="Valuation"  ? renderValuation()
          : activeTab==="News"       ? renderNews()
          : activeTab==="Peers"      ? renderPeers()
          : null}
      </div>
    </div>
  );
}

function IntelCard({ intel, accentColor = "#e3b341" }) {
  if (!intel) return null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="font-mono mb-1" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>What It Is</div>
        <p className="font-mono" style={{ color:"#c9d1d9", fontSize:11, lineHeight:1.7 }}>{intel.whatItIs}</p>
      </div>
      <div>
        <div className="font-mono mb-1" style={{ color:accentColor, fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Why It Matters</div>
        <p className="font-mono" style={{ color:"#c9d1d9", fontSize:11, lineHeight:1.7 }}>{intel.whyItMatters}</p>
      </div>
      <div>
        <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Key Drivers</div>
        <div className="flex flex-col gap-1">
          {intel.drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-mono flex-shrink-0" style={{ color:accentColor, fontSize:10 }}>▸</span>
              <span className="font-mono" style={{ color:"#8b949e", fontSize:10, lineHeight:1.6 }}>{d}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Market Relationships</div>
        <div className="flex flex-col gap-1">
          {intel.relationships.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-mono flex-shrink-0" style={{ color:"#58a6ff", fontSize:10 }}>↔</span>
              <span className="font-mono" style={{ color:"#8b949e", fontSize:10, lineHeight:1.6 }}>{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResearchTabBar({ tabs, active, onSelect }) {
  return (
    <div className="flex gap-1 mb-3" style={{ borderBottom:"1px solid rgba(99,110,123,0.12)", paddingBottom:8, flexShrink:0 }}>
      {tabs.map(tab => (
        <button key={tab} onClick={() => onSelect(tab)} className="font-mono"
          style={{ background: active===tab ? "#21262d" : "transparent", border:"none", cursor:"pointer", padding:"2px 10px", fontSize:10, borderRadius:6, color: active===tab ? "#e6edf3" : "#7d8590" }}>
          {tab}
        </button>
      ))}
    </div>
  );
}

function CommodityResearchPanel({ item, onClose, onOpen }) {
  const TABS = ["Overview","Intelligence","Producers"];
  const [activeTab, setActiveTab] = useState("Overview");
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const intel = ENTITY_INTEL[item.id];

  useEffect(() => {
    setLoading(true); setChartData([]); setSummary(null); setActiveTab("Overview");
    fetch("/api/chart?ticker=" + encodeURIComponent(item.ticker) + "&range=1y&interval=1d")
      .then(r => r.json())
      .then(c => {
        const result = c?.chart?.result?.[0];
        if (result) {
          const ts     = result.timestamp || [];
          const closes = result.indicators?.quote?.[0]?.close || [];
          const data   = ts.map((t, i) => ({ t, v: closes[i] != null ? +closes[i].toFixed(4) : null })).filter(d => d.v != null);
          setChartData(data);
          if (data.length >= 2) {
            const cur = data[data.length - 1].v, prev = data[data.length - 2].v;
            const m1 = data[Math.max(0, data.length - 22)].v;
            const m3 = data[Math.max(0, data.length - 66)].v;
            const hi52 = Math.max(...data.map(d => d.v)), lo52 = Math.min(...data.map(d => d.v));
            setSummary({ cur, prev, dayPct:((cur-prev)/prev)*100, m1Pct:((cur-m1)/m1)*100, m3Pct:((cur-m3)/m3)*100, ytdPct:((cur-data[0].v)/data[0].v)*100, hi52, lo52 });
          }
        }
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [item.ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  const dp = 2;
  const priceColor = summary ? (summary.dayPct >= 0 ? "#3fb950" : "#f85149") : "#e3b341";
  const pct52 = summary ? Math.min(100, Math.max(0, ((summary.cur - summary.lo52) / (summary.hi52 - summary.lo52)) * 100)) : null;

  const renderOverview = () => loading ? (
    <div className="flex items-center justify-center py-8 font-mono" style={{ color:"#7d8590" }}>Loading…</div>
  ) : (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <span className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:26 }}>${summary?.cur.toLocaleString("en-US",{minimumFractionDigits:dp,maximumFractionDigits:dp})||"—"}</span>
          {intel?.unit && <span className="font-mono ml-2" style={{ color:"#484f58", fontSize:10 }}>per {intel.unit.split("/")[1]||intel.unit}</span>}
        </div>
        <div className="text-right">
          {summary && <div className="font-mono" style={{ color:clr(summary.dayPct), fontSize:13 }}>Day {fmt.pct(summary.dayPct)}</div>}
          {summary && <div className="font-mono" style={{ color:clr(summary.m1Pct), fontSize:10 }}>1M {fmt.pct(summary.m1Pct)}</div>}
        </div>
      </div>

      {chartData.length > 0 && (
        <div style={{ height:190, marginBottom:12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top:4, right:2, bottom:0, left:0 }}>
              <defs>
                <linearGradient id={"cmg_"+item.id.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={priceColor} stopOpacity={0.22}/>
                  <stop offset="95%" stopColor={priceColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tickFormatter={t=>{const d=new Date(t*1000);return(d.getMonth()+1)+"/"+d.getDate();}} tick={{fill:"#484f58",fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}} tickLine={false} axisLine={false} interval={35}/>
              <YAxis domain={["auto","auto"]} hide/>
              <Tooltip contentStyle={{background:"#1c2230",border:"1px solid rgba(99,110,123,0.28)",borderRadius:10,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}} labelFormatter={t=>new Date(t*1000).toLocaleDateString()} formatter={v=>["$"+v?.toFixed(dp),"Price"]}/>
              <Area type="monotone" dataKey="v" stroke={priceColor} strokeWidth={1.5} fill={"url(#cmg_"+item.id.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {pct52 != null && (
        <div className="mb-4">
          <div className="flex justify-between font-mono mb-1" style={{ color:"#484f58", fontSize:9 }}>
            <span>52W LOW ${summary.lo52.toFixed(dp)}</span>
            <span style={{ color:"#7d8590" }}>52-WEEK RANGE</span>
            <span>${summary.hi52.toFixed(dp)} 52W HIGH</span>
          </div>
          <div style={{ position:"relative", height:4, background:"#21262d", borderRadius:2 }}>
            <div style={{ position:"absolute", left:0, width:pct52+"%", height:"100%", background:pct52>70?"#3fb950":pct52<30?"#f85149":"#e3b341", borderRadius:2 }}/>
            <div style={{ position:"absolute", left:pct52+"%", top:-3, width:2, height:10, background:"#e6edf3", borderRadius:1, transform:"translateX(-50%)" }}/>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid mb-4" style={{ gridTemplateColumns:"repeat(4,1fr)", gap:"4px 8px" }}>
          {[["1D",summary.dayPct],["1M",summary.m1Pct],["3M",summary.m3Pct],["YTD",summary.ytdPct]].map(([label,val])=>(
            <div key={label} style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:10, padding:"6px 8px" }}>
              <div className="font-mono" style={{ color:"#484f58", fontSize:9 }}>{label}</div>
              <div className="font-mono font-bold" style={{ color:clr(val), fontSize:13 }}>{fmt.pct(val)}</div>
            </div>
          ))}
        </div>
      )}
      <RelatedLinks itemId={item.id} onOpen={onOpen}/>
    </div>
  );

  const renderProducers = () => !intel?.producers ? (
    <div className="font-mono py-4" style={{ color:"#484f58" }}>No producer data available.</div>
  ) : (
    <div>
      <div className="font-mono mb-3" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Key Producers / Supply Sources</div>
      <div style={{ borderTop:"1px solid rgba(99,110,123,0.12)" }}>
        {intel.producers.map((p,i) => (
          <div key={i} className="flex items-start justify-between py-2.5" style={{ borderBottom:"1px solid rgba(99,110,123,0.07)" }}>
            <div>
              <div className="font-mono" style={{ color:"#e6edf3", fontSize:11 }}>{p.name}</div>
              <div className="font-mono" style={{ color:"#7d8590", fontSize:9 }}>{p.note}</div>
            </div>
            <div className="font-mono" style={{ color:"#e3b341", fontSize:11 }}>{p.share}</div>
          </div>
        ))}
      </div>
      <RelatedLinks itemId={item.id} onOpen={onOpen}/>
    </div>
  );

  return (
    <ResearchPanelShell title={item.label} subtitle={item.ticker} badge="Commodity" onClose={onClose}>
      <ResearchTabBar tabs={TABS} active={activeTab} onSelect={setActiveTab}/>
      {activeTab === "Overview"      && renderOverview()}
      {activeTab === "Intelligence"  && <div>{intel ? <IntelCard intel={intel} accentColor="#e3b341"/> : <div className="font-mono py-4" style={{color:"#484f58"}}>No data.</div>}<div className="mt-4"><RelatedLinks itemId={item.id} onOpen={onOpen}/></div></div>}
      {activeTab === "Producers"     && renderProducers()}
    </ResearchPanelShell>
  );
}

function FXResearchPanel({ item, onClose, onOpen }) {
  const TABS = ["Overview","Rate Differential","Intelligence"];
  const [activeTab, setActiveTab] = useState("Overview");
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [rateData, setRateData]   = useState({ base:[], quote:[] });
  const [rateLoading, setRateLoading] = useState(false);
  const loadedTabs = useRef(new Set(["Overview"]));
  const intel = ENTITY_INTEL[item.id];
  const pair  = FX_RATE_PAIRS[item.id];

  useEffect(() => {
    setLoading(true); setChartData([]); setSummary(null);
    setActiveTab("Overview"); loadedTabs.current = new Set(["Overview"]);
    fetch("/api/chart?ticker=" + encodeURIComponent(item.ticker) + "&range=1y&interval=1d")
      .then(r => r.json())
      .then(c => {
        const result = c?.chart?.result?.[0];
        if (result) {
          const ts     = result.timestamp || [];
          const closes = result.indicators?.quote?.[0]?.close || [];
          const data   = ts.map((t,i) => ({ t, v: closes[i] != null ? +closes[i].toFixed(4) : null })).filter(d => d.v != null);
          setChartData(data);
          if (data.length >= 2) {
            const cur = data[data.length-1].v, prev = data[data.length-2].v;
            const m1 = data[Math.max(0,data.length-22)].v, m3 = data[Math.max(0,data.length-66)].v;
            const hi52 = Math.max(...data.map(d=>d.v)), lo52 = Math.min(...data.map(d=>d.v));
            setSummary({ cur, prev, dayPct:((cur-prev)/prev)*100, m1Pct:((cur-m1)/m1)*100, m3Pct:((cur-m3)/m3)*100, hi52, lo52 });
          }
        }
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [item.ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loadedTabs.current.has(activeTab)) return;
    loadedTabs.current.add(activeTab);
    if (activeTab === "Rate Differential" && pair) {
      setRateLoading(true);
      Promise.all([
        fetch("/api/fred?series=" + pair.baseSeries).then(r => r.json()),
        pair.quoteSeries ? fetch("/api/fred?series=" + pair.quoteSeries).then(r => r.json()) : Promise.resolve(null),
      ]).then(([baseRaw, quoteRaw]) => {
        const parse = raw => (raw?.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value))).slice(-60).map(o => ({ t:o.date, v:parseFloat(o.value) }));
        setRateData({ base: parse(baseRaw), quote: parse(quoteRaw) });
        setRateLoading(false);
      }).catch(() => setRateLoading(false));
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const dp = 4;
  const priceColor = summary ? (summary.dayPct >= 0 ? "#3fb950" : "#f85149") : "#3fb950";
  const pct52 = summary ? Math.min(100, Math.max(0, ((summary.cur-summary.lo52)/(summary.hi52-summary.lo52))*100)) : null;

  const renderOverview = () => loading ? (
    <div className="flex items-center justify-center py-8 font-mono" style={{ color:"#7d8590" }}>Loading…</div>
  ) : (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:26 }}>{summary?.cur.toLocaleString("en-US",{minimumFractionDigits:dp,maximumFractionDigits:dp})||"—"}</span>
        <div className="text-right">
          {summary && <div className="font-mono" style={{ color:clr(summary.dayPct), fontSize:13 }}>Day {fmt.pct(summary.dayPct)}</div>}
          {summary && <div className="font-mono" style={{ color:clr(summary.m1Pct), fontSize:10 }}>1M {fmt.pct(summary.m1Pct)}</div>}
        </div>
      </div>

      {chartData.length > 0 && (
        <div style={{ height:190, marginBottom:12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top:4, right:2, bottom:0, left:0 }}>
              <defs>
                <linearGradient id={"fxg_"+item.id.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={priceColor} stopOpacity={0.22}/>
                  <stop offset="95%" stopColor={priceColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tickFormatter={t=>{const d=new Date(t*1000);return(d.getMonth()+1)+"/"+d.getDate();}} tick={{fill:"#484f58",fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}} tickLine={false} axisLine={false} interval={35}/>
              <YAxis domain={["auto","auto"]} hide/>
              <Tooltip contentStyle={{background:"#1c2230",border:"1px solid rgba(99,110,123,0.28)",borderRadius:10,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}} labelFormatter={t=>new Date(t*1000).toLocaleDateString()} formatter={v=>[v?.toFixed(dp),"Rate"]}/>
              <Area type="monotone" dataKey="v" stroke={priceColor} strokeWidth={1.5} fill={"url(#fxg_"+item.id.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {pct52 != null && (
        <div className="mb-4">
          <div className="flex justify-between font-mono mb-1" style={{ color:"#484f58", fontSize:9 }}>
            <span>52W LOW {summary.lo52.toFixed(dp)}</span>
            <span style={{ color:"#7d8590" }}>52-WEEK RANGE</span>
            <span>{summary.hi52.toFixed(dp)} 52W HIGH</span>
          </div>
          <div style={{ position:"relative", height:4, background:"#21262d", borderRadius:2 }}>
            <div style={{ position:"absolute", left:0, width:pct52+"%", height:"100%", background:pct52>70?"#3fb950":pct52<30?"#f85149":"#e3b341", borderRadius:2 }}/>
            <div style={{ position:"absolute", left:pct52+"%", top:-3, width:2, height:10, background:"#e6edf3", borderRadius:1, transform:"translateX(-50%)" }}/>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid mb-4" style={{ gridTemplateColumns:"repeat(3,1fr)", gap:"4px 8px" }}>
          {[["1D",summary.dayPct],["1M",summary.m1Pct],["3M",summary.m3Pct]].map(([label,val])=>(
            <div key={label} style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:10, padding:"6px 8px" }}>
              <div className="font-mono" style={{ color:"#484f58", fontSize:9 }}>{label}</div>
              <div className="font-mono font-bold" style={{ color:clr(val), fontSize:13 }}>{fmt.pct(val)}</div>
            </div>
          ))}
        </div>
      )}
      <RelatedLinks itemId={item.id} onOpen={onOpen}/>
    </div>
  );

  const renderRateDiff = () => {
    if (!pair) return <div className="font-mono py-4" style={{ color:"#484f58" }}>Rate differential data not available for this pair.</div>;
    if (rateLoading) return <div className="flex items-center justify-center py-8 font-mono" style={{ color:"#7d8590" }}>Loading rates…</div>;

    const baseLatest  = rateData.base[rateData.base.length-1];
    const quoteLatest = rateData.quote[rateData.quote.length-1];
    const diff = baseLatest && quoteLatest ? +(baseLatest.v - quoteLatest.v).toFixed(2) : null;

    // Build merged differential time series
    const baseMap  = Object.fromEntries(rateData.base.map(d=>[d.t,d.v]));
    const quoteMap = Object.fromEntries(rateData.quote.map(d=>[d.t,d.v]));
    const allDates = [...new Set([...rateData.base.map(d=>d.t),...rateData.quote.map(d=>d.t)])].sort();
    let lb=null, lq=null;
    const diffData = allDates.map(t => {
      if (baseMap[t]!=null)  lb=baseMap[t];
      if (quoteMap[t]!=null) lq=quoteMap[t];
      return { t, base:lb, quote:lq, diff: lb!=null&&lq!=null ? +(lb-lq).toFixed(2) : null };
    }).filter(d=>d.diff!=null).slice(-48);

    return (
      <div>
        <div className="grid mb-4" style={{ gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[{ label:pair.baseLabel, val:baseLatest?.v, color:"#58a6ff", date:baseLatest?.t },
            { label:pair.quoteLabel||"N/A", val:quoteLatest?.v, color:"#e3b341", date:quoteLatest?.t }].map(({label,val,color,date})=>(
            <div key={label} style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:6, padding:"10px 12px" }}>
              <div className="font-mono mb-1" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>{label}</div>
              <div className="font-mono font-bold" style={{ color, fontSize:20 }}>{val!=null?val.toFixed(2)+"%":"—"}</div>
              {date && <div className="font-mono" style={{ color:"#484f58", fontSize:9 }}>as of {date}</div>}
            </div>
          ))}
        </div>

        {diff != null && (
          <div className="mb-4 p-3" style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:6 }}>
            <div className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>Differential (USD minus {pair.quoteCCY})</div>
            <div className="font-mono font-bold" style={{ color:diff>=0?"#58a6ff":"#e3b341", fontSize:20 }}>{diff>=0?"+":""}{diff} pp</div>
            <div className="font-mono mt-0.5" style={{ color:"#7d8590", fontSize:10 }}>
              {diff>1?"USD yield premium — supports USD strength":diff<-1?"Foreign yield premium — USD headwind":"Rates near parity"}
            </div>
          </div>
        )}

        {diffData.length > 0 && (
          <div>
            <div className="font-mono mb-1" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>Rate Differential Over Time</div>
            <div style={{ height:150, marginBottom:12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={diffData} margin={{ top:4, right:2, bottom:0, left:0 }}>
                  <defs>
                    <linearGradient id={"rdg_"+item.id.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#58a6ff" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#58a6ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{fill:"#484f58",fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}} tickLine={false} axisLine={false} interval={11}/>
                  <YAxis domain={["auto","auto"]} hide/>
                  <ReferenceLine y={0} stroke="#30363d" strokeDasharray="3 3"/>
                  <Tooltip contentStyle={{background:"#1c2230",border:"1px solid rgba(99,110,123,0.28)",borderRadius:10,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}} formatter={v=>[v?.toFixed(2)+"pp","Differential"]}/>
                  <Area type="monotone" dataKey="diff" stroke="#58a6ff" strokeWidth={1.5} fill={"url(#rdg_"+item.id.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <RelatedLinks itemId={item.id} onOpen={onOpen}/>
      </div>
    );
  };

  return (
    <ResearchPanelShell title={item.label} subtitle={item.ticker} badge="FX" onClose={onClose}>
      <ResearchTabBar tabs={TABS} active={activeTab} onSelect={setActiveTab}/>
      {activeTab === "Overview"          && renderOverview()}
      {activeTab === "Rate Differential" && renderRateDiff()}
      {activeTab === "Intelligence"      && <div>{intel ? <IntelCard intel={intel} accentColor="#3fb950"/> : <div className="font-mono py-4" style={{color:"#484f58"}}>No data.</div>}<div className="mt-4"><RelatedLinks itemId={item.id} onOpen={onOpen}/></div></div>}
    </ResearchPanelShell>
  );
}

function MacroResearchPanel({ item, onClose, onOpen }) {
  const TABS = ["Chart","Context"];
  const [activeTab, setActiveTab] = useState("Chart");
  const [data, setData]   = useState([]);
  const [loading, setLoading] = useState(true);
  const intel = ENTITY_INTEL[item.id];

  useEffect(() => {
    setLoading(true); setActiveTab("Chart");
    fetch("/api/fred?series=" + item.series)
      .then(r => r.json())
      .then(d => {
        const obs = (d.observations || [])
          .filter(o => o.value !== "." && !isNaN(parseFloat(o.value)))
          .slice(-60)
          .map(o => ({ t: o.date, v: parseFloat(o.value) }));
        setData(obs);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [item.series]); // eslint-disable-line react-hooks/exhaustive-deps

  const latest  = data[data.length - 1];
  const prev    = data[data.length - 2];
  const yearAgo = data[Math.max(0, data.length - 13)];
  const yoyPct  = latest && yearAgo && yearAgo.v !== 0 ? ((latest.v - yearAgo.v) / Math.abs(yearAgo.v)) * 100 : null;
  const mom     = latest && prev ? latest.v - prev.v : null;

  // Simple linear trend over last 12 points
  const trend = (() => {
    if (data.length < 4) return null;
    const pts = data.slice(-12), n = pts.length;
    const xm = (n-1)/2, ym = pts.reduce((s,d)=>s+d.v,0)/n;
    const num = pts.reduce((s,d,i)=>s+(i-xm)*(d.v-ym),0);
    const den = pts.reduce((s,d,i)=>s+(i-xm)**2,0);
    return den===0 ? 0 : num/den;
  })();

  const renderChart = () => loading ? (
    <div className="flex items-center justify-center py-8 font-mono" style={{ color:"#7d8590" }}>Loading…</div>
  ) : !data.length ? (
    <div className="flex items-center justify-center py-8 font-mono" style={{ color:"#f85149" }}>No data available</div>
  ) : (
    <div>
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="font-mono font-bold" style={{ color:"#bc8cff", fontSize:26 }}>{latest?.v?.toFixed(2)}</span>
        <div className="text-right">
          {yoyPct != null && <div className="font-mono" style={{ color:clr(yoyPct), fontSize:11 }}>YoY {fmt.pct(yoyPct)}</div>}
          {mom != null && <div className="font-mono" style={{ color:clr(mom), fontSize:10 }}>MoM {mom>=0?"+":""}{mom.toFixed(2)}</div>}
        </div>
      </div>
      <div className="font-mono mb-3" style={{ color:"#484f58", fontSize:10 }}>As of {latest?.t}</div>

      {trend != null && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1.5" style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:4 }}>
          <span className="font-mono" style={{ color:Math.abs(trend)<0.01?"#7d8590":trend>0?"#3fb950":"#f85149", fontSize:14 }}>
            {Math.abs(trend)<0.01?"→":trend>0?"↗":"↘"}
          </span>
          <span className="font-mono" style={{ color:"#7d8590", fontSize:10 }}>
            12-period trend: <span style={{ color:"#c9d1d9" }}>{trend>0.01?"Rising":trend<-0.01?"Declining":"Flat"}</span>
            <span style={{ color:"#484f58" }}> ({trend>=0?"+":""}{trend.toFixed(3)}/period)</span>
          </span>
        </div>
      )}

      <div style={{ height:155, marginBottom:12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top:4, right:2, bottom:0, left:0 }}>
            <defs>
              <linearGradient id={"mcg_"+item.series.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#bc8cff" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#bc8cff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="t" tick={{fill:"#484f58",fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}} tickLine={false} axisLine={false} interval={11}/>
            <YAxis domain={["auto","auto"]} hide/>
            <Tooltip contentStyle={{background:"#1c2230",border:"1px solid rgba(99,110,123,0.28)",borderRadius:10,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}} formatter={v=>[v?.toFixed(2),item.label]}/>
            <Area type="monotone" dataKey="v" stroke="#bc8cff" strokeWidth={1.5} fill={"url(#mcg_"+item.series.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid mb-3" style={{ gridTemplateColumns:"repeat(3,1fr)", gap:"4px 8px" }}>
        {[
          ["Previous",  prev?.v?.toFixed(2)||"—"],
          ["1Y Ago",    yearAgo?.v?.toFixed(2)||"—"],
          ["5Y Min",    data.length>=12?Math.min(...data.slice(-60).map(d=>d.v)).toFixed(2):"—"],
        ].map(([k,v])=>(
          <div key={k}>
            <div className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>{k}</div>
            <div className="font-mono" style={{ color:"#e6edf3", fontSize:11 }}>{v}</div>
          </div>
        ))}
      </div>
      <RelatedLinks itemId={item.id} onOpen={onOpen}/>
    </div>
  );

  return (
    <ResearchPanelShell title={item.label} subtitle={item.series} badge="Macro" onClose={onClose}>
      <ResearchTabBar tabs={TABS} active={activeTab} onSelect={setActiveTab}/>
      {activeTab === "Chart"   && renderChart()}
      {activeTab === "Context" && (
        <div>
          {intel ? <IntelCard intel={intel} accentColor="#bc8cff"/> : <div className="font-mono py-4" style={{color:"#484f58"}}>No context data available.</div>}
          <div className="mt-4"><RelatedLinks itemId={item.id} onOpen={onOpen}/></div>
        </div>
      )}
    </ResearchPanelShell>
  );
}

function TopicResearchPanel({ item, onClose, onOpen }) {
  const cfg = TOPIC_CONFIG[item.id];
  const [macroData, setMacroData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cfg) return;
    setLoading(true);
    Promise.all(
      cfg.macro.map((m, i) =>
        delay(i * 200)
          .then(() => fetch("/api/fred?series=" + m.series).then(r => r.json()))
          .then(d => {
            const obs = (d.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
            const latest = obs[obs.length - 1];
            const prev   = obs[obs.length - 2];
            return { id:m.id, label:m.label, latest:latest ? parseFloat(latest.value) : null, date:latest?.date, prev:prev ? parseFloat(prev.value) : null };
          })
          .catch(() => ({ id:m.id, label:m.label, latest:null }))
      )
    ).then(results => {
      setMacroData(Object.fromEntries(results.map(r => [r.id, r])));
      setLoading(false);
    });
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg) return null;

  return (
    <ResearchPanelShell title={cfg.icon + " " + cfg.title} subtitle={cfg.desc} badge="Topic" onClose={onClose}>
      {loading ? (
        <div className="flex items-center justify-center flex-1 font-mono" style={{ color:"#7d8590", fontSize:11 }}>Loading…</div>
      ) : (
        <>
          <div className="grid mb-3" style={{ gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {cfg.macro.map(m => {
              const d = macroData[m.id];
              const mom = d?.latest != null && d?.prev != null ? d.latest - d.prev : null;
              return (
                <button key={m.id} onClick={() => onOpen({ id:m.id, label:m.label, type:"macro", series:m.series, category:"Macro" })}
                  className="text-left p-2"
                  style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:10, cursor:"pointer", transition:"border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="rgba(99,110,123,0.40)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#21262d"}>
                  <div className="font-mono" style={{ color:"#7d8590", fontSize:9, textTransform:"uppercase" }}>{m.label}</div>
                  <div className="font-mono font-bold" style={{ color:"#bc8cff", fontSize:16 }}>
                    {d?.latest != null ? d.latest.toFixed(2) : "—"}
                  </div>
                  {mom != null && (
                    <div className="font-mono" style={{ color:clr(mom), fontSize:10 }}>
                      {mom >= 0 ? "▲" : "▼"} {Math.abs(mom).toFixed(2)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ borderTop:"1px solid rgba(99,110,123,0.12)", paddingTop:8, marginBottom:4 }}>
            <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Related Assets</div>
            <div className="flex flex-wrap gap-1.5">
              {cfg.assets.map(a => (
                <button key={a.id} onClick={() => onOpen(a)} className="font-mono"
                  style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:6, padding:"3px 8px", fontSize:11, color:RB_TYPE_COLOR[a.type]||"#7d8590", cursor:"pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="rgba(99,110,123,0.40)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#21262d"}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <RelatedLinks itemId={item.id} onOpen={onOpen} />
        </>
      )}
    </ResearchPanelShell>
  );
}

function ResearchPanel({ item, onClose, onOpen }) {
  if (item.type === "equity") {
    return (
      <div style={{ gridColumn:"1 / -1" }}>
        <EquityResearchPanel item={item} onClose={onClose} onOpen={onOpen} />
      </div>
    );
  }
  switch (item.type) {
    case "commodity": return <CommodityResearchPanel item={item} onClose={onClose} onOpen={onOpen} />;
    case "fx":        return <FXResearchPanel        item={item} onClose={onClose} onOpen={onOpen} />;
    case "macro":     return <MacroResearchPanel   item={item} onClose={onClose} onOpen={onOpen} />;
    case "topic":     return <TopicResearchPanel   item={item} onClose={onClose} onOpen={onOpen} />;
    default:          return null;
  }
}

const HOME_TILES = [
  { heading:"Macro",       color:"#bc8cff", ids:["FEDFUNDS","DGS10","T10Y2Y","CPIAUCSL","UNRATE"] },
  { heading:"Equities",    color:"#58a6ff", ids:["SPY","QQQ","AAPL","NVDA","TSLA"] },
  { heading:"Commodities", color:"#e3b341", ids:["GC=F","CL=F","SI=F","HG=F","NG=F"] },
  { heading:"FX",          color:"#3fb950", ids:["EURUSD=X","DX=F","GBPUSD=X","USDJPY=X","USDCNY=X"] },
  { heading:"Banks",       color:"#58a6ff", ids:["JPM","GS","BAC","MS","C"] },
  { heading:"Topics",      color:"#f0883e", ids:["topic-inflation","topic-rates","topic-energy","topic-credit"] },
];

function ResearchHomeDashboard({ onOpen }) {
  const byId = Object.fromEntries(RESEARCH_CATALOG.map(c => [c.id, c]));
  return (
    <div>
      <div className="font-mono mb-4" style={{ color:"#484f58", fontSize:11 }}>
        Search above to open research panels — or start from a quick-access tile below. Press <span style={{ color:"#7d8590" }}>/</span> to focus the search bar.
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))" }}>
        {HOME_TILES.map(({ heading, color, ids }) => (
          <div key={heading} className="terminal-panel p-3">
            <div className="font-mono mb-2" style={{ color, fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>{heading}</div>
            <div className="flex flex-col gap-1">
              {ids.map(id => {
                const item = byId[id];
                if (!item) return null;
                return (
                  <button key={id} onClick={() => onOpen(item)} className="text-left font-mono px-2 py-1.5"
                    style={{ background:"transparent", border:"1px solid rgba(99,110,123,0.18)", borderRadius:10, color:"#e6edf3", fontSize:12, cursor:"pointer", transition:"all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(99,110,123,0.40)"; e.currentTarget.style.background="#0d1117"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="#21262d"; e.currentTarget.style.background="transparent"; }}>
                    <span style={{ color }}>{item.label}</span>
                    <span style={{ color:"#484f58", marginLeft:8, fontSize:10 }}>{item.id}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResearchBrowser({ pendingItem, onPendingConsumed }) {
  const [query, setQuery]               = useState("");
  const [suggestions, setSuggestions]   = useState([]);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);
  const [panels, setPanels]             = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ov_research_recent") || "[]"); }
    catch { return []; }
  });
  const debounceRef = useRef(null);
  const searchRef   = useRef(null);

  // Press "/" anywhere to focus search
  useEffect(() => {
    const handler = e => {
      if (e.key === "/" && document.activeElement !== searchRef.current && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Debounced autocomplete
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSuggestions([]); setSuggestionIdx(-1); return; }
    debounceRef.current = setTimeout(async () => {
      const q = query.toLowerCase();
      const local = RESEARCH_CATALOG.filter(item =>
        item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
      ).slice(0, 6);
      try {
        const res = await api("/search?q=" + encodeURIComponent(query));
        const remote = (res.result || []).slice(0, 8).map(r => ({
          id:r.symbol, label:r.description || r.symbol, type:"equity", ticker:r.symbol, category:"Equities"
        }));
        const merged = [...local];
        remote.forEach(e => { if (!merged.find(m => m.id === e.id)) merged.push(e); });
        setSuggestions(merged.slice(0, 10));
      } catch { setSuggestions(local); }
    }, 300);
  }, [query]);

  const openPanel = item => {
    const newRecent = [item, ...recentSearches.filter(r => r.id !== item.id)].slice(0, 8);
    setRecentSearches(newRecent);
    localStorage.setItem("ov_research_recent", JSON.stringify(newRecent));
    setPanels(prev => prev.find(p => p.id === item.id) ? prev : [{ ...item }, ...prev]);
    setQuery(""); setSuggestions([]); setSuggestionIdx(-1);
  };

  const closePanel = id => setPanels(prev => prev.filter(p => p.id !== id));

  // Consume external trigger (e.g. from Geopolitical Events module)
  useEffect(() => {
    if (pendingItem) { openPanel(pendingItem); onPendingConsumed && onPendingConsumed(); }
  }, [pendingItem]); // eslint-disable-line

  const handleKeyDown = e => {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown")  { e.preventDefault(); setSuggestionIdx(i => Math.min(i+1, suggestions.length-1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSuggestionIdx(i => Math.max(i-1, -1)); }
    else if (e.key === "Enter" && suggestionIdx >= 0) { openPanel(suggestions[suggestionIdx]); }
    else if (e.key === "Escape") { setSuggestions([]); setSuggestionIdx(-1); setQuery(""); }
  };

  const grouped = suggestions.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col flex-1" style={{ height:"calc(100vh - 90px)", overflow:"hidden" }}>
      {/* ── Search bar ── */}
      <div className="px-4 py-3" style={{ borderBottom:"1px solid rgba(99,110,123,0.12)", background:"#010409", flexShrink:0 }}>
        <div style={{ position:"relative", maxWidth:680 }}>
          <div className="flex items-center gap-2 px-3 py-2"
            style={{ background:"#161b22", border:"1px solid " + (searchFocused ? "#1f6feb" : "#30363d"), borderRadius:6 }}
            onFocusCapture={() => setSearchFocused(true)}
            onBlurCapture={() => setSearchFocused(false)}>
            <Search size={13} style={{ color:"#7d8590", flexShrink:0 }} />
            <input ref={searchRef} value={query}
              onChange={e => { setQuery(e.target.value); setSuggestionIdx(-1); }}
              onKeyDown={handleKeyDown}
              placeholder="Search equities, commodities, FX, macro indicators, topics… (press / to focus)"
              style={{ background:"transparent", border:"none", color:"#e6edf3", fontSize:12, flex:1, outline:"none", minWidth:0 }} />
            {query && (
              <button onClick={() => { setQuery(""); setSuggestions([]); setSuggestionIdx(-1); searchRef.current?.focus(); }}
                style={{ color:"#7d8590", background:"none", border:"none", cursor:"pointer", flexShrink:0, fontSize:12 }}>✕</button>
            )}
            <span className="font-mono" style={{ color:"#484f58", fontSize:9, flexShrink:0 }}>/</span>
          </div>

          {/* Dropdown */}
          {suggestions.length > 0 && (
            <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:"#161b22", border:"1px solid #30363d", borderRadius:6, zIndex:200, boxShadow:"0 12px 32px rgba(0,0,0,0.6)", overflow:"hidden" }}>
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div style={{ padding:"5px 12px 2px", color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.1em", background:"#0d1117" }}>{cat}</div>
                  {items.map(item => {
                    const idx = suggestions.indexOf(item);
                    const active = idx === suggestionIdx;
                    return (
                      <div key={item.id}
                        onClick={() => openPanel(item)}
                        onMouseEnter={() => setSuggestionIdx(idx)}
                        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 12px", cursor:"pointer", background:active?"#1f2937":"transparent", borderLeft:active?"2px solid #1f6feb":"2px solid transparent" }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold" style={{ color:RB_TYPE_COLOR[item.type]||"#7d8590", fontSize:11, width:80, flexShrink:0 }}>{item.id}</span>
                          <span className="font-mono truncate" style={{ color:"#e6edf3", fontSize:12 }}>{item.label}</span>
                        </div>
                        <span className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", marginLeft:8, flexShrink:0 }}>{item.type}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent searches row */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {recentSearches.length > 0 && !query && (
            <>
              <span className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>Recent:</span>
              {recentSearches.map(r => (
                <button key={r.id} onClick={() => openPanel(r)} className="font-mono"
                  style={{ background:"#161b22", border:"1px solid rgba(99,110,123,0.18)", borderRadius:6, padding:"2px 8px", color:RB_TYPE_COLOR[r.type]||"#7d8590", fontSize:10, cursor:"pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="rgba(99,110,123,0.40)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#21262d"}>
                  {r.label}
                </button>
              ))}
            </>
          )}
          {panels.length > 0 && (
            <button onClick={() => setPanels([])} className="font-mono ml-auto"
              style={{ color:"#f85149", background:"none", border:"none", cursor:"pointer", fontSize:10 }}>
              Close all ({panels.length})
            </button>
          )}
        </div>
      </div>

      {/* ── Panel workspace ── */}
      <div className="flex-1" style={{ overflowY:"auto", padding:12 }}>
        {panels.length === 0
          ? <ResearchHomeDashboard onOpen={openPanel} />
          : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(380px, 1fr))", gap:12, alignItems:"start" }}>
              {panels.map(p => (
                <ResearchPanel key={p.id} item={p} onClose={() => closePanel(p.id)} onOpen={openPanel} />
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}

function PortfolioTracker() {
  const [holdings, setHoldings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ov_portfolio") || "[]"); }
    catch { return []; }
  });
  const [quotes, setQuotes] = useState({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [form, setForm] = useState({ ticker: "", shares: "", avgCost: "" });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    localStorage.setItem("ov_portfolio", JSON.stringify(holdings));
  }, [holdings]);

  const tickerKey = holdings.map(h => h.ticker).join(",");
  useEffect(() => {
    if (!holdings.length) { setQuotes({}); return; }
    setLoadingQuotes(true);
    const fetch_ = async () => {
      const newQuotes = {};
      for (let i = 0; i < holdings.length; i++) {
        if (i > 0) await delay(i * 200);
        try {
          const q = await api("/quote?symbol=" + holdings[i].ticker);
          newQuotes[holdings[i].ticker] = { price: q.c, change: q.d, changePct: q.dp };
        } catch(e) {}
      }
      setQuotes(newQuotes);
      setLoadingQuotes(false);
    };
    fetch_();
  }, [tickerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const addHolding = () => {
    const t = form.ticker.trim().toUpperCase();
    const s = parseFloat(form.shares);
    const c = parseFloat(form.avgCost);
    if (!t) { setFormError("Enter a ticker symbol"); return; }
    if (!s || s <= 0) { setFormError("Enter a valid share count"); return; }
    if (!c || c <= 0) { setFormError("Enter a valid average cost"); return; }
    const idx = holdings.findIndex(h => h.ticker === t);
    if (idx >= 0) {
      const old = holdings[idx];
      const totalShares = old.shares + s;
      const newAvg = (old.shares * old.avgCost + s * c) / totalShares;
      const updated = [...holdings];
      updated[idx] = { ticker: t, shares: totalShares, avgCost: newAvg };
      setHoldings(updated);
    } else {
      setHoldings([...holdings, { ticker: t, shares: s, avgCost: c }]);
    }
    setForm({ ticker: "", shares: "", avgCost: "" });
    setFormError("");
  };

  const removeHolding = (ticker) => setHoldings(holdings.filter(h => h.ticker !== ticker));

  const refreshQuotes = () => {
    if (!holdings.length || loadingQuotes) return;
    setLoadingQuotes(true);
    const fetch_ = async () => {
      const newQuotes = { ...quotes };
      for (let i = 0; i < holdings.length; i++) {
        if (i > 0) await delay(i * 200);
        try {
          const q = await api("/quote?symbol=" + holdings[i].ticker);
          newQuotes[holdings[i].ticker] = { price: q.c, change: q.d, changePct: q.dp };
        } catch(e) {}
      }
      setQuotes(newQuotes);
      setLoadingQuotes(false);
    };
    fetch_();
  };

  let totalValue = 0, totalCost = 0, dayPnlTotal = 0;
  holdings.forEach(h => {
    const q = quotes[h.ticker];
    const price = q?.price || h.avgCost;
    totalValue += price * h.shares;
    totalCost += h.avgCost * h.shares;
    if (q?.change) dayPnlTotal += q.change * h.shares;
  });
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const summaryCards = [
    { label: "Portfolio Value", value: "$" + totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: "#e6edf3" },
    { label: "Today's P&L", value: (dayPnlTotal >= 0 ? "+" : "") + "$" + Math.abs(dayPnlTotal).toFixed(2), color: clr(dayPnlTotal) },
    { label: "Total P&L", value: (totalPnl >= 0 ? "+" : "") + "$" + Math.abs(totalPnl).toFixed(2), color: clr(totalPnl) },
    { label: "Total Return", value: totalCost > 0 ? fmt.pct(totalPnlPct) : "—", color: totalCost > 0 ? clr(totalPnlPct) : "#7d8590" },
  ];

  const inputStyle = { background: "#0d1117", border: "1px solid #30363d", borderRadius: 10, color: "#e6edf3", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: "6px 8px", width: "100%" };

  return (
    <div className="flex flex-col flex-1" style={{ height: "calc(100vh - 90px)", overflow: "hidden" }}>
      {/* Summary row */}
      <div className="grid gap-2 p-2" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {summaryCards.map(({ label, value, color }) => (
          <div key={label} className="terminal-panel p-3">
            <div className="text-xs font-mono" style={{ color: "#7d8590", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10 }}>{label}</div>
            <div className="font-mono font-bold mt-1" style={{ color, fontSize: 18 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="flex gap-2 px-2 pb-2 flex-1" style={{ overflow: "hidden", minHeight: 0 }}>
        {/* Holdings table */}
        <div className="terminal-panel terminal-glow flex-1 flex flex-col p-3" style={{ overflowY: "auto" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="terminal-header">💼 Holdings ({holdings.length})</span>
            <button onClick={refreshQuotes} disabled={loadingQuotes}
              className="text-xs font-mono px-2 py-1"
              style={{ border: "1px solid #30363d", borderRadius: 10, background: "transparent", color: loadingQuotes ? "#7d8590" : "#58a6ff", cursor: loadingQuotes ? "wait" : "pointer" }}>
              {loadingQuotes ? "⟳ Updating..." : "⟳ Refresh"}
            </button>
          </div>

          {holdings.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1" style={{ color: "#7d8590" }}>
              <div className="text-xs font-mono text-center">No positions yet.</div>
              <div className="text-xs font-mono text-center mt-1">Add holdings using the form on the right.</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #30363d" }}>
                  {["Ticker", "Shares", "Avg Cost", "Price", "Mkt Value", "P&L ($)", "Return", "Day Chg", ""].map(h => (
                    <th key={h} className="text-left px-2 py-2"
                      style={{ color: "#7d8590", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map(h => {
                  const q = quotes[h.ticker];
                  const price = q?.price ?? null;
                  const mktValue = price !== null ? price * h.shares : null;
                  const costBasis = h.avgCost * h.shares;
                  const pnl = mktValue !== null ? mktValue - costBasis : null;
                  const pnlPct = pnl !== null ? (pnl / costBasis) * 100 : null;
                  const alloc = totalValue > 0 && mktValue !== null ? (mktValue / totalValue) * 100 : 0;
                  return (
                    <tr key={h.ticker} className="holding-row" style={{ borderBottom: "1px solid #161b22" }}>
                      <td className="px-2 py-2">
                        <div className="font-mono font-bold" style={{ color: "#58a6ff", fontSize: 12 }}>{h.ticker}</div>
                        <div className="font-mono" style={{ color: "#7d8590", fontSize: 10 }}>{alloc.toFixed(1)}%</div>
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: "#e6edf3", fontSize: 12 }}>{h.shares.toLocaleString()}</td>
                      <td className="px-2 py-2 font-mono" style={{ color: "#e6edf3", fontSize: 12 }}>${fmt.price(h.avgCost)}</td>
                      <td className="px-2 py-2 font-mono" style={{ color: price !== null ? "#e6edf3" : "#7d8590", fontSize: 12 }}>
                        {price !== null ? "$" + fmt.price(price) : loadingQuotes ? "…" : "—"}
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: "#e6edf3", fontSize: 12 }}>
                        {mktValue !== null ? "$" + mktValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: pnl !== null ? clr(pnl) : "#7d8590", fontSize: 12 }}>
                        {pnl !== null ? (pnl >= 0 ? "+" : "") + "$" + Math.abs(pnl).toFixed(2) : "—"}
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: pnlPct !== null ? clr(pnlPct) : "#7d8590", fontSize: 12 }}>
                        {pnlPct !== null ? fmt.pct(pnlPct) : "—"}
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: q?.changePct != null ? clr(q.changePct) : "#7d8590", fontSize: 12 }}>
                        {q?.changePct != null ? fmt.pct(q.changePct) : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeHolding(h.ticker)}
                          style={{ color: "#f85149", background: "none", border: "none", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {holdings.length > 1 && (
                <tfoot>
                  <tr style={{ borderTop: "1px solid #30363d" }}>
                    <td className="px-2 py-2 font-mono font-bold" style={{ color: "#7d8590", fontSize: 11 }} colSpan={4}>TOTAL</td>
                    <td className="px-2 py-2 font-mono font-bold" style={{ color: "#e6edf3", fontSize: 12 }}>
                      ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2 font-mono font-bold" style={{ color: clr(totalPnl), fontSize: 12 }}>
                      {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 font-mono font-bold" style={{ color: clr(totalPnlPct), fontSize: 12 }}>
                      {fmt.pct(totalPnlPct)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-2" style={{ width: 280, flexShrink: 0 }}>
          {/* Add position form */}
          <div className="terminal-panel terminal-glow p-3">
            <div className="terminal-header mb-3">+ Add / Update Position</div>
            <div className="flex flex-col gap-2">
              <div>
                <div className="font-mono mb-1" style={{ color: "#7d8590", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Ticker</div>
                <input className="pf-input" value={form.ticker}
                  onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                  onKeyDown={e => e.key === "Enter" && document.getElementById("pf-shares")?.focus()}
                  placeholder="AAPL" style={inputStyle} />
              </div>
              <div>
                <div className="font-mono mb-1" style={{ color: "#7d8590", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Shares</div>
                <input id="pf-shares" className="pf-input" type="number" min="0" step="any"
                  value={form.shares}
                  onChange={e => setForm(f => ({ ...f, shares: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && document.getElementById("pf-cost")?.focus()}
                  placeholder="100" style={inputStyle} />
              </div>
              <div>
                <div className="font-mono mb-1" style={{ color: "#7d8590", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Avg Cost / Share ($)</div>
                <input id="pf-cost" className="pf-input" type="number" min="0" step="any"
                  value={form.avgCost}
                  onChange={e => setForm(f => ({ ...f, avgCost: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && addHolding()}
                  placeholder="150.00" style={inputStyle} />
              </div>
              {formError && <div className="font-mono" style={{ color: "#f85149", fontSize: 11 }}>{formError}</div>}
              <button onClick={addHolding}
                className="font-mono font-semibold py-2 mt-1"
                style={{ background: "#1f6feb", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 12, letterSpacing: "0.05em" }}>
                ADD POSITION
              </button>
              <div className="font-mono" style={{ color: "#484f58", fontSize: 10 }}>
                Adding an existing ticker averages your cost basis.
              </div>
            </div>
          </div>

          {/* Allocation breakdown */}
          {holdings.length > 0 && (
            <div className="terminal-panel terminal-glow p-3 flex-1" style={{ overflowY: "auto" }}>
              <div className="terminal-header mb-3">📊 Allocation</div>
              {[...holdings]
                .map(h => {
                  const q = quotes[h.ticker];
                  const price = q?.price || h.avgCost;
                  return { ...h, mktValue: price * h.shares };
                })
                .sort((a, b) => b.mktValue - a.mktValue)
                .map(h => {
                  const pct = totalValue > 0 ? (h.mktValue / totalValue) * 100 : 0;
                  const q = quotes[h.ticker];
                  return (
                    <div key={h.ticker} className="mb-3">
                      <div className="flex justify-between font-mono mb-1" style={{ fontSize: 11 }}>
                        <span style={{ color: "#e6edf3" }}>{h.ticker}</span>
                        <span style={{ color: q?.changePct != null ? clr(q.changePct) : "#7d8590" }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ background: "#21262d", borderRadius: 2, height: 4 }}>
                        <div style={{ width: pct + "%", height: "100%", background: "#1f6feb", borderRadius: 2, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
const Panel = ({ children, className = "", style = {} }) => <div className={"terminal-panel terminal-glow p-3 flex flex-col " + className} style={style}>{children}</div>;

function MarketSessionBadges() {
  const SESSIONS = [
    { name: "NYSE",   open: { h:14, m:30 }, close: { h:21, m:0  }, tz: "America/New_York",  flag: "🇺🇸" },
    { name: "LSE",    open: { h:8,  m:0  }, close: { h:16, m:30 }, tz: "Europe/London",     flag: "🇬🇧" },
    { name: "TSE",    open: { h:0,  m:0  }, close: { h:6,  m:0  }, tz: "Asia/Tokyo",        flag: "🇯🇵" },
    { name: "HKEx",   open: { h:1,  m:30 }, close: { h:8,  m:0  }, tz: "Asia/Hong_Kong",    flag: "🇭🇰" },
  ];
  const [, setTick] = useState(0); // tick unused intentionally — triggers re-render
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t+1), 30000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="flex items-center gap-3">
      {SESSIONS.map(s => {
        const now = new Date();
        const utcH = now.getUTCHours();
        const utcM = now.getUTCMinutes();
        const utcMins = utcH * 60 + utcM;
        // Simple UTC-based approximation (ignores DST exactly but good enough for indicator)
        const offsets = { "America/New_York":-240, "Europe/London":60, "Asia/Tokyo":540, "Asia/Hong_Kong":480 };
        const off = offsets[s.tz] || 0;
        const localMins = ((utcMins + off) % 1440 + 1440) % 1440;
        const openMins  = s.open.h  * 60 + s.open.m;
        const closeMins = s.close.h * 60 + s.close.m;
        const isOpen = localMins >= openMins && localMins < closeMins;
        return (
          <span key={s.name} className="font-mono" style={{ color: isOpen ? "#3fb950" : "#484f58", fontSize:9 }}>
            {s.flag} {s.name} {isOpen ? "●" : "○"}
          </span>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GLOBAL MARKETS MODULE
// ─────────────────────────────────────────────────────────────

const COUNTRY_CONFIG = {
  CA: {
    id:"CA", name:"Canada", flag:"🇨🇦", region:"North America", accentColor:"#f85149",
    fxTicker:"CADUSD=X",
    indices:[{ label:"TSX Composite", ticker:"^GSPTSE" },{ label:"TSX 60 ETF", ticker:"XIU.TO" }],
    macro:[
      { label:"Policy Rate",  series:"IRSTCI01CAM156N" },
      { label:"CPI",          series:"CPALTT01CAM657N" },
      { label:"Unemployment", series:"LRUNTTTTCAM156S" },
      { label:"10Y Bond",     series:"IRLTLT01CAM156N" },
    ],
    topStocks:[
      { ticker:"RY.TO",   label:"Royal Bank",      sector:"Financials" },
      { ticker:"TD.TO",   label:"TD Bank",         sector:"Financials" },
      { ticker:"SHOP.TO", label:"Shopify",         sector:"Technology" },
      { ticker:"ENB.TO",  label:"Enbridge",        sector:"Energy" },
      { ticker:"CNQ.TO",  label:"Can. Natural Res.",sector:"Energy" },
    ],
    keyComms:[
      { id:"CL=F", label:"Crude Oil",   note:"~18% of export revenue" },
      { id:"NG=F", label:"Natural Gas", note:"Alberta LNG exports" },
      { id:"GC=F", label:"Gold",        note:"Major mining sector" },
      { id:"HG=F", label:"Copper",      note:"BC & Ontario mines" },
    ],
    insight:{
      summary:"Canada is a commodity-driven, export-dependent economy with ~75% of goods flowing to the US. The TSX is heavily weighted toward financials (~35%) and energy (~20%), making it uniquely sensitive to oil prices and US economic cycles.",
      drivers:["WTI/WCS oil price — core driver of Alberta GDP and TSX energy","Bank of Canada vs Fed rate divergence (CAD/USD flows)","US housing and auto demand (lumber, steel exports)","Chinese commodity demand (metals, potash)"],
      risks:["Household debt-to-income ratio near record highs","US tariff risk on auto, lumber, softwood","Energy transition reducing long-run oil demand"],
    },
  },
  UK: {
    id:"UK", name:"United Kingdom", flag:"🇬🇧", region:"Europe", accentColor:"#58a6ff",
    fxTicker:"GBPUSD=X",
    indices:[{ label:"FTSE 100", ticker:"^FTSE" },{ label:"FTSE 250", ticker:"^FTMC" }],
    macro:[
      { label:"Policy Rate",  series:"BOEBR" },
      { label:"CPI",          series:"GBRCPIALLMINMEI" },
      { label:"Unemployment", series:"LRUNTTTTGBM156S" },
      { label:"10Y Bond",     series:"IRLTLT01GBM156N" },
    ],
    topStocks:[
      { ticker:"AZN.L",  label:"AstraZeneca", sector:"Healthcare" },
      { ticker:"HSBA.L", label:"HSBC",        sector:"Financials" },
      { ticker:"BP.L",   label:"BP",          sector:"Energy" },
      { ticker:"SHEL.L", label:"Shell",       sector:"Energy" },
      { ticker:"GSK.L",  label:"GSK",         sector:"Healthcare" },
    ],
    keyComms:[
      { id:"CL=F", label:"Crude Oil",   note:"Shell & BP direct exposure" },
      { id:"GC=F", label:"Gold",        note:"London LBMA gold market hub" },
      { id:"NG=F", label:"Natural Gas", note:"North Sea production" },
    ],
    insight:{
      summary:"The FTSE 100 is skewed toward multinationals (80% revenues overseas) — a weaker GBP actually boosts index performance. The UK runs a persistent current account deficit and faces structurally higher inflation post-Brexit.",
      drivers:["GBP/USD rate — FTSE 100 earnings are largely overseas","BOE rate path vs Fed (GBP carry dynamics)","UK fiscal credibility (Gilt market as key signal)","Oil price (Shell + BP ≈ 15% of FTSE 100 weight)"],
      risks:["Persistent current account deficit (~4% of GDP)","Post-Brexit trade friction reducing EU goods flows","BOE credibility — UK inflation stickier than peers"],
    },
  },
  JP: {
    id:"JP", name:"Japan", flag:"🇯🇵", region:"Asia-Pacific", accentColor:"#f0883e",
    fxTicker:"USDJPY=X",
    indices:[{ label:"Nikkei 225", ticker:"^N225" },{ label:"TOPIX", ticker:"^TOPX" }],
    macro:[
      { label:"Policy Rate",  series:"IRSTCI01JPM156N" },
      { label:"CPI",          series:"JPNCPIALLMINMEI" },
      { label:"Unemployment", series:"LRUNTTTTJPM156S" },
      { label:"10Y Bond",     series:"IRLTLT01JPM156N" },
    ],
    topStocks:[
      { ticker:"7203.T", label:"Toyota",   sector:"Automotive" },
      { ticker:"6758.T", label:"Sony",     sector:"Technology" },
      { ticker:"9984.T", label:"SoftBank", sector:"Technology" },
      { ticker:"6501.T", label:"Hitachi",  sector:"Industrials" },
      { ticker:"6902.T", label:"Denso",    sector:"Automotive" },
    ],
    keyComms:[
      { id:"CL=F", label:"Crude Oil",   note:"Japan imports ~99% of energy needs" },
      { id:"NG=F", label:"Natural Gas", note:"World's largest LNG importer" },
      { id:"HG=F", label:"Copper",      note:"Key industrial input" },
    ],
    insight:{
      summary:"Japan's Nikkei 225 is heavily export-oriented — a weak Yen (USD/JPY > 150) directly boosts corporate earnings of Toyota, Sony, and other exporters. The BOJ's ultra-loose policy is the world's largest carry trade funding source.",
      drivers:["USD/JPY rate — weak JPY = earnings boost for all major exporters","BOJ yield curve control — the dominant policy variable","China demand (Japan's #1 trading partner)","Corporate governance reforms driving ROE improvement"],
      risks:["Yen carry trade unwind — sudden JPY spike = global deleveraging","BOJ normalization (rate hike = JPY surge, export headwind)","Demographics — shrinking workforce, debt >230% of GDP"],
    },
  },
  IN: {
    id:"IN", name:"India", flag:"🇮🇳", region:"Asia-Pacific", accentColor:"#3fb950",
    fxTicker:"INRUSD=X",
    indices:[{ label:"Nifty 50", ticker:"^NSEI" },{ label:"BSE Sensex", ticker:"^BSESN" }],
    macro:[
      { label:"CPI",          series:"INDCPIALLMINMEI" },
    ],
    topStocks:[
      { ticker:"RELIANCE.NS",  label:"Reliance Ind.",  sector:"Conglomerate" },
      { ticker:"TCS.NS",       label:"TCS",            sector:"IT Services" },
      { ticker:"HDFCBANK.NS",  label:"HDFC Bank",      sector:"Financials" },
      { ticker:"INFY.NS",      label:"Infosys",        sector:"IT Services" },
      { ticker:"ICICIBANK.NS", label:"ICICI Bank",     sector:"Financials" },
    ],
    keyComms:[
      { id:"CL=F", label:"Crude Oil", note:"India imports ~88% of oil needs" },
      { id:"GC=F", label:"Gold",      note:"World's 2nd largest gold consumer" },
      { id:"ZW=F", label:"Wheat",     note:"Key food security commodity" },
    ],
    insight:{
      summary:"India is the fastest-growing large economy (GDP ~7% p.a.), driven by domestic consumption and IT services exports. The Nifty 50 is one of the world's best-performing indices over the past decade.",
      drivers:["Domestic consumption — 60%+ of GDP, rising middle class","IT exports (TCS, Infosys, Wipro = major FX earners)","RBI rate policy vs Fed (INR carry dynamics)","Infrastructure investment cycle (roads, railways, data centers)"],
      risks:["Current account deficit sensitive to oil price spikes","High Nifty valuations (P/E ~22x vs EM peers)","Monsoon failure risk — agriculture = 15% of GDP","INR depreciation pressure during USD tightening cycles"],
    },
  },
  CN: {
    id:"CN", name:"China", flag:"🇨🇳", region:"Asia-Pacific", accentColor:"#f85149",
    fxTicker:"CNYUSD=X",
    indices:[{ label:"Hang Seng", ticker:"^HSI" },{ label:"SSE Composite", ticker:"000001.SS" }],
    macro:[
      { label:"CPI",          series:"CHNCPIALLMINMEI" },
    ],
    topStocks:[
      { ticker:"BABA",   label:"Alibaba (ADR)",  sector:"Technology" },
      { ticker:"JD",     label:"JD.com (ADR)",   sector:"E-Commerce" },
      { ticker:"PDD",    label:"PDD Holdings",   sector:"E-Commerce" },
      { ticker:"BIDU",   label:"Baidu (ADR)",    sector:"Technology" },
      { ticker:"700.HK", label:"Tencent (HK)",   sector:"Technology" },
    ],
    keyComms:[
      { id:"HG=F", label:"Copper",      note:"China = 55% of global demand" },
      { id:"CL=F", label:"Crude Oil",   note:"World's largest importer" },
      { id:"ZW=F", label:"Wheat",       note:"Largest consumer globally" },
    ],
    insight:{
      summary:"China markets are driven by PBOC policy, property sector deleveraging, and US-China geopolitical relations. The Hang Seng is the primary traded proxy for China risk given mainland capital controls.",
      drivers:["PBOC monetary policy and credit impulse","Property sector deleveraging (Evergrande, Country Garden legacy)","US-China tech sanctions and tariff escalation","Stimulus measures targeting infrastructure and consumption"],
      risks:["Property deflation — largest asset market globally by value","US chip export restrictions constraining tech sector growth","Taiwan geopolitical risk premium","Deflationary spiral risk — CPI near zero for extended period"],
    },
  },
  EU: {
    id:"EU", name:"Eurozone", flag:"🇪🇺", region:"Europe", accentColor:"#bc8cff",
    fxTicker:"EURUSD=X",
    indices:[{ label:"EURO STOXX 50", ticker:"^STOXX50E" },{ label:"DAX 40", ticker:"^GDAXI" },{ label:"CAC 40", ticker:"^FCHI" }],
    macro:[
      { label:"ECB Rate",     series:"ECBDFR" },
      { label:"CPI (HICP)",   series:"CP0000EZ19M086NEST" },
      { label:"Unemployment", series:"LRUNTTTTEZM156S" },
      { label:"10Y Bond",     series:"IRLTLT01EZM156N" },
    ],
    topStocks:[
      { ticker:"ASML.AS", label:"ASML",           sector:"Semiconductors" },
      { ticker:"SAP.DE",  label:"SAP",            sector:"Enterprise Tech" },
      { ticker:"MC.PA",   label:"LVMH",           sector:"Luxury" },
      { ticker:"SIE.DE",  label:"Siemens",        sector:"Industrials" },
      { ticker:"NESN.SW", label:"Nestlé",         sector:"Consumer Staples" },
    ],
    keyComms:[
      { id:"NG=F", label:"Natural Gas", note:"Europe = major LNG importer" },
      { id:"CL=F", label:"Crude Oil",   note:"Net energy importer" },
      { id:"HG=F", label:"Copper",      note:"Industrial + EV demand" },
    ],
    insight:{
      summary:"The Eurozone is export-driven where EUR/USD is critical to corporate competitiveness. Germany's industrial base and ECB pivot from 15 years of near-zero rates are the defining macro themes of the current cycle.",
      drivers:["ECB rate path — fastest hiking cycle in history now unwinding","EUR/USD — weak EUR boosts exporters (ASML, SAP, BMW, Airbus)","Energy cost restructuring post-Ukraine war (LNG vs pipeline gas)","China luxury and capital goods demand (LVMH, Siemens)"],
      risks:["German industrial competitiveness vs China competition","Sovereign debt fragmentation (Italy vs Germany spread)","Russia-Ukraine conflict duration and energy supply","China luxury slowdown (LVMH, Hermès have 30%+ China revenue)"],
    },
  },
};

function CountryDashboard({ country, onOpenResearch }) {
  const [indexData,   setIndexData]   = useState({});
  const [fxData,      setFxData]      = useState(null);
  const [macroData,   setMacroData]   = useState({});
  const [stockData,   setStockData]   = useState({});
  const [loadingIdx,  setLoadingIdx]  = useState(true);
  const macroFetched  = useRef(false);
  const stocksFetched = useRef(false);

  // ── Fetch indices + FX on mount ──────────────────────────────────────────
  useEffect(() => {
    setLoadingIdx(true); setIndexData({}); setFxData(null);
    macroFetched.current = false; stocksFetched.current = false;
    setMacroData({}); setStockData({});

    const tickers = [...country.indices.map(i => i.ticker), country.fxTicker];
    Promise.all(tickers.map((t, i) =>
      delay(i * 80).then(() =>
        fetch("/api/chart?ticker=" + encodeURIComponent(t) + "&range=5d&interval=1d").then(r => r.json()).catch(() => null)
      )
    )).then(results => {
      const idxOut = {};
      tickers.forEach((t, i) => {
        const res = results[i]?.chart?.result?.[0];
        if (res) {
          const closes = res.indicators?.quote?.[0]?.close || [];
          const valid  = closes.filter(v => v != null);
          const cur = valid[valid.length-1], prev = valid[valid.length-2];
          idxOut[t] = { price: cur, changePct: cur && prev ? ((cur-prev)/prev)*100 : null };
        }
      });
      setFxData(idxOut[country.fxTicker] || null);
      const idxOnly = {};
      country.indices.forEach(idx => { if (idxOut[idx.ticker]) idxOnly[idx.ticker] = idxOut[idx.ticker]; });
      setIndexData(idxOnly);
      setLoadingIdx(false);
    }).catch(() => setLoadingIdx(false));
  }, [country.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lazy-load macro ──────────────────────────────────────────────────────
  useEffect(() => {
    if (macroFetched.current || !country.macro?.length) return;
    macroFetched.current = true;
    Promise.all(country.macro.map((m, i) =>
      delay(i * 250).then(() =>
        fetch("/api/fred?series=" + m.series).then(r => r.json()).catch(() => null)
      )
    )).then(results => {
      const out = {};
      country.macro.forEach((m, i) => {
        const obs = (results[i]?.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
        const lat = obs[obs.length-1], prv = obs[obs.length-2];
        out[m.series] = { latest: lat ? parseFloat(lat.value) : null, date: lat?.date, prev: prv ? parseFloat(prv.value) : null };
      });
      setMacroData(out);
    });
  }, [country.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lazy-load stocks ─────────────────────────────────────────────────────
  useEffect(() => {
    if (stocksFetched.current || !country.topStocks?.length) return;
    stocksFetched.current = true;
    (async () => {
      const out = {};
      for (let i = 0; i < country.topStocks.length; i++) {
        if (i > 0) await delay(180);
        try {
          const c = await fetch("/api/chart?ticker=" + encodeURIComponent(country.topStocks[i].ticker) + "&range=5d&interval=1d").then(r => r.json());
          const res = c?.chart?.result?.[0];
          if (res) {
            const closes = res.indicators?.quote?.[0]?.close || [];
            const valid  = closes.filter(v => v != null);
            const cur = valid[valid.length-1], prev = valid[valid.length-2];
            out[country.topStocks[i].ticker] = { price: cur, changePct: cur && prev ? ((cur-prev)/prev)*100 : null };
          }
        } catch(e) {}
      }
      setStockData({...out});
    })();
  }, [country.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mainIdx = country.indices[0];
  const mainD   = indexData[mainIdx?.ticker];
  const isInvFX = country.fxTicker === "USDJPY=X"; // JPY quotes as units per USD (higher = weaker JPY)
  const fmtPx   = (v, dp=2) => v != null ? v.toLocaleString("en-US",{minimumFractionDigits:dp,maximumFractionDigits:dp}) : "—";
  const fxDp    = isInvFX ? 2 : 4;

  return (
    <div className="flex-1 overflow-auto px-4 py-4">
      {/* ── Country header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span style={{ fontSize:32 }}>{country.flag}</span>
          <div>
            <div className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:20 }}>{country.name}</div>
            <div className="font-mono" style={{ color:"#484f58", fontSize:10 }}>{country.region}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {mainD && (
            <div className="text-right">
              <div className="font-mono" style={{ color:"#484f58", fontSize:9 }}>{mainIdx.label}</div>
              <div className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:18 }}>{fmtPx(mainD.price)}</div>
              {mainD.changePct != null && <div className="font-mono" style={{ color:clr(mainD.changePct), fontSize:11 }}>1D {fmt.pct(mainD.changePct)}</div>}
            </div>
          )}
          {fxData && (
            <div className="text-right" style={{ borderLeft:"1px solid #21262d", paddingLeft:16 }}>
              <div className="font-mono" style={{ color:"#484f58", fontSize:9 }}>{country.fxTicker.replace("=X","")}</div>
              <div className="font-mono font-bold" style={{ color:"#3fb950", fontSize:18 }}>{fmtPx(fxData.price, fxDp)}</div>
              {fxData.changePct != null && <div className="font-mono" style={{ color:clr(fxData.changePct), fontSize:11 }}>1D {fmt.pct(fxData.changePct)}</div>}
            </div>
          )}
          {loadingIdx && !mainD && <div className="font-mono" style={{ color:"#484f58", fontSize:11 }}>Loading…</div>}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns:"1fr 1fr", alignItems:"start" }}>

        {/* ── Left column ── */}
        <div className="flex flex-col gap-4">

          {/* All Indices */}
          <div className="terminal-panel p-3">
            <div className="font-mono mb-3" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Market Indices</div>
            <div style={{ borderTop:"1px solid rgba(99,110,123,0.12)" }}>
              {country.indices.map(idx => {
                const d = indexData[idx.ticker];
                return (
                  <div key={idx.ticker} className="flex items-center justify-between py-2" style={{ borderBottom:"1px solid rgba(99,110,123,0.07)" }}>
                    <div>
                      <div className="font-mono" style={{ color:"#e6edf3", fontSize:11 }}>{idx.label}</div>
                      <div className="font-mono" style={{ color:"#484f58", fontSize:9 }}>{idx.ticker}</div>
                    </div>
                    <div className="text-right">
                      {d ? (
                        <>
                          <div className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:13 }}>{fmtPx(d.price)}</div>
                          {d.changePct != null && <div className="font-mono" style={{ color:clr(d.changePct), fontSize:10 }}>{fmt.pct(d.changePct)}</div>}
                        </>
                      ) : <div className="font-mono" style={{ color:"#484f58", fontSize:10 }}>—</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Economy */}
          {country.macro?.length > 0 && (
            <div className="terminal-panel p-3">
              <div className="font-mono mb-3" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Economy</div>
              <div className="grid gap-2" style={{ gridTemplateColumns:"1fr 1fr" }}>
                {country.macro.map(m => {
                  const d = macroData[m.series];
                  const mom = d?.latest != null && d?.prev != null ? d.latest - d.prev : null;
                  return (
                    <button key={m.series}
                      onClick={() => onOpenResearch({ id:m.series, label:m.label, type:"macro", series:m.series, category:"Macro" })}
                      className="text-left p-2"
                      style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:10, cursor:"pointer" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor="rgba(99,110,123,0.40)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor="#21262d"}>
                      <div className="font-mono" style={{ color:"#7d8590", fontSize:9, textTransform:"uppercase" }}>{m.label}</div>
                      <div className="font-mono font-bold" style={{ color:"#bc8cff", fontSize:18 }}>
                        {d?.latest != null ? d.latest.toFixed(2) : "—"}
                      </div>
                      {mom != null && <div className="font-mono" style={{ color:clr(mom), fontSize:9 }}>{mom>=0?"+":""}{mom.toFixed(2)} chg</div>}
                      {d?.date && <div className="font-mono" style={{ color:"#484f58", fontSize:9 }}>{d.date}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Commodity Exposure */}
          <div className="terminal-panel p-3">
            <div className="font-mono mb-3" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Commodity Exposure</div>
            <div className="flex flex-col gap-1.5">
              {country.keyComms.map(c => (
                <button key={c.id}
                  onClick={() => onOpenResearch({ id:c.id, label:c.label, type:"commodity", ticker:c.id, category:"Commodities" })}
                  className="flex items-center justify-between py-2 px-2 text-left"
                  style={{ background:"#0d1117", border:"1px solid rgba(99,110,123,0.18)", borderRadius:10, cursor:"pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="rgba(99,110,123,0.40)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#21262d"}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono" style={{ color:"#e3b341", fontSize:11 }}>{c.label}</span>
                    <span className="font-mono" style={{ color:"#484f58", fontSize:9 }}>{c.id}</span>
                  </div>
                  <span className="font-mono" style={{ color:"#7d8590", fontSize:9 }}>{c.note}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-4">

          {/* Key Companies */}
          <div className="terminal-panel p-3">
            <div className="font-mono mb-3" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Key Companies</div>
            <div style={{ borderTop:"1px solid rgba(99,110,123,0.12)" }}>
              {country.topStocks.map(s => {
                const d = stockData[s.ticker];
                return (
                  <button key={s.ticker}
                    onClick={() => onOpenResearch({ id:s.ticker, label:s.label, type:"equity", ticker:s.ticker, category:"Equities" })}
                    className="w-full flex items-center justify-between py-2 px-1 text-left"
                    style={{ borderBottom:"1px solid rgba(99,110,123,0.07)", cursor:"pointer", background:"transparent" }}
                    onMouseEnter={e => e.currentTarget.style.background="#0d1117"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <div>
                      <div className="font-mono" style={{ color:"#e6edf3", fontSize:11 }}>{s.label}</div>
                      <div className="font-mono" style={{ color:"#484f58", fontSize:9 }}>{s.ticker} · {s.sector}</div>
                    </div>
                    <div className="text-right">
                      {d ? (
                        <>
                          <div className="font-mono" style={{ color:"#e6edf3", fontSize:11 }}>{fmtPx(d.price)}</div>
                          {d.changePct != null && <div className="font-mono" style={{ color:clr(d.changePct), fontSize:10 }}>{fmt.pct(d.changePct)}</div>}
                        </>
                      ) : <div className="font-mono" style={{ color:"#484f58", fontSize:10 }}>—</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Market Intelligence */}
          <div className="terminal-panel p-3">
            <div className="font-mono mb-3" style={{ color:country.accentColor, fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              Market Intelligence
            </div>
            <p className="font-mono mb-4" style={{ color:"#c9d1d9", fontSize:10, lineHeight:1.75 }}>{country.insight.summary}</p>
            <div className="mb-4">
              <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>Key Drivers</div>
              {country.insight.drivers.map((d, i) => (
                <div key={i} className="flex items-start gap-2 mb-1.5">
                  <span className="font-mono flex-shrink-0" style={{ color:country.accentColor, fontSize:10 }}>▸</span>
                  <span className="font-mono" style={{ color:"#8b949e", fontSize:10, lineHeight:1.6 }}>{d}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>Key Risks</div>
              {country.insight.risks.map((r, i) => (
                <div key={i} className="flex items-start gap-2 mb-1.5">
                  <span className="font-mono flex-shrink-0" style={{ color:"#f85149", fontSize:10 }}>⚠</span>
                  <span className="font-mono" style={{ color:"#8b949e", fontSize:10, lineHeight:1.6 }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlobalMarketsModule({ onOpenResearch }) {
  const [selected, setSelected] = useState("CA");
  const countries = Object.values(COUNTRY_CONFIG);
  const country   = COUNTRY_CONFIG[selected];
  return (
    <div className="flex flex-col flex-1" style={{ overflow:"hidden" }}>
      {/* ── Country selector bar ── */}
      <div className="flex items-center gap-2 px-4 py-2 flex-wrap" style={{ borderBottom:"1px solid rgba(99,110,123,0.12)", flexShrink:0 }}>
        <span className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", marginRight:4 }}>Markets:</span>
        {countries.map(c => (
          <button key={c.id} onClick={() => setSelected(c.id)} className="font-mono"
            style={{
              borderRadius:10, border:"1px solid", padding:"3px 10px", fontSize:10, cursor:"pointer",
              borderColor: selected===c.id ? c.accentColor : "#21262d",
              color:        selected===c.id ? c.accentColor : "#7d8590",
              background:   selected===c.id ? c.accentColor+"18" : "transparent",
            }}>
            {c.flag} {c.name}
          </button>
        ))}
      </div>
      <CountryDashboard key={selected} country={country} onOpenResearch={onOpenResearch} />
    </div>
  );
}

// ─── NAV ITEMS config ─────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key:"financial",   icon:"📈", label:"Financial"   },
  { key:"commodities", icon:"🛢", label:"Commodities" },
  { key:"crypto",      icon:"₿",  label:"Crypto"      },
  { key:"supplychain", icon:"📉", label:"Macro"       },
  { key:"technical",   icon:"📊", label:"Technical"   },
  { key:"eye",         icon:"👁",  label:"Eye of Sauron"},
  { key:"fx",          icon:"💱", label:"FX"          },
  { key:"markets",     icon:"🌍", label:"Markets"     },
  { key:"portfolio",   icon:"💼", label:"Portfolio"   },
  { key:"research",    icon:"🔬", label:"Research"    },
];

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function SidebarNav({ activePage, setActivePage, isOpen, onToggle }) {
  return (
    <div className="app-sidebar" style={{ justifyContent:"space-between" }}>
      <div>
        {/* Toggle button */}
        <button onClick={onToggle}
          style={{ width:"100%", padding:"10px 0", background:"none", border:"none", borderBottom:"1px solid rgba(99,110,123,0.10)",
            color:"#484f58", fontSize:14, cursor:"pointer", transition:"color 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.color="#8b949e"}
          onMouseLeave={e=>e.currentTarget.style.color="#484f58"}>
          {isOpen ? "◂" : "▸"}
        </button>
        {NAV_ITEMS.map(item => (
          <button key={item.key}
            className={"sidebar-item" + (activePage===item.key ? " active" : "")}
            onClick={() => setActivePage(item.key)}>
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </div>
      {/* Bottom: settings */}
      <div style={{ borderTop:"1px solid rgba(99,110,123,0.10)" }}>
        <button className="sidebar-item" onClick={() => setActivePage("settings")}>
          <span className="sidebar-icon">⚙</span>
          <span className="sidebar-label">Settings</span>
        </button>
      </div>
    </div>
  );
}

// ─── GLOBAL TOP BAR ───────────────────────────────────────────────────────────
function GlobalTopBar({ ticker, setTicker, tapeData, quote, loading }) {
  const [input, setInput] = useState(ticker);
  const [focused, setFocused] = useState(false);
  const tapeRef = useRef(null);

  useEffect(() => { setInput(ticker); }, [ticker]);

  // Animate ticker tape inside topbar
  useEffect(() => {
    const el = tapeRef.current;
    if (!el || !tapeData.length) return;
    let x = 0;
    const speed = 0.35;
    let raf;
    const animate = () => {
      x -= speed;
      if (x < -el.scrollWidth / 2) x = 0;
      el.style.transform = "translateX(" + x + "px)";
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [tapeData]);

  const tapeItems = useMemo(() => [...tapeData, ...tapeData], [tapeData]);
  const up = quote?.dp >= 0;

  return (
    <div className="global-topbar">
      {/* Logo */}
      <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0, paddingRight:12, borderRight:"1px solid rgba(99,110,123,0.12)", marginRight:12 }}>
        <Zap size={13} style={{ color:"#58a6ff" }} />
        <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:12, color:"#e6edf3", letterSpacing:"0.12em" }}>OMNES</span>
      </div>

      {/* Inline ticker tape */}
      <div style={{ flex:1, overflow:"hidden", height:"100%", display:"flex", alignItems:"center", minWidth:0, maskImage:"linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)" }}>
        <div ref={tapeRef} style={{ display:"flex", alignItems:"center", gap:20, whiteSpace:"nowrap", willChange:"transform" }}>
          {tapeItems.map((t, i) => (
            <span key={i} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, fontSize:10, color:"#7d8590" }}>{t.symbol}</span>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#e6edf3" }}>${fmt.price(t.price)}</span>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:clr(t.changePct) }}>
                {t.changePct >= 0 ? "▲" : "▼"}{Math.abs(t.changePct||0).toFixed(2)}%
              </span>
              <span style={{ color:"rgba(99,110,123,0.3)", marginLeft:6 }}>|</span>
            </span>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 8px", background:"#0d1117",
          border:"1px solid"+(focused?"rgba(88,166,255,0.45)":"rgba(99,110,123,0.22)"), borderRadius:8,
          transition:"border-color 0.15s, box-shadow 0.15s", boxShadow:focused?"0 0 0 3px rgba(88,166,255,0.14)":"none",
          marginLeft:12, flexShrink:0, minWidth:180 }}>
        <Search size={11} style={{ color:"#484f58", flexShrink:0 }} />
        <input value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key==="Enter") setTicker(input.trim()); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Symbol…"
          style={{ background:"none", border:"none", outline:"none", width:100, fontSize:11, color:"#e6edf3", fontFamily:"'IBM Plex Mono',monospace" }} />
        {loading && <span style={{ color:"#484f58", fontSize:9 }}>…</span>}
      </div>

      {/* Live quote strip */}
      {quote && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:12, flexShrink:0 }}>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:600, fontSize:12, color:"#e6edf3" }}>${fmt.price(quote.c)}</span>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:up?"#3fb950":"#f85149" }}>
            {up?"+":""}{fmt.price(quote.d)} ({fmt.pct(quote.dp||0)})
          </span>
        </div>
      )}

      {/* Clock */}
      <TopBarClock />
    </div>
  );
}

function TopBarClock() {
  const [t, setT] = useState(() => new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" }));
  useEffect(() => {
    const iv = setInterval(() => setT(new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" })), 15000);
    return () => clearInterval(iv);
  }, []);
  return (
    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#484f58", marginLeft:12, flexShrink:0 }}>{t}</span>
  );
}

// ─── RIGHT PANEL (Watchlist + Order Ticket) ───────────────────────────────────
function RightPanelShell({ tapeData, onSelectTicker, earnings, activeTicker }) {
  const [side, setSide] = useState("BUY");
  const [qty, setQty] = useState("");
  const [orderType, setOrderType] = useState("MKT");
  const [limitPx, setLimitPx] = useState("");
  const [orderMsg, setOrderMsg] = useState(null);

  const handleOrder = () => {
    if (!qty || isNaN(qty) || +qty <= 0) { setOrderMsg({ type:"error", text:"Enter valid quantity" }); return; }
    setOrderMsg({ type:"ok", text: side + " " + qty + " " + activeTicker + " @ " + (orderType==="MKT"?"MKT":("$"+limitPx)) + " — Simulated ✓" });
    setTimeout(() => setOrderMsg(null), 3500);
    setQty(""); setLimitPx("");
  };

  return (
    <div className="app-right">
      {/* Watchlist */}
      <div className="right-section-header" style={{ display:"flex", alignItems:"center", gap:6 }}>
        <Star size={10} style={{ color:"#e3b341" }} />  Watchlist
      </div>
      <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
        {tapeData.length === 0 && (
          <div style={{ padding:"12px 12px", fontFamily:"'IBM Plex Mono',monospace", color:"#484f58", fontSize:10 }}>Loading…</div>
        )}
        {tapeData.map(t => (
          <button key={t.symbol} onClick={() => onSelectTicker(t.symbol)}
            style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"7px 12px", background: activeTicker===t.symbol?"rgba(88,166,255,0.06)":"transparent",
              border:"none", borderBottom:"1px solid rgba(99,110,123,0.07)", cursor:"pointer",
              transition:"background 0.12s" }}
            onMouseEnter={e=>{if(activeTicker!==t.symbol) e.currentTarget.style.background="rgba(255,255,255,0.025)"}}
            onMouseLeave={e=>{if(activeTicker!==t.symbol) e.currentTarget.style.background="transparent"}}>
            <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, fontSize:11,
              color: activeTicker===t.symbol?"#58a6ff":"#e6edf3" }}>{t.symbol}</span>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#e6edf3" }}>${fmt.price(t.price)}</div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:clr(t.changePct) }}>
                {t.changePct>=0?"▲":"▼"}{Math.abs(t.changePct||0).toFixed(2)}%
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Events */}
      {earnings && (
        <>
          <div className="right-section-header">📅  Upcoming Events</div>
          <div style={{ padding:"4px 0 6px", borderBottom:"1px solid rgba(99,110,123,0.10)" }}>
            <EventsCalendar earnings={earnings} />
          </div>
        </>
      )}

      {/* Order Ticket */}
      <div className="right-section-header">🎫  Order Ticket</div>
      <div style={{ padding:"10px 12px", flexShrink:0 }}>
        {/* BUY / SELL toggle */}
        <div style={{ display:"flex", marginBottom:8, background:"#0d1117", borderRadius:6, padding:2, border:"1px solid rgba(99,110,123,0.16)" }}>
          {["BUY","SELL"].map(s => (
            <button key={s} onClick={() => setSide(s)}
              style={{ flex:1, padding:"5px 0", border:"none", borderRadius:4, fontFamily:"'Inter',sans-serif",
                fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.15s",
                background: side===s ? (s==="BUY"?"rgba(63,185,80,0.18)":"rgba(248,81,73,0.16)") : "transparent",
                color: side===s ? (s==="BUY"?"#3fb950":"#f85149") : "#484f58" }}>
              {s}
            </button>
          ))}
        </div>
        {/* Ticker display */}
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#58a6ff", fontWeight:700, marginBottom:6, textAlign:"center" }}>
          {activeTicker}
        </div>
        {/* Qty */}
        <div style={{ marginBottom:6 }}>
          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:600, color:"#484f58", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>Quantity</div>
          <input className="order-ticket-input" type="number" placeholder="0" value={qty}
            onChange={e => setQty(e.target.value)} min="1" step="1" />
        </div>
        {/* Order type */}
        <div style={{ marginBottom:6 }}>
          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:600, color:"#484f58", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>Type</div>
          <select className="order-ticket-input" value={orderType} onChange={e => setOrderType(e.target.value)}
            style={{ appearance:"none", cursor:"pointer" }}>
            <option value="MKT">Market</option>
            <option value="LMT">Limit</option>
            <option value="STP">Stop</option>
          </select>
        </div>
        {orderType !== "MKT" && (
          <div style={{ marginBottom:6 }}>
            <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:600, color:"#484f58", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>Price</div>
            <input className="order-ticket-input" type="number" placeholder="0.00" value={limitPx}
              onChange={e => setLimitPx(e.target.value)} step="0.01" />
          </div>
        )}
        <button onClick={handleOrder}
          style={{ width:"100%", padding:"7px 0", border:"none", borderRadius:6, fontFamily:"'Inter',sans-serif",
            fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:"0.06em", marginTop:2,
            background: side==="BUY"?"#238636":"#b62324", color:"#fff", transition:"opacity 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.opacity="0.85"}
          onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          PLACE {side} ORDER
        </button>
        {orderMsg && (
          <div style={{ marginTop:6, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, textAlign:"center",
            color: orderMsg.type==="ok"?"#3fb950":"#f85149" }}>
            {orderMsg.text}
          </div>
        )}
        <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9, color:"#484f58", textAlign:"center", marginTop:6 }}>
          Simulated — paper trading only
        </div>
      </div>
    </div>
  );
}

// ─── ASSET VIEW (Financial module 3-tier layout) ──────────────────────────────
function AssetView({ ticker, quote, metrics, profile, news }) {
  const [activeTab, setActiveTab] = useState("News");
  const [chartRange, setChartRange] = useState("1Y");
  const [chartData, setChartData] = useState([]);
  const [histData, setHistData] = useState(null);
  const tabsLoaded = useRef(new Set());

  const TABS = ["News","Options","Financials","Analyst","Peers","Profile","Historical"];
  const RANGES = ["1D","5D","1M","3M","6M","1Y","5Y"];
  const rangeMap = { "1D":"1d", "5D":"5d", "1M":"1mo", "3M":"3mo", "6M":"6mo", "1Y":"1y", "5Y":"5y" };
  const intMap =  { "1D":"5m","5D":"15m","1M":"1d","3M":"1d","6M":"1d","1Y":"1wk","5Y":"1mo" };

  const up = quote?.dp >= 0;
  const priceColor = up ? "#3fb950" : "#f85149";
  const m = metrics?.metric || {};

  // Fetch chart data when ticker or range changes
  useEffect(() => {
    const range = rangeMap[chartRange] || "1y";
    const interval = intMap[chartRange] || "1wk";
    fetchChart(ticker, range, interval).then(d => {
      const result = d?.chart?.result?.[0];
      if (!result) return;
      const ts = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      setChartData(ts.map((t,i) => ({ t, v: closes[i] != null ? +closes[i].toFixed(2) : null })).filter(d => d.v != null));
    }).catch(() => {});
  }, [ticker, chartRange]); // eslint-disable-line

  // Lazy-load Historical tab
  useEffect(() => {
    if (activeTab !== "Historical" || tabsLoaded.current.has("Historical")) return;
    tabsLoaded.current.add("Historical");
    fetchChart(ticker, "3mo", "1d").then(d => {
      const result = d?.chart?.result?.[0];
      if (!result) { setHistData([]); return; }
      const ts = result.timestamp || [];
      const q0 = result.indicators?.quote?.[0] || {};
      const rows = ts.map((t, i) => ({
        date: new Date(t*1000).toLocaleDateString("en-US",{month:"short",day:"2-digit",year:"numeric"}),
        open:  q0.open?.[i]?.toFixed(2),
        high:  q0.high?.[i]?.toFixed(2),
        low:   q0.low?.[i]?.toFixed(2),
        close: q0.close?.[i]?.toFixed(2),
        vol:   q0.volume?.[i],
      })).filter(r => r.close).reverse();
      setHistData(rows);
    }).catch(() => setHistData([]));
  }, [activeTab, ticker]); // eslint-disable-line

  // Quick helpers
  const fmtRange = (lo, hi) => lo && hi ? `$${fmtN(lo)} – $${fmtN(hi)}` : "—";

  const metricsGrid = [
    { label:"Open",        value: quote?.o != null ? "$"+fmt.price(quote.o) : "—" },
    { label:"Day Range",   value: fmtRange(quote?.l, quote?.h) },
    { label:"Volume",      value: quote?.v != null ? fmt.volume(quote.v) : "—" },
    { label:"Market Cap",  value: fmtMktCap(m.marketCapitalization) },
    { label:"52W Range",   value: fmtRange(m["52WeekLow"], m["52WeekHigh"]) },
    { label:"Avg Vol 10D", value: m["10DayAverageTradingVolume"] != null ? (m["10DayAverageTradingVolume"]).toFixed(1)+"M" : "—" },
    { label:"P/E (TTM)",   value: fmtX(m.peBasicExclExtraTTM) },
    { label:"EPS (TTM)",   value: m.epsBasicExclExtraItemsTTM != null ? "$"+fmtN(m.epsBasicExclExtraItemsTTM) : "—" },
  ];

  // ── Tab content renderers ─────────────────────────────────────────────────
  const renderNews = () => {
    if (!news) return <div style={{ color:"#484f58", fontFamily:"'IBM Plex Mono',monospace", fontSize:10 }}>Loading news…</div>;
    if (!news.length) return <div style={{ color:"#484f58", fontFamily:"'IBM Plex Mono',monospace", fontSize:10 }}>No recent news</div>;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {news.slice(0,14).map((n,i) => {
          const ts = n.datetime ? new Date(n.datetime*1000) : null;
          const ago = ts ? Math.floor((Date.now()-ts)/86400000) : null;
          return (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none" }}>
              <div className="news-card" style={{ padding:"8px 10px", background:"#0d1117" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(99,110,123,0.40)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor=""}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:10, marginBottom:3 }}>
                  <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:500, color:"#e6edf3", lineHeight:1.4 }}>{n.headline}</span>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#484f58", flexShrink:0 }}>
                    {ago===0?"Today":ago===1?"1d ago":ago!=null?ago+"d ago":""}
                  </span>
                </div>
                <span style={{ fontFamily:"'Inter',sans-serif", fontSize:9, color:"#58a6ff" }}>{n.source}</span>
              </div>
            </a>
          );
        })}
      </div>
    );
  };

  const renderOptions = () => {
    // Mock options chain — structured, realistic
    const strikes = [175,177.5,180,182.5,185,187.5,190,192.5,195,197.5,200];
    const spotPrice = quote?.c || 185;
    const mockChain = strikes.map(k => {
      const itm = k < spotPrice;
      const dist = Math.abs(k - spotPrice) / spotPrice;
      const callIV = (0.22 + dist * 0.4 + Math.random()*0.02).toFixed(3);
      const putIV  = (0.24 + dist * 0.38 + Math.random()*0.02).toFixed(3);
      const callBid  = Math.max(0, spotPrice - k + 2 + Math.random()*2).toFixed(2);
      const callAsk  = (+callBid + 0.05 + Math.random()*0.1).toFixed(2);
      const putBid   = Math.max(0, k - spotPrice + 2 + Math.random()*2).toFixed(2);
      const putAsk   = (+putBid + 0.05 + Math.random()*0.1).toFixed(2);
      return { strike:k, itm, callIV, putIV, callBid, callAsk, putBid, putAsk,
        callOI: Math.floor(Math.random()*12000+500),
        putOI:  Math.floor(Math.random()*9000+300),
        callVol: Math.floor(Math.random()*3000+100),
        putVol:  Math.floor(Math.random()*2500+80),
      };
    });
    return (
      <div>
        <div style={{ fontFamily:"'Inter',sans-serif", fontSize:10, color:"#484f58", marginBottom:8, display:"flex", gap:12, alignItems:"center" }}>
          <span>Expiry: <strong style={{ color:"#e3b341" }}>May 17, 2025</strong></span>
          <span>Spot: <strong style={{ color:"#e6edf3" }}>${fmt.price(spotPrice)}</strong></span>
          <span style={{ color:"#484f58" }}>· Mock data · for UI demonstration</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:0 }}>
          {/* CALLS header */}
          <table className="dense-table">
            <thead><tr>
              <th style={{ textAlign:"left" }}>IV</th><th>Bid</th><th>Ask</th><th>OI</th><th>Vol</th>
            </tr></thead>
            <tbody>
              {mockChain.map(r => (
                <tr key={r.strike} style={{ background: r.itm?"rgba(63,185,80,0.04)":"transparent" }}>
                  <td style={{ color:"#7d8590", textAlign:"left" }}>{(+r.callIV*100).toFixed(1)}%</td>
                  <td style={{ color:"#3fb950" }}>${r.callBid}</td>
                  <td style={{ color:"#f85149" }}>${r.callAsk}</td>
                  <td style={{ color:"#484f58" }}>{r.callOI.toLocaleString()}</td>
                  <td style={{ color:"#7d8590" }}>{r.callVol.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Strike column */}
          <div style={{ display:"flex", flexDirection:"column", justifyContent:"stretch" }}>
            <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", color:"#484f58", padding:"5px 14px 6px", borderBottom:"1px solid rgba(99,110,123,0.08)", textAlign:"center" }}>STRIKE</div>
            {mockChain.map(r => (
              <div key={r.strike} style={{ padding:"4px 14px", borderBottom:"1px solid rgba(99,110,123,0.06)", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700, color: Math.abs(r.strike-spotPrice)<1.5?"#58a6ff":"#8b949e", textAlign:"center", background: Math.abs(r.strike-spotPrice)<1.5?"rgba(88,166,255,0.08)":"transparent" }}>
                {r.strike.toFixed(1)}
              </div>
            ))}
          </div>
          {/* PUTS */}
          <table className="dense-table">
            <thead><tr>
              <th>Bid</th><th>Ask</th><th>OI</th><th>Vol</th><th style={{ textAlign:"right" }}>IV</th>
            </tr></thead>
            <tbody>
              {mockChain.map(r => (
                <tr key={r.strike} style={{ background: !r.itm?"rgba(248,81,73,0.04)":"transparent" }}>
                  <td style={{ color:"#3fb950" }}>${r.putBid}</td>
                  <td style={{ color:"#f85149" }}>${r.putAsk}</td>
                  <td style={{ color:"#484f58" }}>{r.putOI.toLocaleString()}</td>
                  <td style={{ color:"#7d8590" }}>{r.putVol.toLocaleString()}</td>
                  <td style={{ color:"#7d8590", textAlign:"right" }}>{(+r.putIV*100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9, color:"#484f58", marginTop:10, textAlign:"center" }}>
          Calls (ITM highlighted green) · ATM in blue · Puts (ITM highlighted red)
        </div>
      </div>
    );
  };

  const renderFinancials = () => {
    const rows = [
      ["Gross Margin (Ann.)", fmtMgn(m.grossMarginAnnual), fmtMgn(m.grossMarginTTM)],
      ["Operating Margin",   fmtMgn(m.operatingMarginAnnual), fmtMgn(m.operatingMarginTTM)],
      ["Net Margin",         fmtMgn(m.netMarginAnnual), fmtMgn(m.netMarginTTM)],
      ["ROE",                fmtMgn(m.roeRfy), fmtMgn(m.roeTTM)],
      ["ROA",                fmtMgn(m.roaRfy), fmtMgn(m.roaTTM)],
      ["ROIC",               fmtMgn(m.roiAnnual), fmtMgn(m.roiTTM)],
      ["Rev Growth QoQ YoY", fmtGr(m.revenueGrowthQuarterlyYoy), fmtGr(m.revenueGrowthTTMYoy)],
      ["EPS Growth QoQ YoY", fmtGr(m.epsGrowthQuarterlyYoy), fmtGr(m.epsGrowthTTMYoy)],
      ["Current Ratio",      fmtN(m.currentRatioAnnual), "—"],
      ["Quick Ratio",        fmtN(m.quickRatioAnnual), "—"],
      ["Debt / Equity",      fmtN(m["totalDebt/totalEquityAnnual"]), "—"],
      ["EV/EBITDA (Ann.)",   fmtX(m.evEbitdaAnnual), fmtX(m.evEbitdaTTM)],
      ["P/E",                fmtX(m.peBasicExclExtraTTM), fmtX(m.peNormalizedAnnual)],
    ];
    return (
      <table className="dense-table">
        <thead><tr>
          <th style={{ textAlign:"left" }}>Metric</th>
          <th>Annual</th>
          <th>TTM</th>
        </tr></thead>
        <tbody>
          {rows.map(([k,a,t]) => (
            <tr key={k}>
              <td style={{ color:"#7d8590", textAlign:"left" }}>{k}</td>
              <td style={{ color: a!=="—"?clrM2(a):"#484f58" }}>{a||"—"}</td>
              <td style={{ color: t!=="—"?clrM2(t):"#484f58" }}>{t||"—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderProfile = () => {
    if (!profile || !profile.name) return <div style={{ color:"#484f58", fontFamily:"'IBM Plex Mono',monospace", fontSize:10 }}>Loading profile…</div>;
    const fields = [
      ["Full Name",    profile.name],
      ["Industry",     profile.finnhubIndustry],
      ["Exchange",     profile.exchange],
      ["Country",      profile.country],
      ["Currency",     profile.currency],
      ["IPO Date",     profile.ipo],
      ["Website",      profile.weburl],
      ["Shares Out.",  profile.shareOutstanding != null ? profile.shareOutstanding.toFixed(2)+"M" : null],
    ];
    return (
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 24px" }}>
        <div>
          {profile.logo && <img src={profile.logo} alt="" style={{ height:36, width:36, objectFit:"contain", borderRadius:8, background:"#161b22", padding:4, marginBottom:12 }} />}
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:"#8b949e", lineHeight:1.7, marginBottom:12 }}>{profile.description}</p>
        </div>
        <table className="dense-table" style={{ alignSelf:"start" }}>
          <tbody>
            {fields.filter(([,v])=>v).map(([k,v]) => (
              <tr key={k}>
                <td style={{ color:"#484f58", textAlign:"left" }}>{k}</td>
                <td style={{ color:"#e6edf3" }}>
                  {k==="Website"
                    ? <a href={v} target="_blank" rel="noopener noreferrer" style={{ color:"#58a6ff", textDecoration:"none" }}>{v.replace(/^https?:\/\//,"").replace(/\/$/,"")}</a>
                    : v}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderHistorical = () => {
    if (!histData) return <div style={{ color:"#484f58", fontFamily:"'IBM Plex Mono',monospace", fontSize:10 }}>Loading…</div>;
    if (!histData.length) return <div style={{ color:"#484f58", fontFamily:"'IBM Plex Mono',monospace", fontSize:10 }}>No data</div>;
    return (
      <table className="dense-table">
        <thead>
          <tr>
            <th style={{ textAlign:"left" }}>Date</th>
            <th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th>
          </tr>
        </thead>
        <tbody>
          {histData.map((r,i) => {
            const dayUp = +r.close >= +r.open;
            return (
              <tr key={i}>
                <td style={{ color:"#7d8590", textAlign:"left" }}>{r.date}</td>
                <td>${r.open}</td>
                <td style={{ color:"#3fb950" }}>${r.high}</td>
                <td style={{ color:"#f85149" }}>${r.low}</td>
                <td style={{ color: dayUp?"#3fb950":"#f85149", fontWeight:600 }}>${r.close}</td>
                <td style={{ color:"#484f58" }}>{r.vol ? fmt.volume(r.vol) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* TIER 1: Price Hero */}
      <div className="asset-hero">
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              {profile?.logo && <img src={profile.logo} alt="" style={{ height:18, width:18, objectFit:"contain", borderRadius:4, background:"#161b22", padding:1 }} />}
              <span className="asset-ticker-name">{ticker}</span>
              <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:"#7d8590" }}>{profile?.name}</span>
              {profile?.exchange && <span style={{ fontFamily:"'Inter',sans-serif", fontSize:9, background:"#21262d", color:"#7d8590", borderRadius:4, padding:"1px 5px" }}>{profile.exchange}</span>}
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
              <span className="asset-price">{quote?.c != null ? "$"+fmt.price(quote.c) : "—"}</span>
              {quote?.d != null && (
                <span className="asset-change" style={{ color:priceColor }}>
                  {up?"+":""}{fmt.price(quote.d)} ({fmt.pct(quote.dp||0)})
                </span>
              )}
            </div>
          </div>
          {/* TF range buttons */}
          <div className="tf-btn-group">
            {RANGES.map(r => (
              <button key={r} className={"tf-btn"+(chartRange===r?" active":"")} onClick={() => setChartRange(r)}>{r}</button>
            ))}
          </div>
        </div>
        {/* Chart */}
        {chartData.length > 0 && (
          <div style={{ height:180, marginTop:8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top:4, right:0, bottom:0, left:0 }}>
                <defs>
                  <linearGradient id={"avg_"+ticker.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={priceColor} stopOpacity={0.18}/>
                    <stop offset="95%" stopColor={priceColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" hide />
                <YAxis domain={["auto","auto"]} hide />
                <Tooltip contentStyle={{ background:"#1c2230", border:"1px solid rgba(99,110,123,0.28)", borderRadius:8, fontSize:10, fontFamily:"'IBM Plex Mono',monospace" }}
                  labelFormatter={t => new Date(t*1000).toLocaleDateString()}
                  formatter={v=>["$"+v?.toFixed(2),"Price"]} />
                <Area type="monotone" dataKey="v" stroke={priceColor} strokeWidth={1.5}
                  fill={"url(#avg_"+ticker.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* TIER 2: At-a-Glance Metrics */}
      <div className="asset-metrics-grid">
        {metricsGrid.map(({ label, value }) => (
          <div key={label} className="metric-cell">
            <div className="metric-cell-label">{label}</div>
            <div className="metric-cell-value">{value}</div>
          </div>
        ))}
      </div>

      {/* TIER 3: Tabbed Workspace */}
      <div className="asset-tabs-bar">
        {TABS.map(t => (
          <button key={t} className={"asset-tab-btn"+(activeTab===t?" active":"")} onClick={() => setActiveTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="asset-tab-content">
        {activeTab==="News"       && renderNews()}
        {activeTab==="Options"    && renderOptions()}
        {activeTab==="Financials" && (
          <div className="flex flex-col gap-4">
            {renderFinancials()}
            <FinancialStatements ticker={ticker} />
          </div>
        )}
        {activeTab==="Analyst"    && <AnalystData ticker={ticker} />}
        {activeTab==="Peers"      && <PeerComparison ticker={ticker} metrics={metrics} quote={quote} />}
        {activeTab==="Profile"    && renderProfile()}
        {activeTab==="Historical" && renderHistorical()}
      </div>
    </div>
  );
}

// Helper for coloring margin/ratio values
function clrM2(v) {
  if (typeof v !== "string") return "#e6edf3";
  const n = parseFloat(v);
  if (isNaN(n)) return "#e6edf3";
  if (v.includes("%")) return n > 0 ? "#3fb950" : "#f85149";
  return "#e6edf3";
}

export default function App() {
  const [activePage, setActivePage] = useState("financial");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(() => ({ showTickerTape: true, ...loadSettings() }));
  const [ticker, setTicker] = useState("AAPL");
  const [quote, setQuote] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [profile, setProfile] = useState(null);
  const [news, setNews] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [tapeData, setTapeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingResearchItem, setPendingResearchItem] = useState(null);
  const [statusTime, setStatusTime] = useState(() => new Date().toLocaleTimeString());

  // Live clock in status bar
  useEffect(() => {
    const iv = setInterval(() => setStatusTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    setLoading(true);
    setQuote(null); setMetrics(null); setProfile(null); setNews(null); setEarnings(null);
    const today = new Date().toISOString().split("T")[0];
    const monthAgo = new Date(Date.now()-30*24*3600*1000).toISOString().split("T")[0];
    const yearAhead = new Date(Date.now()+365*24*3600*1000).toISOString().split("T")[0];
    Promise.all([
      api("/quote?symbol="+ticker),
      delay(300).then(() => api("/stock/metric?symbol="+ticker+"&metric=all")),
      delay(600).then(() => api("/stock/profile2?symbol="+ticker)),
      delay(900).then(() => api("/company-news?symbol="+ticker+"&from="+monthAgo+"&to="+today)),
      delay(1200).then(() => api("/calendar/earnings?symbol="+ticker+"&from="+today+"&to="+yearAhead)),
    ]).then(([q,m,p,n,e]) => {
      setQuote(q); setMetrics(m); setProfile(p);
      setNews(Array.isArray(n)?n:[]);
      setEarnings(e?.earningsCalendar||[]);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, [ticker]);

  useEffect(() => {
    // Stagger to respect Finnhub rate limits; single state update at end to avoid 8 re-renders
    const fetchTape = async () => {
      const results = [];
      for (let i = 0; i < WATCHLIST.length; i++) {
        if (i > 0) await delay(150);
        try {
          const q = await api("/quote?symbol=" + WATCHLIST[i]);
          results.push({ symbol: WATCHLIST[i], price: q.c, changePct: q.dp });
        } catch(e) {}
      }
      setTapeData(results);
    };
    fetchTape();
  }, []);

  const openResearch = (item) => { setPendingResearchItem(item); setActivePage("research"); };

  return (
    <div className={"app-shell" + (sidebarOpen ? " sidebar-open" : "")} style={{ fontFamily:"'Inter','IBM Plex Sans',sans-serif", background:"#0d1117", color:"#e6edf3" }}>
      <GlobalStyles />

      {/* ── Global Top Bar ─────────────────────────────────── */}
      <GlobalTopBar
        ticker={ticker}
        setTicker={t => { setTicker(t); setActivePage("financial"); }}
        tapeData={tapeData}
        quote={activePage==="financial" ? quote : null}
        loading={loading}
      />

      {/* ── Left Sidebar ───────────────────────────────────── */}
      <SidebarNav
        activePage={activePage}
        setActivePage={setActivePage}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />

      {/* ── Main Content ───────────────────────────────────── */}
      <div className="app-main">
        {activePage === "financial" && (
          <AssetView
            ticker={ticker}
            quote={quote}
            metrics={metrics}
            profile={profile}
            news={news}
          />
        )}
        {activePage === "commodities"  && <CommoditiesDashboard />}
        {activePage === "crypto"       && <CryptoDashboard />}
        {activePage === "supplychain"  && <SupplyChainDashboard onOpenResearch={openResearch} />}
        {activePage === "fx"           && <FXDashboard onOpenResearch={openResearch} />}
        {activePage === "technical"    && <TechnicalAnalysis ticker={ticker} />}
        {activePage === "eye"          && <EyeOfSauron onOpenResearch={openResearch} />}
        {activePage === "markets"      && <GlobalMarketsModule onOpenResearch={openResearch} />}
        {activePage === "portfolio"    && <PortfolioTracker />}
        {activePage === "research"     && <ResearchBrowser pendingItem={pendingResearchItem} onPendingConsumed={() => setPendingResearchItem(null)} />}
        {activePage === "settings" && (
          <div style={{ padding:24, maxWidth:480 }}>
            <div style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, fontSize:13, color:"#e6edf3", marginBottom:16 }}>Settings</div>
            <div style={{ background:"#161b22", border:"1px solid rgba(99,110,123,0.18)", borderRadius:10, padding:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:"#e6edf3", fontWeight:500 }}>Ticker Tape</div>
                  <div style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:"#7d8590" }}>Scrolling prices in top bar</div>
                </div>
                <button onClick={() => setSettings(s => { const n={...s, showTickerTape:!s.showTickerTape}; saveSettings(n); return n; })}
                  style={{ width:40, height:22, borderRadius:11, border:"none", cursor:"pointer", background:settings.showTickerTape?"#1f6feb":"#30363d", position:"relative", transition:"background 0.2s" }}>
                  <div style={{ position:"absolute", top:3, left:settings.showTickerTape?21:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Right Panel ────────────────────────────────────── */}
      <RightPanelShell
        tapeData={tapeData}
        onSelectTicker={t => { setTicker(t); setActivePage("financial"); }}
        earnings={earnings}
        activeTicker={ticker}
      />

      {/* ── Status Bar ─────────────────────────────────────── */}
      <div className="status-bar" style={{ gridArea:"status", display:"flex", alignItems:"center", gap:16, padding:"0 12px", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:"#3fb950", boxShadow:"0 0 6px rgba(63,185,80,0.6)" }} />
        <span>OMNES VIDENTES · LIVE DATA</span>
        <span style={{ color:"rgba(99,110,123,0.3)" }}>|</span>
        <MarketSessionBadges />
        <span style={{ marginLeft:"auto" }}>{statusTime}</span>
      </div>
    </div>
  );
}// build Thu Apr  9 12:56:09 EDT 2026
