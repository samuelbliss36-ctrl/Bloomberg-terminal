import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * InsightChip — a rainbow-pill AI insight callout.
 *
 * Props:
 *   page     — page identifier, used as part of the cache key (e.g. "heatmap")
 *   context  — live data string describing what's on screen
 *   style    — optional extra styles on the container
 */
export function InsightChip({ page, context, style }) {
  const [insight,  setInsight]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState(false);
  const prevCtx = useRef(null);

  useEffect(() => {
    if (!context || context === prevCtx.current) return;
    prevCtx.current = context;

    let cancelled = false;
    setLoading(true);
    setInsight(null);
    setExpanded(false);

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const jwt = session?.access_token;
        if (!jwt) return;

        const r = await fetch('/api/copilot', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
          body:    JSON.stringify({ mode: 'insight', page, context }),
        });
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled && d.insight) setInsight(d.insight);
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [page, context]);

  if (!loading && !insight) return null;

  return (
    <div style={{
      display:      'flex',
      alignItems:   expanded ? 'flex-start' : 'center',
      gap:          6,
      background:   'linear-gradient(var(--surface-1,#1e293b), var(--surface-1,#1e293b)) padding-box, linear-gradient(135deg,#7c3aed,#2563eb) border-box',
      border:       '1px solid transparent',
      borderRadius: 16,
      padding:      '5px 10px 5px 14px',
      fontFamily:   "'IBM Plex Mono',monospace",
      fontSize:     12,
      color:        'var(--text-1,#e2e8f0)',
      width:        '100%',
      minWidth:     0,
      boxShadow:    '0 0 12px rgba(124,58,237,0.12)',
      ...style,
    }}>
      {/* Gradient ✦ icon */}
      <span style={{
        background:           'linear-gradient(135deg,#a78bfa,#60a5fa)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor:  'transparent',
        backgroundClip:       'text',
        fontWeight:           700,
        fontSize:             13,
        flexShrink:           0,
        marginTop:            expanded ? 1 : 0,
      }}>✦</span>

      {loading && !insight ? (
        <span style={{
          display:        'inline-block',
          width:          180,
          height:         9,
          borderRadius:   4,
          background:     'linear-gradient(90deg, var(--surface-2,#334155) 25%, var(--surface-3,#475569) 50%, var(--surface-2,#334155) 75%)',
          backgroundSize: '200% 100%',
          animation:      'insight-shimmer 1.4s infinite',
        }} />
      ) : (
        <span style={{
          flex:         1,
          overflow:     expanded ? 'visible' : 'hidden',
          textOverflow: expanded ? 'clip'    : 'ellipsis',
          whiteSpace:   expanded ? 'normal'  : 'nowrap',
          lineHeight:   expanded ? 1.5       : 'normal',
        }}>{insight}</span>
      )}

      {/* Expand / collapse button */}
      {insight && (
        <button
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Collapse' : 'Expand'}
          style={{
            background:  'none',
            border:      'none',
            cursor:      'pointer',
            color:       'var(--text-3,#64748b)',
            fontSize:    10,
            padding:     '0 2px',
            flexShrink:  0,
            marginTop:   expanded ? 2 : 0,
            lineHeight:  1,
          }}
        >{expanded ? '▲' : '▼'}</button>
      )}

      <style>{`
        @keyframes insight-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
