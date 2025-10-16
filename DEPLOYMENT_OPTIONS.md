# Deployment Options Guide

> **📚 Related Documentation:**
> - **README.md**: Complete setup and configuration guide
> - **DOCKER_DEPLOYMENT.md**: Detailed Docker deployment with nginx
> - **WHITE_LABEL_GUIDE.md**: Brand customization for different clients

## Overview

The Media Management System is built with two separate applications:
- **Frontend**: Next.js 15 application
- **Backend**: Express.js API server

This architecture provides flexibility in deployment strategies. You can deploy them together (Docker Compose), separately (Vercel + PaaS), or refactor to a unified Next.js application.

## Architecture Considerations

### Current Architecture
```
┌─────────────────┐
│   Next.js App   │  Port 3000 (dev) / 5000 (Docker)
│   (Frontend)    │
└────────┬────────┘
         │ HTTP API calls
         ▼
┌─────────────────┐
│   Express API   │  Port 3001 (dev) / 5001 (Docker)
│   (Backend)     │
└────────┬────────┘
         │
         ▼
    ┌────────────┐
    │  MongoDB   │
    └────────────┘
```

### Database Requirement
- **MongoDB** is the only supported database
- No alternative databases (PostgreSQL, MySQL, DynamoDB) are currently supported
- Changing databases would require significant refactoring from Mongoose ODM

### Storage Options
- **AWS S3**: Production-ready cloud storage (configurable)
- **Local Filesystem**: Development or small deployments (configurable)
- Toggle via `USE_S3_STORAGE` environment variable

### Email Services
- **SendGrid**: Transactional email service (configurable)
- **Mailgun**: Alternative email service (configurable)
- Auto-detected based on available credentials

---

## Deployment Strategy Comparison

| Strategy | Complexity | Cost | Best For |
|----------|-----------|------|----------|
| **Docker Compose** | Medium | VPS cost | Full control, predictable costs |
| **Vercel + PaaS** | Low | Free tier available | Quick setup, auto-scaling |
| **VPS Manual Setup** | High | VPS cost | Maximum control, custom config |
| **Next.js API Routes** | High (refactor) | Lowest | Future unified architecture |

---

## Option 1: Docker Compose (Current)

**Recommended for:** Production deployments where you control the infrastructure

### Architecture
```
┌──────────────────────────────────────┐
│           nginx (HTTPS)              │
│  ┌────────────┐    ┌──────────────┐ │
│  │  Frontend  │    │   Backend    │ │
│  │  (Next.js) │───▶│  (Express)   │ │
│  │  Port 5000 │    │  Port 5001   │ │
│  └────────────┘    └──────────────┘ │
└──────────────────────────────────────┘
```

### Advantages
- Single-command deployment: `docker compose up -d`
- Consistent environment across dev and production
- Easy rollback and versioning
- Predictable resource usage and costs
- Complete control over configuration

### Requirements
- VPS or dedicated server with Docker installed
- External MongoDB database
- Domain name with SSL certificates
- Persistent storage for uploads (if not using S3)

### Setup
See [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) for complete instructions.

**Quick start:**
```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 2. Build and start
docker compose up --build -d

# 3. View logs
docker compose logs -f
```

---

## Option 2: Vercel + Backend PaaS

**Recommended for:** Quick deployments, auto-scaling, minimal DevOps

### Architecture
```
┌─────────────────┐       ┌──────────────────┐
│  Vercel         │       │  Railway/Render  │
│  (Frontend)     │──────▶│  (Backend)       │
│  Auto-scaling   │ HTTPS │  Express API     │
└─────────────────┘       └──────────────────┘
```

### Advantages
- **Zero config deployment** for frontend
- **Free tier available** on most platforms
- **Automatic HTTPS** and CDN
- **Auto-scaling** for traffic spikes
- **Git-based deployment** (push to deploy)
- **Built-in monitoring** and logs

