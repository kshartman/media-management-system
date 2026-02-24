# ACME Brand (Example)

The canonical reference brand for the Media Management System.  All values are
placeholders — copy this folder to `<client>-brand/` and customize for real
deployments.

## What's Inside

| Directory | Contents |
|-----------|----------|
| `assets/` | Logo, favicon, OG image (generated placeholders) |
| `aws/` | S3 IAM policy + CORS configuration |
| `config/` | Brand config with every field documented |
| `env/` | Environment templates for Docker, local dev, and bare-server |
| `nginx/` | Reverse-proxy config (Let's Encrypt + Cloudflare variants) |

## Quick Start

### Local development (fastest)

```bash
# From project root
acme-brand/deploy.sh          # Choose option 2 (Local Development)
npm run dev                    # Frontend → http://localhost:3000
cd server && npm run dev       # Backend  → http://localhost:3001
```

### Docker

```bash
acme-brand/deploy.sh          # Choose option 1 (Docker Production)
# Edit .env — replace placeholders with real values
docker compose build && docker compose up -d
```

### Via parent deploy script

```bash
./deploy.sh acme               # Calls acme-brand/deploy.sh deploy
docker compose build && docker compose up -d
```

## Creating Your Own Brand

```bash
cp -r acme-brand myclient-brand
cd myclient-brand
```

Then:

1. Rename `config/brand.config.acme.ts` → `brand.config.myclient.ts`
2. Edit company name, colors, domain, external links
3. Replace logo/favicon/OG images in `assets/`
4. Copy the env template you need, fill in real credentials
5. Update `deploy.sh` file references
6. (Optional) `git init` to make it a separate private repo

Set `NEXT_PUBLIC_BRAND_CONFIG=myclient` in your environment and build.

## Deployment Scenarios

See **[DEVELOPMENT_NOTES.md](DEVELOPMENT_NOTES.md)** for detailed instructions covering:

1. Local development (no Docker, local disk)
2. Docker on local / dev machine
3. Self-hosted VPS with Docker + nginx
4. AWS VPS with Docker + ECR
5. Bare Node.js + nginx (no Docker)

## Security

For real client brands:

- **Encrypt env files** with GPG: `gpg -c .env.production -o .env.production.gpg`
- **Host privately** — each brand folder should be its own private git repo
- **Never commit** unencrypted credentials
- **Generate strong JWT secrets**: `openssl rand -base64 48`

The `acme-brand/` folder is safe to commit because it contains only placeholders.

## Related Documentation

- [WHITE_LABEL_GUIDE.md](../WHITE_LABEL_GUIDE.md) — Brand theming & configuration
- [BRAND_OVERLAY_GUIDE.md](../BRAND_OVERLAY_GUIDE.md) — Private brand repo pattern
- [DOCKER_DEPLOYMENT.md](../DOCKER_DEPLOYMENT.md) — Docker deployment details
- [HOSTING_OPTIONS.md](../HOSTING_OPTIONS.md) — Hosting & deployment strategies
