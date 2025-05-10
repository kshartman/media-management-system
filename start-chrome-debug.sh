#!/bin/bash

# This script starts Chrome in remote debugging mode for the VSCode debugger to attach to

echo "Starting Chrome with remote debugging enabled..."

# Ensure the debug profile directory exists
mkdir -p .vscode/chrome-debug-profile

# Platform-specific Chrome launcher
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --remote-debugging-port=9222 \
    --user-data-dir=.vscode/chrome-debug-profile \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    http://localhost:3000
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    google-chrome \
    --remote-debugging-port=9222 \
    --user-data-dir=.vscode/chrome-debug-profile \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    http://localhost:3000
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    start chrome \
    --remote-debugging-port=9222 \
    --user-data-dir=.vscode/chrome-debug-profile \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    http://localhost:3000
else
    echo "Unsupported operating system. Please start Chrome manually with these flags:"
    echo "--remote-debugging-port=9222 --user-data-dir=.vscode/chrome-debug-profile"
fi

echo "Once Chrome is running, you can use the 'Next.js: attach to Chrome' debug configuration in VSCode"