@echo off
cd /d "%~dp0"
title League Letter Game Feed Collector
 echo Starting League Letter Game Feed...
echo.
echo The collector will ask whether this is a PUBLIC or TEST run.
echo Keep this window open during games. Press Ctrl+C to stop.
echo.
npm run game-feed
echo.
echo The collector has stopped.
pause
