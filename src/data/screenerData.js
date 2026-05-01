// NOTE: SCREENER_UNIVERSE and FULL_UNIVERSE are in src/screenerData.js

export const SC_COLS = [
  { key:"ticker",      label:"Ticker",   w:72,  flex:0, num:false },
  { key:"name",        label:"Company",  w:180, flex:1, num:false },
  { key:"sector",      label:"Sector",   w:112, flex:0, num:false },
  { key:"price",       label:"Price",    w:78,  flex:0, num:true  },
  { key:"changePct",   label:"Chg%",     w:68,  flex:0, num:true  },
  { key:"mktCap",      label:"Mkt Cap",  w:88,  flex:0, num:true  },
  { key:"pe",          label:"P/E",      w:58,  flex:0, num:true  },
  { key:"fwdPe",       label:"Fwd P/E",  w:62,  flex:0, num:true  },
  { key:"pb",          label:"P/B",      w:52,  flex:0, num:true  },
  { key:"revGrowth",   label:"Rev%",     w:65,  flex:0, num:true  },
  { key:"grossMargin", label:"Gross%",   w:62,  flex:0, num:true  },
  { key:"netMargin",   label:"Net%",     w:58,  flex:0, num:true  },
  { key:"roe",         label:"ROE%",     w:58,  flex:0, num:true  },
  { key:"debtToEq",    label:"D/E",      w:52,  flex:0, num:true  },
  { key:"divYield",    label:"Div%",     w:56,  flex:0, num:true  },
  { key:"beta",        label:"Beta",     w:52,  flex:0, num:true  },
  { key:"volume",      label:"Vol(M)",   w:68,  flex:0, num:true  },
  { key:"rating",      label:"Rating",   w:92,  flex:0, num:false },
];
export const SC_ROW_H = 32; // px — fixed row height for virtualizer


// FMP sector names → our screener sector labels
export const FMP_SECTOR_MAP = {
  "Financial Services":    "Financials",
  "Consumer Cyclical":     "Consumer Disc.",
  "Consumer Defensive":    "Consumer Staples",
  "Communication Services":"Communication",
  "Basic Materials":       "Materials",
  // pass-through sectors (same name in both systems)
  "Technology":            "Technology",
  "Healthcare":            "Healthcare",
  "Energy":                "Energy",
  "Industrials":           "Industrials",
  "Utilities":             "Utilities",
  "Real Estate":           "Real Estate",
};


export const NAV_ITEMS = [
  { key:"financial",   icon:"📈", label:"Financial"   },
  { key:"commodities", icon:"🛢", label:"Commodities" },
  { key:"crypto",      icon:"₿",  label:"Crypto"      },
  { key:"supplychain", icon:"📉", label:"Macro"       },
  { key:"technical",   icon:"📊", label:"Technical"   },
  { key:"eye",         icon:"👁",  label:"Eye of Sauron"},
  { key:"fx",          icon:"💱", label:"FX"          },
  { key:"markets",     icon:"🌍", label:"Markets"     },
  { key:"portfolio",   icon:"💼", label:"Portfolio"   },
  { key:"screener",    icon:"🔍", label:"Screener"    },
  { key:"research",    icon:"🔬", label:"Research"    },
  { key:"earnings",    icon:"📅", label:"Earnings"    },
];