### Requirements
- Vercel account (free tier available)
- Backend hosting (Railway, Render, Heroku, or Fly.io)
- MongoDB Atlas (or other hosted MongoDB)
- AWS S3 (recommended for file storage)

### Frontend: Vercel Deployment

**Step 1: Configure for Vercel**

Create `vercel.json` in project root:
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

**Step 2: Environment Variables**

Add these in Vercel dashboard:
```bash
# Backend API URL (update after deploying backend)
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api

# Brand configuration
NEXT_PUBLIC_BRAND_CONFIG=your-brand-name
NEXT_PUBLIC_DOMAIN=your-domain.com
```

**Step 3: Deploy to Vercel**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

Or connect your GitHub repository to Vercel for automatic deployments on push.

### Backend: Railway Deployment

**Step 1: Prepare Backend**

The backend is in the `server/` directory. Railway can deploy it directly.

**Step 2: Create `railway.json`**

Create `server/railway.json`:
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node index.js",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Step 3: Environment Variables**

Add in Railway dashboard:
```bash
# Server
NODE_ENV=production
PORT=5001

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/media-management
MONGODB_DB_NAME=media-management

# JWT
JWT_SECRET=your-super-secure-secret-min-32-chars
JWT_EXPIRES_IN=24h

# AWS S3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
S3_BUCKET=your-bucket
USE_S3_STORAGE=true

# CORS (include your Vercel domain)
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000

# Email (SendGrid OR Mailgun)
SENDGRID_API_KEY=your-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Frontend URL
FRONTEND_URL=https://your-frontend.vercel.app

# Logging
LOG_LEVEL=warn
```

**Step 4: Deploy to Railway**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
cd server
railway init

# Deploy
railway up
```

Or connect your GitHub repository to Railway for automatic deployments.

**Step 5: Update Vercel Environment**

After backend is deployed, update Vercel's `NEXT_PUBLIC_API_URL` with your Railway URL:
```bash
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
```

### Backend: Render Deployment

Similar to Railway, but with Render-specific configuration:

**Create `render.yaml`** in `server/`:
```yaml
services:
  - type: web
    name: media-backend
    runtime: node
    buildCommand: npm install
    startCommand: node index.js
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5001
```

Add environment variables in Render dashboard, then connect your repository.

### Backend: Fly.io Deployment

**Create `fly.toml`** in `server/`:
```toml
app = "media-management-backend"

[build]
  builder = "heroku/buildpacks:20"

[env]
  PORT = "5001"

[[services]]
  http_checks = []
  internal_port = 5001
  processes = ["app"]
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [[services.tcp_checks]]
    grace_period = "1s"
    interval = "15s"
    restart_limit = 0
    timeout = "2s"
```

Deploy:
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app
cd server
fly launch

# Set secrets
fly secrets set MONGODB_URI="your-connection-string"
fly secrets set JWT_SECRET="your-secret"
# ... set other secrets

# Deploy
fly deploy
```

### Cost Comparison (Backend Hosting)

| Platform | Free Tier | Paid Plans Start | Best For |
|----------|-----------|------------------|----------|
| **Railway** | $5 credit/month | $5/month | Easy setup, great DX |
| **Render** | 750 hours/month | $7/month | Simple pricing |
| **Heroku** | None | $5/month | Established platform |
| **Fly.io** | 3 VMs free | $1.94/month | Global edge deployment |

---

## Option 3: Traditional VPS (Manual Setup)

**Recommended for:** Maximum control, custom configurations

### Architecture
```
┌────────────────────────────────────┐
│         VPS (Ubuntu/Debian)        │
│  ┌─────────┐    ┌─────────────┐   │
│  │ nginx   │───▶│  PM2        │   │
│  │ (HTTPS) │    │  ├─Frontend │   │
│  │         │    │  └─Backend  │   │
│  └─────────┘    └─────────────┘   │
└────────────────────────────────────┘
```

