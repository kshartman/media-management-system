# Media Management System - Docker Deployment Guide

## Overview

This guide explains how to build and deploy the Media Management System using Docker containers.

## Prerequisites

- Docker installed on build machine
- Access to a MongoDB instance (external)
- Domain name configured (e.g., resources.shopzive.com)
- SSL certificates for HTTPS
- Storage location for uploaded files

## Building the Containers

1. Clone the repository and navigate to the project directory
2. Copy and configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Build the Docker images:
   ```bash
   ./build-docker.sh
   ```

   This will create two images:
   - `media-management-backend:latest`
   - `media-management-frontend:latest`

## Environment Variables

Configure these in your `.env` file:

### Domain Configuration
- `DOMAIN`: Your domain name (default: resources.shopzive.com)
- `NEXT_PUBLIC_API_URL`: Full URL for API access (e.g., https://resources.shopzive.com/api)
- `NEXT_PUBLIC_DOMAIN`: Public domain for frontend

### Backend Configuration
- `BACKEND_URL`: Internal backend URL (default: http://backend:5001)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `AWS_ACCESS_KEY_ID`: AWS access key for S3
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: AWS region (default: us-east-1)
- `S3_BUCKET_NAME`: S3 bucket for file storage
- `UPLOAD_PATH`: Local path for file uploads (will be mounted as volume)
- **Email Configuration** (optional - choose SendGrid OR Mailgun):
  - SendGrid: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
  - Mailgun: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL`
  - Force driver: `MAIL_DRIVER=sendgrid` or `MAIL_DRIVER=mailgun`
- `FRONTEND_URL`: Frontend URL for password reset links (optional)
- `LOG_LEVEL`: Logging level - debug, info, warn, error (defaults to warn in production)

## Deployment Options

### Option 1: Using Docker Compose (recommended for production)

```bash
docker compose up -d
```

The `-d` flag runs containers in detached mode (background). The containers are configured with `restart: unless-stopped` policy for automatic recovery.

### Production Docker Options Explained

When running containers in production, these additional flags are recommended:

- `--restart unless-stopped`: Automatically restart containers if they crash or after server reboot
- `--memory="2g"`: Limit memory usage (backend needs more for file processing)
- `--log-driver="json-file"`: Use structured JSON logging
- `--log-opt max-size="10m"`: Rotate logs when they reach 10MB
- `--log-opt max-file="3"`: Keep only 3 rotated log files
- `-d`: Run in detached mode (background)

### Option 2: Manual Deployment with Nginx

1. **Run the backend container:**
   ```bash
   docker run -d \
     --name media-backend \
     --restart unless-stopped \
     -p 5001:5001 \
     -v /path/to/uploads:/uploads \
     --env-file .env \
     --memory="2g" \
     --log-driver="json-file" \
     --log-opt max-size="10m" \
     --log-opt max-file="3" \
     media-management-backend:latest
   ```

2. **Run the frontend container:**
   ```bash
   docker run -d \
     --name media-frontend \
     --restart unless-stopped \
     -p 5000:3000 \
     --env-file .env \
     --memory="512m" \
     --log-driver="json-file" \
     --log-opt max-size="10m" \
     --log-opt max-file="3" \
     media-management-frontend:latest
   ```

3. **Configure Nginx** for HTTPS proxy:
   ```nginx
   server {
       listen 443 ssl http2;
       server_name resources.shopzive.com;

       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       # Frontend
       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       # Backend API
       location /api/ {
           proxy_pass http://localhost:5001/api/;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

### Option 3: Container Registry Deployment

1. **Tag images for your registry:**
   ```bash
   docker tag media-management-backend:latest your-registry.com/media-backend:latest
   docker tag media-management-frontend:latest your-registry.com/media-frontend:latest
   ```

2. **Push to registry:**
   ```bash
   docker push your-registry.com/media-backend:latest
   docker push your-registry.com/media-frontend:latest
   ```

3. **Deploy on target host** using your orchestration platform (Kubernetes, Docker Swarm, etc.)

## Volume Mounts

The backend requires a persistent volume for file uploads:
- Mount host path to container path `/uploads`
- Ensure proper permissions for the container user

## Security Considerations

1. **Environment Variables**: Never commit `.env` files to version control
2. **SSL/TLS**: Always use HTTPS in production
3. **MongoDB**: Ensure MongoDB is properly secured and not publicly accessible
4. **S3 Bucket**: Configure proper IAM policies and bucket permissions
5. **JWT Secret**: Use a strong, random secret for JWT tokens

## Health Checks

- Frontend health: `http://frontend-host:5000`
- Backend health: `http://backend-host:5001/api/health` (if implemented)

## Troubleshooting

1. **Container won't start**: Check logs with `docker logs container-name`
2. **Upload issues**: Verify volume mount permissions
3. **API connection errors**: Ensure BACKEND_URL is correctly configured
4. **MongoDB connection**: Verify MONGODB_URI and network connectivity

## Updating

To update the application:
1. Pull latest code
2. Rebuild images with `./build-docker.sh`
3. Stop old containers
4. Start new containers with updated images