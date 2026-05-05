import { useQueries } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useCopilotData(ticker) {
  const today     = new Date().toISOString().split('T')[0];
  const twoYrsAgo = new Date(Date.now() - 730 * 24 * 3600 * 1000).toISOString().split('T')[0];

  const [histQ, recsQ, ptQ, peersQ] = useQueries({
    queries: [
      {
        queryKey: ['earnings-history', ticker, twoYrsAgo, today],
        queryFn:  () => api('/calendar/earnings?symbol=' + ticker + '&from=' + twoYrsAgo + '&to=' + today),
        staleTime: 60 * 60_000,
      },
      {
        queryKey: ['recommendation', ticker],
        queryFn:  () => api('/stock/recommendation?symbol=' + ticker),
        staleTime: 60 * 60_000,
      },
      {
        queryKey: ['price-target', ticker],
        queryFn:  () => api('/stock/price-target?symbol=' + ticker).catch(() => null),
        staleTime: 60 * 60_000,
      },
      {
        queryKey: ['peers', ticker],
        queryFn:  () => api('/stock/peers?symbol=' + ticker),
        staleTime: 60 * 60_000,
      },
    ],
  });

  const knownPeers = (peersQ.data || []).filter(x => x !== ticker).slice(0, 4);

  // Peer metrics — dynamic queries, enabled only once peers are known
  const peerMetricQueries = useQueries({
    queries: knownPeers.map(peer => ({
      queryKey: ['metrics', peer],
      queryFn:  () => api('/stock/metric?symbol=' + peer + '&metric=all'),
      staleTime: 5 * 60_000,
      enabled:  knownPeers.length > 0,
    })),
  });

  const peerMetrics = {};
  peerMetricQueries.forEach((q, i) => {
    if (q.data) peerMetrics[knownPeers[i]] = q.data?.metric || {};
  });

  return {
    earningsHistory: (histQ.data?.earningsCalendar || [])
      .filter(e => e.epsActual != null)
      .sort((a, b) => (b.date > a.date ? 1 : -1))
      .slice(0, 4),
    recommendation: Array.isArray(recsQ.data) ? (recsQ.data[0] || null) : null,
    priceTarget:    ptQ.data?.targetMean ? ptQ.data : null,
    peerTickers:    knownPeers,
    peerMetrics,
  };
}
