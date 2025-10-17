#!/bin/bash
#
# ACME Brand Deployment Script (EXAMPLE)
# This is a reference implementation - customize for your needs
#
# IMPORTANT: Uses cp instead of symlinks because Docker builds don't follow
# symlinks outside the build context. Symlinks will cause "module not found" errors.
#

set -e  # Exit on error

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=================================="
echo "ACME Brand Deployment (EXAMPLE)"
echo "=================================="
echo ""
echo "Script directory: $SCRIPT_DIR"
echo "Project root: $PROJECT_ROOT"
echo ""

# Function to copy file with confirmation
copy_file() {
    local source=$1
    local target=$2

    # Remove existing file/symlink if it exists
    if [ -e "$target" ] || [ -L "$target" ]; then
        echo "Removing existing: $target"
        rm -f "$target"
    fi

    # Copy file (NOT symlink - Docker builds don't follow external symlinks)
    echo "Copying: $(basename $target)"
    cp "$source" "$target"
}

# Copy brand configuration
echo "Step 1: Copying brand configuration..."
copy_file "$SCRIPT_DIR/config/brand.config.acme.ts" "$PROJECT_ROOT/src/config/brand.config.ts"
echo ""

# Copy logo (you'll need to add your actual logo file)
echo "Step 2: Copying logo..."
if [ -f "$SCRIPT_DIR/assets/acme-logo.png" ]; then
    copy_file "$SCRIPT_DIR/assets/acme-logo.png" "$PROJECT_ROOT/public/logo-placeholder.png"
    echo "Logo copied successfully"
else
    echo "⚠️  WARNING: No logo found at assets/acme-logo.png"
    echo "   Add your logo file and run this script again"
fi
echo ""

# Deploy environment files
echo "Step 3: Deploying environment files..."
echo ""
echo "Choose deployment environment:"
echo "  1) Production (from .env.production.example)"
echo "  2) Local Development (from .env.local.example)"
echo "  3) Docker Production (from .env.docker.example)"
echo "  4) Skip environment files"
read -p "Enter choice [1-4]: " env_choice

case $env_choice in
    1)
        echo "⚠️  NOTE: This is an EXAMPLE file with placeholders!"
        echo "   Copy env/.env.production.example to env/.env.production"
        echo "   Replace all placeholder values with real credentials"
        echo "   Then run this script again or manually copy the file"
        if [ -f "$SCRIPT_DIR/env/.env.production" ]; then
            cp "$SCRIPT_DIR/env/.env.production" "$PROJECT_ROOT/.env"
            echo "✓ Deployed: .env (from .env.production)"
        else
            echo "⚠️  File not found: env/.env.production"
        fi
        ;;
    2)
        if [ -f "$SCRIPT_DIR/env/.env.local.example" ]; then
            cp "$SCRIPT_DIR/env/.env.local.example" "$PROJECT_ROOT/.env.local"
            echo "✓ Deployed: .env.local (EXAMPLE - customize before use)"
        else
            echo "⚠️  File not found: env/.env.local.example"
        fi
        ;;
    3)
        echo "⚠️  NOTE: This is an EXAMPLE file with placeholders!"
        echo "   Customize env/.env.docker.example before deployment"
        if [ -f "$SCRIPT_DIR/env/.env.docker" ]; then
            cp "$SCRIPT_DIR/env/.env.docker" "$PROJECT_ROOT/.env"
            echo "✓ Deployed: .env (from .env.docker)"
        else
            echo "⚠️  File not found: env/.env.docker"
        fi
        ;;
    4)
        echo "Skipping environment files"
        ;;
    *)
        echo "Invalid choice. Skipping environment files."
        ;;
esac

echo ""
echo "=================================="
echo "Deployment Complete!"
echo "=================================="
echo ""
echo "⚠️  IMPORTANT: This is an EXAMPLE brand configuration!"
echo ""
echo "To use this for a real deployment:"
echo "  1. Copy acme-brand/ to your-client-brand/"
echo "  2. Customize all files with real client data"
echo "  3. Replace placeholder environment values"
echo "  4. Add your client's logo"
echo "  5. Update brand.config.acme.ts with client branding"
echo ""
echo "Next steps:"
echo "  1. Verify NEXT_PUBLIC_BRAND_CONFIG=acme in your .env"
echo "  2. Build the application: npm run build"
echo "  3. Start the application: npm start"
echo ""
