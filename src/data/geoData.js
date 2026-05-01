export const GEO_CATEGORIES = {
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
    color: "#7c3aed", bg: "rgba(188,140,255,0.08)",
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
    color: "#b45309", bg: "rgba(227,179,65,0.08)",
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
    color: "#2563eb", bg: "rgba(37,99,235,0.08)",
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
    color: "#ea580c", bg: "rgba(240,136,62,0.08)",
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
    color: "#059669", bg: "rgba(5,150,105,0.08)",
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
    color: "#e11d48", bg: "rgba(225,29,72,0.08)",
    assets: [
      { id:"GC=F", label:"Gold",             type:"commodity", ticker:"GC=F", category:"Commodities" },
      { id:"CL=F", label:"Crude Oil",         type:"commodity", ticker:"CL=F", category:"Commodities" },
      { id:"ITA",  label:"Defense ETF (ITA)", type:"equity",    ticker:"ITA",  category:"Equities" },
      { id:"DX=F", label:"USD Index",         type:"fx",        ticker:"DX=F", category:"FX" },
    ],
    why: "Military escalation drives safe-haven flows into gold and USD, lifts energy prices on supply-risk fears, and boosts defense sector revenues.",
  },
};

export const GEO_REGIONS = {
  "🇺🇸 US":         ["united states","u.s. ","american","washington dc","biden","trump","congress","federal reserve","white house","pentagon","u.s. economy","u.s. dollar","treasury secretary"],
  "🇨🇳 China":       ["china","chinese","beijing","xi jinping","pboc","ccp","taiwan","hong kong","shanghai","yuan","renminbi","chinese economy"],
  "🇷🇺 Russia":      ["russia","russian","moscow","putin","kremlin","ukraine","rouble","gazprom","russian economy"],
  "🇪🇺 Europe":      ["europe","european","eurozone","ecb","germany","france","united kingdom","britain","euro zone","sterling","european union","eu trade"],
  "🌍 Middle East":  ["iran","israel","saudi","opec","gulf state","iraq","syria","yemen","palestin","hamas","hezbollah","middle east","riyadh","tehran"],
  "🌏 Asia Pacific": ["japan","south korea","india","australia","singapore","bank of japan","asia pacific","southeast asia","asean","indian rupee","japanese yen"],
  "🌎 LatAm":        ["brazil","mexico","argentina","venezuela","chile","colombia","latin america","brazilian real","mexican peso"],
};

export const GEO_ASSET_COLOR = { equity:"#2563eb", commodity:"#b45309", fx:"#059669", macro:"#7c3aed", topic:"#ea580c" };

export const BULLISH_WORDS = ["ceasefire","peace deal","diplomatic agreement","de-escalat","easing tension","recovery","stimulus","rate cut","rate cuts","trade deal signed","accord","truce","resolution","normalization"];
export const BEARISH_WORDS = ["invasion","crisis","default","collapse","recession","escalat","new sanction","tariff hike","production cut","blockade","restrict","ultimatum","hostile","military offensive","coup","regime collapse"];

