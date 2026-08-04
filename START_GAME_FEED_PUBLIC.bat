@echo off
cd /d "%~dp0"
title League Letter Game Feed - PUBLIC
 echo Starting PUBLIC Game Feed collector...
echo Keep this window open during games. Press Ctrl+C to stop.
echo.
npm run game-feed:public
echo.
echo The collector has stopped.
pause
