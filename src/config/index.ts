// Dynamic brand configuration loader
// Loads the appropriate brand config based on NEXT_PUBLIC_BRAND_CONFIG environment variable

import type { BrandConfig } from './types';
import defaultConfig from './brand.config';

const configName = process.env.NEXT_PUBLIC_BRAND_CONFIG || 'default';

let brandConfig: BrandConfig;

if (configName === 'default') {
  brandConfig = defaultConfig;
} else if (configName === 'test-client') {
  // Load test client config for demonstration
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    brandConfig = require('./brand.config.test-client').default;
  } catch {
    console.warn('Test client config not found, using default config');
    brandConfig = defaultConfig;
  }
} else {
  // For other client-specific configs, fall back to default
  console.warn(`Client config '${configName}' not found, using default config`);
  brandConfig = defaultConfig;
}

// Helper function to get theme color
export function getThemeColor(colorKey: keyof BrandConfig['theme']): string {
  const color = brandConfig.theme[colorKey];
  if (!color) return '';
  
  // Return the color value (should be hex format)
  return color;
}

export { brandConfig };