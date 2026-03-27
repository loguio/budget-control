export const Colors = {
  // Primary palette
  primary: '#6C5CE7',
  primaryLight: '#A29BFE',
  primaryDark: '#4A3DB5',

  // Accent
  accent: '#00CEC9',
  accentLight: '#55EFC4',
  accentDark: '#00A89D',

  // Semantic
  success: '#00B894',
  warning: '#FDCB6E',
  danger: '#E17055',
  dangerLight: '#FAB1A0',
  info: '#74B9FF',

  // Backgrounds
  background: '#0A0E21',
  backgroundLight: '#1A1E33',
  card: '#1E2240',
  cardLight: '#2A2E4A',
  cardBorder: '#2E3354',

  // Text
  text: '#FFFFFF',
  textSecondary: '#8E92B0',
  textMuted: '#5A5E7A',

  // Gradients
  gradientPrimary: ['#6C5CE7', '#A29BFE'] as const,
  gradientAccent: ['#00CEC9', '#55EFC4'] as const,
  gradientSuccess: ['#00B894', '#55EFC4'] as const,
  gradientWarning: ['#FDCB6E', '#F8A51C'] as const,
  gradientDanger: ['#E17055', '#FAB1A0'] as const,
  gradientDark: ['#1A1E33', '#0A0E21'] as const,
};

export const CategoryColors: Record<string, string> = {
  'Alimentation': '#FF6B6B',
  'Transport': '#4ECDC4',
  'Logement': '#45B7D1',
  'Loisirs': '#96CEB4',
  'Shopping': '#FFEAA7',
  'Santé': '#DDA0DD',
  'Éducation': '#98D8C8',
  'Abonnements': '#F7DC6F',
  'Restaurants': '#E8A87C',
  'Épargne': '#55EFC4',
  'Salaire': '#6C5CE7',
  'Autre': '#8E92B0',
};
