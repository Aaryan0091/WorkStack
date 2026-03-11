#!/bin/bash

# WorkStack Extension Loader
# This script helps load the unpacked extension in Chrome
# Usage: bash public/extension/load-extension.sh

echo "🚀 WorkStack Extension Loader"
echo ""
echo "Opening chrome://extensions/..."
echo "If this doesn't open automatically, type chrome://extensions/ in your address bar"
echo ""

# macOS
open "chrome://extensions/"

# Linux (you can uncomment if needed)
# xdg-open "chrome://extensions/" 2>/dev/null || google-chrome "chrome://extensions/"

echo ""
echo "After chrome://extensions/ opens:"
echo "1. Find 'Load unpacked' button (top left, puzzle icon)"
echo "2. Select the workstack-extension folder (containing manifest.json)"
echo "3. Visit your deployed WorkStack site"
echo "4. Click 'Start Tracking' to verify extension is detected"
echo ""
echo "If the extension isn't detected, click the 'Reload' button on the extension card."
