@echo off
:: Robust script located inside /docs folder
cd /d "%~dp0"
cd ..

echo ========================================
echo [PROCESS] Starting BGG Data Sync...
echo ========================================
echo.

call npm run sync:data

echo.
echo ========================================
echo [DONE] Process Finished.
echo Output: docs/Final_BggCollection.csv
echo ========================================
pause
