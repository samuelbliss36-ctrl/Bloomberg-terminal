import { useState, useMemo, useCallback } from "react";
import { api } from "../../lib/api";
import { delay } from "../../lib/fmt";
import { EC_NOTABLE, hourBg, hourClr, hourLabel, SECTOR_CLR } from "../../lib/constants";
import { SCREENER_UNIVERSE } from "../../screenerData";

// eslint-disable-next-line no-unused-vars
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

export default function EarningsCalendarPage() {
  const today    = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => today.toISOString().slice(0,10), [today]);

  const [viewDate,    setViewDate]    = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [events,      setEvents]      = useState(null);   // null=loading, []=no data
  const [selDate,     setSelDate]     = useState(null);
  const [histMap,     setHistMap]     = useState({});
  const [histLoading, setHistLoading] = useState(false);

  const monthStart  = viewDate;
  const monthEnd    = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  const firstDow    = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const numRows     = Math.ceil((firstDow + daysInMonth) / 7);

  // ── Fetch market-wide earnings for visible month ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    setEvents(null); setSelDate(null);
    const from = monthStart.toISOString().slice(0,10);
    const to   = monthEnd.toISOString().slice(0,10);
    api(`/calendar/earnings?from=${from}&to=${to}`)
      .then(d => {
        const raw = d?.earningsCalendar || [];
        setEvents(raw.filter(e => EC_NOTABLE.has(e.symbol)).sort((a,b) => a.date < b.date ? -1 : 1));
      })
      .catch(() => setEvents([]));
  }, [viewDate]); // eslint-disable-line

  // ── Group by date ──
  const eventsByDate = useMemo(() => {
    const m = {};
    (events || []).forEach(e => { (m[e.date] = m[e.date] || []).push(e); });
    return m;
  }, [events]);

  // ── Lazy-load beat/miss history on date select ──
  const selectDate = useCallback(async (dateStr) => {
    setSelDate(dateStr);
    const dayEvts = eventsByDate[dateStr] || [];
    const missing = dayEvts.map(e => e.symbol).filter(s => !(s in histMap));
    if (!missing.length) return;
    setHistLoading(true);
    const updates = {};
    for (const sym of missing) {
      try {
        await delay(150);
        const d = await api(`/stock/earnings?symbol=${sym}&limit=4`);
        updates[sym] = d?.data || [];
      } catch { updates[sym] = []; }
    }
    setHistMap(m => ({ ...m, ...updates }));
    setHistLoading(false);
  }, [eventsByDate, histMap]);

  // ── Stats ──
  const weekEnd   = useMemo(() => new Date(today.getTime() + 7*86400000).toISOString().slice(0,10), [today]);
  const thisWeek  = useMemo(() => (events||[]).filter(e => e.date >= todayStr && e.date <= weekEnd), [events, todayStr, weekEnd]);
  const bmoCount  = useMemo(() => (events||[]).filter(e => e.hour==="bmo").length, [events]);
  const amcCount  = useMemo(() => (events||[]).filter(e => e.hour==="amc").length, [events]);
  const selEvents = selDate ? (eventsByDate[selDate] || []) : [];

  // ── Month nav ──
  const monthLabel = viewDate.toLocaleString("en-US", { month:"long", year:"numeric" });
  const goPrev  = useCallback(() => setViewDate(d => new Date(d.getFullYear(), d.getMonth()-1, 1)), []);
  const goNext  = useCallback(() => setViewDate(d => new Date(d.getFullYear(), d.getMonth()+1, 1)), []);
  const goToday = useCallback(() => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)), [today]);

  // ── Whisper: estimate × (1 + beatRate×0.04 − 0.01) derived from history ──
  const getWhisper = (sym, est) => {
    if (est == null) return null;
    const hist  = histMap[sym];
    if (!hist?.length) return null;
    const valid = hist.filter(h => h.actual != null && h.estimate != null);
    if (!valid.length) return null;
    const beatRate = valid.filter(h => h.actual > h.estimate).length / valid.length;
    return +(est * (1 + beatRate * 0.04 - 0.01)).toFixed(2);
  };

  const DAYS_HDR = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

  return (
    <div style={{ display:"flex", height:"calc(100vh - 90px)", overflow:"hidden", gap:10, padding:10 }}>

      {/* ── LEFT: Month grid ──────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8, minWidth:0 }}>

        {/* Header */}
        <div className="terminal-panel p-3" style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <span className="terminal-header">📅 Earnings Calendar</span>
            {events !== null && (
              <div style={{ display:"flex", gap:14, fontFamily:"'IBM Plex Mono',monospace", fontSize:10 }}>
                <span><b style={{ color:"var(--text-1)" }}>{events.length}</b> <span style={{ color:"var(--text-3)" }}>this month</span></span>
                <span><b style={{ color:"#2563eb" }}>{bmoCount}</b> <span style={{ color:"var(--text-3)" }}>BMO</span></span>
                <span><b style={{ color:"#b45309" }}>{amcCount}</b> <span style={{ color:"var(--text-3)" }}>AMC</span></span>
                {thisWeek.length > 0 && <span><b style={{ color:"#7c3aed" }}>{thisWeek.length}</b> <span style={{ color:"var(--text-3)" }}>this week</span></span>}
              </div>
            )}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {[["←", goPrev], ["→", goNext]].map(([ch, fn]) => (
              <button key={ch} onClick={fn} style={{ background:"none", border:"1px solid var(--border)", borderRadius:4, cursor:"pointer", padding:"2px 10px", color:"var(--text-3)", fontFamily:"'IBM Plex Mono',monospace", fontSize:13, lineHeight:1 }}>{ch}</button>
            ))}
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, fontSize:13, color:"var(--text-1)", minWidth:168, textAlign:"center" }}>{monthLabel}</span>
            {[["←", goPrev], ["→", goNext]].map(([ch, fn]) => (
              <button key={"r"+ch} onClick={fn} style={{ display:"none" }}>{ch}</button>
            ))}
            <button onClick={goToday} style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", fontWeight:600, padding:"3px 10px", background:"var(--blue-dim)", color:"var(--blue)", border:"1px solid rgba(37,99,235,0.30)", borderRadius:4, cursor:"pointer" }}>TODAY</button>
          </div>
        </div>

        {/* Grid body */}
        <div className="terminal-panel" style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", padding:"10px 10px 8px" }}>
          {/* Day name header row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:3, marginBottom:4, flexShrink:0 }}>
            {DAYS_HDR.map(d => (
              <div key={d} style={{ textAlign:"center", fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"var(--text-3)", fontWeight:700, letterSpacing:"0.07em" }}>{d}</div>
            ))}
          </div>

          {events === null ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontFamily:"monospace", fontSize:11, color:"var(--text-3)" }}>Loading earnings data…</span>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gridTemplateRows:`repeat(${numRows}, 1fr)`, gap:3, flex:1 }}>
              {Array.from({ length: numRows * 7 }).map((_, i) => {
                const day     = i - firstDow + 1;
                const inMonth = day >= 1 && day <= daysInMonth;
                const dateStr = inMonth
                  ? new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toISOString().slice(0,10)
                  : null;
                const dayEvts = dateStr ? (eventsByDate[dateStr] || []) : [];
                const isToday = dateStr === todayStr;
                const isSel   = dateStr === selDate;
                const isPast  = dateStr != null && dateStr < todayStr;
                return (
                  <div key={i}
                    onClick={() => inMonth && selectDate(dateStr)}
                    onMouseEnter={e => { if (inMonth && !isSel) e.currentTarget.style.borderColor = "var(--border-hover)"; }}
                    onMouseLeave={e => { if (inMonth && !isSel) e.currentTarget.style.borderColor = isToday ? "rgba(37,99,235,0.22)" : "var(--border-subtle)"; }}
                    style={{
                      background: isSel ? "var(--blue-dim)" : isToday ? "rgba(37,99,235,0.03)" : "var(--surface-0)",
                      border: `1px solid ${isSel ? "rgba(37,99,235,0.45)" : isToday ? "rgba(37,99,235,0.22)" : "var(--border-subtle)"}`,
                      borderRadius:4, padding:"4px 5px", overflow:"hidden",
                      cursor: inMonth ? "pointer" : "default",
                      opacity: inMonth ? 1 : 0.15,
                      transition:"border-color 0.1s",
                    }}>
                    {inMonth && (
                      <>
                        <div style={{ fontFamily:"'IBM Plex Mono',monospace", marginBottom:2,
                          color: isToday ? "#fff" : isPast ? "var(--text-3)" : "var(--text-2)",
                          fontWeight: isToday ? 700 : 400,
                          background: isToday ? "var(--blue)" : "transparent",
                          width: isToday ? 16 : "auto", height: isToday ? 16 : "auto",
                          borderRadius: isToday ? "50%" : 0,
                          display:"flex", alignItems:"center", justifyContent: isToday ? "center" : "flex-start",
                          fontSize: isToday ? 9 : 10,
                        }}>{day}</div>
                        {dayEvts.slice(0, 3).map(ev => (
                          <div key={ev.symbol} style={{
                            fontSize:9, fontFamily:"'IBM Plex Mono',monospace", fontWeight:700,
                            background:hourBg(ev.hour), color:hourClr(ev.hour),
                            borderRadius:3, padding:"1px 4px", marginBottom:1,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                          }}>{ev.symbol}</div>
                        ))}
                        {dayEvts.length > 3 && (
                          <div style={{ fontSize:8, fontFamily:"monospace", color:"var(--text-3)", lineHeight:1.2 }}>+{dayEvts.length-3}</div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="terminal-panel p-2" style={{ flexShrink:0 }}>
          <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
            {[
              { bg:"rgba(37,99,235,0.13)", clr:"#2563eb", label:"BMO · Before Market Open" },
              { bg:"rgba(180,83,9,0.13)",  clr:"#b45309", label:"AMC · After Market Close" },
              { bg:"rgba(5,150,105,0.15)", clr:"#059669", label:"Beat" },
              { bg:"rgba(225,29,72,0.15)", clr:"#e11d48", label:"Miss" },
            ].map(l => (
              <div key={l.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <div style={{ width:9, height:9, borderRadius:2, background:l.bg, border:`1px solid ${l.clr}` }} />
                <span style={{ fontSize:9, fontFamily:"monospace", color:"var(--text-3)" }}>{l.label}</span>
              </div>
            ))}
            <span style={{ fontSize:9, fontFamily:"monospace", color:"#7c3aed", marginLeft:"auto" }}>✦ Whisper derived from beat-rate history</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Upcoming + Day detail ──────────────────────────────── */}
      <div style={{ width:290, flexShrink:0, display:"flex", flexDirection:"column", gap:8 }}>

        {/* This week */}
        <div className="terminal-panel p-3" style={{ flexShrink:0 }}>
          <div className="terminal-header mb-2">⚡ Upcoming 7 Days ({thisWeek.length})</div>
          {thisWeek.length === 0 ? (
            <div style={{ fontSize:10, fontFamily:"monospace", color:"var(--text-3)" }}>
              {events === null ? "Loading…" : "No tracked events next 7 days"}
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {thisWeek.slice(0,8).map(ev => (
                <div key={ev.symbol+ev.date} onClick={() => selectDate(ev.date)}
                  style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"5px 6px", borderRadius:4, cursor:"pointer",
                    background: selDate===ev.date ? "var(--blue-dim)" : "transparent",
                    border:`1px solid ${selDate===ev.date ? "rgba(37,99,235,0.30)" : "transparent"}`,
                    transition:"background 0.1s",
                  }}
                  onMouseEnter={e => { if (selDate!==ev.date) e.currentTarget.style.background="var(--surface-0)"; }}
                  onMouseLeave={e => { if (selDate!==ev.date) e.currentTarget.style.background="transparent"; }}>
                  <div>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, fontSize:11, color:"var(--text-1)" }}>{ev.symbol}</span>
                    <span style={{ fontFamily:"monospace", fontSize:9, color:"var(--text-3)", marginLeft:6 }}>
                      {new Date(ev.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                    </span>
                  </div>
                  <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                    <span style={{ fontSize:8, fontFamily:"monospace", background:hourBg(ev.hour), color:hourClr(ev.hour), borderRadius:2, padding:"1px 4px", fontWeight:700 }}>{ev.hour?.toUpperCase()||"—"}</span>
                    {ev.epsEstimate != null && <span style={{ fontFamily:"monospace", fontSize:9, color:"var(--text-3)" }}>e:${ev.epsEstimate.toFixed(2)}</span>}
                  </div>
                </div>
              ))}
              {thisWeek.length > 8 && <div style={{ fontSize:9, fontFamily:"monospace", color:"var(--text-3)", textAlign:"center", paddingTop:4 }}>+{thisWeek.length-8} more</div>}
            </div>
          )}
        </div>

        {/* Day detail panel */}
        {selDate ? (
          <div className="terminal-panel p-3" style={{ flex:1, overflowY:"auto", minHeight:0 }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:12 }}>
              <span className="terminal-header">
                {new Date(selDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"long",day:"numeric"})}
              </span>
              <span style={{ fontFamily:"monospace", fontSize:10, color:"var(--text-3)" }}>{selEvents.length} report{selEvents.length!==1?"s":""}</span>
            </div>

            {selEvents.length === 0 ? (
              <div style={{ fontSize:10, fontFamily:"monospace", color:"var(--text-3)" }}>No tracked earnings on this date</div>
            ) : selEvents.map(ev => {
              const hist    = histMap[ev.symbol];
              const valid   = (hist||[]).filter(h => h.actual!=null && h.estimate!=null);
              const beats   = valid.filter(h => h.actual > h.estimate).length;
              const wp      = getWhisper(ev.symbol, ev.epsEstimate);
              const secInfo = SCREENER_UNIVERSE.find(s => s.ticker===ev.symbol);
              const secClr  = SECTOR_CLR[secInfo?.sector] || "var(--text-3)";
              return (
                <div key={ev.symbol} style={{ marginBottom:18, paddingBottom:18, borderBottom:"1px solid var(--border)" }}>
                  {/* Company row */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, fontSize:14, color:"var(--text-1)" }}>{ev.symbol}</span>
                        {secInfo && <span style={{ fontSize:8, fontFamily:"monospace", fontWeight:600, padding:"1px 5px", borderRadius:99, background:`${secClr}18`, color:secClr }}>{secInfo.sector}</span>}
                      </div>
                      <div style={{ fontSize:9, color:"var(--text-3)", fontFamily:"monospace" }}>Q{ev.quarter} {ev.year}</div>
                    </div>
                    <span style={{ fontSize:8, fontFamily:"monospace", fontWeight:700, background:hourBg(ev.hour), color:hourClr(ev.hour), borderRadius:3, padding:"2px 6px" }}>{hourLabel(ev.hour)}</span>
                  </div>

                  {/* EPS / Whisper cards */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:8 }}>
                    <div style={{ background:"var(--surface-0)", borderRadius:5, padding:"7px 8px" }}>
                      <div style={{ fontSize:8, fontFamily:"monospace", color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>Consensus EPS</div>
                      <div style={{ fontSize:15, fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, color:"var(--text-1)" }}>
                        {ev.epsEstimate!=null ? `$${ev.epsEstimate.toFixed(2)}` : "—"}
                      </div>
                    </div>
                    <div style={{ background: wp!=null ? "rgba(124,58,237,0.07)" : "var(--surface-0)", borderRadius:5, padding:"7px 8px", border: wp!=null ? "1px solid rgba(124,58,237,0.20)" : "none" }}>
                      <div style={{ fontSize:8, fontFamily:"monospace", color:"#7c3aed", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>Street Whisper ✦</div>
                      <div style={{ fontSize:15, fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, color:"#7c3aed" }}>
                        {wp!=null ? `$${wp.toFixed(2)}` : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Revenue */}
                  {ev.revenueEstimate!=null && (
                    <div style={{ fontSize:10, fontFamily:"monospace", color:"var(--text-3)", marginBottom:8 }}>
                      Rev. Est: <span style={{ color:"var(--text-1)", fontWeight:700 }}>${(ev.revenueEstimate/1e9).toFixed(1)}B</span>
                    </div>
                  )}

                  {/* Beat-rate dots */}
                  {valid.length > 0 && (
                    <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:8 }}>
                      <span style={{ fontSize:9, fontFamily:"monospace", color:"var(--text-3)" }}>Beat rate:</span>
                      {valid.map((h,i) => (
                        <div key={i} title={`Q${h.quarter} '${String(h.year).slice(2)}: ${h.actual>h.estimate?"Beat":"Miss"}`}
                          style={{ width:11, height:11, borderRadius:3, background:h.actual>h.estimate?"#059669":"#e11d48" }} />
                      ))}
                      <span style={{ fontSize:9, fontFamily:"monospace", fontWeight:700,
                        color: beats/valid.length>=0.75?"#059669":beats/valid.length>=0.5?"#b45309":"#e11d48" }}>
                        {beats}/{valid.length}
                      </span>
                    </div>
                  )}

                  {/* History table */}
                  {histLoading && !hist ? (
                    <div style={{ fontSize:10, fontFamily:"monospace", color:"var(--text-3)" }}>Loading history…</div>
                  ) : valid.length > 0 ? (
                    <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr auto", gap:"3px 8px", fontFamily:"'IBM Plex Mono',monospace", fontSize:9 }}>
                      {["Period","Est","Actual","Δ"].map(h => (
                        <div key={h} style={{ color:"var(--text-3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", paddingBottom:3, borderBottom:"1px solid var(--border)" }}>{h}</div>
                      ))}
                      {valid.map((h,i) => {
                        const beat = h.actual > h.estimate;
                        return [
                          <div key={i+"p"} style={{ color:"var(--text-3)", paddingTop:3 }}>Q{h.quarter} '{String(h.year).slice(2)}</div>,
                          <div key={i+"e"} style={{ color:"var(--text-2)", paddingTop:3 }}>${h.estimate?.toFixed(2)}</div>,
                          <div key={i+"a"} style={{ color:beat?"#059669":"#e11d48", fontWeight:700, paddingTop:3 }}>${h.actual?.toFixed(2)}</div>,
                          <div key={i+"d"} style={{ color:beat?"#059669":"#e11d48", fontWeight:700, paddingTop:3 }}>{beat?"▲":"▼"}{Math.abs(h.surprisePercent)?.toFixed(1)}%</div>,
                        ];
                      })}
                    </div>
                  ) : hist!==undefined ? (
                    <div style={{ fontSize:9, fontFamily:"monospace", color:"var(--text-3)" }}>No historical earnings data</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="terminal-panel p-3" style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ textAlign:"center", color:"var(--text-3)", fontFamily:"monospace", fontSize:11 }}>
              <div style={{ fontSize:28, marginBottom:10 }}>📅</div>
              <div>Click any date to see<br/>earnings details</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
