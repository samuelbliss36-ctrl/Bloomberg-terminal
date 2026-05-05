import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * InsightChip — a rainbow-pill AI insight callout.
 *
 * Props:
 *   page     — page identifier, used as part of the cache key (e.g. "heatmap")
 *   context  — short string describing what's on screen (e.g. "287 advancing, avg -0.3%")
 *   style    — optional extra styles on the container
 */
export function InsightChip({ page, context, style }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const prevCtx = useRef(null);

  useEffect(() => {
    if (!context || context === prevCtx.current) return;
    prevCtx.current = context;

    let cancelled = false;
    setLoading(true);
    setInsight(null);

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
      display:     'inline-flex',
      alignItems:  'center',
      gap:         6,
      background:  'linear-gradient(var(--surface-1,#1e293b), var(--surface-1,#1e293b)) padding-box, linear-gradient(135deg,#7c3aed,#2563eb) border-box',
      border:      '1px solid transparent',
      borderRadius: 20,
      padding:     '5px 14px',
      fontFamily:  "'IBM Plex Mono',monospace",
      fontSize:    12,
      color:       'var(--text-1,#e2e8f0)',
      whiteSpace:  'nowrap',
      maxWidth:    560,
      overflow:    'hidden',
      textOverflow: 'ellipsis',
      boxShadow:   '0 0 12px rgba(124,58,237,0.12)',
      ...style,
    }}>
      {/* Gradient ✦ icon */}
      <span style={{
        background:             'linear-gradient(135deg,#a78bfa,#60a5fa)',
        WebkitBackgroundClip:   'text',
        WebkitTextFillColor:    'transparent',
        backgroundClip:         'text',
        fontWeight:             700,
        fontSize:               13,
        flexShrink:             0,
      }}>✦</span>

      {loading && !insight ? (
        /* Shimmer placeholder */
        <span style={{
          display:         'inline-block',
          width:           180,
          height:          9,
          borderRadius:    4,
          background:      'linear-gradient(90deg, var(--surface-2,#334155) 25%, var(--surface-3,#475569) 50%, var(--surface-2,#334155) 75%)',
          backgroundSize:  '200% 100%',
          animation:       'insight-shimmer 1.4s infinite',
        }} />
      ) : (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{insight}</span>
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
