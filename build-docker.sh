#!/bin/bash

# Build script for media management system Docker containers

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Media Management System Docker Containers${NC}"
echo "=================================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found.${NC}"
    echo -e "${RED}Please create a .env file with your configuration before deploying!${NC}"
fi

# Build backend image
echo -e "\n${GREEN}Building backend image...${NC}"
docker build -f Dockerfile.backend -t media-management-backend:latest .

# Build frontend image
echo -e "\n${GREEN}Building frontend image...${NC}"
docker build -f Dockerfile.frontend -t media-management-frontend:latest .

echo -e "\n${GREEN}Build complete!${NC}"
echo -e "${GREEN}Images created:${NC}"
echo "  - media-management-backend:latest"
echo "  - media-management-frontend:latest"

echo -e "\n${YELLOW}To run locally with docker-compose:${NC}"
echo "  docker-compose up"

echo -e "\n${YELLOW}To push to a registry:${NC}"
echo "  docker tag media-management-backend:latest your-registry/media-management-backend:latest"
echo "  docker tag media-management-frontend:latest your-registry/media-management-frontend:latest"
echo "  docker push your-registry/media-management-backend:latest"
echo "  docker push your-registry/media-management-frontend:latest"

echo -e "\n${YELLOW}For deployment, ensure you:${NC}"
echo "  1. Set up nginx with HTTPS certificates for domain: ${DOMAIN:-resources.shopzive.com}"
echo "  2. Configure environment variables in your deployment environment"
echo "  3. Mount a persistent volume for uploads at the path specified in UPLOAD_PATH"
echo "  4. Ensure MongoDB is accessible from your deployment environment"