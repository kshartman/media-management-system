#!/bin/bash

# Script to set log level on resources.shopzive.com
# Usage: ./set-loglevel.sh [level]
# If no level is provided, defaults to 'warn'

# Set default log level to 'warn' if no argument provided
LOG_LEVEL=${1:-warn}

# API endpoint
API_URL="https://resources.shopzive.com/api/debug/loglevel"

echo "Setting log level to: $LOG_LEVEL"

# Make the API call
response=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"logLevel\": \"$LOG_LEVEL\"}")

# Check if curl succeeded
if [ $? -ne 0 ]; then
  echo "Error: Failed to connect to API endpoint"
  exit 1
fi

# Parse the response to check for success
if echo "$response" | grep -q '"success":true'; then
  echo "✅ Success!"
  echo "$response" | jq -r '.message // "Log level changed successfully"' 2>/dev/null || echo "Log level changed successfully"
else
  echo "❌ Failed!"
  echo "$response" | jq -r '.error // "Unknown error"' 2>/dev/null || echo "$response"
  exit 1
fi