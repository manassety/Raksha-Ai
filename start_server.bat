@echo off
cd server
echo Starting RakshaAi Streaming Server...
node index.js > server_log.txt 2>&1
