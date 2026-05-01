import { SCREENER_UNIVERSE } from '../screenerData';

export const WATCHLIST = ["SPY", "QQQ", "MSFT", "NVDA", "TSLA", "GOOGL", "AMZN", "META"];

export const PF_COLORS = ["#2563eb","#059669","#e11d48","#b45309","#7c3aed","#ea580c","#0891b2","#be123c","#047857","#92400e","#78716c","#475569"];

export const SECTOR_CLR = {
  "Technology":"#2563eb","Healthcare":"#059669","Financials":"#b45309",
  "Consumer Disc.":"#ea580c","Consumer Staples":"#047857","Communication":"#7c3aed",
  "Energy":"#92400e","Industrials":"#475569","Materials":"#78716c",
  "Utilities":"#0891b2","Real Estate":"#be123c",
};
export const RATING_CLR = {
  "Strong Buy":"#059669","Buy":"#2563eb","Hold":"#b45309","Sell":"#e11d48","Strong Sell":"#be123c",
};
export const SCREENER_PRESETS = [
  { label:"🚀 High Growth",       f:{ revGrowthMin:"15", grossMarginMin:"40" } },
  { label:"💎 Value Plays",       f:{ peMax:"15", divYieldMin:"1", profitable:true } },
  { label:"💰 Dividend Dogs",     f:{ divYieldMin:"3.5" } },
  { label:"🏔 Mega Caps",         f:{ mktCapTier:"Mega" } },
  { label:"⚡ Tech Quality",      f:{ sector:"Technology", grossMarginMin:"60" } },
  { label:"🛡 Low Beta",          f:{ betaMax:"0.6" } },
  { label:"🏆 Strong Buys",       f:{ rating:"Strong Buy" } },
  { label:"🏦 Capital Efficient", f:{ roeMin:"20", debtToEqMax:"1.0", profitable:true } },
  { label:"📖 Deep Value",        f:{ peMax:"15", pbMax:"2.0", profitable:true } },
  { label:"💪 Quality Growth",    f:{ roeMin:"15", grossMarginMin:"50", revGrowthMin:"10" } },
];

export const EC_NOTABLE = new Set([...SCREENER_UNIVERSE.map(s => s.ticker), ...WATCHLIST]);
export const hourBg  = h => h==="bmo"?"rgba(37,99,235,0.13)":h==="amc"?"rgba(180,83,9,0.13)":"rgba(107,114,128,0.10)";
export const hourClr = h => h==="bmo"?"#2563eb":h==="amc"?"#b45309":"var(--text-3)";
export const hourLabel = h => h==="bmo"?"BEFORE OPEN":h==="amc"?"AFTER CLOSE":h?h.toUpperCase():"TBD";

export const TIMEFRAMES = ["1W", "1M", "3M", "1Y"];
export const TF_CFG = {
  "1W": { range: "5d",  interval: "1h",  days: 7   },
  "1M": { range: "1mo", interval: "1d",  days: 30  },
  "3M": { range: "3mo", interval: "1d",  days: 90  },
  "1Y": { range: "1y",  interval: "1d",  days: 365 },
};
