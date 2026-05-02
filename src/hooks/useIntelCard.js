import { useState, useEffect, useRef, useCallback } from "react";

const CACHE_TTL = 3_600_000; // 1 hour

/**
 * Fetches AI-generated intelligence cards for a financial asset.
 *
 * @param {string}  id       - Asset ID (e.g. "AAPL", "GC=F", "EURUSD=X")
 * @param {string}  context  - Plain-text market data string to ground the AI response.
 *                             Pass null/undefined to delay fetching until data is ready.
 * @param {object}  opts
 * @param {boolean} opts.enabled - Set false to suppress fetching (e.g. tab not active).
 *                                 Fetching begins as soon as enabled=true AND context is set.
 *
 * @returns {{ intel, loading, error, refresh }}
 *   intel   — parsed JSON from /api/intel, or null while loading/errored
 *   loading — true while request in flight
 *   error   — string error message, or null
 *   refresh — function to bypass cache and re-generate
 */
export function useIntelCard(id, context, { enabled = true } = {}) {
  const [intel,   setIntel]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Tracks whether we've already kicked off a fetch for the current `id`
  // so a context change (data arriving late) doesn't cause a duplicate call.
  const triggered = useRef(false);

  // Reset state whenever the asset changes
  useEffect(() => {
    triggered.current = false;
    setIntel(null);
    setLoading(false);
    setError(null);
  }, [id]);

  const doFetch = useCallback(async (ctx) => {
    let apiKey;
    try { apiKey = localStorage.getItem("ov_copilot_key") || undefined; } catch {}
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, context: ctx || "", apiKey }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        throw new Error(d.message || d.error || `HTTP ${r.status}`);
      }
      try {
        localStorage.setItem(
          `ov_intel_v1_${id}`,
          JSON.stringify({ ts: Date.now(), intel: d })
        );
      } catch {}
      setIntel(d);
    } catch (e) {
      setError(e.message || "Failed to generate intelligence");
    } finally {
      setLoading(false);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger logic: fire once when (enabled && context) first become truthy for this id
  useEffect(() => {
    if (!enabled || !context || triggered.current) return;
    triggered.current = true;

    // Check cache first
    try {
      const raw = localStorage.getItem(`ov_intel_v1_${id}`);
      if (raw) {
        const { ts, intel: cached } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) {
          setIntel(cached);
          return;
        }
      }
    } catch {}

    doFetch(context);
  }, [enabled, context, id, doFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual refresh: clear cache and re-fetch with current context
  const refresh = useCallback(() => {
    try { localStorage.removeItem(`ov_intel_v1_${id}`); } catch {}
    doFetch(context);
  }, [id, context, doFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  return { intel, loading, error, refresh };
}
