#!/bin/sh
# Wrapper script for Chromium to handle permission issues in Docker
exec /usr/bin/chromium --no-sandbox "$@"