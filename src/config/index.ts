// Dynamic brand configuration loader
// Loads the appropriate brand config based on NEXT_PUBLIC_BRAND_CONFIG environment variable

import type { BrandConfig } from './types';
import defaultConfig from './brand.config';

function loadBrandConfig(): BrandConfig {
  const configName = process.env.NEXT_PUBLIC_BRAND_CONFIG;
  
  if (!configName) {
    // No specific brand config specified, use default
    return defaultConfig;
  }
  
  try {
    // Dynamically import the specified brand config
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const specificConfig = require(`./brand.config.${configName}`).default;
    return specificConfig;
  } catch (error) {
    console.warn(`Failed to load brand config '${configName}', falling back to default:`, error);
    return defaultConfig;
  }
}

const brandConfig: BrandConfig = loadBrandConfig();

// Only the string-valued theme keys (excludes headerColors object)
type ThemeColorKey = 'headerBackground' | 'primaryColor' | 'adminColor' | 'editorColor';

// Helper function to get theme color
export function getThemeColor(colorKey: ThemeColorKey): string {
  return brandConfig.theme[colorKey] || '';
}

// --- Header color auto-computation ---

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function isDarkBackground(hex: string): boolean {
  return relativeLuminance(hex) < 0.4;
}

type HeaderColorKey = NonNullable<BrandConfig['theme']['headerColors']>;

function computeHeaderColors(
  headerBackground: string,
  primaryColor: string,
  overrides?: Partial<HeaderColorKey>,
): HeaderColorKey {
  const dark = isDarkBackground(headerBackground);

  const defaults: HeaderColorKey = dark
    ? {
        text: '#ffffff',
        textMuted: 'rgba(255,255,255,0.85)',
        border: 'rgba(255,255,255,0.2)',
        navActiveText: '#ffffff',
        navActiveBg: 'rgba(255,255,255,0.18)',
        navActiveBorder: 'rgba(255,255,255,0.5)',
        navInactiveText: 'rgba(255,255,255,0.7)',
        navHoverText: '#ffffff',
        navHoverBg: 'rgba(255,255,255,0.1)',
      }
    : {
        // Exact Tailwind equivalents — zero visual change for light headers
        text: '#111827',           // gray-900
        textMuted: '#374151',      // gray-700
        border: '#e5e7eb',         // gray-200
        navActiveText: '#1d4ed8',  // blue-700
        navActiveBg: '#dbeafe',    // blue-100
        navActiveBorder: '#bfdbfe',// blue-200
        navInactiveText: '#4b5563',// gray-600
        navHoverText: '#111827',   // gray-900
        navHoverBg: '#f3f4f6',    // gray-100
      };

  return { ...defaults, ...overrides };
}

let _headerColors: HeaderColorKey | null = null;

function getResolvedHeaderColors(): HeaderColorKey {
  if (!_headerColors) {
    _headerColors = computeHeaderColors(
      brandConfig.theme.headerBackground,
      brandConfig.theme.primaryColor,
      brandConfig.theme.headerColors,
    );
  }
  return _headerColors;
}

export function getHeaderColor(key: keyof HeaderColorKey): string {
  return getResolvedHeaderColors()[key] ?? '';
}

export { brandConfig };