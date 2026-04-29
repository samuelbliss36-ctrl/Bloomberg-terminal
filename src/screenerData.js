/**
 * screenerData.js — Institutional-grade screener universe (2,500+ US equities)
 *
 * Exports
 *   SCREENER_UNIVERSE  ~70 notable tickers  (used by EC_NOTABLE, portfolio sector lookup)
 *   FULL_UNIVERSE      2,500+ tickers       (used by StockScreener)
 */

/* ── Seeded PRNG (mulberry32) ──────────────────────────────────────── */
function mkRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 0x100000000;
  };
}

/* ── Clamped normal variate (Box-Muller) ───────────────────────────── */
function N(r, mean, sd, lo, hi) {
  const u = Math.max(1e-10, r()), v = r();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.min(hi, Math.max(lo, mean + sd * z));
}
const rnd = (r, lo, hi) => lo + r() * (hi - lo);
const r1  = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

/* ── Sector generation parameters ─────────────────────────────────── */
//   lossRate: P(unprofitable)   nullRoe/nullDe: P(field shown as null)
//   pe/gm/nm/rg/dy/b/ro/de/pb: [mean, sd, lo, hi]
const SP = {
  "Technology":       { lossRate:.18, nullRoe:.08, nullDe:.05, pe:[32,15,10,150], gm:[60,22,15,95], nm:[11,20,-45,50], rg:[9,28,-25,150], dy:[.4,.8,0,3],  b:[1.30,.40,.5,2.5], ro:[22,35,-30,180], de:[.50,.80,0,5],  pb:[8,12,.5,60] },
  "Healthcare":       { lossRate:.30, nullRoe:.12, nullDe:.08, pe:[28,20,8,120],  gm:[62,26,5,95],  nm:[4,28,-90,42],  rg:[7,20,-20,80],  dy:[1.2,1.5,0,7], b:[0.65,.28,.2,1.5], ro:[12,28,-40,80],  de:[.80,1.0,0,8],  pb:[4,6,.3,55]  },
  "Financials":       { lossRate:.06, nullRoe:.05, nullDe:.85, pe:[14,5,6,35],    gm:[null],         nm:[18,10,3,42],   rg:[5,12,-15,35],  dy:[2.4,1.2,0,7], b:[1.10,.30,.5,1.8], ro:[12,6,2,45],     de:[1.50,.80,0,12],pb:[1.5,.9,.3,8] },
  "Consumer Disc.":   { lossRate:.12, nullRoe:.15, nullDe:.10, pe:[28,18,8,100],  gm:[35,22,5,85],  nm:[7,15,-40,38],  rg:[4,18,-25,40],  dy:[.9,1.5,0,5],  b:[1.20,.40,.5,2.2], ro:[14,28,-30,80],  de:[1.0,1.5,0,12], pb:[4,7,.3,45]  },
  "Consumer Staples": { lossRate:.05, nullRoe:.10, nullDe:.08, pe:[22,6,10,40],   gm:[40,15,8,78],  nm:[11,8,0,30],    rg:[3,6,-12,18],   dy:[2.8,1.5,0,8], b:[0.58,.20,.2,1.0], ro:[28,20,3,90],    de:[1.0,1.0,0,6],  pb:[6,5,1,22]   },
  "Communication":    { lossRate:.10, nullRoe:.08, nullDe:.08, pe:[20,12,6,60],   gm:[54,22,10,88], nm:[10,15,-30,42], rg:[5,15,-15,35],  dy:[2.2,2.0,0,8], b:[0.90,.30,.3,1.6], ro:[14,20,-20,50],  de:[1.0,.80,0,8],  pb:[3.5,5,.4,25] },
  "Energy":           { lossRate:.15, nullRoe:.10, nullDe:.05, pe:[12,5,4,35],    gm:[35,15,5,70],  nm:[7,15,-40,30],  rg:[-2,22,-45,40], dy:[3.2,1.5,0,9], b:[0.95,.30,.3,1.8], ro:[12,10,-20,40],  de:[.45,.45,0,4],  pb:[1.9,1.0,.3,8]},
  "Industrials":      { lossRate:.08, nullRoe:.08, nullDe:.05, pe:[22,8,8,50],    gm:[30,12,5,58],  nm:[8,8,-15,28],   rg:[3,12,-22,28],  dy:[1.5,1.2,0,5], b:[1.00,.28,.4,1.7], ro:[15,15,-10,75],  de:[1.0,1.2,0,8],  pb:[3.5,4,.5,18] },
  "Materials":        { lossRate:.10, nullRoe:.08, nullDe:.05, pe:[18,8,5,50],    gm:[35,15,5,70],  nm:[9,10,-25,30],  rg:[2,18,-30,70],  dy:[1.8,1.5,0,6], b:[1.00,.40,.3,1.9], ro:[12,10,-15,50],  de:[.65,.60,0,5],  pb:[2.3,2,.4,12] },
  "Utilities":        { lossRate:.03, nullRoe:.05, nullDe:.02, pe:[20,5,10,35],   gm:[44,14,12,70], nm:[12,6,2,28],    rg:[2,5,-8,12],    dy:[3.8,1.0,1,8], b:[0.40,.15,.1,.9],  ro:[9,5,2,22],      de:[1.5,.50,.5,4], pb:[1.4,.5,.6,3.5]},
  "Real Estate":      { lossRate:.08, nullRoe:.25, nullDe:.06, pe:[35,20,10,90],  gm:[65,15,20,88], nm:[18,20,-30,50], rg:[4,8,-10,22],   dy:[3.8,2.0,0,9], b:[0.75,.28,.2,1.5], ro:[7,10,-20,30],   de:[1.0,.50,.3,4], pb:[1.8,1.5,.4,8]},
};

