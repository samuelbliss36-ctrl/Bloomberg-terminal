import { create } from 'zustand';

export const useNavigationStore = create((set) => ({
  ticker:    'AAPL',
  setTicker: (t) => set({ ticker: t.trim().toUpperCase() }),
}));
