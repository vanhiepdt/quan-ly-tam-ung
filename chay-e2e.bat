@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Chay E2E that - Quan ly tam ung
cd /d "%~dp0"

rem npm tra ma loi am khi thieu package.json, va "if errorlevel 1" khong bat duoc ma
rem am, nen dung "|| goto :loi" cho moi lenh npm.

if not exist "package.json" (
  echo [LOI] Khong tim thay package.json. Hay dat file nay trong thu muc du an.
  pause
  exit /b 1
)

echo ================================================
echo   E2E THAT - NEXT.JS + POSTGRESQL TAM THOI
echo ================================================
echo.
echo Script nay se tu dong:
echo   - Tao mot PostgreSQL dung mot lan trong Docker o cong rieng
echo   - Chay migration that va tao tai khoan admin gia lap
echo   - Mo web that bang Edge va kiem tra cac luong nghiep vu
echo   - Xoa sach container va thu muc tam sau khi xong
echo.
echo An toan: khong dung database that, khong doc file .env nao,
echo         khong goi mang ra ngoai. Can khoang vai phut.
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js LTS. Tai tai: https://nodejs.org/
  pause
  exit /b 1
)

where docker >nul 2>nul
if errorlevel 1 (
  echo [LOI] Khong tim thay Docker Desktop. Tai tai:
  echo       https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [LOI] Docker da cai nhung chua chay. Hay mo Docker Desktop roi chay lai.
  pause
  exit /b 1
)

call :co_edge
if errorlevel 1 (
  echo [LOI] Khong tim thay Microsoft Edge. Cai Edge hoac chay: npx playwright install msedge
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [THONG BAO] Chua co node_modules, dang cai thu vien lan dau...
  call npm install || goto :loi
)

echo Dang chay E2E that...
echo.
call npm run test:e2e || goto :loi

echo.
echo ================================================
echo   THANH CONG - Tat ca nhom kiem tra E2E deu dat.
echo ================================================
echo.
if not defined KHONG_DUNG pause
exit /b 0

:loi
echo.
echo ================================================
echo   THAT BAI - Doc log ngay tren dong loi de biet nhom nao khong dat.
echo ================================================
echo.
if not defined KHONG_DUNG pause
exit /b 1

:co_edge
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" exit /b 0
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" exit /b 0
exit /b 1
