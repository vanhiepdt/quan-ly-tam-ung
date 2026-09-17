@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Chay migration - Quan ly tam ung
cd /d "%~dp0"

rem npm tra ma loi AM khi thieu package.json, va "if errorlevel 1" KHONG bat duoc ma
rem am. Vi vay kiem tra package.json ngay tu dau, va dung "|| goto :loi" cho moi lenh
rem npm de bat moi truong hop loi.

if not exist "package.json" (
  echo [LOI] Khong tim thay package.json. Hay dat file nay trong thu muc du an.
  pause
  exit /b 1
)

echo ====================================
echo   CHAY DATABASE MIGRATION
echo ====================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js LTS. Tai tai: https://nodejs.org/
  pause
  exit /b 1
)

if not exist ".env.local" (
  echo [LOI] Chua co file .env.local nen khong biet ket noi database nao.
  echo       Hay chay CAI-DAT-POSTGRESQL.bat truoc de cau hinh DATABASE_URL.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [THONG BAO] Chua co node_modules, dang cai thu vien...
  call npm install || goto :loi
)

echo Script se quet thu muc db\migrations va chay theo thu tu ten file.
echo File da chay truoc do duoc bo qua, file moi duoc chay them.
echo Vi du: 007_lich_su_don_vi.sql se tu dong duoc ap dung neu chua chay.
echo.

call npm run db:migrate || goto :loi

echo.
echo ================================================
echo   THANH CONG - Database da duoc cap nhat.
echo ================================================
echo.
pause
exit /b 0

:loi
echo.
echo ================================================
echo   THAT BAI - Kiem tra PostgreSQL dang chay va DATABASE_URL trong .env.local.
echo ================================================
echo.
pause
exit /b 1