### Requirements
- VPS with Ubuntu/Debian (DigitalOcean, Linode, AWS EC2)
- Node.js 18+ installed
- nginx for reverse proxy
- PM2 for process management
- MongoDB (local or hosted)

### Setup Steps

**1. Install Dependencies**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install nginx
sudo apt install -y nginx

# Install certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

**2. Clone and Setup Application**
```bash
# Clone repository
git clone https://your-repo.git /opt/media-management
cd /opt/media-management

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install

# Create environment file
cp .env.example .env
nano .env  # Edit with your configuration

# Build frontend
cd ..
npm run build
```

**3. Configure PM2**

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'media-frontend',
      cwd: '/opt/media-management',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        BACKEND_URL: 'http://localhost:5001'
      }
    },
    {
      name: 'media-backend',
      cwd: '/opt/media-management/server',
      script: 'index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      }
    }
  ]
};
```

Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

**4. Configure nginx**

Create `/etc/nginx/sites-available/media-management`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
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

Enable site and get SSL:
```bash
sudo ln -s /etc/nginx/sites-available/media-management /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d your-domain.com
```

---

## Option 4: Unified Next.js Architecture (Future)

**Status:** Requires refactoring (not currently implemented)

### Concept
Move all Express routes to Next.js API routes, eliminating the separate backend server.

### Benefits
- Single application to deploy
- Deploy entirely on Vercel (serverless)
- Simpler architecture
- Reduced operational complexity

### Challenges
- Requires significant refactoring of backend code
- Need to adapt Express middleware to Next.js patterns
- File upload handling differs in serverless environment
- MongoDB connection management in serverless context

### Architecture (After Refactoring)
```
┌──────────────────────────────────┐
│        Next.js Application       │
│  ┌────────────┐  ┌────────────┐  │
│  │   Pages    │  │ API Routes │  │
│  │ (Frontend) │  │ (Backend)  │  │
│  └────────────┘  └────────────┘  │
└──────────────────────────────────┘
```

### Example Refactor

**Current:** `server/routes/cards.js`
```javascript
router.get('/api/cards', async (req, res) => {
  const cards = await Card.find();
  res.json(cards);
});
```

**Future:** `src/app/api/cards/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Card } from '@/models/Card';

export async function GET(request: NextRequest) {
  await connectToDatabase();
  const cards = await Card.find();
  return NextResponse.json(cards);
}
```

This refactor would take significant development time but could simplify deployment.

---

## Database Options

### MongoDB (Only Supported Option)

The system is currently built exclusively for MongoDB:
- Uses Mongoose ODM throughout
- Schema validation via Mongoose
- No abstraction layer for other databases

**Hosted MongoDB Options:**
- **MongoDB Atlas**: Free tier available, recommended for production
- **DigitalOcean MongoDB**: Managed MongoDB service
- **AWS DocumentDB**: MongoDB-compatible (may have compatibility issues)

**Self-Hosted:**
- Docker container
- VPS installation
- Not recommended for production without expertise

### Why No Other Databases?

The codebase uses Mongoose-specific features:
- Schema definitions
- Virtual properties
- Middleware hooks
- Query builders

Supporting other databases would require:
1. Creating a database abstraction layer
2. Rewriting all models
3. Testing across multiple databases
4. Maintaining compatibility

This is a significant undertaking not currently planned.

---

## Storage Options

### AWS S3 (Recommended for Production)

**Advantages:**
- Unlimited scalability
- High availability and durability
- CDN integration with CloudFront
- Pay-per-use pricing

**Configuration:**
```bash
USE_S3_STORAGE=true
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
S3_BUCKET=your-bucket
```

**Alternatives:**
- **Cloudflare R2**: S3-compatible, cheaper egress
- **DigitalOcean Spaces**: S3-compatible, simple pricing
- **Backblaze B2**: Very cheap storage

### Local Filesystem (Development Only)

**Use only for:**
- Local development
- Small deployments with single server
- Testing and prototyping

**Not recommended for:**
- Production with multiple servers
- High-traffic applications
- Distributed deployments

**Configuration:**
```bash
USE_S3_STORAGE=false
HOST_UPLOAD_PATH=/path/to/uploads
```

---

## Email Services

### SendGrid

**Best for:** Reliable delivery, detailed analytics

```bash
SENDGRID_API_KEY=your-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

