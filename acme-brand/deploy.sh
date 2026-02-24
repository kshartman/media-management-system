#!/bin/bash
#
# ACME Brand Deployment Script (EXAMPLE)
#
# Sets up the project to build as the ACME brand by copying brand assets
# and config into the shared build directories (src/config/, public/).
#
# Usage:
#   ./deploy.sh              # Interactive — prompts for environment choice
#   ./deploy.sh deploy       # Called by parent dispatcher (./deploy.sh acme)
#
# IMPORTANT: Uses cp instead of symlinks because Docker builds don't follow
# symlinks outside the build context.  Symlinks cause "module not found" errors.
#

set -e  # Exit on error

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=================================="
echo "ACME Brand Setup (EXAMPLE)"
echo "=================================="
echo ""
echo "Script directory: $SCRIPT_DIR"
echo "Project root:     $PROJECT_ROOT"
echo ""

# ── Helper ──────────────────────────────────────────────────────────────
copy_file() {
    local source=$1
    local target=$2

    # Remove existing file/symlink if it exists
    if [ -e "$target" ] || [ -L "$target" ]; then
        rm -f "$target"
    fi

    # Copy file (NOT symlink — Docker builds don't follow external symlinks)
    echo "  $(basename "$target")"
    cp "$source" "$target"
}

# ── Step 1: Brand configuration ────────────────────────────────────────
echo "Step 1: Brand configuration..."
copy_file "$SCRIPT_DIR/config/brand.config.acme.ts" "$PROJECT_ROOT/src/config/brand.config.ts"
echo ""

# ── Step 2: Logo ───────────────────────────────────────────────────────
echo "Step 2: Logo..."
if [ -f "$SCRIPT_DIR/assets/acme-logo.png" ]; then
    copy_file "$SCRIPT_DIR/assets/acme-logo.png" "$PROJECT_ROOT/public/logo-placeholder.png"
else
    echo "  WARNING: No logo found at assets/acme-logo.png"
    echo "  Add your logo file and run this script again"
fi
echo ""

# ── Step 3: Favicon ────────────────────────────────────────────────────
echo "Step 3: Favicon..."
if [ -f "$SCRIPT_DIR/assets/acme-favicon.png" ]; then
    copy_file "$SCRIPT_DIR/assets/acme-favicon.png" "$PROJECT_ROOT/public/favicon.ico"
elif [ -f "$SCRIPT_DIR/assets/acme-favicon.ico" ]; then
    copy_file "$SCRIPT_DIR/assets/acme-favicon.ico" "$PROJECT_ROOT/public/favicon.ico"
else
    echo "  WARNING: No favicon found at assets/acme-favicon.{png,ico}"
fi
echo ""

# ── Step 4: OG / social-share image ───────────────────────────────────
echo "Step 4: OG image..."
if [ -f "$SCRIPT_DIR/assets/acme-og.png" ]; then
    copy_file "$SCRIPT_DIR/assets/acme-og.png" "$PROJECT_ROOT/public/acme-og.png"
else
    echo "  (none — skipping)"
fi
echo ""

# ── Step 5: Environment files ─────────────────────────────────────────
# When called as `./deploy.sh deploy` from the parent dispatcher,
# skip the interactive prompt — the real brand scripts handle env setup.
if [ "${1:-}" = "deploy" ]; then
    echo "Step 5: Environment files (auto mode)..."
    # Look for decrypted env files in priority order
    if [ -f "$SCRIPT_DIR/env/.env.docker" ]; then
        copy_file "$SCRIPT_DIR/env/.env.docker" "$PROJECT_ROOT/.env"
        echo "  Deployed .env from .env.docker"
    elif [ -f "$SCRIPT_DIR/env/.env.production" ]; then
        copy_file "$SCRIPT_DIR/env/.env.production" "$PROJECT_ROOT/.env"
        echo "  Deployed .env from .env.production"
    else
        echo "  No decrypted env file found — using examples as-is"
        echo "  Decrypt your env files first: gpg -d env/.env.docker.gpg > env/.env.docker"
    fi
else
    echo "Step 5: Environment files..."
    echo ""
    echo "Choose deployment target:"
    echo "  1) Docker Production  (from .env.docker / .env.docker.example)"
    echo "  2) Local Development  (from .env.local.example → .env.local)"
    echo "  3) Bare Server        (from .env.server.example → server/.env)"
    echo "  4) Skip"
    read -p "Enter choice [1-4]: " env_choice

    case $env_choice in
        1)
            if [ -f "$SCRIPT_DIR/env/.env.docker" ]; then
                copy_file "$SCRIPT_DIR/env/.env.docker" "$PROJECT_ROOT/.env"
                echo "  Deployed .env from .env.docker"
            elif [ -f "$SCRIPT_DIR/env/.env.docker.example" ]; then
                copy_file "$SCRIPT_DIR/env/.env.docker.example" "$PROJECT_ROOT/.env"
                echo "  Deployed .env from .env.docker.example (PLACEHOLDER VALUES — edit before use!)"
            fi
            ;;
        2)
            if [ -f "$SCRIPT_DIR/env/.env.local.example" ]; then
                copy_file "$SCRIPT_DIR/env/.env.local.example" "$PROJECT_ROOT/.env.local"
                echo "  Deployed .env.local (customize before use)"
            fi
            ;;
        3)
            if [ -f "$SCRIPT_DIR/env/.env.server.example" ]; then
                copy_file "$SCRIPT_DIR/env/.env.server.example" "$PROJECT_ROOT/server/.env"
                echo "  Deployed server/.env (customize before use)"
            fi
            ;;
        4|*)
            echo "  Skipping environment files"
            ;;
    esac
fi

echo ""
echo "=================================="
echo "Setup Complete!"
echo "=================================="
echo ""
echo "This is an EXAMPLE brand.  To use for a real deployment:"
echo "  1. Copy acme-brand/ to <client>-brand/"
echo "  2. Customize config, assets, and env files"
echo "  3. Replace all placeholder values with real credentials"
echo ""
echo "Next steps:"
echo "  1. Verify NEXT_PUBLIC_BRAND_CONFIG=acme in your .env"
echo "  2. Build:  npm run build          (or docker compose build)"
echo "  3. Start:  npm start              (or docker compose up -d)"
echo ""
