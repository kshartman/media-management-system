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

// Helper function to get theme color
export function getThemeColor(colorKey: keyof BrandConfig['theme']): string {
  const color = brandConfig.theme[colorKey];
  if (!color) return '';
  
  // Return the color value (should be hex format)
  return color;
}

export { brandConfig };