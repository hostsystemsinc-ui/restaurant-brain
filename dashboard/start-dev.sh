#!/bin/bash
export PATH="/usr/local/bin:$PATH"
cd /Users/aaronjacobs/restaurant-brain/dashboard
exec /usr/local/bin/node node_modules/.bin/next dev --port 3000
