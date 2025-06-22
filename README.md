# Media Management System

A comprehensive system for browsing, categorizing, and managing digital media assets like images, social posts, and video reels with advanced cloud storage and reliability features.

## 🚀 Key Features

- **Responsive Design**: Works seamlessly on mobile, tablet, and desktop devices
- **Media Cards**: Three card types (Image, Social Post, Reel) with rich metadata
- **Advanced Search**: Filter by type, tags, and search by description with smart caching
- **Infinite Scroll**: Smooth content loading as you browse
- **Role-Based Access**: Anonymous browsing, editor privileges, and admin controls
- **Admin Features**: Upload, edit, and delete media assets with real-time validation
- **Soft Delete System**: Safe deletion with trash management and restore functionality
- **Cloud Storage**: AWS S3 integration with local fallback support
- **User Management**: Complete admin interface for user administration
- **Email Integration**: Password reset functionality via SendGrid or Mailgun

## 🏗️ Architecture Improvements (Phase 2)

### Reliability & Performance
- **Centralized Error Handling**: Structured error responses with correlation ID tracking
- **Database Resilience**: Connection pooling (10 max connections) with exponential backoff retry
- **Request Correlation**: UUID-based request tracing for debugging
- **API Client Enhancement**: Automatic retry logic, request deduplication, and intelligent caching
- **Environment Validation**: Comprehensive startup validation of all configuration

### Monitoring & Debugging
- **Health Monitoring**: Enhanced health checks with dependency status
- **Client Error Logging**: Automatic React error boundary reporting to server
- **Structured Logging**: Winston-based logging with correlation IDs and component isolation
- **Real-time Metrics**: Database connection pool monitoring and system resource tracking

## System Architecture

This application consists of two main parts:
- **Frontend**: A Next.js application that provides the user interface
- **Backend**: An Express.js server that manages the API, database operations, and file storage

### Storage Architecture

The system supports two storage options:

1. **Local File Storage**: Files are stored in the server's `/uploads` directory
2. **Amazon S3 Cloud Storage**: Files are stored in an S3 bucket in a dedicated folder

The storage system is abstracted through utility functions that handle file operations (upload, download, delete) in a storage-agnostic way, making it easy to switch between storage options via configuration.

## Getting Started

> **📚 Documentation Guide:**
> - **README.md** (this file): Complete setup and feature guide
> - **DOCKER_DEPLOYMENT.md**: Production deployment with Docker and nginx
> - **WHITE_LABEL_GUIDE.md**: Brand customization for different clients
> - **CLAUDE.md**: Development workflow and architecture reference

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- MongoDB database
- AWS account with S3 access (for cloud storage)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd media-management-system
   ```

2. Install dependencies for both frontend and backend:
   ```bash
   # Install frontend dependencies
   npm install

   # Install backend dependencies
   cd server
   npm install
   ```

### Configuration

#### Environment Setup

> **💡 For white-label/client-specific deployments, see [WHITE_LABEL_GUIDE.md](./WHITE_LABEL_GUIDE.md)**  
> **🐳 For production Docker deployment, see [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)**

Create a complete `.env` file in the `/server` directory with all necessary configuration:

```
# MongoDB Configuration
MONGODB_URI=mongodb://username:password@hostname:port/?ssl=true&retryWrites=false&loadBalanced=false&connectTimeoutMS=10000&authSource=dbname&authMechanism=SCRAM-SHA-256
MONGODB_DB_NAME=media-management  # Database name (fallback if not specified in URI)

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Authentication
JWT_SECRET=your-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
S3_BUCKET=your-bucket-name
S3_CUSTOM_DOMAIN=cdn.example.com  # Optional: Set if you're using a CDN

# Storage Configuration
USE_S3_STORAGE=true  # Set to true for S3, false for local storage

# Email Configuration (for password reset emails)
# You can use either SendGrid OR Mailgun

# SendGrid Configuration
SENDGRID_API_KEY=your-sendgrid-api-key-here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Mailgun Configuration (Alternative to SendGrid)
# MAILGUN_API_KEY=your-mailgun-api-key-here
# MAILGUN_DOMAIN=yourdomain.com
# MAILGUN_FROM_EMAIL=noreply@yourdomain.com

# Optional: Force a specific mail driver (sendgrid or mailgun)
# MAIL_DRIVER=sendgrid

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:3000

