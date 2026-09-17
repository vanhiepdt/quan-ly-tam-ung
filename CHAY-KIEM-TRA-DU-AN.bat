@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Kiem tra du an Quan ly tam ung
cd /d "%~dp0"

echo.
echo ================================================
echo   KIEM TRA DU AN QUAN LY TAM UNG - HOA DON
echo ================================================
echo.
echo Script nay kiem tra code moi nhat roi mo web:
echo   - Cai thu vien (neu thieu)
echo   - TypeScript, test don vi, kiem tra giao dien, build production
echo   - Chay E2E that neu Docker Desktop dang mo
echo   - Khoi dong web local tai http://localhost:3000
echo.
echo Chi muon kiem tra nhanh, khong chay E2E: chay-test.bat nhanh
echo Chi muon chay E2E: chay-e2e.bat
echo.

if not exist "package.json" (
  echo [LOI] Khong tim thay package.json. Hay dat file nay trong thu muc du an.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [LOI] Khong tim thay npm. Hay cai Node.js LTS truoc.
  echo https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/2] Dang cai thu vien lan dau...
  call npm install || goto :loi
) else (
  echo [1/2] Thu vien da san sang.
)

echo.
echo [2/2] Kiem tra code moi nhat...
rem Dat KHONG_DUNG de chay-test.bat khong dung cho rieng; script nay hoi mot lan o cuoi.
set "KHONG_DUNG=1"
call "%~dp0chay-test.bat"
set "KHONG_DUNG="
if errorlevel 1 goto :loi

echo.
echo ================================================
echo   THANH CONG - Code moi nhat da dat het cac buoc kiem tra.
echo ================================================
echo.
echo Nhan phim bat ky de khoi dong web local tai http://localhost:3000
pause >nul
call "%~dp0chay-dev.bat"
exit /b %errorlevel%

:loi
echo.
echo ================================================
echo   THAT BAI - Xem dong loi o phia tren de sua.
echo ================================================
echo.
pause
exit /b 1
