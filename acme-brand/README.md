# ACME Brand Configuration (EXAMPLE)

**⚠️ IMPORTANT: This is a reference implementation with placeholder values!**

This folder serves as a working example of how to structure a client brand configuration. All values are placeholders and should NOT be used in production.

## Purpose

This example demonstrates:
- Brand configuration structure
- Environment file organization
- Deployment script pattern
- Asset management approach

## Contents

```
acme-brand/
├── assets/
│   └── PLACE_LOGO_HERE.txt    # Logo placeholder instructions
├── config/
│   └── brand.config.acme.ts   # Example brand configuration
├── aws/
│   └── acme-s3-policy.json    # Example S3 IAM policy
├── env/
│   ├── .env.production.example # Production environment template
│   ├── .env.local.example      # Local development template
│   └── .env.docker.example     # Docker deployment template
├── deploy.sh                   # Example deployment script
└── README.md                   # This file
```

## Using This Example

### Option 1: Quick Local Testing

Test the brand system with this example:

```bash
# Run the deployment script
cd acme-brand
./deploy.sh

# Choose option 2 (Local Development)
# This will link the ACME brand configuration

# Start the application
cd ..
npm run dev
```

The application will use the ACME branding (blue theme, ACME name, etc.)

### Option 2: Create Your Own Client Brand

Copy this folder structure for your client:

```bash
# Copy the entire folder
cp -r acme-brand myclient-brand

# Navigate to your new brand folder
cd myclient-brand

# Initialize as a separate git repository (optional but recommended)
git init
```

Then customize:

1. **Brand Configuration** (`config/brand.config.myclient.ts`):
   - Change company name, colors, URLs
   - Update external links
   - Set domain

2. **Logo** (`assets/`):
   - Add your client's logo as PNG
   - Update deploy.sh to reference correct filename

3. **Environment Files** (`env/`):
   - Copy .example files to actual files (without .example)
   - Replace ALL placeholder values with real credentials
   - **IMPORTANT**: Never commit unencrypted secrets to git!

4. **AWS Configuration** (`aws/`):
   - Update S3 bucket name
   - Adjust IAM permissions as needed

5. **Deployment Script** (`deploy.sh`):
   - Update logo filename reference
   - Adjust environment file handling
   - Add any client-specific deployment steps

## Security Considerations

### For Private Client Brands

If creating a real client brand:

1. **Environment Files**:
   - Encrypt with GPG: `gpg -c .env.production -o .env.production.gpg`
   - Only commit encrypted .gpg files
   - Add `*.env` to your brand repo's .gitignore

2. **Private Repository**:
   - Host on private GitLab/GitHub
   - Restrict access to authorized team members
   - Use SSH keys for authentication

3. **Secrets Management**:
   - Use strong JWT secrets (32+ characters)
   - Generate with: `openssl rand -base64 48`
   - Rotate credentials regularly
   - Never commit real credentials to git

### This Example Folder

The `acme-brand/` folder is **safe to commit** to the main repository because:
- All values are placeholders
- No real credentials included
- Clearly marked as EXAMPLE
- Serves as documentation

## Deployment Workflow

### Development

```bash
cd acme-brand  # or your-client-brand
./deploy.sh
# Choose option 2 (Local Development)
cd ..
npm run dev
```

### Production

```bash
cd your-client-brand

# Ensure you have real environment files (not .example)
# Decrypt if using GPG encryption
gpg -d env/.env.production.gpg > env/.env.production

./deploy.sh
# Choose option 1 (Production)

cd ..
npm run build
npm start
```

### Docker Deployment

```bash
cd your-client-brand
./deploy.sh
# Choose option 3 (Docker)

cd ..
docker-compose up --build -d
```

## Customization Guide

### Brand Configuration

Edit `config/brand.config.acme.ts`:

```typescript
const brandConfig: BrandConfig = {
  companyName: 'Your Company',      // Appears in header
  appTitle: 'Your App Title',        // Browser title
  appDescription: 'Description',     // Meta description

  logoPath: '/logo-placeholder.png', // Logo location
  faviconPath: '/favicon.ico',       // Favicon

  theme: {
    headerBackground: '#e6f3ff',     // Header color
    primaryColor: '#0066cc',          // Primary brand color
    adminColor: '#cc0066',            // Admin badge color
    editorColor: '#0066cc',           // Editor badge color
  },

  externalLinks: {
    portal: {
      label: 'Portal',
      url: 'https://portal.example.com'
    },
    training: null,  // Set to null to hide
  },

  domain: 'media.example.com',

  trash: {
    retentionDays: 30  // Days before permanent deletion
  },
};
```

### Environment Variables

Key variables to customize in your `.env` files:

```bash
# Brand Selection
NEXT_PUBLIC_BRAND_CONFIG=yourclient  # Must match config filename

# Domain
DOMAIN=media.yourclient.com
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api

# Database
MONGODB_URI=your-mongodb-connection-string

# Security
JWT_SECRET=generate-strong-random-string-here

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=your-bucket-name

# Email
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@yourclient.com
```

## Multiple Client Management

You can maintain multiple client brands:

```
media-management-system/
├── acme-brand/       (example, committed to git)
├── client-a-brand/   (private, gitignored)
├── client-b-brand/   (private, gitignored)
└── client-c-brand/   (private, gitignored)
```

Each can be a separate git repository hosted privately.

## Troubleshooting

**Brand not loading:**
- Check `NEXT_PUBLIC_BRAND_CONFIG` matches your config filename
- Verify symlink: `ls -la src/config/brand.config.ts`
- Check browser console for errors

**Logo not appearing:**
- Verify logo file exists in `assets/`
- Check symlink: `ls -la public/logo-placeholder.png`
- Clear Next.js cache: `rm -rf .next && npm run dev`

**Environment variables not working:**
- Ensure `.env` file is in project root (not in brand folder after deployment)
- Restart server after changes
- Check for typos in variable names

## Additional Resources

- **BRAND_OVERLAY_GUIDE.md** - Complete guide to the brand overlay system
- **WHITE_LABEL_GUIDE.md** - White labeling documentation
- **README.md** - Main project documentation

## Contributing

When improving this example:
- Keep all values as obvious placeholders
- Update this README with any structural changes
- Ensure the deploy.sh script remains functional
- Test that the example works for local development

---

**Remember**: This is an EXAMPLE. Create your own client brand folders for real deployments!
