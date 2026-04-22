// Simple module-level singleton to communicate the desired market tab
// between screens, bypassing Expo Router's unreliable param caching on tabs.
let pendingTab: 'Market' | 'Skills' | null = null;

export const setMarketTab = (tab: 'Market' | 'Skills') => {
  pendingTab = tab;
};

export const consumeMarketTab = (): 'Market' | 'Skills' | null => {
  const tab = pendingTab;
  pendingTab = null; // consume and clear so it only fires once
  return tab;
};