/* ── Name pools ────────────────────────────────────────────────────── */
const PRE = {
  "Technology":       ["Quantum","Apex","Vertex","Nexus","Cipher","CloudCore","Nano","CyberSys","LogicWave","DataStream","VoltTech","CoreData","EdgeNet","GridLogic","LinkSoft","NodeSys","PulseAI","FluxData","ArrayTech","ByteWave","BitStream","ProtoSys","Ultratech","Hyperion","MacroSys","OmniData","UniStack","NeoTech","PrimeData","AlphaNet","BetaCode","GammaTech","DeltaSoft","SigmaData","AeroByte","ExoSys","AstroTech","InfiniteStack","CortexAI","SynthNet","BinaryCore","HelixData","PivotTech","ZenithSys","Vector","Prisma","Luminary","Stratos","Vortex","Epoch"],
  "Healthcare":       ["BioGen","MedTech","GeneSys","PharmaCore","NeuroLink","CardioGen","OncoTech","ImmunoSys","EndoGen","OrthoMed","PulmoCore","GastroCure","HemaGen","NephroSys","UroGen","VascuTech","BioPharma","MedGene","GenePath","CuraSys","LifeSci","MedPath","BioPath","GenVita","PharmaCure","NeuroGen","BioAxis","CellaGen","ProtiSys","VitaCore","ImmunePath","GenMed","CellThera","BioNexus","HelioBio","SpectraGen","VectorMed","ChronoPharm","RenaGen","SomataMed"],
  "Financials":       ["First","National","State","Premier","Summit","Harbor","Bridge","Central","Crown","Eagle","Horizon","Keystone","Liberty","Patriot","Pioneer","Pinnacle","Republic","Sterling","United","Anchor","Atlantic","Pacific","Sovereign","Fidelity","Heritage","Commerce","Empire","Federal","Continental","Allied","Midwest","Coastal","Majestic","Granite","Meridian","Cascade","Ridgeline","BlueStar","Cornerstone","Triumphant","Reliant","Frontier","Provident","Steadfast","Equitable","Vanguard","Prudential","Consolidated","American"],
  "Consumer Disc.":   ["Style","Trend","Luxe","Urban","Active","Premium","Select","Prestige","Elite","Signature","Classic","Iconic","Fusion","Dynamic","Bold","Zest","Spark","Glow","Vivid","Crest","Vista","Vibe","Savvy","Solo","Evolve","Stride","Craft","Woven","Arc","Nova","Shift","Chase","Rally","Bloom","Verve","Slate","Drift","Motion","Blend","Canvas","Pinnacle","Revive","Spire","Coda","Echo"],
  "Consumer Staples": ["Fresh","Pure","Natural","Harvest","Sunrise","Golden","Heritage","Classic","Family","True","Simple","Essential","Daily","Valley","Field","Garden","Earth","Spring","River","Meadow","Prairie","Woodland","Brook","Lake","Oak","Maple","Cedar","Birch","Clover","Amber","Wholesome","Bright","Kind","Grove","Crest","Tide","Bountiful","Verdant","Farmhouse","Orchid"],
  "Communication":    ["Stream","Broadcast","Signal","Wave","Connect","NetMedia","Voice","Sync","Relay","Beam","Reach","Span","Hub","Nexus","Swift","Direct","Open","Global","Alliance","Channel","Frequency","Spectrum","Platform","Vibe","Cast","Pulse","Orbit","Fusion","Clear","Radiant","Echo","Link","Helix","Beacon","Surge","Trans","Resonant","Vertex","Apex","Clarity"],
  "Energy":           ["Sunrise","Pinnacle","Frontier","Pioneer","Liberty","Plains","Basin","Gulf","Delta","Mountain","Valley","Coast","Eagle","Falcon","Summit","Ridge","Horizon","Continental","Pacific","Atlantic","Clearwater","Benchmark","Patriot","Republic","Heritage","Keystone","Emerald","Cascade","Granite","Sage","Arrow","Meridian","Vanguard","Thunder","Ironwood","Crestline","Redstone","Clearfield","Bravo","Maverick"],
  "Industrials":      ["General","National","American","United","Standard","Dynamic","Advanced","Modern","Precision","Quality","Superior","Atlas","Titan","Eagle","Apex","Summit","Ridge","Empire","Continental","Allied","Merit","Triumph","Spectrum","Vanguard","Heartland","Republic","Reliant","Frontier","Interstate","Paramount","Steadfast","Concord","Integrated","Global","Pioneer","Keystone","Sterling","Liberty","Federal","Commerce"],
  "Materials":        ["Advanced","Applied","Specialty","Premium","Pure","Ultra","Micro","Nano","Poly","Alloy","Silica","Carbon","Fiber","Composite","Crystal","Cobalt","Lithium","Earth","Mining","Chem","Molecular","Prismatic","Element","Catalyst","Synthesis","Ferrous","Mineral","Nova","Forge","Stratum","Axial","Veridian","Isotope","Metallix","Nexite","Chromacore","Periodic","Basalt","Quartzite","Alchemex"],
  "Utilities":        ["Electric","Power","Energy","Gas","Water","Public","City","National","American","Pacific","Atlantic","Central","Western","Eastern","Northern","Southern","New","Premier","Core","Grid","Source","Supply","Network","Generation","Reliable","Unified","Valley","Coastal","Ridge","Prairie","Summit","Cascade","Meridian","Clearwater","Horizon","Federal","Heritage","Frontier","Interstate","Consolidated"],
  "Real Estate":      ["Realty","Properties","Estate","Building","Plaza","Tower","Center","Park","Place","Square","Crest","Summit","Ridge","View","Vista","Heights","Hills","Shores","Lakes","Pines","Woods","Garden","Valley","Brook","River","Bay","Harbor","Gate","Landmark","Horizon","Meridian","Cornerstone","Pinnacle","Arcadia","Majestic","Colonial","Heritage","Patriot","Sovereign","Continental"],
};
const SUF = {
  "Technology":       ["Technologies","Systems","Software","Corp","Inc","Group","Holdings","Solutions","Platforms","AI","Labs","Networks","Digital","Cloud","Tech"],
  "Healthcare":       ["Therapeutics","Pharmaceuticals","Biosciences","Medical","Health","Corp","Inc","Labs","Biotech","Sciences","Bio","Pharma","Genomics","Medicine","Diagnostics"],
  "Financials":       ["Financial","Bancorp","Bank","Capital","Asset Mgmt","Corp","Group","Holdings","Trust","Investments","Partners","Advisors","Markets","Securities","Finance"],
  "Consumer Disc.":   ["Brands","Group","Corp","Inc","Holdings","Retail","Lifestyle","Entertainment","Leisure","Media","Products","Services","Industries","International","Co"],
  "Consumer Staples": ["Foods","Beverages","Consumer","Household","Personal","Nutrition","Brands","Products","Industries","Corp","Inc","Group","Holdings","International","Co"],
  "Communication":    ["Media","Telecom","Wireless","Broadband","Networks","Communications","Interactive","Digital","Streaming","Broadcasting","Corp","Inc","Group","Holdings","Entertainment"],
  "Energy":           ["Energy","Resources","Petroleum","Corp","Inc","Group","Holdings","Exploration","Production","Services","Partners","Solutions","Infrastructure","International","Midstream"],
  "Industrials":      ["Industries","Manufacturing","Systems","Corp","Inc","Group","Holdings","Solutions","Services","Technologies","Engineering","Works","International","Supply","Dynamics"],
  "Materials":        ["Materials","Chemical","Minerals","Mining","Metals","Corp","Inc","Group","Holdings","Industries","Solutions","Technologies","International","Products","Resources"],
  "Utilities":        ["Electric","Power","Gas","Water","Services","Utilities","Corp","Inc","Group","Holdings","Energy","Networks","Distribution","Infrastructure","Solutions"],
  "Real Estate":      ["Properties","Realty","REIT","Trust","Corp","Inc","Group","Holdings","Development","Investments","Partners","Capital","Commercial","Residential","Industrial"],
};

