// CampusLoop Design System
export const Colors = {
  // Backgrounds
  bg: '#0A0A12',
  bgCard: '#13131F',
  bgSurface: '#1C1C2E',

  // Primary Gradient (violet → blue)
  primary: '#7C6FFF',
  primaryLight: '#A78BFA',
  secondary: '#38BDF8',

  // Accents
  success: '#34EE9A',
  danger: '#FF6B6B',
  warning: '#FFB347',

  // Text
  textPrimary: '#F0F0FF',
  textSecondary: 'rgba(240,240,255,0.55)',
  textMuted: 'rgba(240,240,255,0.3)',

  // Borders
  border: 'rgba(255,255,255,0.08)',
  borderActive: 'rgba(124,111,255,0.5)',
};

export const Gradients = {
  primary: ['#7C6FFF', '#38BDF8'] as const,
  dark: ['#13131F', '#0A0A12'] as const,
  card: ['#1C1C2E', '#13131F'] as const,
  lostBadge: ['#FF6B6B', '#FF4757'] as const,
  foundBadge: ['#34EE9A', '#26D68A'] as const,
  skillOffer: ['#7C6FFF', '#A78BFA'] as const,
  skillRequest: ['#FFB347', '#FF8C00'] as const,
};
