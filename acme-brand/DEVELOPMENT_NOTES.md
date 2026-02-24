# ACME Brand — Development & Deployment Notes

> **This is the EXAMPLE brand.**  All values are placeholders.
> Copy `acme-brand/` to `<client>-brand/`, customize everything, then follow
> the deployment scenario that matches your infrastructure.

---

## Quick Reference

| Item | Value |
|------|-------|
| Brand config key | `acme` |
| Domain | `media.acmecorp.example.com` |
| S3 bucket | `acme-media-bucket` |
| Config file | `acme-brand/config/brand.config.acme.ts` |
| Deploy script | `./deploy.sh acme` (or `acme-brand/deploy.sh`) |

---

## Deployment Scenarios

### 1. Local Development (no Docker, local disk)

Best for day-to-day development work.

**Env file:** `acme-brand/env/.env.local.example` → `.env.local`

**Storage:** Local disk (`USE_S3_STORAGE=false` or omitted).
Files are stored in `server/uploads/`.

**Commands:**
```bash
# One-time setup
acme-brand/deploy.sh        # Choose option 2 (Local Development)
# — or from project root —
# cp acme-brand/env/.env.local.example .env.local
# Edit .env.local with your values

# Run (two terminals)
npm run dev                  # Frontend → http://localhost:3000
cd server && npm run dev     # Backend  → http://localhost:3001
```

**First run:** Visit `http://localhost:3000`.  The backend logs will show setup
instructions.  Hit `/api/auth/setup` to create the initial admin user.

---

### 2. Docker on Local / Dev Machine

Good for testing the production Docker build locally.

**Env file:** `acme-brand/env/.env.docker.example` → `.env`
(Docker Compose reads `.env` from project root.)

**Storage:** S3 or local disk — set `USE_S3_STORAGE` in `.env`.

**Commands:**
```bash
# One-time setup
acme-brand/deploy.sh        # Choose option 1 (Docker Production)
# Edit .env — replace ALL placeholder values

# Build and run
docker compose build
docker compose up -d

# Frontend: http://localhost:5000
# Backend:  http://localhost:5001
# Health:   curl http://localhost:5001/api/health
```

**Rebuild after config changes:**
```bash
acme-brand/deploy.sh        # Re-copy brand config
docker compose build         # Rebuild images
docker compose up -d         # Restart
```

---

### 3. Self-Hosted VPS with Docker

A typical production setup: VPS + Docker + nginx reverse proxy.

**Env file:** `acme-brand/env/.env.docker.example` → `.env`

**Storage:** S3 recommended for production.

**Setup:**
```bash
# On the VPS
git clone <repo-url> ~/media-management-system
cd ~/media-management-system

# Clone or copy the brand folder
git clone <brand-repo-url> acme-brand

# Deploy brand
acme-brand/deploy.sh deploy     # Non-interactive (called by ./deploy.sh acme)
# Edit .env with real credentials

# Build and start
docker compose build
docker compose up -d
```

