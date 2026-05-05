import { useQueries } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useTickerData(ticker) {
  const today     = new Date().toISOString().split('T')[0];
  const monthAgo  = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const yearAhead = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0];

  const [quoteQ, metricsQ, profileQ, newsQ, earningsQ] = useQueries({
    queries: [
      {
        queryKey: ['quote', ticker],
        queryFn:  () => api('/quote?symbol=' + ticker),
        staleTime: 15_000,
        refetchInterval: 60_000,
      },
      {
        queryKey: ['metrics', ticker],
        queryFn:  () => api('/stock/metric?symbol=' + ticker + '&metric=all'),
        staleTime: 5 * 60_000,
      },
      {
        queryKey: ['profile', ticker],
        queryFn:  () => api('/stock/profile2?symbol=' + ticker),
        staleTime: 60 * 60_000,
      },
      {
        queryKey: ['news', ticker, monthAgo, today],
        queryFn:  () => api('/company-news?symbol=' + ticker + '&from=' + monthAgo + '&to=' + today),
        staleTime: 5 * 60_000,
      },
      {
        queryKey: ['upcoming-earnings', ticker, today, yearAhead],
        queryFn:  () => api('/calendar/earnings?symbol=' + ticker + '&from=' + today + '&to=' + yearAhead),
        staleTime: 30 * 60_000,
      },
    ],
  });

  return {
    quote:    quoteQ.data    ?? null,
    metrics:  metricsQ.data  ?? null,
    profile:  profileQ.data  ?? null,
    news:     Array.isArray(newsQ.data) ? newsQ.data : [],
    earnings: earningsQ.data?.earningsCalendar ?? [],
    loading:  quoteQ.isLoading || metricsQ.isLoading,
  };
}
