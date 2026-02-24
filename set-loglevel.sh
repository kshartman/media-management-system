#!/bin/bash

# Script to set log level via the backend debug API
# Usage: ./set-loglevel.sh [level] [url]
# Examples:
#   ./set-loglevel.sh debug                              # uses $DOMAIN or localhost
#   ./set-loglevel.sh warn https://media.example.com     # explicit URL
#   ./set-loglevel.sh                                    # defaults to 'warn'

# Set default log level to 'warn' if no argument provided
LOG_LEVEL=${1:-warn}

# Determine base URL
if [ -n "$2" ]; then
  BASE_URL="$2"
elif [ -n "$DOMAIN" ]; then
  BASE_URL="https://$DOMAIN"
else
  BASE_URL="http://localhost:5001"
fi

API_URL="$BASE_URL/api/debug/loglevel"

echo "Setting log level to: $LOG_LEVEL ($API_URL)"

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
  echo "Success!"
  echo "$response" | jq -r '.message // "Log level changed successfully"' 2>/dev/null || echo "Log level changed successfully"
else
  echo "Failed!"
  echo "$response" | jq -r '.error // "Unknown error"' 2>/dev/null || echo "$response"
  exit 1
fi