/* ── Sector weight distribution (Russell 3000 approximate) ────────── */
const SECTOR_WEIGHTS = [
  ["Technology",27],["Healthcare",13],["Financials",13],["Consumer Disc.",11],
  ["Communication",9],["Industrials",8],["Consumer Staples",6],["Energy",4],
  ["Materials",3],["Utilities",3],["Real Estate",3],
];
function pickSector(r) {
  const roll = r() * 100, cum = [0];
  for (const [s, w] of SECTOR_WEIGHTS) {
    cum.push(cum[cum.length - 1] + w);
    if (roll < cum[cum.length - 1]) return s;
  }
  return "Technology";
}

/* ── Ticker generator ──────────────────────────────────────────────── */
const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function makeTicker(r, used) {
  let t;
  do {
    const len = r() < .08 ? 2 : r() < .55 ? 3 : r() < .92 ? 4 : 5;
    t = Array.from({ length: len }, () => AZ[Math.floor(r() * 26)]).join("");
  } while (used.has(t));
  used.add(t);
  return t;
}

/* ── Stock generator ───────────────────────────────────────────────── */
function generateStocks(count, seed, usedTickers) {
  const r = mkRng(seed);
  const stocks = [];

  for (let i = 0; i < count; i++) {
    const sector = pickSector(r);
    const p = SP[sector];

    /* Market cap — log-normal, biased toward small cap (Russell 3000 style) */
    const capRoll = r();
    let mktCap;
    if      (capRoll < .04) mktCap = Math.exp(N(r, Math.log(500), .80, Math.log(200), Math.log(3000)));
    else if (capRoll < .14) mktCap = Math.exp(N(r, Math.log(30),  .80, Math.log(10),  Math.log(200)));
    else if (capRoll < .39) mktCap = Math.exp(N(r, Math.log(4),   .60, Math.log(2),   Math.log(10)));
    else                    mktCap = Math.exp(N(r, Math.log(.45), .70, Math.log(.05), Math.log(2)));
    mktCap = r1(mktCap, 1);

    /* Fundamentals */
    const profitable = r() > p.lossRate;
    const pe = (p.pe[0] == null || !profitable) ? null : r1(N(r, ...p.pe), 1);
    const fwdPe = pe ? r1(pe * rnd(r, .60, .95), 1) : null;
    const gm = p.gm[0] == null ? null : r1(N(r, ...p.gm), 1);
    const nm = profitable ? r1(N(r, ...p.nm), 1) : r1(N(r, -22, 18, -80, -.1), 1);
    const rg = r1(N(r, ...p.rg), 1);
    const dy = r1(Math.max(0, N(r, ...p.dy)), 2);
    const bt = r1(N(r, ...p.b), 2);
    const roe = (!profitable || r() < p.nullRoe) ? null : r1(N(r, ...p.ro), 1);
    const de  = (r() < p.nullDe) ? null : r1(Math.max(0, N(r, ...p.de)), 2);
    const pb  = roe == null ? null : r1(Math.max(.3, N(r, ...p.pb)), 1);

    /* Cap tier helpers */
    const tier = mktCap >= 200 ? 0 : mktCap >= 10 ? 1 : mktCap >= 2 ? 2 : 3;
    const priceRanges  = [[50,2000],[15,500],[5,200],[1,80]];
    const volRanges    = [[5,150],[0.5,25],[0.05,5],[0.005,2]];
    const volSd        = [1.4,1.8,2.5,4.2][tier];

    const price     = r1(rnd(r, ...priceRanges[tier]), 2);
    const changePct = r1(N(r, 0, volSd, -18, 18), 2);
    const volume    = r1(Math.max(.001, rnd(r, ...volRanges[tier])), 2);

    /* Rating (slightly bearish for small caps) */
    const rRoll = r();
    const rating = rRoll < (tier > 1 ? .18 : .25) ? "Strong Buy"
                 : rRoll < (tier > 1 ? .50 : .62) ? "Buy"
                 : rRoll < (tier > 1 ? .80 : .87) ? "Hold" : "Sell";

    /* Name + ticker */
    const pre = PRE[sector], suf = SUF[sector];
    const name = pre[Math.floor(r() * pre.length)] + " " + suf[Math.floor(r() * suf.length)];
    const ticker = makeTicker(r, usedTickers);

    stocks.push({ ticker, name, sector, mktCap, pe, fwdPe, revGrowth:rg, grossMargin:gm,
      netMargin:nm, divYield:dy, beta:bt, rating, roe, debtToEq:de, pb,
      price, changePct, volume });
  }
  return stocks;
}