export function classifyGeoArticle(article) {
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

export function geoTimeAgo(ts) {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return "Just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

export const GEO_IMPACT_COLOR = { High:"#e11d48", Medium:"#b45309", Low:"#059669" };
export const GEO_SIGNAL_COLOR = { Bullish:"#059669", Bearish:"#e11d48", Neutral:"#64748b" };
export const GEO_SIGNAL_ICON  = { Bullish:"▲", Bearish:"▼", Neutral:"◆" };


export const ARC_STYLE = {
  oilRoutes:  { color:"rgba(240,165,0,0.85)",   stroke:0.85, altitude:0.18 },
  pipelines:  { color:"rgba(232,93,4,0.90)",    stroke:0.70, altitude:0.04 },
  seaCables:  { color:"rgba(37,99,235,0.70)",  stroke:0.50, altitude:0.07 },
  tradeFlows: { color:"rgba(167,139,250,0.75)", stroke:0.65, altitude:0.27 },
};
export const PT_STYLE = {
  chokepoints:   { color:"#e11d48", r:0.55, alt:0.016 },
  cableLandings: { color:"#059669", r:0.22, alt:0.005 },
  majorPorts:    { color:"#06b6d4", r:0.30, alt:0.008 },
  conflictZones: { color:"#ff3333", r:0.70, alt:0.014 },
  sanctioned:    { color:"#b45309", r:0.50, alt:0.008 },
};
const arcCol = d => ARC_STYLE[d._layer]?.color    || "rgba(255,255,255,0.6)";
const arcStr = d => ARC_STYLE[d._layer]?.stroke   || 0.5;
const arcAlt = d => ARC_STYLE[d._layer]?.altitude || 0.1;
const ptCol  = d => PT_STYLE[d._layer]?.color || "#fff";
const ptRad  = d => PT_STYLE[d._layer]?.r     || 0.3;
const ptAlt  = d => PT_STYLE[d._layer]?.alt   || 0.01;

// ── Region filter definitions ──
export const GLOBE_REGIONS = {
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
export const CHOKEPOINTS = [
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
export const OIL_ROUTES = [
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
export const PIPELINES = [
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
export const SEA_CABLES = [
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
export const CABLE_LANDINGS = [
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
export const CONFLICT_ZONES = [
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
export const SANCTIONED_REGIONS = [
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
export const TRADE_FLOWS = [
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
export const MAJOR_PORTS = [
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
export const GLOBE_LAYER_CONFIG = {
  // Infrastructure
  oilRoutes:     { label:"Oil Shipping Routes",    icon:"🛢",  color:"#f0a500", cat:"infrastructure", desc:"Major global oil tanker routes",    enabled:true,  count:OIL_ROUTES.length },
  pipelines:     { label:"Pipelines",              icon:"⚡",  color:"#e85d04", cat:"infrastructure", desc:"Major oil and gas pipelines",        enabled:false, count:0 },
  seaCables:     { label:"Subsea Internet Cables", icon:"🌐",  color:"#2563eb", cat:"infrastructure", desc:"Global undersea fiber-optic cables", enabled:true,  count:SEA_CABLES.length },
  cableLandings: { label:"Cable Landing Points",   icon:"📡",  color:"#059669", cat:"infrastructure", desc:"Coastal cable terminal stations",    enabled:false, count:0 },
  // Transportation
  majorPorts:    { label:"Major Ports",            icon:"🚢",  color:"#06b6d4", cat:"transportation", desc:"World's top container & energy ports",enabled:false, count:0 },
  // Geopolitics
  chokepoints:   { label:"Strategic Chokepoints",  icon:"⚓",  color:"#e11d48", cat:"geopolitics",    desc:"Critical maritime chokepoints",      enabled:true,  count:CHOKEPOINTS.length },
  conflictZones: { label:"Conflict Zones",         icon:"⚔️",  color:"#ff3333", cat:"geopolitics",    desc:"Active conflicts and instability",   enabled:false, count:0 },
  sanctioned:    { label:"Sanctioned Regions",     icon:"🚫",  color:"#b45309", cat:"geopolitics",    desc:"Sanctioned countries and embargoes", enabled:false, count:0 },
  // Markets
  tradeFlows:    { label:"Global Trade Flows",     icon:"📦",  color:"#a78bfa", cat:"markets",        desc:"Major global trade corridors",       enabled:false, count:0 },
};

export const GLOBE_CATEGORIES = [
  { id:"infrastructure", label:"Infrastructure", icon:"🏗" },
  { id:"transportation", label:"Transportation", icon:"🚢" },
  { id:"geopolitics",    label:"Geopolitics",    icon:"🌏" },
  { id:"markets",        label:"Markets",        icon:"📊" },
];

export const GLOBE_FUTURE_LAYERS = [
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
export const TIP = "background:#0d1117;border:1px solid #30363d;padding:5px 10px;border-radius:3px;font-family:monospace;font-size:10px;color:#e6edf3;pointer-events:none";


