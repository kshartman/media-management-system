# Docker Deployment Guide

## Overview
This guide explains how to build and deploy the Media Management System using Docker containers behind an nginx proxy with HTTPS.

## Prerequisites
- Docker and Docker Compose installed on build machine
- External MongoDB instance
- Domain name (e.g., marketing.shopzive.com) with SSL certificates
- Persistent storage location for uploads

## Building Images

1. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Build Docker images:**
   ```bash
   ./build-docker.sh
   ```

   This creates:
   - `media-management-frontend:latest`
   - `media-management-backend:latest`

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DOMAIN` | Your domain name | marketing.shopzive.com |
| `NEXT_PUBLIC_API_URL` | Public API URL | https://marketing.shopzive.com/api |
| `MONGODB_URI` | MongoDB connection string | mongodb://user:pass@host:port/db |
| `JWT_SECRET` | Secret for JWT tokens | random-secret-string |
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 | your-key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | your-secret |
| `S3_BUCKET_NAME` | S3 bucket name | your-bucket |
| `HOST_UPLOAD_PATH` | Host path for uploads | /data/uploads |
| `SENDGRID_API_KEY` | SendGrid API key (optional) | your-sendgrid-key |
| `SENDGRID_FROM_EMAIL` | From email address (optional) | noreply@domain.com |
| `FRONTEND_URL` | Frontend URL for reset links (optional) | https://domain.com |

## Deployment Steps

### 1. Push to Container Registry
```bash
# Tag images
docker tag media-management-frontend:latest your-registry/media-frontend:v1.0
docker tag media-management-backend:latest your-registry/media-backend:v1.0

# Push to registry
docker push your-registry/media-frontend:v1.0
docker push your-registry/media-backend:v1.0
```

### 2. On Deployment Host

Create docker-compose.yml:
```yaml
version: '3.8'

services:
  frontend:
    image: your-registry/media-frontend:v1.0
    environment:
      - BACKEND_URL=http://backend:5001
    networks:
      - internal

  backend:
    image: your-registry/media-backend:v1.0
    environment:
      - PORT=5001
      - MONGODB_URI=${MONGODB_URI}
      - JWT_SECRET=${JWT_SECRET}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_REGION=us-east-1
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
      - SENDGRID_API_KEY=${SENDGRID_API_KEY}
      - SENDGRID_FROM_EMAIL=${SENDGRID_FROM_EMAIL}
      - FRONTEND_URL=${FRONTEND_URL}
    volumes:
      - /data/uploads:/uploads
    networks:
      - internal

networks:
  internal:
```

### 3. Configure nginx

Example nginx configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name marketing.shopzive.com;

    ssl_certificate /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;

    # Frontend
    location / {
        proxy_pass http://frontend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name marketing.shopzive.com;
    return 301 https://$server_name$request_uri;
}
```

### 4. Start Services
```bash
docker-compose up -d
```

## Volumes and Persistence

- **Uploads**: Mount host directory to `/uploads` in backend container
- Ensure proper permissions (user ID 1001)

## Security Notes

1. Never commit `.env` files
2. Use strong JWT_SECRET
3. Secure MongoDB with proper authentication
4. Configure S3 bucket policies correctly
5. Keep SSL certificates up to date

## Troubleshooting

- Check logs: `docker logs container-name`
- Verify environment variables: `docker exec container-name env`
- Test connectivity between containers
- Ensure MongoDB is accessible from containers