@echo off
cd /d "%~dp0"
title League Letter Game Feed - TEST
 echo Starting TEST Game Feed collector...
echo You will be asked whether to create sample test cells.
echo A local Test Play Console will open in your browser.
echo.
npm run game-feed:test
echo.
echo The collector has stopped.
pause
