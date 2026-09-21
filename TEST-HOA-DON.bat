@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Test hoa don PDF va Cai dat AI

rem Cach dung: TEST-HOA-DON.bat
rem Mo web de tu thu:
rem   - Doc tu hoa don (PDF/QR + AI) tren form Them giao dich
rem   - Test API va Tim model hien co trong Cai dat AI
rem Khong can Docker / OnlyOffice. Luon khoi dong lai server (chay-dev.bat moi)
rem de nap pdfjs fake worker va gioi han tai 12MB trong next.config.ts.

echo ================================================
echo   TEST HOA DON PDF + CAI DAT AI
echo ================================================
echo Khong can Docker. Can PostgreSQL va file .env.local.
echo Script luon khoi dong lai web de nap code doc PDF moi nhat.
echo DU LIEU NHAP TREN WEB SE LUU VAO DATABASE DANG CAU HINH.
echo Ket qua Doc tu hoa don CHI LA DE XUAT - khong ghi so cho den khi bam Luu.
echo.
echo Sau khi dang nhap bang tai khoan admin:
echo   1. Cai dat  -  Cai dat AI doc hoa don
echo      - Bat lop AI, chon nha cung cap, dien khoa (hoac dung khoa trong .env.local)
echo      - Bam Test API
echo      - Bam Tim model hien co  (danh sach goi y model that tu API)
echo   2. Giao dich  -  Them giao dich  -  Hoan tam ung hoac Co quan tra thang
echo      - Doc tu hoa don: chon file PDF (vi du 1C26MLD_*.pdf trong thu muc du an)
echo      - QR khoa so HD va tong tien; AI dien nguoi mua, nguoi ban, ruou bia
echo      - Khong co khoa AI van test duoc lop QR
echo.
echo Test Word / OnlyOffice: MO-WEB-TEST.bat
echo Chi chay test don vi, khong mo web: chay-test.bat nhanh
echo.

if not exist "package.json" (
  echo [LOI] Khong tim thay package.json. Hay dat file nay trong thu muc du an.
  goto :loi
)
where node >nul 2>&1 || goto :thieu_node
where npm >nul 2>&1 || goto :thieu_node
if not exist ".env.local" (
  echo [LOI] Chua co .env.local. Chay CAI-DAT-POSTGRESQL.bat de cau hinh lan dau.
  goto :loi
)
if not exist "node_modules" (
  echo [THONG BAO] Chua co node_modules, dang cai thu vien lan dau...
  call npm install || goto :loi
)

call "%~dp0chay-dev.bat" moi
exit /b %errorlevel%

:thieu_node
echo [LOI] Can cai Node.js LTS va npm. Tai tai: https://nodejs.org/
:loi
echo [LOI] Chua san sang. Khong tu chay migration.
if not defined KHONG_DUNG pause
exit /b 1
