# Docker Deployment Guide

## Overview
This guide explains how to build and deploy the Media Management System using Docker containers behind an nginx proxy with HTTPS.

## Prerequisites
- Docker and Docker Compose installed on build machine
- External MongoDB instance
- Domain name (e.g., resources.shopzive.com) with SSL certificates
- Persistent storage location for uploads

## Building Images

1. **Configure environment variables:**
   ```bash
   cp .env.docker.example.whitelabel .env
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
| `DOMAIN` | Your domain name | resources.shopzive.com |
| `NEXT_PUBLIC_API_URL` | Public API URL | https://resources.shopzive.com/api |
| `MONGODB_URI` | MongoDB connection string | mongodb://user:pass@host:port/db |
| `JWT_SECRET` | Secret for JWT tokens | random-secret-string |
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 | your-key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | your-secret |
| `S3_BUCKET_NAME` | S3 bucket name | your-bucket |
| `HOST_UPLOAD_PATH` | Host path for uploads | /data/uploads |
| **Email Configuration** | (optional - choose one) | |
| `SENDGRID_API_KEY` | SendGrid API key | your-sendgrid-key |
| `SENDGRID_FROM_EMAIL` | SendGrid from email | noreply@domain.com |
| `MAILGUN_API_KEY` | Mailgun API key | your-mailgun-key |
| `MAILGUN_DOMAIN` | Mailgun domain | yourdomain.com |
| `MAILGUN_FROM_EMAIL` | Mailgun from email | noreply@domain.com |
| `MAIL_DRIVER` | Force specific driver | sendgrid or mailgun |
| `FRONTEND_URL` | Frontend URL for reset links (optional) | https://domain.com |
| `LOG_LEVEL` | Logging level (optional) | warn |
| `NODE_ENV` | Node.js environment (set automatically in Docker) | production |

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
      - NODE_ENV=production
      - BACKEND_URL=http://backend:5001
    networks:
      - internal

  backend:
    image: your-registry/media-backend:v1.0
    environment:
      - NODE_ENV=production
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
    server_name resources.shopzive.com;

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
    server_name resources.shopzive.com;
    return 301 https://$server_name$request_uri;
}
```

### 4. Start Services

For production deployment:
```bash
docker compose up -d
```

The `-d` flag runs containers in detached mode (background), which is essential for production deployments.

## Volumes and Persistence

- **Uploads**: Mount host directory to `/uploads` in backend container
- Ensure proper permissions (user ID 1001)

## Security Notes

1. Never commit `.env` files
2. Use strong JWT_SECRET
3. Secure MongoDB with proper authentication
4. Configure S3 bucket policies correctly
5. Keep SSL certificates up to date

## Container Management

### Starting and Stopping
```bash
# Start services (production)
docker compose up -d

# Stop services
docker compose down

# Restart services
docker compose restart

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Restart Policy
The containers are configured with `restart: unless-stopped` policy, which means:
- Containers will automatically restart if they crash
- Containers will restart when Docker daemon starts (after server reboot)
- Containers will NOT restart if manually stopped with `docker compose down`

## Troubleshooting

- Check logs: `docker compose logs container-name`
- Verify environment variables: `docker compose exec container-name env`
- Test connectivity between containers: `docker compose exec backend ping frontend`
- Ensure MongoDB is accessible from containers
- Check container status: `docker compose ps`