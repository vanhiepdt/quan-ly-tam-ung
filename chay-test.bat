@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Kiem thu - Quan ly tam ung
cd /d "%~dp0"

rem Cach dung:
rem   chay-test.bat          -> chay day du, gom ca E2E that neu Docker dang mo
rem   chay-test.bat nhanh    -> bo qua buoc E2E (nhanh, khong can Docker)
rem Dat bien KHONG_DUNG=1 truoc khi goi de bo qua buoc dung cho.
rem
rem LUU Y: npm tra ma loi AM khi thieu package.json, va "if errorlevel 1" KHONG bat
rem duoc ma am. Vi vay kiem tra package.json ngay tu dau, va dung "|| goto :loi" cho
rem moi lenh npm de bat moi truong hop loi.

if /i "%~1"=="nhanh" (set "BO_QUA_E2E=1") else (set "BO_QUA_E2E=")

if not exist "package.json" (
  echo [LOI] Khong tim thay package.json. Hay dat file nay trong thu muc du an.
  if not defined KHONG_DUNG pause
  exit /b 1
)

echo ================================================
echo   CHAY KIEM THU - QUAN LY TAM UNG
echo ================================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js LTS. Tai tai: https://nodejs.org/
  goto :loi
)

if not exist "node_modules" (
  echo [THONG BAO] Chua co node_modules, dang cai thu vien lan dau...
  call npm install || goto :loi
)

echo [1/5] Kiem tra TypeScript...
call npm run typecheck || goto :loi

echo.
echo [2/5] Test don vi - vi tinh tai chinh, kieu du lieu, phan quyen...
call npm test || goto :loi

echo.
echo [3/5] Kiem tra giao dien that bang trinh duyet Edge...
call :co_edge
if errorlevel 1 (
  echo [BO QUA] Khong tim thay Microsoft Edge nen bo qua buoc nay.
  echo         Cai Edge hoac chay lenh: npx playwright install msedge
) else (
  call npm run test:ui || goto :loi
)

echo.
echo [4/5] Build ban production...
call npm run build || goto :loi

echo.
echo [5/5] E2E that - Next.js + PostgreSQL tam thoi trong Docker...
if defined BO_QUA_E2E (
  echo [BO QUA] Dang o che do "nhanh". Muon chay day du: chay-test.bat
) else (
  call :co_docker
  if errorlevel 1 (
    echo [BO QUA] Docker chua chay nen bo qua buoc nay.
    echo         Mo Docker Desktop roi chay lai, hoac chay rieng: chay-e2e.bat
  ) else (
    call npm run test:e2e || goto :loi
  )
)

echo.
echo ================================================
echo   THANH CONG - Cac phan kiem tra da chay xong.
echo ================================================
if not defined KHONG_DUNG pause
exit /b 0

:loi
echo.
echo ================================================
echo   THAT BAI - Xem dong loi o phia tren de sua.
echo ================================================
echo.
if not defined KHONG_DUNG pause
exit /b 1

:co_edge
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" exit /b 0
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" exit /b 0
exit /b 1

:co_docker
where docker >nul 2>nul
if errorlevel 1 exit /b 1
docker info >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0
