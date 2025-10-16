# Media Management System - Server

This is the backend server for the Media Management System, providing API endpoints for managing media files, user authentication, and user management.

## Features

### Core Functionality
- RESTful API for CRUD operations on media cards
- User authentication with JWT tokens
- User management (admin-only)
- File uploads to local storage or Amazon S3
- Tag management and filtering
- Media metadata extraction
- Password reset via email (SendGrid or Mailgun)
- MongoDB database for data persistence
- Soft delete system with trash management

### Phase 2 Architecture Improvements
- Centralized error handling with structured responses
- Database connection pooling with exponential backoff retry
- UUID-based correlation ID tracking for debugging
- Structured Winston logging with component isolation
- Enhanced health monitoring with dependency checks
- Environment validation on startup

## Installation

1. Clone the repository
2. Navigate to the server directory
3. Install dependencies:
   ```bash
   npm install
   ```
4. Configure environment variables (see Configuration section)
5. Start the server:
   ```bash
   npm run dev
   ```

## Configuration

The server requires several environment variables to run properly. Create a `.env` file in the server directory with the following variables:

```env
# Server Configuration (3001 for local development, 5001 for production)
PORT=3001
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://username:password@hostname:port/database
MONGODB_DB_NAME=media-management

# JWT Authentication
JWT_SECRET=your-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# AWS S3 Configuration (required if USE_S3_STORAGE=true)
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-west-1
S3_BUCKET=your-bucket-name
USE_S3_STORAGE=true  # Set to true to enable S3 storage, false for local storage

# Optionally specify a custom domain for your S3 bucket (if using CloudFront or similar)
# S3_CUSTOM_DOMAIN=cdn.yourdomain.com

# Email Configuration (optional - choose SendGrid OR Mailgun)
# SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Mailgun (alternative to SendGrid)
# MAILGUN_API_KEY=your-mailgun-api-key
# MAILGUN_DOMAIN=yourdomain.com
# MAILGUN_FROM_EMAIL=noreply@yourdomain.com

# Force specific mail driver (optional)
# MAIL_DRIVER=sendgrid

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:3000

# Logging Configuration
LOG_LEVEL=debug  # debug, info, warn, error

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002
```

## Setting Up Amazon S3 for File Storage

### Prerequisites

1. An AWS account
2. Basic knowledge of AWS services
3. AWS CLI (optional, for easier setup)

### S3 Bucket Setup

1. **Create an S3 bucket**:
   - Sign in to the AWS Management Console
   - Navigate to the S3 service
   - Click "Create bucket"
   - Choose a unique bucket name (this will be your `S3_BUCKET` value)
   - Select the AWS Region (this will be your `AWS_REGION` value)
   - Configure bucket settings:
     - Block all public access: Unchecked (we'll set permissions via policies)
     - Bucket versioning: Optional
     - Default encryption: Recommended
   - Click "Create bucket"

2. **Set up CORS configuration**:
   - Select your newly created bucket
   - Navigate to the "Permissions" tab
   - Scroll down to "Cross-origin resource sharing (CORS)"
   - Click "Edit" and add a configuration like:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
       "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```
   - Adjust the `AllowedOrigins` to match your frontend application URLs

3. **Create a bucket policy (optional)**:
   - In the same "Permissions" tab, click "Bucket policy"
   - Add a policy to allow access to your files:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
       }
     ]
   }
   ```
   - Replace `YOUR-BUCKET-NAME` with your actual bucket name
   - This policy allows public read access to your files
   - If your application requires more restricted access, adjust the policy accordingly or consider using pre-signed URLs

### IAM User Configuration

1. **Create an IAM user for your application**:
   - Navigate to the IAM service
   - Click "Users" and then "Add user"
   - Choose a username (e.g., `media-management-app`)
   - Select "Programmatic access" for Access type
   - Attach existing policies or create a new policy with the following permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::YOUR-BUCKET-NAME",
           "arn:aws:s3:::YOUR-BUCKET-NAME/*"
         ]
       }
     ]
   }
   ```
   - Replace `YOUR-BUCKET-NAME` with your actual bucket name
   - Complete the user creation
   - Save the Access Key ID and Secret Access Key (these will be your `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` values)

### CloudFront Setup (Optional)

If you want to use CloudFront to serve your S3 files:

1. Create a CloudFront distribution:
   - Navigate to the CloudFront service
   - Click "Create Distribution"
   - For "Origin Domain", select your S3 bucket
   - Configure the distribution settings according to your needs
   - Set "Default root object" if needed
   - Click "Create Distribution"

2. After creation, set your CloudFront domain name as the `S3_CUSTOM_DOMAIN` value in your `.env` file.

## API Endpoints

### Health & Monitoring

- `GET /health` - Simple liveness check
- `GET /api/health` - Comprehensive health check with dependency status
- `GET /api/health/ready` - Kubernetes-style readiness probe

### Authentication

- `POST /api/auth/setup` - Create first admin user (only works on fresh database)
- `POST /api/auth/login` - Login with username or email (case-insensitive)
- `POST /api/auth/forgot-password` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token

### Cards

- `GET /api/cards` - Get all cards with optional filtering (supports `includeDeleted` for admin/editor)
- `GET /api/cards/:id` - Get a single card by ID
- `POST /api/cards` - Create a new card (editor/admin only)
- `PUT /api/cards/:id` - Update a card (editor/admin only)
- `DELETE /api/cards/:id` - Soft delete a card (editor/admin only)
- `POST /api/track-download` - Track download count for analytics

### Trash Management

- `POST /api/cards/trash/:id/restore` - Restore a deleted card (editor/admin only)
- `DELETE /api/cards/trash/:id/permanent` - Permanently delete a card (admin only)

### Tags

- `GET /api/tags` - Get all available tags

### Users (Admin Only)

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get a single user by ID
- `POST /api/users` - Create a new user
- `PUT /api/users/:id` - Update a user
- `DELETE /api/users/:id` - Delete a user

### Error Logging

- `POST /api/client-error` - Log client-side React errors for debugging

## Initial System Setup

**No default admin user exists.** On first deployment, create an admin user using the setup endpoint:

```bash
curl -X POST http://localhost:3001/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "username":"admin",
    "email":"admin@example.com",
    "password":"YourSecurePassword123!"
  }'
```

**Password Requirements:**
- Minimum 12 characters
- Must include uppercase, lowercase, numbers, and special characters
- Common passwords are rejected

**JWT Secret Requirement:**
- Set a strong JWT_SECRET (minimum 32 characters)
- Generate with: `openssl rand -base64 48`

**Security Features:**
- Rate limiting on authentication endpoints (5 attempts per 15 minutes)
- JWT tokens stored in httpOnly cookies
- Password hashing with scrypt
- Correlation ID tracking for all requests