@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title DND Spellbook
if not exist node_modules (
  echo Run npm install in the project folder first.
  pause
  exit /b 1
)
if not exist storage\spell-catalog.sqlite (
  call npm run spellbook:init
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Open http://127.0.0.1:5181/spellbook.html
echo Close this window or press Ctrl+C to stop the spellbook.
call npm run dev:spellbook
pause
