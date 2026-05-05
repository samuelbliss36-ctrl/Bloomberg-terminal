import { create } from 'zustand';
import { loadSettings, saveSettings } from '../lib/fmt';

const saved = loadSettings();

export const useLayoutStore = create((set, get) => ({
  sidebarOpen:    true,
  showTickerTape: saved.showTickerTape ?? true,
  darkMode:       saved.darkMode       ?? false,

  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),

  toggleTape: () => {
    const showTickerTape = !get().showTickerTape;
    set({ showTickerTape });
    saveSettings({ ...loadSettings(), showTickerTape });
  },

  toggleDark: () => {
    const darkMode = !get().darkMode;
    set({ darkMode });
    saveSettings({ ...loadSettings(), darkMode });
  },
}));
