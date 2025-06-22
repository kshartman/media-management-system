# Phase 1 Security Fixes - Testing Guide

## 🔥 Critical Security Improvements Implemented

### 1. JWT Secret Validation
- **Change**: Server now requires a strong JWT_SECRET (min 32 chars, no common values)
- **Test**: Start server without JWT_SECRET - should fail with security error
- **Test**: Start server with weak secret (e.g., "secret") - should fail

### 2. Removed Hardcoded Admin User
- **Change**: No automatic admin user creation on startup
- **Test**: Fresh database should show setup instructions in logs
- **Test**: Setup endpoint `/api/auth/setup` only available when no users exist

### 3. Secure Setup Flow
- **Endpoint**: `POST /api/auth/setup`
- **Test Cases**:
  - Try setup when users exist → Should return 403
  - Try setup with weak password → Should return validation errors
  - Try setup with strong password → Should create admin user and login
  - Try setup again after user exists → Should fail

### 4. Password Strength Requirements
- **Requirements**: 
  - Minimum 12 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
  - Cannot be common passwords
- **Test**: Try weak passwords in setup and password reset

### 5. Rate Limiting
- **Auth endpoints**: 5 attempts per 15 minutes
- **Sensitive operations**: 3 attempts per hour
- **Test**: Make multiple rapid login attempts → Should get 429 responses

### 6. Enhanced File Upload Security
- **MIME type validation**: Strict mapping of extensions to MIME types
- **Suspicious file detection**: Blocks .exe, .php, .js and other dangerous files
- **Size limits**: Per-file-type size restrictions
- **Test**: Try uploading suspicious files or files with mismatched extensions

### 7. HttpOnly Cookies for Authentication
- **Change**: JWT tokens now stored in secure httpOnly cookies
- **Test**: Check that tokens are not accessible via JavaScript
- **Test**: Cookies should have proper flags (httpOnly, secure in prod, sameSite)

### 8. Secure Password Reset
- **Change**: Uses cryptographically secure token generation
- **Token length**: 256-bit entropy (32 bytes → base64url)
- **Test**: Password reset tokens should be unpredictable

## 🧪 Testing Instructions

### Local Development Testing

1. **Environment Setup**:
   ```bash
   # Ensure you have a strong JWT secret
   echo "JWT_SECRET=$(openssl rand -base64 48)" >> server/.env
   ```

2. **Start the application**:
   ```bash
   # Terminal 1: Frontend
   npm run dev
   
   # Terminal 2: Backend  
   cd server
   npm run dev
   ```

3. **Test Fresh Database Setup**:
   - Clear your database or use a fresh one
   - Check server logs for setup instructions
   - Navigate to the application
   - Should not be able to login (no users exist)

4. **Test Setup Endpoint**:
   ```bash
   # Test setup with weak password (should fail)
   curl -X POST http://localhost:5001/api/auth/setup \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","email":"admin@test.com","password":"weak"}'
   
   # Test setup with strong password (should succeed)
   curl -X POST http://localhost:5001/api/auth/setup \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","email":"admin@test.com","password":"MySecurePassword123!"}'
   ```

5. **Test Rate Limiting**:
   ```bash
   # Make multiple rapid login attempts
   for i in {1..10}; do
     curl -X POST http://localhost:5001/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"username":"admin","password":"wrong"}' \
       -v
   done
   ```

6. **Test File Upload Security**:
   - Try uploading a file with .exe extension
   - Try uploading a file where MIME type doesn't match extension
   - Verify that only allowed file types are accepted

7. **Test Cookie Authentication**:
   - Login successfully
   - Check browser developer tools → Application → Cookies
   - Should see `auth_token` cookie with httpOnly flag
   - Try accessing `document.cookie` in browser console → token should not be visible

### Production-like Testing

1. **Set NODE_ENV=production** in server environment
2. **Verify HTTPS-only cookies** (secure flag should be true)
3. **Test CORS configuration** with actual domain names
4. **Verify rate limiting** persists across server restarts

## ✅ Expected Results

After successful implementation:

1. **Server Startup**: 
   - ✅ Fails with weak/missing JWT_SECRET
   - ✅ Shows setup instructions when no users exist
   - ✅ No hardcoded admin user created

2. **Authentication**:
   - ✅ Setup endpoint works only once
   - ✅ Strong password requirements enforced
   - ✅ Rate limiting prevents brute force
   - ✅ Cookies used instead of localStorage

3. **File Uploads**:
   - ✅ Strict MIME type validation
   - ✅ Suspicious files blocked
   - ✅ Proper error messages for invalid files

4. **Security Headers**:
   - ✅ Rate limit headers in responses
   - ✅ Secure cookie attributes
   - ✅ CORS properly configured

## 🚨 Breaking Changes

**Important**: This phase introduces breaking changes:

1. **JWT_SECRET is now required** - Server will not start without it
2. **No automatic admin user** - Must use setup endpoint for first user
3. **Frontend auth changes** - Cookies replace localStorage (automatic)
4. **Stronger password requirements** - Existing weak passwords may need updates

## 🔧 Rollback Plan

If issues occur:
1. Switch back to `master` branch
2. Use previous JWT_SECRET fallback behavior
3. Restore hardcoded admin user temporarily
4. Revert to localStorage authentication

## 📝 Notes for Next Phase

Phase 2 will focus on:
- Architecture improvements
- Centralized error handling
- Enhanced logging
- Database connection pooling
- Request retry logic