Free tier: 100 emails/day

### Mailgun

**Best for:** Developer-friendly, flexible pricing

```bash
MAILGUN_API_KEY=your-key
MAILGUN_DOMAIN=yourdomain.com
MAILGUN_FROM_EMAIL=noreply@yourdomain.com
```

Free tier: 5,000 emails/month for 3 months

### Alternative Services

You can extend the mail abstraction to support:
- AWS SES (very cheap, requires verification)
- Postmark (transactional focus)
- Resend (modern, developer-friendly)

See `server/utils/mail.js` for the abstraction layer.

---

## Recommendation Matrix

| Use Case | Recommended Strategy | Why |
|----------|---------------------|-----|
| **Quick prototype** | Vercel + Railway | Fast setup, free tier |
| **Small business** | Docker on VPS | Predictable costs |
| **Agency (multiple clients)** | Docker with brand overlay | Easy per-client deployment |
| **High traffic** | Vercel + Railway | Auto-scaling |
| **Maximum control** | VPS manual setup | Full customization |
| **Budget-conscious** | VPS with PM2 | Lowest ongoing cost |

---

## Migration Between Strategies

### From Local Dev to Docker
```bash
# 1. Create .env file
cp .env.example .env

# 2. Build and run
docker compose up --build -d
```

### From Docker to Vercel + Railway
```bash
# 1. Deploy backend to Railway
cd server
railway init
railway up

# 2. Deploy frontend to Vercel
cd ..
vercel --prod

# 3. Update NEXT_PUBLIC_API_URL in Vercel
```

### From Vercel to Docker
```bash
# 1. Create docker-compose.yml (see DOCKER_DEPLOYMENT.md)
# 2. Configure environment variables
# 3. Deploy
docker compose up --build -d
```

---

## Troubleshooting

### CORS Issues (Separate Frontend/Backend)
Ensure `ALLOWED_ORIGINS` includes your frontend URL:
```bash
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000
```

### File Uploads Failing
- Ensure S3 credentials are correct
- Check S3 bucket permissions
- Verify CORS configuration on S3 bucket

### Connection Timeout Between Services
- Check that backend URL is correct in frontend config
- Ensure backend health check passes: `curl https://your-backend/health`
- Verify CORS and firewall rules

### Environment Variables Not Working
- Next.js requires `NEXT_PUBLIC_` prefix for client-side variables
- Restart services after changing environment variables
- Check build logs for missing variables

---

## Security Checklist

Regardless of deployment strategy:

- [ ] Use strong JWT_SECRET (32+ characters)
- [ ] Enable HTTPS in production
- [ ] Set secure CORS origins
- [ ] Use MongoDB authentication
- [ ] Secure S3 bucket permissions
- [ ] Enable rate limiting
- [ ] Use environment variables for secrets
- [ ] Enable security headers in nginx/Vercel
- [ ] Regular dependency updates
- [ ] Monitor error logs

---

## Next Steps

1. **Choose your deployment strategy** based on the recommendations above
2. **Configure environment variables** for your chosen platform
3. **Set up MongoDB** (Atlas recommended for beginners)
4. **Configure S3 storage** (recommended for production)
5. **Deploy backend** first, get the API URL
6. **Deploy frontend** with backend API URL configured
7. **Test the deployment** with health checks
8. **Set up monitoring** (logs, error tracking)

For detailed setup instructions, see:
- **Docker**: [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)
- **Configuration**: [README.md](./README.md)
- **Branding**: [WHITE_LABEL_GUIDE.md](./WHITE_LABEL_GUIDE.md)