**nginx:** Copy `acme-brand/nginx/acme.conf` to `/etc/nginx/sites-available/`
and symlink to `sites-enabled/`.  Use Option A (Let's Encrypt) or Option B
(Cloudflare Origin Certificate) depending on your DNS setup.

```bash
sudo cp acme-brand/nginx/acme.conf /etc/nginx/sites-available/acme.conf
sudo ln -sf /etc/nginx/sites-available/acme.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**SSL with Let's Encrypt:**
```bash
sudo certbot --nginx -d media.acmecorp.example.com
```

---

### 4. AWS VPS with Docker + ECR

For teams using AWS ECR to store Docker images and pull them to a VPS.

**Env file:** `acme-brand/env/.env.docker.example` → `.env`

**Storage:** S3 (use the IAM policy in `acme-brand/aws/acme-s3-policy.json`).

**S3 CORS:** Apply `acme-brand/aws/acme-s3-cors.json` to your bucket for video streaming:
```bash
aws s3api put-bucket-cors \
  --bucket acme-media-bucket \
  --cors-configuration file://acme-brand/aws/acme-s3-cors.json
```

**ECR workflow:**
```bash
# On build machine — build and push
export AWS_PROFILE=acme   # or configure credentials
ACCOUNT_ID=123456789012
REGION=us-east-1
ECR_BASE="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/acme"

acme-brand/deploy.sh deploy
docker compose build
docker tag media-management-frontend:latest "$ECR_BASE/frontend:latest"
docker tag media-management-backend:latest  "$ECR_BASE/backend:latest"
docker push "$ECR_BASE/frontend:latest"
docker push "$ECR_BASE/backend:latest"

# On VPS — pull and run
export AWS_PROFILE=acme
docker pull "$ECR_BASE/frontend:latest"
docker pull "$ECR_BASE/backend:latest"
docker compose up -d
```

---

### 5. Non-Docker Server (Bare Node.js + nginx)

For deployments without Docker — Node.js processes managed by systemd or pm2.

**Env files:**
- Frontend: `.env` (project root)
- Backend: `acme-brand/env/.env.server.example` → `server/.env`

**Storage:** S3 or local disk (set `UPLOAD_PATH` in `server/.env` for local).

**Commands:**
```bash
# Setup
acme-brand/deploy.sh        # Choose option 3 (Bare Server)
# Edit server/.env with real credentials

# Also create a frontend .env:
# cp acme-brand/env/.env.docker.example .env
# Edit .env — set BACKEND_URL=http://localhost:5001

# Build & run
npm install
npm run build
npm start &                  # Frontend on port 3000

cd server
npm install
npm start &                  # Backend on port 5001
```

**nginx:** Same as scenario 3 — use `acme-brand/nginx/acme.conf`, but point
`proxy_pass` to `127.0.0.1:3000` (frontend) and `127.0.0.1:5001` (backend)
instead of Docker-mapped ports.

**Process management with pm2:**
```bash
pm2 start npm --name "acme-frontend" -- start
pm2 start server/index.js --name "acme-backend"
pm2 save
pm2 startup
```

---

## Monitoring & Health Checks

### Health endpoint
```bash
curl http://localhost:5001/api/health
# Returns: database status, connection pool metrics, storage & mail status
```

### Docker container health
```bash
docker compose ps              # Shows health status
docker inspect --format='{{.State.Health.Status}}' media-frontend
docker inspect --format='{{.State.Health.Status}}' media-backend
```

### Logs
```bash
# Docker
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs --since 1h

# Non-Docker
tail -f server/backend.log     # If LOG_LEVEL includes file output
journalctl -u acme-backend -f  # If using systemd
pm2 logs acme-backend          # If using pm2
```

### Correlation IDs
Every API response includes an `X-Correlation-ID` header.  Use it to trace
requests through server logs:
```bash
docker compose logs backend | grep "abc123-correlation-id"
```

---

## File Structure

```
acme-brand/
├── assets/
│   ├── acme-logo.png            # Brand logo (200x40, copied to public/)
│   ├── acme-favicon.png         # Favicon (32x32, copied to public/favicon.ico)
│   ├── acme-og.png              # Social share image (1200x630)
│   └── PLACE_LOGO_HERE.txt      # Instructions for adding your own logo
├── aws/
│   ├── acme-s3-policy.json      # IAM policy for S3 bucket access
│   └── acme-s3-cors.json        # CORS config for video streaming
├── config/
│   └── brand.config.acme.ts     # Brand configuration (all fields documented)
├── env/
│   ├── .env.docker.example      # Docker Compose environment template
│   ├── .env.local.example       # Local development environment template
│   ├── .env.server.example      # Bare-server backend environment template
│   └── .env.production.example  # Legacy production template
├── nginx/
│   └── acme.conf                # nginx reverse-proxy config (SSL + Cloudflare)
├── deploy.sh                    # Brand setup script
├── DEVELOPMENT_NOTES.md         # This file
└── README.md                    # Quick-start guide
```
