#!/bin/bash

# Script to get current log level from the backend debug API
# Usage: ./get-loglevel.sh [url]
# Examples:
#   ./get-loglevel.sh                              # uses $DOMAIN or localhost
#   ./get-loglevel.sh https://media.example.com    # explicit URL

# Determine base URL
if [ -n "$1" ]; then
  BASE_URL="$1"
elif [ -n "$DOMAIN" ]; then
  BASE_URL="https://$DOMAIN"
else
  BASE_URL="http://localhost:5001"
fi

API_URL="$BASE_URL/api/debug/loglevel"

echo "Getting current log level from $API_URL ..."

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

  echo "Current log level: $current_level"
  echo "Valid levels: $valid_levels"
else
  echo "Failed to get log level"
  echo "$response"
  exit 1
fi
