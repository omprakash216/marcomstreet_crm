@echo off
cd /d "%~dp0"
echo Running attendance migration...
node scripts/run-migration.js
if %ERRORLEVEL% EQU 0 (
  echo Done.
) else (
  echo Migration failed. Check .env and MySQL.
)
pause
