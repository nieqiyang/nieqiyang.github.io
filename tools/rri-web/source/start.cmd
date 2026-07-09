@echo off
rem RRI Toolbox launcher — starts the dev server and opens the browser
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
start "" http://localhost:5180/
npm run dev
