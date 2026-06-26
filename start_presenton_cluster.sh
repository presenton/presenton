

#!/usr/bin/env bash
set -euo pipefail

# PRESENTON_ROOT="$HOME/Elagente/presenton"
# NVM_DIR="$HOME/Elagente/nvm"

# cd "$PRESENTON_ROOT"

# echo "== Loading/installing Node 20 =="

# if [ -s "$NVM_DIR/nvm.sh" ]; then
#     source "$NVM_DIR/nvm.sh"
# elif [ -s "$HOME/.nvm/nvm.sh" ]; then
#     export NVM_DIR="$HOME/.nvm"
#     source "$NVM_DIR/nvm.sh"
# else
#     echo "ERROR: NVM is not installed."
#     exit 1
# fi

# nvm install 20
# nvm use 20

# echo "Node: $(command -v node)"
# echo "npm:  $(command -v npm)"

# echo "== Installing Presenton root dependencies =="

# npm install --include=optional --no-fund --no-audit

# echo "== Installing Next.js dependencies =="

# npm --prefix servers/nextjs install \
#     --include=optional \
#     --no-fund \
#     --no-audit

# echo "== Installing presentation export runtime =="

# npm run sync:presentation-export:force
# npm run check:presentation-export

# chmod +x presentation-export/py/convert-linux-x64

# echo "== Installing export runtime Node dependencies =="

# cd presentation-export

# if [ ! -f package.json ]; then
#     npm init -y
# fi

# npm install \
#     "sharp@^0.34.5" \
#     "puppeteer" \
#     --include=optional \
#     --omit=dev \
#     --no-fund \
#     --no-audit \
#     --no-package-lock

# echo "== Installing Puppeteer Chrome =="

# npx puppeteer browsers install chrome

# echo "== Finding Chrome =="

# CHROME="$(find "$HOME/.cache/puppeteer/chrome" \
#     -type f -path '*/chrome-linux64/chrome' \
#     -print 2>/dev/null | sort -V | tail -1)"

# if [ -z "$CHROME" ]; then
#     echo "ERROR: Puppeteer Chrome was not found."
#     exit 1
# fi

# chmod +x "$CHROME"

# echo "Chrome: $CHROME"

# echo "== Checking native Linux libraries =="

# MISSING_LIBRARIES="$(ldd "$CHROME" | grep 'not found' || true)"

# if [ -n "$MISSING_LIBRARIES" ]; then
#     echo "ERROR: Chrome requires missing cluster system libraries:"
#     echo "$MISSING_LIBRARIES"
#     echo
#     echo "These libraries cannot be installed through npm."
#     exit 1
# fi

# echo "== Testing Chrome =="

# mkdir -p "$PRESENTON_ROOT/tmp/chromium-config"
# mkdir -p "$PRESENTON_ROOT/tmp/chromium-cache"
# mkdir -p "$PRESENTON_ROOT/tmp/chromium-profile"

# XDG_CONFIG_HOME="$PRESENTON_ROOT/tmp/chromium-config" \
# XDG_CACHE_HOME="$PRESENTON_ROOT/tmp/chromium-cache" \
# "$CHROME" \
#     --headless \
#     --no-sandbox \
#     --disable-setuid-sandbox \
#     --disable-dev-shm-usage \
#     --disable-gpu \
#     --user-data-dir="$PRESENTON_ROOT/tmp/chromium-profile" \
#     --dump-dom about:blank >/dev/null

# echo
# echo "Installation and Chrome smoke test completed successfully."
# echo "PUPPETEER_EXECUTABLE_PATH=$CHROME"



source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate presenton311

python /h/327/chlyahad/Elagente/presenton/start_presenton_cluster.py