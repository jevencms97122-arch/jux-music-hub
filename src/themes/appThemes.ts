export type AppTheme = {
  id: string;
  name: string;
  /** CSS brute : #rgb/hex ou gradient(…) */
  background: string;
  /** Couleur texte lisible sur fond */
  textColor: string;
  /** Couleur d’accentuation (boutons actifs, progress bar, etc.) */
  accentColor: string;

  /** HSL triplets compatibles avec tailwind config actuelle (hsl(var(--…))) */
  hsl: {
    primary: string; // "h s% l%"
    primaryForeground: string; // "h s% l%"
    accent: string;
    accentForeground: string;
    ring: string;

    border: string;
    input: string;
    background: string;
    foreground: string;

    secondary: string;
    secondaryForeground: string;

    muted: string;
    mutedForeground: string;

    destructive: string;
    destructiveForeground: string;

    card: string;
    cardForeground: string;

    popover: string;
    popoverForeground: string;

    sidebar: {
      background: string;
      foreground: string;
      primary: string;
      primaryForeground: string;
      accent: string;
      accentForeground: string;
      border: string;
      ring: string;
    };
  };
};

/**
 * Inspiré Nitro Discord (couleurs unies + fondus).
 * NOTE: background est un CSS brut (uni/gradient).
 * Les autres couleurs sont en HSL triplets pour tailwind (hsl(var(--x))).
 */
export const APP_THEMES: AppTheme[] = [
  {
    id: 'dark-classique',
    name: 'Sombre Classique',
    background: '#000000',
    textColor: 'rgba(255,255,255,0.98)',
    accentColor: 'rgb(14,165,233)',
    hsl: {
      primary: '12 90% 58%',
      primaryForeground: '0 0% 100%',
      accent: '12 90% 58%',
      accentForeground: '0 0% 100%',
      ring: '12 90% 58%',

      border: '0 0% 14%',
      input: '0 0% 14%',
      background: '0 0% 6%',
      foreground: '0 0% 98%',

      secondary: '0 0% 13%',
      secondaryForeground: '0 0% 92%',

      muted: '0 0% 16%',
      mutedForeground: '0 0% 60%',

      destructive: '0 84% 60%',
      destructiveForeground: '0 0% 100%',

      card: '0 0% 9%',
      cardForeground: '0 0% 98%',

      popover: '0 0% 9%',
      popoverForeground: '0 0% 98%',

      sidebar: {
        background: '0 0% 8%',
        foreground: '0 0% 92%',
        primary: '12 90% 58%',
        primaryForeground: '0 0% 100%',
        accent: '0 0% 12%',
        accentForeground: '0 0% 92%',
        border: '0 0% 14%',
        ring: '12 90% 58%',
      },
    },
  },
  {
    id: 'lune-carmin',
    name: 'Lune Carmin',
    background: 'linear-gradient(135deg, #0f0f1a 0%, #3b0a3a 45%, #b0123c 100%)',
    textColor: 'rgba(255,255,255,0.98)',
    accentColor: '#ff3b6a',
    hsl: {
      primary: '345 92% 60%',
      primaryForeground: '0 0% 100%',
      accent: '345 92% 60%',
      accentForeground: '0 0% 100%',
      ring: '345 92% 60%',

      border: '346 35% 30%',
      input: '346 35% 30%',
      background: '250 30% 6%',
      foreground: '0 0% 98%',

      secondary: '300 25% 12%',
      secondaryForeground: '0 0% 92%',

      muted: '300 18% 18%',
      mutedForeground: '0 0% 62%',

      destructive: '0 84% 60%',
      destructiveForeground: '0 0% 100%',

      card: '275 30% 10%',
      cardForeground: '0 0% 98%',

      popover: '275 30% 10%',
      popoverForeground: '0 0% 98%',

      sidebar: {
        background: '250 30% 8%',
        foreground: '0 0% 92%',
        primary: '345 92% 60%',
        primaryForeground: '0 0% 100%',
        accent: '300 30% 12%',
        accentForeground: '0 0% 92%',
        border: '346 35% 30%',
        ring: '345 92% 60%',
      },
    },
  },
  {
    id: 'lueur-chromee',
    name: 'Lueur Chromée',
    background:
      'linear-gradient(135deg, #070a1a 0%, #0b5cff 45%, #20e3b2 100%)',
    textColor: 'rgba(255,255,255,0.98)',
    accentColor: '#20e3b2',
    hsl: {
      primary: '166 88% 48%',
      primaryForeground: '0 0% 100%',
      accent: '166 88% 48%',
      accentForeground: '0 0% 100%',
      ring: '166 88% 48%',

      border: '170 35% 30%',
      input: '170 35% 30%',
      background: '231 48% 6%',
      foreground: '0 0% 98%',

      secondary: '210 30% 13%',
      secondaryForeground: '0 0% 92%',

      muted: '200 25% 16%',
      mutedForeground: '0 0% 60%',

      destructive: '0 84% 60%',
      destructiveForeground: '0 0% 100%',

      card: '220 35% 9%',
      cardForeground: '0 0% 98%',

      popover: '220 35% 9%',
      popoverForeground: '0 0% 98%',

      sidebar: {
        background: '231 45% 8%',
        foreground: '0 0% 92%',
        primary: '166 88% 48%',
        primaryForeground: '0 0% 100%',
        accent: '190 28% 12%',
        accentForeground: '0 0% 92%',
        border: '170 35% 30%',
        ring: '166 88% 48%',
      },
    },
  },
];