# Logging Configuration
LOG_LEVEL=debug  # debug, info, warn, error (defaults: debug in dev, warn in production)

# Development Features
SHOW_DOWNLOAD_COUNT=true  # Show download count overlay on cards (development only)
```

Replace all placeholders with your actual values. The S3 configuration is only required if you're using S3 storage (`USE_S3_STORAGE=true`).

### Starting the Application

1. Start the backend server:
   ```bash
   cd server
   npm run dev
   ```

2. In a separate terminal, start the frontend:
   ```bash
   npm run dev
   ```

3. Access the application at `http://localhost:3000`

## AWS S3 Setup

### IAM Policy for S3 Access

Create an IAM policy with the following JSON to restrict access to just your S3 bucket:

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
"arn:aws:s3:::your-bucket-name",
"arn:aws:s3:::your-bucket-name/dams/*"
]
}
]
}
```

Replace `your-bucket-name` with your actual bucket name.

### CORS Configuration (Required for Downloads)

Configure CORS on your S3 bucket to enable browser downloads from the lightbox feature:

1. Go to AWS Console → S3 → your bucket
2. **Permissions** tab → **Cross-origin resource sharing (CORS)**
3. Edit and paste this configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": [
      "Content-Length",
      "Content-Type",
      "Content-Disposition",
      "ETag",
      "Last-Modified"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**Note**: This CORS configuration is required for the lightbox download feature to work properly. Without it, downloads will open images in the browser instead of downloading them.

### Bucket Policy

Ensure your bucket has this public read policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### IAM User Setup

1. Create an IAM user in AWS with programmatic access
2. Attach the policy you created above to this user
3. Get the Access Key ID and Secret Access Key
4. Add these credentials to your `.env` file

For detailed instructions, see the [S3 IAM Setup Guide](./server/s3-iam-setup-guide.md).

## Email Setup (Optional)

The password reset feature requires either SendGrid or Mailgun for sending emails. The system automatically detects which service is configured.

### SendGrid Setup

1. **Create a SendGrid account** at [sendgrid.com](https://sendgrid.com)
2. **Generate an API key**:
   - Go to Settings > API Keys in SendGrid dashboard
   - Create a new API key with "Mail Send" permissions
   - Copy the API key (you won't see it again)
3. **Configure environment variables**:
   ```bash
   SENDGRID_API_KEY=your-sendgrid-api-key-here
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   FRONTEND_URL=https://yourdomain.com
   ```
4. **Verify sender identity** in SendGrid (required for production)

### Mailgun Setup

1. **Create a Mailgun account** at [mailgun.com](https://mailgun.com)
2. **Get your API credentials**:
   - Go to Dashboard > API Security
   - Copy your Private API key
   - Note your sending domain
3. **Configure environment variables**:
   ```bash
   MAILGUN_API_KEY=your-mailgun-api-key-here
   MAILGUN_DOMAIN=yourdomain.com
   MAILGUN_FROM_EMAIL=noreply@yourdomain.com
   FRONTEND_URL=https://yourdomain.com
   ```
4. **Verify your domain** in Mailgun (required for production)

### Choosing a Mail Driver

- If both services are configured, SendGrid is used by default
- To force a specific driver, set: `MAIL_DRIVER=sendgrid` or `MAIL_DRIVER=mailgun`
- If neither service is configured, password reset features will be disabled

**Note**: The system provides detailed status information about mail configuration in the health check endpoint at `/api/health`.

## Logging

The application uses Winston for structured logging with the following features:

- **Development**: Colorized console output with debug level logging
- **Production**: JSON format logging with warn level by default
- **Component-based**: Different parts of the application use child loggers (database, s3, auth, api, file)
- **Configurable**: Set `LOG_LEVEL` environment variable to control verbosity

**Log Levels** (in order of verbosity):
- `debug`: Detailed diagnostic information (default in development)
- `info`: General informational messages
- `warn`: Potentially harmful situations (default in production)  
- `error`: Error events that might still allow the application to continue

**Example development output:**
```
2024-01-15 10:30:45 [info]: Server started on port 3001 {"component":"api"}
2024-01-15 10:30:46 [debug]: Connected to MongoDB {"component":"database"}
2024-01-15 10:30:47 [error]: Failed to upload file {"component":"s3","error":"Access denied"}
```

### S3 Integration Details

The S3 integration includes the following features:

1. **S3 Folder Structure**:
   - All files are stored in a `dams/` folder in the S3 bucket
   - Each file gets a unique timestamped name to prevent conflicts

2. **URL Generation**:
   - System automatically generates appropriate URLs for S3 objects
   - Supports using a custom domain (CDN) by setting `S3_CUSTOM_DOMAIN` environment variable
   - Default format: `https://<bucket>.s3.<region>.amazonaws.com/dams/<filename>`

