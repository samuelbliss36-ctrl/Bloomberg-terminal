import { create } from 'zustand';

export const useAIStore = create((set) => ({
  copilotOpen:    false,
  toggleCopilot:  () => set(s => ({ copilotOpen: !s.copilotOpen })),
  setCopilotOpen: (open) => set({ copilotOpen: open }),
}));
