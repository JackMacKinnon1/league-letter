@echo off
cd /d "%~dp0"
title League Letter Game Feed - MOCK SLEEPER TEST
 echo Starting TRUE TEST Game Feed collector...
echo A local mock Sleeper API and Test Play Console will open in your browser.
echo Plays are NOT inserted directly into Supabase; the worker must infer them from matchup score changes.
echo.
npm run game-feed:test
echo.
echo The collector has stopped.
pause
