# White Label Configuration Guide

This guide explains how to customize the Media Management System for different clients using the brand configuration system.

## Quick Start

1. Copy `src/config/brand.config.example-client.js` to `src/config/brand.config.[client-name].js`
2. Update the configuration values for your client
3. Set `NEXT_PUBLIC_BRAND_CONFIG=[client-name]` in your environment
4. Build and deploy

## Configuration Structure

### Brand Configuration File

Create a new file in `src/config/` named `brand.config.[client-name].js`:

```javascript
const brandConfig = {
  // Company Information
  companyName: 'Your Company Name',
  appTitle: 'Your App Title',
  appDescription: 'Description of your media management system',
  
  // Visual Assets
  logoPath: '/your-logo.png',      // Place in public/ directory
  faviconPath: '/your-favicon.ico', // Place in public/ directory
  
  // Theme Colors
  theme: {
    headerBackground: '#hexcolor', // Header background color
    primaryColor: '#hexcolor',     // Primary brand color
    adminColor: '#hexcolor',       // Admin role badge color
    editorColor: '#hexcolor',      // Editor role badge color
  },
  
  // External Links (optional - set to null to hide)
  externalLinks: {
    portal: {
      label: 'Client Portal',
      url: 'https://portal.yourclient.com'
    },
    training: {
      label: 'Training Resources',
      url: 'https://training.yourclient.com'
    }
  },
  
  // Domain Configuration
  domain: 'media.yourclient.com',
};

export default brandConfig;
```

### Asset Requirements

#### Logo
- **Format**: PNG with transparent background recommended
- **Dimensions**: Height of 32px, width flexible (will scale)
- **Location**: `/public/[your-logo].png`

#### Favicon
- **Format**: ICO or PNG
- **Dimensions**: 32x32px or 16x16px
- **Location**: `/public/[your-favicon].ico`

## Deployment Steps

### 1. Create Client Configuration

```bash
# Copy the example configuration
cp src/config/brand.config.example-client.js src/config/brand.config.acme.js

# Edit the configuration
vim src/config/brand.config.acme.js
```

### 2. Add Client Assets

```bash
# Add logo and favicon to public directory
cp /path/to/acme-logo.png public/
cp /path/to/acme-favicon.ico public/
```

### 3. Configure Environment

#### Frontend Environment
```bash
# Copy the whitelabel environment template
cp .env.example.whitelabel .env

# Update with client values
vim .env
```

#### Server Environment (for local development)
```bash
# Copy the server whitelabel template
cp server/.env.example.whitelabel server/.env

# Update with client values
vim server/.env
```

Key environment variables:
- `NEXT_PUBLIC_BRAND_CONFIG=acme` (matches your config filename)
- `CLIENT_DOMAIN=media.acme.com`
- Update email domains and CORS origins
- Ensure `ALLOWED_ORIGINS` includes client domain for production

### 4. Build and Test

#### Local Development Testing
```bash
# Set brand config for this session
export NEXT_PUBLIC_BRAND_CONFIG=acme

# Start frontend
npm run dev

# In another terminal, start backend (if testing locally)
cd server
npm start
```

#### Production Build Testing
```bash
# Build for production
npm run build

# Build Docker images
docker compose build
```

### 5. Deploy

```bash
# Deploy with Docker
docker compose up -d
```

## Multiple Client Management

### Option 1: Build-Time Configuration (Recommended)

Build separate Docker images for each client:

```bash
# Build for ACME Corp
NEXT_PUBLIC_BRAND_CONFIG=acme docker compose build

# Tag the images
docker tag media-management-frontend:latest media-management-frontend:acme
docker tag media-management-backend:latest media-management-backend:acme
```

### Option 2: Runtime Configuration

Use environment variable substitution in Docker:

```yaml
# docker-compose.yml
services:
  frontend:
    environment:
      - NEXT_PUBLIC_BRAND_CONFIG=${BRAND_CONFIG:-default}
```

Then deploy with:
```bash
BRAND_CONFIG=acme docker compose up -d
```

## Customization Examples

### Remove External Links

For clients without external portals:

```javascript
externalLinks: null, // This removes the menu items completely
```

### Custom Color Schemes

```javascript
theme: {
  headerBackground: '#1a1a1a', // Dark header
  primaryColor: '#00ff00',     // Green primary
  adminColor: '#ff0000',       // Red admin badges
  editorColor: '#0000ff',      // Blue editor badges
},
```

### Minimal Branding

For a generic deployment:

```javascript
const brandConfig = {
  companyName: 'Media Library',
  appTitle: 'Media Library',
  appDescription: 'Digital asset management',
  logoPath: '/generic-logo.png',
  faviconPath: '/favicon.ico',
  theme: {
    headerBackground: '#f3f4f6',
    primaryColor: '#6b7280',
    adminColor: '#6b7280',
    editorColor: '#6b7280',
  },
  externalLinks: null,
  domain: 'media.local',
};
```

## Development Reference Files

### ZIVE Production Values
For reference, the actual ZIVE production configuration values are available in:
- `server/.env.zive` - Real ZIVE server environment (not tracked by git)

This file contains the actual production values formatted like the `.env.example` template, useful for:
- Comparing client configurations against ZIVE defaults
- Quick setup for ZIVE-compatible development
- Reference for working configuration values

**Note**: These files contain sensitive data and are not committed to git.

## Troubleshooting

### Brand Config Not Loading

1. Check the environment variable:
   ```bash
   echo $NEXT_PUBLIC_BRAND_CONFIG
   ```

2. Verify the config file exists:
   ```bash
   ls src/config/brand.config.*.js
   ```

3. Check for syntax errors in the config file

### Assets Not Displaying

1. Verify files are in `/public/` directory
2. Check file paths in brand config match exactly
3. Clear Next.js cache: `rm -rf .next`

### Build Errors

If you get module not found errors:
1. Ensure config file is named correctly
2. Export default from the config file
3. Restart the dev server after adding new configs

## Best Practices

1. **Version Control**: Keep client configs in separate branches or repos
2. **Asset Naming**: Use client prefix (e.g., `acme-logo.png`)
3. **Testing**: Always test the full build before deployment
4. **Documentation**: Document client-specific features or modifications
5. **Secrets**: Never commit API keys or sensitive data in configs