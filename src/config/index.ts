// Dynamic brand configuration loader
// Loads the appropriate brand config based on NEXT_PUBLIC_BRAND_CONFIG environment variable

import type { BrandConfig } from './types';
import defaultConfig from './brand.config';

// For now, always use the default config
// Client-specific configs should be added as needed
const brandConfig: BrandConfig = defaultConfig;

// Helper function to get theme color
export function getThemeColor(colorKey: keyof BrandConfig['theme']): string {
  const color = brandConfig.theme[colorKey];
  if (!color) return '';
  
  // Return the color value (should be hex format)
  return color;
}

export { brandConfig };