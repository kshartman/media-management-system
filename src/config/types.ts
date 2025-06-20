// Type definitions for brand configuration

export interface BrandConfig {
  // Company Information
  companyName: string;
  appTitle: string;
  appDescription: string;
  
  // Visual Assets
  logoPath: string;
  faviconPath: string;
  
  // Theme Colors
  theme: {
    headerBackground: string;
    primaryColor: string;
    adminColor: string;
    editorColor: string;
  };
  
  // External Links (optional)
  externalLinks: {
    portal?: {
      label: string;
      url: string;
    };
    training?: {
      label: string;
      url: string;
    };
  } | null;
  
  // Domain Configuration
  domain: string;
  
  // Trash Configuration
  trash?: {
    retentionDays: number; // Number of days to keep deleted items before permanent deletion
  };
}