3. **Pre-signed URLs**:
   - System can generate temporary signed URLs for private content
   - Configurable expiration time (default: 1 hour)

4. **Seamless Switching**:
   - Switch between S3 and local storage by changing the `USE_S3_STORAGE` setting
   - No code changes required when switching storage backends

## Migrating Files to S3

To migrate existing files from local storage to S3:

1. Ensure S3 is properly configured in your `.env` file
2. Run the migration script:
   ```bash
   cd server
   node migrate-files-to-s3.js
   ```

The migration script:
1. Scans your local `uploads` directory for all media files
2. Uploads each file to the `dams/` folder in your S3 bucket
3. Updates database records to point to the new S3 locations
4. Preserves file metadata (content type, original name)
5. Creates a mapping between local files and S3 keys
6. Handles all three media card types (image, social, reel)

### Migration Options

By default, the script runs in "dry run" mode to show what would happen without making actual changes. To perform the actual migration:

1. Open `server/migrate-files-to-s3.js`
2. Find the `DRY_RUN` variable near the top of the file
3. Change it from `true` to `false`
4. Save and run the script again

### Migration Safety

The migration script is designed to be:
- **Non-destructive**: Local files remain untouched
- **Idempotent**: Safe to run multiple times without duplicating content
- **Resumable**: If interrupted, you can pick up where you left off
- **Error-tolerant**: Continues processing even if individual file uploads fail

## Detailed Feature Reference

### Media Card Types

The system supports three types of media cards:

1. **Image Cards**:
   - Preview image for display in the grid
   - Downloadable high-resolution version
   - Tags for categorization
   - Description field for searchable content

2. **Social Cards**:
   - Preview image showing the social post design
   - Downloadable document (PDF) with copy and specifications
   - Tags for categorization by platform or campaign
   - Description field for searchable content

3. **Reel Cards**:
   - Preview thumbnail image
   - Embedded video player (mp4 format)
   - Optional transcript file
   - Tags for categorization
   - Description field for searchable content

### User Management

The system includes user management features:

- User roles (admin, editor)
- Secure authentication with JWT
- Password hashing with scrypt
- Admin panel for user management

The default admin credentials are:
- Username: `admin`
- Email: `owner@shopzive.com`
- Password: `HealthyGuts4Me!`

Change these credentials after the first login.

### File Storage Options

The system supports two storage options with a unified API for file operations:

1. **Local Storage**:
   - Files are stored in the server's `/uploads` directory
   - Uses the Node.js `fs` module for file operations
   - URLs are relative paths like `/uploads/filename.jpg`
   - Suitable for development and small deployments

2. **S3 Storage**:
   - Files are stored in an Amazon S3 bucket in the `dams/` folder
   - Uses AWS SDK v3 for S3 operations
   - Uses `multer-s3` for direct-to-S3 uploads
   - URLs are S3 URLs or custom domain URLs if configured
   - Supports pre-signed URLs for private content
   - Recommended for production and larger deployments

#### Implementation Details

The storage abstraction is implemented in `server/utils/s3Storage.js` and provides:

- **getStorage()**: Returns the appropriate multer storage engine
- **getFileUrl()**: Converts local paths or S3 keys to appropriate URLs
- **deleteFile()**: Handles file deletion from either storage system
- **getSignedFileUrl()**: Generates temporary authenticated S3 URLs

#### Configuration

To switch between storage options:

1. Open your `.env` file
2. Set `USE_S3_STORAGE=true` for S3 storage or `USE_S3_STORAGE=false` for local storage
3. Restart the server

No code changes are required when switching between storage options.

## API Endpoints

### Health Monitoring

- `GET /health` - Simple liveness check
- `GET /api/health` - Comprehensive health check with dependency status
- `GET /api/health/ready` - Kubernetes-style readiness probe

### Authentication

- `POST /api/auth/login` - Login with username and password
- `POST /api/auth/forgot-password` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token