/* ── 70 Notable tickers (exported for EC_NOTABLE + portfolio lookup) ── */
export const SCREENER_UNIVERSE = [
  // Technology
  {ticker:"AAPL", name:"Apple Inc",               sector:"Technology",       mktCap:3930, pe:33.4,  fwdPe:28.0, revGrowth:4.0,   grossMargin:46.5, netMargin:27.0,  divYield:0.44, beta:1.20, rating:"Buy",        roe:160.0, debtToEq:1.79, pb:49.0, price:220.82, changePct:0.54, volume:55.2 },
  {ticker:"MSFT", name:"Microsoft Corp",           sector:"Technology",       mktCap:3140, pe:35.2,  fwdPe:30.1, revGrowth:16.0,  grossMargin:69.8, netMargin:36.5,  divYield:0.72, beta:0.90, rating:"Strong Buy",  roe:38.0,  debtToEq:0.34, pb:11.5, price:432.15, changePct:0.38, volume:22.4 },
  {ticker:"NVDA", name:"NVIDIA Corp",              sector:"Technology",       mktCap:2650, pe:48.2,  fwdPe:36.0, revGrowth:122.0, grossMargin:75.0, netMargin:55.0,  divYield:0.03, beta:1.95, rating:"Strong Buy",  roe:123.0, debtToEq:0.42, pb:52.0, price:875.40, changePct:1.23, volume:280.1},
  {ticker:"AVGO", name:"Broadcom Inc",             sector:"Technology",       mktCap:980,  pe:38.5,  fwdPe:28.0, revGrowth:44.0,  grossMargin:68.2, netMargin:25.0,  divYield:1.32, beta:1.20, rating:"Buy",         roe:26.0,  debtToEq:1.53, pb:9.0,  price:248.70, changePct:-0.32,volume:12.3 },
  {ticker:"ORCL", name:"Oracle Corp",              sector:"Technology",       mktCap:490,  pe:42.0,  fwdPe:26.0, revGrowth:17.0,  grossMargin:71.0, netMargin:22.5,  divYield:0.95, beta:0.82, rating:"Buy",         roe:null,  debtToEq:null, pb:null, price:185.50, changePct:0.17, volume:7.8  },
  {ticker:"ADBE", name:"Adobe Inc",                sector:"Technology",       mktCap:195,  pe:26.0,  fwdPe:22.0, revGrowth:11.0,  grossMargin:88.0, netMargin:27.0,  divYield:0.00, beta:1.32, rating:"Buy",         roe:37.0,  debtToEq:0.55, pb:14.0, price:478.20, changePct:-1.04,volume:2.9  },
  {ticker:"CRM",  name:"Salesforce Inc",           sector:"Technology",       mktCap:285,  pe:48.0,  fwdPe:28.0, revGrowth:8.7,   grossMargin:77.0, netMargin:15.0,  divYield:0.60, beta:1.35, rating:"Buy",         roe:9.0,   debtToEq:0.18, pb:5.0,  price:295.30, changePct:0.72, volume:4.1  },
  {ticker:"AMD",  name:"Advanced Micro Devices",   sector:"Technology",       mktCap:285,  pe:110.0, fwdPe:27.0, revGrowth:13.5,  grossMargin:51.0, netMargin:5.7,   divYield:0.00, beta:1.90, rating:"Strong Buy",  roe:3.0,   debtToEq:0.07, pb:3.5,  price:155.80, changePct:2.14, volume:45.2 },
  {ticker:"INTC", name:"Intel Corp",               sector:"Technology",       mktCap:95,   pe:null,  fwdPe:null, revGrowth:-8.0,  grossMargin:32.7, netMargin:-16.0, divYield:0.00, beta:1.00, rating:"Hold",         roe:-14.0, debtToEq:0.62, pb:0.9,  price:22.80,  changePct:-0.88,volume:40.5 },
  {ticker:"QCOM", name:"Qualcomm Inc",             sector:"Technology",       mktCap:185,  pe:17.0,  fwdPe:14.0, revGrowth:14.0,  grossMargin:56.0, netMargin:26.0,  divYield:2.15, beta:1.35, rating:"Buy",         roe:38.0,  debtToEq:2.05, pb:8.5,  price:164.70, changePct:-0.45,volume:11.8 },
  {ticker:"TXN",  name:"Texas Instruments",        sector:"Technology",       mktCap:175,  pe:35.0,  fwdPe:32.0, revGrowth:-11.0, grossMargin:55.0, netMargin:32.0,  divYield:3.00, beta:1.05, rating:"Hold",         roe:47.0,  debtToEq:1.32, pb:14.0, price:196.40, changePct:0.23, volume:7.1  },
  {ticker:"CSCO", name:"Cisco Systems",            sector:"Technology",       mktCap:215,  pe:18.0,  fwdPe:14.0, revGrowth:-6.0,  grossMargin:63.0, netMargin:23.0,  divYield:3.25, beta:0.80, rating:"Hold",         roe:26.0,  debtToEq:0.21, pb:6.0,  price:58.90,  changePct:0.05, volume:19.7 },
  {ticker:"NOW",  name:"ServiceNow Inc",           sector:"Technology",       mktCap:200,  pe:98.0,  fwdPe:45.0, revGrowth:22.0,  grossMargin:79.0, netMargin:15.0,  divYield:0.00, beta:1.10, rating:"Strong Buy",  roe:12.0,  debtToEq:0.32, pb:14.0, price:1048.0, changePct:1.05, volume:1.1  },
  {ticker:"INTU", name:"Intuit Inc",               sector:"Technology",       mktCap:175,  pe:58.0,  fwdPe:34.0, revGrowth:13.0,  grossMargin:79.0, netMargin:17.0,  divYield:0.65, beta:1.25, rating:"Buy",         roe:17.0,  debtToEq:0.53, pb:12.0, price:695.10, changePct:-0.62,volume:2.0  },
  {ticker:"AMAT", name:"Applied Materials",        sector:"Technology",       mktCap:155,  pe:22.0,  fwdPe:18.0, revGrowth:2.0,   grossMargin:47.5, netMargin:27.0,  divYield:0.90, beta:1.60, rating:"Buy",         roe:42.0,  debtToEq:0.38, pb:10.0, price:194.60, changePct:0.87, volume:8.3  },
  {ticker:"MU",   name:"Micron Technology",        sector:"Technology",       mktCap:110,  pe:25.0,  fwdPe:12.0, revGrowth:61.0,  grossMargin:22.6, netMargin:15.0,  divYield:0.45, beta:1.50, rating:"Strong Buy",  roe:8.0,   debtToEq:0.30, pb:2.4,  price:102.50, changePct:1.44, volume:25.6 },
  {ticker:"IBM",  name:"IBM Corp",                 sector:"Technology",       mktCap:225,  pe:30.0,  fwdPe:21.0, revGrowth:3.5,   grossMargin:56.0, netMargin:10.0,  divYield:2.80, beta:0.70, rating:"Hold",         roe:25.0,  debtToEq:2.46, pb:9.5,  price:212.90, changePct:-0.21,volume:5.2  },
  // Healthcare
  {ticker:"JNJ",  name:"Johnson & Johnson",        sector:"Healthcare",       mktCap:395,  pe:22.0,  fwdPe:15.0, revGrowth:3.5,   grossMargin:70.0, netMargin:18.0,  divYield:3.20, beta:0.55, rating:"Buy",         roe:23.0,  debtToEq:0.44, pb:5.5,  price:163.80, changePct:0.12, volume:11.9 },
  {ticker:"UNH",  name:"UnitedHealth Group",       sector:"Healthcare",       mktCap:490,  pe:20.0,  fwdPe:17.0, revGrowth:8.0,   grossMargin:24.0, netMargin:5.5,   divYield:1.60, beta:0.60, rating:"Strong Buy",  roe:25.0,  debtToEq:0.63, pb:5.5,  price:513.40, changePct:0.44, volume:3.1  },
  {ticker:"LLY",  name:"Eli Lilly & Co",           sector:"Healthcare",       mktCap:735,  pe:80.0,  fwdPe:32.0, revGrowth:32.0,  grossMargin:81.0, netMargin:22.0,  divYield:0.65, beta:0.50, rating:"Strong Buy",  roe:65.0,  debtToEq:2.30, pb:52.0, price:875.10, changePct:0.93, volume:5.2  },
  {ticker:"ABBV", name:"AbbVie Inc",               sector:"Healthcare",       mktCap:330,  pe:58.0,  fwdPe:16.0, revGrowth:3.7,   grossMargin:69.0, netMargin:9.0,   divYield:3.50, beta:0.60, rating:"Buy",         roe:null,  debtToEq:null, pb:null, price:174.80, changePct:-0.28,volume:5.8  },
  {ticker:"MRK",  name:"Merck & Co",               sector:"Healthcare",       mktCap:280,  pe:15.0,  fwdPe:12.0, revGrowth:7.5,   grossMargin:76.0, netMargin:27.0,  divYield:2.50, beta:0.50, rating:"Buy",         roe:26.0,  debtToEq:1.02, pb:4.5,  price:102.30, changePct:0.15, volume:14.8 },
  {ticker:"TMO",  name:"Thermo Fisher Scientific", sector:"Healthcare",       mktCap:185,  pe:28.0,  fwdPe:22.0, revGrowth:1.0,   grossMargin:42.0, netMargin:13.5,  divYield:0.28, beta:0.70, rating:"Buy",         roe:13.0,  debtToEq:0.73, pb:5.0,  price:528.60, changePct:-0.37,volume:1.9  },
  {ticker:"ABT",  name:"Abbott Laboratories",      sector:"Healthcare",       mktCap:205,  pe:32.0,  fwdPe:23.0, revGrowth:4.6,   grossMargin:56.0, netMargin:16.0,  divYield:2.00, beta:0.65, rating:"Buy",         roe:17.0,  debtToEq:0.43, pb:6.0,  price:116.70, changePct:0.33, volume:7.9  },
  {ticker:"BMY",  name:"Bristol-Myers Squibb",     sector:"Healthcare",       mktCap:115,  pe:null,  fwdPe:7.5,  revGrowth:6.5,   grossMargin:73.0, netMargin:-34.0, divYield:5.50, beta:0.50, rating:"Hold",         roe:-20.0, debtToEq:2.15, pb:2.5,  price:57.40,  changePct:-0.52,volume:14.6 },
  {ticker:"AMGN", name:"Amgen Inc",                sector:"Healthcare",       mktCap:155,  pe:30.0,  fwdPe:15.0, revGrowth:19.0,  grossMargin:73.0, netMargin:20.0,  divYield:3.40, beta:0.50, rating:"Hold",         roe:null,  debtToEq:null, pb:null, price:308.50, changePct:0.08, volume:3.0  },
  {ticker:"ISRG", name:"Intuitive Surgical",       sector:"Healthcare",       mktCap:195,  pe:82.0,  fwdPe:65.0, revGrowth:16.0,  grossMargin:68.0, netMargin:23.0,  divYield:0.00, beta:0.90, rating:"Buy",         roe:17.0,  debtToEq:0.01, pb:14.0, price:508.20, changePct:1.28, volume:1.0  },
  // Financials
  {ticker:"BRK.B",name:"Berkshire Hathaway",       sector:"Financials",       mktCap:1050, pe:22.0,  fwdPe:20.0, revGrowth:20.0,  grossMargin:null, netMargin:14.0,  divYield:0.00, beta:0.85, rating:"Buy",         roe:12.0,  debtToEq:null, pb:1.7,  price:432.00, changePct:0.22, volume:4.8  },
  {ticker:"JPM",  name:"JPMorgan Chase",           sector:"Financials",       mktCap:755,  pe:13.0,  fwdPe:13.5, revGrowth:22.0,  grossMargin:null, netMargin:31.0,  divYield:2.00, beta:1.15, rating:"Buy",         roe:16.0,  debtToEq:null, pb:2.0,  price:240.80, changePct:0.61, volume:9.4  },
  {ticker:"BAC",  name:"Bank of America",          sector:"Financials",       mktCap:340,  pe:14.5,  fwdPe:12.0, revGrowth:3.5,   grossMargin:null, netMargin:22.0,  divYield:2.40, beta:1.30, rating:"Buy",         roe:10.0,  debtToEq:null, pb:1.2,  price:43.50,  changePct:0.23, volume:39.8 },
  {ticker:"WFC",  name:"Wells Fargo",              sector:"Financials",       mktCap:230,  pe:12.0,  fwdPe:11.5, revGrowth:1.0,   grossMargin:null, netMargin:20.0,  divYield:2.40, beta:1.20, rating:"Buy",         roe:11.0,  debtToEq:null, pb:1.4,  price:69.80,  changePct:-0.14,volume:22.1 },
  {ticker:"GS",   name:"Goldman Sachs",            sector:"Financials",       mktCap:190,  pe:14.5,  fwdPe:13.0, revGrowth:16.0,  grossMargin:null, netMargin:25.0,  divYield:2.10, beta:1.40, rating:"Buy",         roe:12.0,  debtToEq:null, pb:1.8,  price:574.60, changePct:1.02, volume:2.1  },
  {ticker:"MS",   name:"Morgan Stanley",           sector:"Financials",       mktCap:215,  pe:18.0,  fwdPe:16.5, revGrowth:13.0,  grossMargin:null, netMargin:14.0,  divYield:3.20, beta:1.25, rating:"Buy",         roe:14.0,  debtToEq:null, pb:2.1,  price:133.20, changePct:0.45, volume:10.2 },
  {ticker:"BLK",  name:"BlackRock Inc",            sector:"Financials",       mktCap:145,  pe:22.0,  fwdPe:20.0, revGrowth:8.5,   grossMargin:null, netMargin:28.0,  divYield:2.70, beta:1.30, rating:"Buy",         roe:14.0,  debtToEq:0.88, pb:3.4,  price:1078.0, changePct:0.34, volume:0.9  },
  {ticker:"AXP",  name:"American Express",         sector:"Financials",       mktCap:225,  pe:21.0,  fwdPe:18.0, revGrowth:10.0,  grossMargin:null, netMargin:17.0,  divYield:1.00, beta:1.20, rating:"Buy",         roe:33.0,  debtToEq:null, pb:7.2,  price:308.40, changePct:0.73, volume:3.1  },
  {ticker:"V",    name:"Visa Inc",                 sector:"Financials",       mktCap:620,  pe:32.0,  fwdPe:27.0, revGrowth:10.0,  grossMargin:80.0, netMargin:52.0,  divYield:0.75, beta:0.95, rating:"Strong Buy",  roe:47.0,  debtToEq:0.51, pb:13.5, price:324.90, changePct:0.18, volume:7.2  },
  {ticker:"MA",   name:"Mastercard Inc",           sector:"Financials",       mktCap:510,  pe:38.0,  fwdPe:30.0, revGrowth:12.0,  grossMargin:78.0, netMargin:46.0,  divYield:0.55, beta:1.05, rating:"Strong Buy",  roe:180.0, debtToEq:2.01, pb:57.0, price:528.50, changePct:0.29, volume:3.9  },
  {ticker:"C",    name:"Citigroup Inc",            sector:"Financials",       mktCap:130,  pe:14.0,  fwdPe:10.0, revGrowth:5.5,   grossMargin:null, netMargin:15.0,  divYield:3.30, beta:1.45, rating:"Buy",         roe:6.0,   debtToEq:null, pb:0.7,  price:62.80,  changePct:-0.48,volume:20.4 },
  // Consumer Discretionary
  {ticker:"AMZN", name:"Amazon.com Inc",           sector:"Consumer Disc.",   mktCap:2090, pe:45.0,  fwdPe:33.0, revGrowth:11.0,  grossMargin:48.0, netMargin:9.0,   divYield:0.00, beta:1.55, rating:"Strong Buy",  roe:19.0,  debtToEq:0.68, pb:9.0,  price:220.10, changePct:0.87, volume:40.3 },
  {ticker:"TSLA", name:"Tesla Inc",                sector:"Consumer Disc.",   mktCap:1200, pe:130.0, fwdPe:95.0, revGrowth:-1.0,  grossMargin:17.9, netMargin:7.3,   divYield:0.00, beta:2.40, rating:"Hold",         roe:9.0,   debtToEq:0.10, pb:12.0, price:415.80, changePct:3.22, volume:109.8},
  {ticker:"HD",   name:"Home Depot Inc",           sector:"Consumer Disc.",   mktCap:400,  pe:27.0,  fwdPe:24.0, revGrowth:-3.0,  grossMargin:33.4, netMargin:10.0,  divYield:2.30, beta:1.05, rating:"Buy",         roe:null,  debtToEq:null, pb:null, price:394.60, changePct:0.14, volume:3.8  },
  {ticker:"MCD",  name:"McDonald's Corp",          sector:"Consumer Disc.",   mktCap:225,  pe:23.0,  fwdPe:22.0, revGrowth:2.5,   grossMargin:57.0, netMargin:34.0,  divYield:2.30, beta:0.75, rating:"Buy",         roe:null,  debtToEq:null, pb:null, price:310.40, changePct:0.09, volume:4.2  },
  {ticker:"NKE",  name:"Nike Inc",                 sector:"Consumer Disc.",   mktCap:70,   pe:21.0,  fwdPe:18.0, revGrowth:-10.0, grossMargin:44.0, netMargin:7.5,   divYield:2.40, beta:1.05, rating:"Hold",         roe:16.0,  debtToEq:0.82, pb:4.0,  price:82.30,  changePct:-0.72,volume:8.4  },
  {ticker:"LOW",  name:"Lowe's Companies",         sector:"Consumer Disc.",   mktCap:145,  pe:22.0,  fwdPe:18.0, revGrowth:-5.0,  grossMargin:33.5, netMargin:8.5,   divYield:2.10, beta:1.10, rating:"Buy",         roe:null,  debtToEq:null, pb:null, price:246.30, changePct:0.43, volume:4.1  },
  {ticker:"BKNG", name:"Booking Holdings",         sector:"Consumer Disc.",   mktCap:175,  pe:22.0,  fwdPe:20.0, revGrowth:11.0,  grossMargin:83.0, netMargin:24.0,  divYield:0.80, beta:1.30, rating:"Buy",         roe:null,  debtToEq:null, pb:null, price:4892.0, changePct:0.55, volume:0.4  },
  {ticker:"CMG",  name:"Chipotle Mexican Grill",   sector:"Consumer Disc.",   mktCap:78,   pe:50.0,  fwdPe:40.0, revGrowth:14.6,  grossMargin:25.2, netMargin:13.0,  divYield:0.00, beta:1.20, rating:"Strong Buy",  roe:46.0,  debtToEq:0.73, pb:22.0, price:58.40,  changePct:0.82, volume:5.1  },
  {ticker:"SBUX", name:"Starbucks Corp",           sector:"Consumer Disc.",   mktCap:95,   pe:25.0,  fwdPe:22.0, revGrowth:-1.0,  grossMargin:27.0, netMargin:10.0,  divYield:3.50, beta:0.90, rating:"Hold",         roe:null,  debtToEq:null, pb:null, price:107.40, changePct:-0.31,volume:8.1  },
  {ticker:"TJX",  name:"TJX Companies",            sector:"Consumer Disc.",   mktCap:140,  pe:29.0,  fwdPe:26.0, revGrowth:6.0,   grossMargin:30.0, netMargin:8.8,   divYield:1.30, beta:0.90, rating:"Buy",         roe:56.0,  debtToEq:0.62, pb:16.0, price:119.80, changePct:0.27, volume:5.3  },
  // Consumer Staples
  {ticker:"WMT",  name:"Walmart Inc",              sector:"Consumer Staples", mktCap:770,  pe:37.0,  fwdPe:32.0, revGrowth:5.7,   grossMargin:24.7, netMargin:2.5,   divYield:0.90, beta:0.65, rating:"Strong Buy",  roe:21.0,  debtToEq:0.65, pb:8.5,  price:95.80,  changePct:0.38, volume:11.2 },
  {ticker:"PG",   name:"Procter & Gamble",         sector:"Consumer Staples", mktCap:395,  pe:27.0,  fwdPe:22.0, revGrowth:3.0,   grossMargin:52.0, netMargin:18.0,  divYield:2.40, beta:0.55, rating:"Buy",         roe:33.0,  debtToEq:0.49, pb:8.8,  price:160.20, changePct:0.06, volume:7.9  },
  {ticker:"KO",   name:"The Coca-Cola Co",         sector:"Consumer Staples", mktCap:295,  pe:27.0,  fwdPe:22.0, revGrowth:3.0,   grossMargin:60.5, netMargin:23.5,  divYield:3.10, beta:0.55, rating:"Buy",         roe:39.0,  debtToEq:1.89, pb:11.0, price:66.80,  changePct:-0.12,volume:14.8 },
  {ticker:"PEP",  name:"PepsiCo Inc",              sector:"Consumer Staples", mktCap:195,  pe:23.0,  fwdPe:19.0, revGrowth:0.6,   grossMargin:55.0, netMargin:10.0,  divYield:3.70, beta:0.55, rating:"Hold",         roe:50.0,  debtToEq:2.60, pb:11.5, price:150.40, changePct:-0.22,volume:7.2  },
  {ticker:"COST", name:"Costco Wholesale",         sector:"Consumer Staples", mktCap:435,  pe:55.0,  fwdPe:47.0, revGrowth:5.5,   grossMargin:12.6, netMargin:2.9,   divYield:0.50, beta:0.85, rating:"Buy",         roe:30.0,  debtToEq:0.29, pb:16.0, price:950.60, changePct:0.64, volume:2.1  },
  {ticker:"PM",   name:"Philip Morris Intl",       sector:"Consumer Staples", mktCap:250,  pe:24.0,  fwdPe:18.0, revGrowth:9.7,   grossMargin:67.0, netMargin:27.0,  divYield:4.20, beta:0.60, rating:"Buy",         roe:null,  debtToEq:null, pb:null, price:129.80, changePct:0.18, volume:4.3  },
  {ticker:"MO",   name:"Altria Group",             sector:"Consumer Staples", mktCap:90,   pe:10.0,  fwdPe:9.5,  revGrowth:-2.0,  grossMargin:62.0, netMargin:46.0,  divYield:8.00, beta:0.50, rating:"Hold",         roe:null,  debtToEq:null, pb:null, price:50.90,  changePct:-0.08,volume:7.8  },
  // Communication
  {ticker:"GOOGL",name:"Alphabet Inc",             sector:"Communication",    mktCap:2050, pe:25.0,  fwdPe:20.0, revGrowth:15.0,  grossMargin:57.0, netMargin:28.5,  divYield:0.45, beta:1.10, rating:"Strong Buy",  roe:31.0,  debtToEq:0.07, pb:7.2,  price:174.60, changePct:1.15, volume:25.4 },
  {ticker:"META", name:"Meta Platforms",           sector:"Communication",    mktCap:1700, pe:27.0,  fwdPe:24.0, revGrowth:22.0,  grossMargin:81.5, netMargin:38.0,  divYield:0.35, beta:1.25, rating:"Strong Buy",  roe:35.0,  debtToEq:0.08, pb:9.5,  price:600.80, changePct:0.92, volume:14.8 },
  {ticker:"NFLX", name:"Netflix Inc",              sector:"Communication",    mktCap:455,  pe:55.0,  fwdPe:38.0, revGrowth:16.0,  grossMargin:47.0, netMargin:22.5,  divYield:0.00, beta:1.35, rating:"Strong Buy",  roe:37.0,  debtToEq:0.68, pb:20.0, price:851.40, changePct:0.48, volume:3.8  },
  {ticker:"DIS",  name:"Walt Disney Co",           sector:"Communication",    mktCap:190,  pe:55.0,  fwdPe:22.0, revGrowth:4.0,   grossMargin:34.0, netMargin:4.5,   divYield:0.80, beta:1.05, rating:"Buy",         roe:3.5,   debtToEq:0.58, pb:2.0,  price:96.80,  changePct:-0.52,volume:11.9 },
  {ticker:"CMCSA",name:"Comcast Corp",             sector:"Communication",    mktCap:140,  pe:11.0,  fwdPe:10.0, revGrowth:2.5,   grossMargin:68.0, netMargin:12.5,  divYield:3.50, beta:1.00, rating:"Hold",         roe:16.0,  debtToEq:1.40, pb:2.2,  price:39.80,  changePct:-0.25,volume:22.3 },
  {ticker:"VZ",   name:"Verizon Communications",   sector:"Communication",    mktCap:175,  pe:10.0,  fwdPe:9.0,  revGrowth:0.5,   grossMargin:59.0, netMargin:10.0,  divYield:6.30, beta:0.40, rating:"Hold",         roe:11.0,  debtToEq:1.82, pb:1.6,  price:40.20,  changePct:0.05, volume:34.6 },
  {ticker:"T",    name:"AT&T Inc",                 sector:"Communication",    mktCap:165,  pe:18.0,  fwdPe:10.0, revGrowth:1.0,   grossMargin:59.0, netMargin:5.5,   divYield:4.90, beta:0.55, rating:"Hold",         roe:4.0,   debtToEq:1.58, pb:1.3,  price:23.10,  changePct:0.09, volume:70.2 },
  // Energy
  {ticker:"XOM",  name:"Exxon Mobil Corp",         sector:"Energy",           mktCap:520,  pe:14.0,  fwdPe:13.5, revGrowth:-5.5,  grossMargin:35.0, netMargin:10.0,  divYield:3.50, beta:0.95, rating:"Buy",         roe:14.0,  debtToEq:0.18, pb:2.1,  price:110.40, changePct:-0.33,volume:20.1 },
  {ticker:"CVX",  name:"Chevron Corp",             sector:"Energy",           mktCap:285,  pe:14.5,  fwdPe:14.0, revGrowth:-10.0, grossMargin:37.0, netMargin:11.0,  divYield:4.30, beta:1.00, rating:"Buy",         roe:11.0,  debtToEq:0.14, pb:1.9,  price:145.80, changePct:-0.18,volume:9.8  },
  {ticker:"COP",  name:"ConocoPhillips",           sector:"Energy",           mktCap:135,  pe:13.0,  fwdPe:12.5, revGrowth:-9.0,  grossMargin:48.0, netMargin:16.0,  divYield:2.80, beta:1.20, rating:"Strong Buy",  roe:17.0,  debtToEq:0.42, pb:2.2,  price:100.70, changePct:0.28, volume:8.2  },
  {ticker:"SLB",  name:"SLB",                      sector:"Energy",           mktCap:55,   pe:13.0,  fwdPe:11.0, revGrowth:10.0,  grossMargin:21.0, netMargin:13.5,  divYield:2.80, beta:1.40, rating:"Buy",         roe:17.0,  debtToEq:0.78, pb:2.5,  price:43.90,  changePct:-0.68,volume:12.4 },
  {ticker:"EOG",  name:"EOG Resources",            sector:"Energy",           mktCap:70,   pe:11.0,  fwdPe:10.5, revGrowth:-7.0,  grossMargin:64.0, netMargin:23.0,  divYield:3.30, beta:1.25, rating:"Buy",         roe:22.0,  debtToEq:0.28, pb:2.8,  price:124.60, changePct:0.41, volume:5.1  },
  // Industrials
  {ticker:"CAT",  name:"Caterpillar Inc",          sector:"Industrials",      mktCap:165,  pe:16.0,  fwdPe:16.0, revGrowth:-3.5,  grossMargin:37.8, netMargin:16.0,  divYield:1.70, beta:1.05, rating:"Hold",         roe:62.0,  debtToEq:2.37, pb:10.5, price:349.80, changePct:-0.42,volume:2.9  },
  {ticker:"HON",  name:"Honeywell Intl",           sector:"Industrials",      mktCap:130,  pe:22.0,  fwdPe:18.0, revGrowth:4.0,   grossMargin:34.0, netMargin:14.0,  divYield:2.30, beta:1.00, rating:"Hold",         roe:29.0,  debtToEq:0.90, pb:8.0,  price:225.40, changePct:0.16, volume:3.2  },
  {ticker:"RTX",  name:"RTX Corp",                 sector:"Industrials",      mktCap:175,  pe:40.0,  fwdPe:20.0, revGrowth:9.0,   grossMargin:19.0, netMargin:5.5,   divYield:1.90, beta:0.85, rating:"Buy",         roe:8.0,   debtToEq:0.80, pb:3.2,  price:125.10, changePct:0.62, volume:6.1  },
  {ticker:"DE",   name:"Deere & Company",          sector:"Industrials",      mktCap:130,  pe:15.0,  fwdPe:16.0, revGrowth:-17.0, grossMargin:30.5, netMargin:15.0,  divYield:1.60, beta:1.05, rating:"Hold",         roe:43.0,  debtToEq:3.18, pb:6.0,  price:369.50, changePct:-0.58,volume:2.1  },
  {ticker:"GE",   name:"GE Aerospace",             sector:"Industrials",      mktCap:250,  pe:36.0,  fwdPe:30.0, revGrowth:15.0,  grossMargin:28.0, netMargin:8.0,   divYield:0.70, beta:1.20, rating:"Strong Buy",  roe:17.0,  debtToEq:0.41, pb:9.5,  price:196.30, changePct:0.84, volume:7.9  },
  {ticker:"LMT",  name:"Lockheed Martin",          sector:"Industrials",      mktCap:105,  pe:18.0,  fwdPe:16.0, revGrowth:5.5,   grossMargin:12.5, netMargin:9.5,   divYield:2.70, beta:0.45, rating:"Buy",         roe:null,  debtToEq:null, pb:null, price:540.20, changePct:0.31, volume:1.1  },
  {ticker:"UNP",  name:"Union Pacific Corp",       sector:"Industrials",      mktCap:155,  pe:22.0,  fwdPe:20.0, revGrowth:1.0,   grossMargin:52.0, netMargin:27.5,  divYield:2.30, beta:1.00, rating:"Buy",         roe:50.0,  debtToEq:1.62, pb:11.0, price:240.10, changePct:0.12, volume:2.2  },
  {ticker:"UPS",  name:"United Parcel Service",    sector:"Industrials",      mktCap:90,   pe:16.0,  fwdPe:14.0, revGrowth:-9.0,  grossMargin:22.0, netMargin:8.0,   divYield:5.50, beta:1.10, rating:"Hold",         roe:62.0,  debtToEq:4.35, pb:9.5,  price:132.80, changePct:-0.74,volume:4.0  },
  // Materials
  {ticker:"LIN",  name:"Linde plc",                sector:"Materials",        mktCap:225,  pe:30.0,  fwdPe:25.0, revGrowth:-1.0,  grossMargin:43.0, netMargin:20.5,  divYield:1.30, beta:0.85, rating:"Buy",         roe:16.0,  debtToEq:0.58, pb:6.0,  price:468.40, changePct:0.11, volume:1.9  },
  {ticker:"APD",  name:"Air Products & Chemicals", sector:"Materials",        mktCap:65,   pe:22.0,  fwdPe:20.0, revGrowth:-5.0,  grossMargin:36.0, netMargin:18.0,  divYield:2.90, beta:0.85, rating:"Hold",         roe:14.0,  debtToEq:0.86, pb:4.0,  price:305.10, changePct:-0.28,volume:1.5  },
  {ticker:"NEM",  name:"Newmont Corp",             sector:"Materials",        mktCap:55,   pe:22.0,  fwdPe:14.0, revGrowth:65.0,  grossMargin:40.0, netMargin:8.0,   divYield:2.20, beta:0.50, rating:"Buy",         roe:7.0,   debtToEq:0.42, pb:1.8,  price:48.20,  changePct:1.44, volume:12.1 },
  {ticker:"FCX",  name:"Freeport-McMoRan",         sector:"Materials",        mktCap:60,   pe:22.0,  fwdPe:16.0, revGrowth:3.0,   grossMargin:37.0, netMargin:13.0,  divYield:1.50, beta:1.75, rating:"Buy",         roe:20.0,  debtToEq:0.58, pb:2.8,  price:44.10,  changePct:0.91, volume:15.3 },
  // Utilities
  {ticker:"NEE",  name:"NextEra Energy",           sector:"Utilities",        mktCap:150,  pe:21.0,  fwdPe:18.0, revGrowth:1.5,   grossMargin:57.0, netMargin:17.0,  divYield:3.20, beta:0.55, rating:"Buy",         roe:12.0,  debtToEq:1.24, pb:2.5,  price:77.60,  changePct:-0.18,volume:10.2 },
  {ticker:"DUK",  name:"Duke Energy Corp",         sector:"Utilities",        mktCap:90,   pe:20.0,  fwdPe:17.5, revGrowth:1.5,   grossMargin:44.0, netMargin:14.5,  divYield:3.90, beta:0.40, rating:"Hold",         roe:9.0,   debtToEq:1.44, pb:1.4,  price:105.10, changePct:0.04, volume:4.8  },
  {ticker:"SO",   name:"Southern Company",         sector:"Utilities",        mktCap:90,   pe:22.0,  fwdPe:17.5, revGrowth:3.5,   grossMargin:44.0, netMargin:14.0,  divYield:3.70, beta:0.45, rating:"Hold",         roe:11.0,  debtToEq:1.46, pb:1.5,  price:88.90,  changePct:0.08, volume:7.9  },
  // Real Estate
  {ticker:"AMT",  name:"American Tower Corp",      sector:"Real Estate",      mktCap:90,   pe:40.0,  fwdPe:36.0, revGrowth:5.5,   grossMargin:72.0, netMargin:14.0,  divYield:3.10, beta:0.75, rating:"Buy",         roe:null,  debtToEq:null, pb:null, price:215.80, changePct:0.36, volume:3.0  },
  {ticker:"PLD",  name:"Prologis Inc",             sector:"Real Estate",      mktCap:100,  pe:32.0,  fwdPe:28.0, revGrowth:9.5,   grossMargin:69.0, netMargin:30.0,  divYield:3.30, beta:0.85, rating:"Buy",         roe:7.0,   debtToEq:0.63, pb:3.4,  price:117.60, changePct:-0.21,volume:5.1  },
  {ticker:"EQIX", name:"Equinix Inc",              sector:"Real Estate",      mktCap:78,   pe:85.0,  fwdPe:60.0, revGrowth:7.0,   grossMargin:49.0, netMargin:8.0,   divYield:2.10, beta:0.85, rating:"Buy",         roe:4.0,   debtToEq:1.56, pb:6.5,  price:928.40, changePct:0.47, volume:0.9  },
  {ticker:"SPG",  name:"Simon Property Group",     sector:"Real Estate",      mktCap:60,   pe:24.0,  fwdPe:22.0, revGrowth:5.0,   grossMargin:77.0, netMargin:24.0,  divYield:5.20, beta:1.30, rating:"Hold",         roe:null,  debtToEq:null, pb:null, price:154.60, changePct:-0.44,volume:2.1  },
];

/* ── Build & export the full 2,500+ universe ──────────────────────── */
const _usedTickers = new Set(SCREENER_UNIVERSE.map(s => s.ticker));
const _generated   = generateStocks(2430, 0xBADC0DE, _usedTickers);

export const FULL_UNIVERSE = [...SCREENER_UNIVERSE, ..._generated];
