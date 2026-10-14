#!/bin/bash

set -e

echo "Installing Google Antigravity CLI..."

curl -fsSL https://antigravity.google/cli/install.sh | bash -s -- --dir /usr/local/bin

echo "Google Antigravity CLI installed:"
agy --version