The system uses JWT tokens for authentication:
1. Admin users log in via the login form
2. JWT tokens are stored as httpOnly cookies for security
3. Protected routes/operations check for valid token
4. The frontend maintains auth state in the AuthContext

### Cards

- `GET /api/cards` - Get all cards with optional filtering (includes `includeDeleted` parameter for admin/editor)
- `GET /api/cards/:id` - Get a single card by ID
- `POST /api/cards` - Create a new card (admin/editor only)
- `PUT /api/cards/:id` - Update a card (admin/editor only)
- `DELETE /api/cards/:id` - Soft delete a card (admin/editor only)
- `POST /api/track-download` - Track download count for analytics

### Trash Management

- `POST /api/cards/trash/:id/restore` - Restore a deleted card (admin/editor only)
- `DELETE /api/cards/trash/:id/permanent` - Permanently delete a card (admin/editor only)

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

### Correlation ID Tracking

All API responses include the `X-Correlation-ID` header for request tracing and debugging. This UUID is automatically generated for each request and logged throughout the system for end-to-end request tracking.

## Development

### Project Structure

```
/media-management-system/
├── /src/                  # Frontend Next.js application
│   ├── /app/              # Next.js app router components
│   │   ├── layout.tsx     # Main layout component
│   │   └── page.tsx       # Home page component
│   ├── /components/       # React components
│   │   ├── /admin/        # Admin interface components
│   │   ├── /auth/         # Authentication components
│   │   ├── /cards/        # Card components
│   │   ├── /filters/      # Filtering components
│   │   └── /layout/       # Layout components
│   ├── /lib/              # Utilities and API functions
│   ├── /styles/           # CSS styles
│   └── /types/            # TypeScript type definitions
│
├── /server/               # Express.js backend
│   ├── index.js           # Main server entry point
│   ├── /db/               # Database connection
│   ├── /models/           # Mongoose models
│   ├── /uploads/          # Local file storage
│   ├── /utils/            # Utility functions
│   │   └── s3Storage.js   # S3 storage abstraction
│   └── migrate-files-to-s3.js  # Migration script
│
└── /public/               # Static assets
```

### Storage Architecture

The storage system in this application follows these design principles:

1. **Abstraction**: The storage mechanism is abstracted behind a unified API to allow for different storage backends.
2. **Configurability**: Switching between storage options requires only configuration changes, not code changes.
3. **Separation of Concerns**: File storage logic is separated from business logic.

The storage system follows this flow:
```
Client Request → Express → Multer Middleware → Storage Engine (Local/S3) → Database Update
```

### Adding New Features

To add a new feature:

1. Understand which part of the system is affected (frontend or backend)
2. For frontend changes:
   - Find the relevant components in `/src/components`
   - Update types in `/src/types` if needed
   - Use TypeScript for type safety
3. For backend changes:
   - Modify the Express routes in `server/index.js`
   - Test API endpoints with the frontend

### Adding New Media Types

To add a new media card type:

1. Add type definition in `/src/types/index.ts`:
   ```typescript
   // Example for adding a new "Document" card type
   export interface DocumentCard extends BaseCard {
     type: 'document';
     preview: string;
     documentFile: string;
     pageCount: number;
   }
   ```

2. Create a new card component in `/src/components/cards/`:
   ```typescript
   // DocumentCard.tsx
   import BaseCard from './BaseCard';
   // ...
   ```

3. Update `CardFactory` to handle the new type:
   ```typescript
   // In CardFactory.tsx
   import DocumentCard from './DocumentCard';
   // ...
   case 'document':
     return <DocumentCard {...props} />;
   ```

4. Update `CardForm` in `/src/components/admin/CardForm.tsx` for admin uploading
5. Modify server-side handlers in `server/index.js` to handle the new type

#### Complete Workflow for New Media Types

For a complete implementation of a new media type:

1. Add type definition in `/src/types/index.ts`
2. Create a new card component in `/src/components/cards/`
3. Update `CardFactory` to handle the new type
4. Update `CardForm` for admin uploading
5. Modify server-side handlers to:
   - Validate the new media type's required fields
   - Handle file uploads for the new type
   - Process metadata extraction
   - Save to the database with proper validation

## Troubleshooting & FAQs

### Connection Issues

**Q: MongoDB connection fails with authentication errors**
A: Verify your MongoDB connection string in the `.env` file. Ensure the username, password, and authSource are correct. If using Atlas, check that your IP is whitelisted. The system now includes automatic retry logic with exponential backoff for connection issues.

