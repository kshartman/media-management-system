# Brand Overlay System Guide

This guide explains how to use the brand overlay system to manage client-specific configurations separately from the main codebase.

## Overview

The brand overlay system allows you to:
- Keep client-specific branding, logos, and configurations in separate private repositories
- Maintain a clean, generic public codebase
- Deploy multiple branded versions from the same source code
- Version control client secrets independently

## Architecture

```
media-management-system/       (public GitHub repo)
├── src/config/
│   ├── brand.config.ts        (brand system logic)
│   ├── brand.config.default.ts  (generic fallback)
│   └── brand.config.example-client.ts  (template)
├── public/
│   └── logo-placeholder.png.README  (logo instructions)
└── zive-brand/                (PRIVATE - gitignored)
    ├── .git/                  (separate git repo)
    ├── assets/                (logos, images)
    ├── config/                (brand configuration)
    ├── aws/                   (AWS/S3 policies)
    ├── env/                   (encrypted secrets)
    ├── deploy.sh              (deployment script)
    └── README.md              (deployment docs)
```

## Quick Start

### 1. Create Your Brand Folder

```bash
# In your main project directory
mkdir -p your-client-brand/{assets,config,aws,env}
cd your-client-brand
git init
```

### 2. Add Brand Assets

```bash
# Copy your logo
cp /path/to/your-logo.png assets/

# Create brand configuration
cp ../src/config/brand.config.example-client.ts config/brand.config.yourclient.ts
# Edit with your client's information

# Add S3 policy if using AWS
cp ../server/s3-policy.example.json aws/your-s3-policy.json
# Update with your bucket name
```

### 3. Add Environment Files

You can either:
- **Encrypt with GPG:** `gpg -c your.env -o env/env.production.gpg`
- **Store unencrypted:** Just add `env/*.env` to your brand repo's `.gitignore`

### 4. Create Deploy Script

```bash
cat > deploy.sh << 'EOF'
#!/bin/bash
# Link brand assets
ln -sf ../your-client-brand/assets/your-logo.png ../public/logo-placeholder.png
ln -sf ../your-client-brand/config/brand.config.yourclient.ts ../src/config/brand.config.ts

# Decrypt environment files (if using GPG)
gpg -d env/env.production.gpg > ../.env
EOF

chmod +x deploy.sh
```

### 5. Commit to Private Repo

```bash
git add .
git commit -m "Initial brand configuration"
git remote add origin git@your-private-server:your-client-brand.git
git push -u origin main
```

### 6. Deploy

```bash
# Clone main repo
git clone https://github.com/your-org/media-management-system.git
cd media-management-system

# Clone brand repo
git clone git@your-private-server:your-client-brand.git your-client-brand

# Run deployment
cd your-client-brand
./deploy.sh

# Build and run
cd ..
npm install
npm run build
npm start
```

## Brand Configuration

### Creating a Brand Config

Your `config/brand.config.yourclient.ts` should export a configuration object:

```typescript
import type { BrandConfig } from '../types';

const brandConfig: BrandConfig = {
  companyName: 'Your Company',
  appTitle: 'Your App Title',
  appDescription: 'Description of your system',

  logoPath: '/logo-placeholder.png',
  faviconPath: '/favicon.ico',

  theme: {
    headerBackground: '#f0f0f0',
    primaryColor: '#007bff',
    adminColor: '#6f42c1',
    editorColor: '#007bff',
  },

  externalLinks: {
    portal: {
      label: 'Portal',
      url: 'https://portal.yourclient.com'
    },
    training: null,  // Set to null to hide
  },

  domain: 'media.yourclient.com',

  trash: {
    retentionDays: 30
  },
};

export default brandConfig;
```

### Environment Configuration

Set `NEXT_PUBLIC_BRAND_CONFIG` to load your specific brand:

```bash
# In your .env file
NEXT_PUBLIC_BRAND_CONFIG=yourclient
```

This will attempt to load `brand.config.yourclient.ts`. If not found, falls back to `brand.config.default.ts`.

## Security Best Practices

### Encrypting Secrets

Use GPG to encrypt environment files:

```bash
# Encrypt
gpg -c production.env -o env/env.production.gpg

# Decrypt
gpg -d env/env.production.gpg > ../.env
```

### Managing Multiple Environments

```
env/
├── env.production.gpg      # Production secrets
├── env.staging.gpg         # Staging secrets
└── env.development.gpg     # Development secrets
```

Update your deploy script to prompt for environment selection.

### Git Security

**In your brand repo:**
```gitignore
# Never commit unencrypted secrets
*.env
.env
.env.*
!*.gpg
```

**In main repo:**
The `.gitignore` already includes:
```gitignore
*-brand/
```

## Multiple Clients

You can manage multiple brands:

```
media-management-system/
├── zive-brand/        (private repo 1)
├── acme-brand/        (private repo 2)
└── xyz-brand/         (private repo 3)
```

Each brand folder:
- Has its own git repository
- Contains client-specific files
- Uses its own deployment script

## Deployment Automation

### Docker Deployment

Create a `Dockerfile.branded`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy main app
COPY . .

# Clone and deploy brand
ARG BRAND_REPO_URL
ARG BRAND_NAME
RUN git clone ${BRAND_REPO_URL} ${BRAND_NAME}-brand
RUN cd ${BRAND_NAME}-brand && ./deploy.sh

# Build
RUN npm install
RUN npm run build

CMD ["npm", "start"]
```

Build with:
```bash
docker build \
  --build-arg BRAND_REPO_URL=git@server:client-brand.git \
  --build-arg BRAND_NAME=client \
  -f Dockerfile.branded \
  -t client-media-system .
```

### CI/CD Integration

In your GitHub Actions / GitLab CI:

```yaml
- name: Clone brand configuration
  run: |
    git clone https://${{ secrets.BRAND_REPO_TOKEN }}@gitlab.com/org/client-brand.git client-brand
    cd client-brand && ./deploy.sh
```

## Troubleshooting

### Brand not loading
- Check `NEXT_PUBLIC_BRAND_CONFIG` environment variable
- Verify brand config file exists and is properly linked
- Check browser console for errors

### Logo not appearing
- Verify symlink: `ls -la public/logo-placeholder.png`
- Check logo file exists in brand repo
- Clear Next.js cache: `rm -rf .next`

### Environment variables not working
- Ensure `.env` file is in project root
- Restart development server after changes
- Verify GPG decryption succeeded (check file size > 0)

## Example: Zive Brand

This repository includes a `zive-brand/` folder as a reference implementation. Review its structure and deployment script for a complete example.

**Note:** The `zive-brand/` folder is gitignored in the main repository and maintained as a separate private repository.

## Support

For questions about the brand overlay system, see:
- `WHITE_LABEL_GUIDE.md` - White labeling documentation
- `zive-brand/README.md` - Example brand implementation
- `CLAUDE.md` - Development and deployment notes
