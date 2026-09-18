@echo off
title Build PleryGun3D Windows App
where node >nul 2>nul || (echo Node.js is required. Install it from https://nodejs.org/ & pause & exit /b 1)
call npm install
call npm run build:windows
pause