**Q: MongoDB "bufferMaxEntries is not a supported option" error**
A: This error has been fixed in Phase 2. The deprecated bufferMaxEntries option has been removed from the connection configuration. Update to the latest version.

**Q: S3 uploads fail with "Access Denied"**
A: Check your AWS credentials and IAM permissions. Ensure your IAM user has the correct permissions for the S3 bucket and that the bucket name is correct in your `.env` file.

### Storage Issues

**Q: Files upload locally but not to S3**
A: Verify that `USE_S3_STORAGE=true` is set in your `.env` file and that all AWS configuration variables are correct. Also check that the S3 bucket exists and is accessible.

**Q: After migration, some files show broken images**
A: Run the migration script again with `DRY_RUN = false`. Check that the database records have been updated correctly with the new S3 URLs.

**Q: How can I verify if I'm using S3 storage?**
A: Check the server logs during startup. You should see a message like "Using S3 storage: bucket yourBucketName/dams in region your-region". You can also check the `/api/health` endpoint which includes storage configuration status.

### Security Considerations

#### Initial System Setup

**First-time deployment requires secure setup:**

1. **Strong JWT Secret Required**: Set a secure JWT_SECRET (min 32 characters):
   ```bash
   # Generate a secure JWT secret
   echo "JWT_SECRET=$(openssl rand -base64 48)" >> server/.env
   ```

2. **Create First Admin User**: No default admin user exists. Use the setup endpoint:
   ```bash
   curl -X POST http://localhost:5001/api/auth/setup \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","email":"admin@example.com","password":"SecurePassword123!"}'
   ```

3. **Password Requirements**: Passwords must be at least 12 characters with uppercase, lowercase, numbers, and special characters.

4. **Rate Limiting**: Auth endpoints are rate-limited (5 attempts per 15 minutes) to prevent brute force attacks.

**Q: How can I secure access to my media files?**
A: For basic security, ensure your S3 bucket has the correct CORS and bucket policies. For more advanced security, you can:
- Use pre-signed URLs with short expiration times
- Set up CloudFront with signed URLs
- Implement JWT verification for file downloads

**Q: How do I change the admin password?**
A: Admin credentials are no longer hardcoded as of Phase 1 security improvements. Use the admin interface to manage users, or use the "Forgot Password" feature on the login page (requires email configuration).

### Performance Optimization

**Q: File uploads are slow**
A: If using S3, consider:
- Using a region closer to your users
- Setting up a CDN like CloudFront
- Implementing multipart uploads for large files

**Q: The application loads slowly**
A: The system now includes performance optimizations:
- Database connection pooling (10 max connections)
- API request deduplication and caching
- Automatic retry logic for failed requests
- Enhanced error handling to prevent cascading failures

### Debugging and Monitoring

**Q: How do I track down issues with my deployment?**
A: Use the correlation ID system:
1. Check the `X-Correlation-ID` header in failed requests
2. Search server logs for that correlation ID to trace the full request lifecycle
3. Use the `/api/health` endpoint to check system status
4. Monitor database connection pool metrics in health checks

**Q: Client-side errors aren't being logged**
A: The system automatically logs React errors to the server via the `/api/client-error` endpoint. Check your server logs for client-side error reports with correlation IDs.

**Q: How do I enable debug logging?**
A: Set `LOG_LEVEL=debug` in your `.env` file. In development, this is the default. In production, use `LOG_LEVEL=info` or `LOG_LEVEL=warn` for less verbose output.

## Future Enhancements

The Media Management System can be further improved with the following features:

### Short-term Enhancements
- **CloudFront Integration**: Add CDN support for faster content delivery
- **Image Optimization**: Implement automatic resizing and optimization of uploaded images
- **Bulk Operations**: Add support for batch uploading and editing of media cards
- **Advanced Filtering**: Enhance search with date ranges, file sizes, and metadata

### Long-term Roadmap
- **Multi-tenant Support**: Allow multiple organizations to use the system with isolated data
- **AI Features**: Implement auto-tagging, content recognition, and transcript generation
- **Analytics Dashboard**: Add usage statistics and popular content metrics
- **Workflow Automation**: Create approval processes and publishing schedules

Contributions to these features are welcome. Please follow the development guidelines outlined in this document.
