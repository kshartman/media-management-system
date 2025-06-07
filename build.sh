#!/bin/bash

# Build script for Media Management System Docker images

set -e

echo "Building Media Management System Docker images..."
echo "=============================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Warning: .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "Please edit .env with your configuration values before deployment!"
    echo ""
fi

# Load environment variables for build args
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Build images using docker-compose
echo "Building Docker images..."
docker-compose build

echo ""
echo "Build complete! Images created:"
echo "  - media-management-frontend:latest"
echo "  - media-management-backend:latest"
echo ""
echo "To push to a registry:"
echo "  docker tag media-management-frontend:latest your-registry/media-frontend:tag"
echo "  docker tag media-management-backend:latest your-registry/media-backend:tag"
echo "  docker push your-registry/media-frontend:tag"
echo "  docker push your-registry/media-backend:tag"
echo ""
echo "Note: Configure nginx on your deployment host for HTTPS with domain: ${DOMAIN:-marketing.shopzive.com}"