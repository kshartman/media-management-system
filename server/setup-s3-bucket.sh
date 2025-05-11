#!/bin/bash
# Script to set up an S3 bucket and IAM user for the Media Management System
# This script will:
# 1. Create an S3 bucket
# 2. Configure it for public access
# 3. Set up CORS configuration
# 4. Create an IAM user with appropriate permissions
# 5. Generate access keys for the IAM user
# 6. Output configuration for the .env file

# Exit on any error
set -e

# Configuration (edit these values)
BUCKET_NAME="media-management-system-files"
REGION="us-west-1"
IAM_USER_NAME="media-management-app"
FRONTEND_URL="http://localhost:3000"
PRODUCTION_URL="https://yourdomain.com" # Change this to your actual domain

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI is not installed. Please install it first:${NC}"
    echo "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws configure list | grep -q "access_key"; then
    echo -e "${RED}AWS CLI is not configured with credentials. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${BLUE}=== Setting up S3 bucket and IAM user for Media Management System ===${NC}"
echo -e "${YELLOW}Bucket Name:${NC} $BUCKET_NAME"
echo -e "${YELLOW}Region:${NC} $REGION"
echo -e "${YELLOW}IAM User:${NC} $IAM_USER_NAME"
echo ""
echo -e "${YELLOW}This script will create resources in your AWS account. Continue? (y/n)${NC}"
read -r confirm
if [[ "$confirm" != "y" ]]; then
    echo "Aborted by user."
    exit 0
fi

echo -e "\n${BLUE}=== Step 1: Creating S3 bucket ===${NC}"
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo -e "${YELLOW}Bucket $BUCKET_NAME already exists.${NC}"
else
    echo "Creating bucket $BUCKET_NAME in region $REGION..."
    aws s3api create-bucket \
        --bucket "$BUCKET_NAME" \
        --region "$REGION" \
        --create-bucket-configuration LocationConstraint="$REGION"
    echo -e "${GREEN}Bucket created successfully.${NC}"
fi

echo -e "\n${BLUE}=== Step 2: Configuring bucket for public access ===${NC}"
echo "Updating public access settings..."
aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

echo "Creating bucket policy to allow public read access..."
POLICY='{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::'$BUCKET_NAME'/*"
        }
    ]
}'

aws s3api put-bucket-policy \
    --bucket "$BUCKET_NAME" \
    --policy "$POLICY"

echo -e "${GREEN}Public access configured.${NC}"

echo -e "\n${BLUE}=== Step 3: Setting up CORS configuration ===${NC}"
CORS_CONFIGURATION='{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
            "AllowedOrigins": ["'$FRONTEND_URL'", "'$PRODUCTION_URL'"],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3000
        }
    ]
}'

aws s3api put-bucket-cors \
    --bucket "$BUCKET_NAME" \
    --cors-configuration "$CORS_CONFIGURATION"

echo -e "${GREEN}CORS configuration set.${NC}"

echo -e "\n${BLUE}=== Step 4: Creating IAM user ===${NC}"
if aws iam get-user --user-name "$IAM_USER_NAME" 2>/dev/null; then
    echo -e "${YELLOW}User $IAM_USER_NAME already exists.${NC}"
else
    echo "Creating user $IAM_USER_NAME..."
    aws iam create-user --user-name "$IAM_USER_NAME"
    echo -e "${GREEN}User created successfully.${NC}"
fi

echo -e "\n${BLUE}=== Step 5: Creating IAM policy ===${NC}"
POLICY_NAME="$IAM_USER_NAME-s3-policy"
POLICY_DOCUMENT='{
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
                "arn:aws:s3:::'$BUCKET_NAME'",
                "arn:aws:s3:::'$BUCKET_NAME'/*"
            ]
        }
    ]
}'

# Check if policy exists
POLICY_ARN=""
if POLICY_DATA=$(aws iam list-policies --query "Policies[?PolicyName=='$POLICY_NAME']" 2>/dev/null); then
    if [[ $(echo "$POLICY_DATA" | jq length) -gt 0 ]]; then
        POLICY_ARN=$(echo "$POLICY_DATA" | jq -r '.[0].Arn')
        echo -e "${YELLOW}Policy $POLICY_NAME already exists.${NC}"
    fi
fi

if [[ -z "$POLICY_ARN" ]]; then
    echo "Creating policy $POLICY_NAME..."
    POLICY_RESULT=$(aws iam create-policy \
        --policy-name "$POLICY_NAME" \
        --policy-document "$POLICY_DOCUMENT")
    POLICY_ARN=$(echo "$POLICY_RESULT" | jq -r '.Policy.Arn')
    echo -e "${GREEN}Policy created successfully.${NC}"
fi

echo -e "\n${BLUE}=== Step 6: Attaching policy to user ===${NC}"
# Check if policy is already attached
ATTACHED_POLICIES=$(aws iam list-attached-user-policies --user-name "$IAM_USER_NAME" --query 'AttachedPolicies[].PolicyArn' --output text)
if [[ "$ATTACHED_POLICIES" == *"$POLICY_ARN"* ]]; then
    echo -e "${YELLOW}Policy is already attached to user $IAM_USER_NAME.${NC}"
else
    echo "Attaching policy to user..."
    aws iam attach-user-policy \
        --user-name "$IAM_USER_NAME" \
        --policy-arn "$POLICY_ARN"
    echo -e "${GREEN}Policy attached successfully.${NC}"
fi

echo -e "\n${BLUE}=== Step 7: Creating access keys ===${NC}"
echo -e "${YELLOW}Warning: This will create new access keys. If you already have keys, you might want to use those instead.${NC}"
echo -e "Do you want to create new access keys? (y/n)"
read -r create_keys
if [[ "$create_keys" == "y" ]]; then
    echo "Creating access keys for $IAM_USER_NAME..."
    KEYS_JSON=$(aws iam create-access-key --user-name "$IAM_USER_NAME")
    ACCESS_KEY=$(echo "$KEYS_JSON" | jq -r '.AccessKey.AccessKeyId')
    SECRET_KEY=$(echo "$KEYS_JSON" | jq -r '.AccessKey.SecretAccessKey')
    echo -e "${GREEN}Access keys created successfully.${NC}"
else
    echo "Skipping access key creation."
    ACCESS_KEY="YOUR_ACCESS_KEY_ID"
    SECRET_KEY="YOUR_SECRET_ACCESS_KEY"
fi

# Output information for .env file
echo -e "\n${BLUE}=== Configuration Complete ===${NC}"
echo -e "${GREEN}Here's the configuration for your .env file:${NC}"
echo ""
echo "# AWS S3 Configuration"
echo "AWS_ACCESS_KEY_ID=$ACCESS_KEY"
echo "AWS_SECRET_ACCESS_KEY=$SECRET_KEY"
echo "AWS_REGION=$REGION"
echo "S3_BUCKET=$BUCKET_NAME"
echo ""
echo "# Set this to true to use S3, false to use local storage"
echo "USE_S3_STORAGE=true"
echo ""
echo "# Bucket URL"
echo "S3_BUCKET_URL=https://$BUCKET_NAME.s3.$REGION.amazonaws.com"

echo -e "\n${YELLOW}Important:${NC}"
echo "1. Save these credentials securely in your .env file."
echo "2. Never commit the .env file to your repository."
echo "3. The bucket is configured for public read access (anyone can access the files by URL)."
echo ""
echo -e "${GREEN}Setup complete! Your S3 bucket is ready to use.${NC}"