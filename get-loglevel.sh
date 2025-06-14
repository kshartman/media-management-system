#!/bin/bash

# Script to get current log level from resources.shopzive.com
# Usage: ./get-loglevel.sh

# API endpoint
API_URL="https://resources.shopzive.com/api/debug/loglevel"

echo "Getting current log level..."

# Make the API call
response=$(curl -s "$API_URL")

# Check if curl succeeded
if [ $? -ne 0 ]; then
  echo "Error: Failed to connect to API endpoint"
  exit 1
fi

# Parse the response
if echo "$response" | grep -q '"success":true'; then
  current_level=$(echo "$response" | jq -r '.logLevel' 2>/dev/null)
  valid_levels=$(echo "$response" | jq -r '.validLevels | join(", ")' 2>/dev/null)
  
  echo "📊 Current log level: $current_level"
  echo "🔧 Valid levels: $valid_levels"
else
  echo "❌ Failed to get log level"
  echo "$response"
  exit 1
fi