// Shared design tokens for the iOS app. Mirrors the web design system
// where useful and uses native-tuned values where helpful.

export const colors = {
  navy: '#0f2744',
  navyAlt: '#4E5166',
  blueGray: '#7C90A0',
  tan: '#B5AA9D',
  charcoal: '#747274',
  sage: '#B9B7A7',

  text: '#1a1a2e',
  muted: '#6b7280',

  bg: '#ffffff',
  bgAlt: '#f8f8f8',
  border: 'rgba(78,81,102,0.15)',
  borderStrong: 'rgba(78,81,102,0.25)',

  amber: '#F59E0B',
  red: '#EF4444',
  green: '#16a34a',
};

export const radius = {
  card: 10,
  button: 6,
  pilotDot: 9999, // intentional — pilot dots are the one place pills remain
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const font = {
  pageTitle: 18,
  label: 12,
  body: 14,
  value: 24,
};

// Deterministic pilot color by index, matching the spec's color ladder
// when a user record lacks an explicit color (rare — Allan/Chip/Bob have
// theirs persisted in KV via the existing UserManagement).
export const pilotColorByIndex = [
  colors.navyAlt,
  colors.blueGray,
  colors.tan,
  colors.charcoal,
  colors.sage,
];
