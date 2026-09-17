@echo off
setlocal EnableExtensions
title Cai dat PostgreSQL - Quan ly tam ung
cd /d "%~dp0"

rem LUU Y 1: khong dat "chcp 65001" truoc cac cau lenh set /p. Doi bang ma console
rem ngay truoc khi nhap lieu lam set /p doc sai du lieu nguoi dung go vao, nen chi
rem doi bang ma ngay truoc khi goi node/npm.
rem LUU Y 2: gia tri nguoi dung nhap duoc ghi ra .env.local bang node
rem (scripts/ghi-env.mjs) chu khong bang "echo >>", de ky tu & | < > ^ " khong lam
rem hong file cau hinh.
rem LUU Y 3: npm tra ma loi am khi thieu package.json, va "if errorlevel 1" khong bat
rem duoc ma am, nen dung "|| goto :loi" cho moi lenh npm.

if not exist "package.json" (
  echo [LOI] Khong tim thay package.json. Hay dat file nay trong thu muc du an.
  pause
  exit /b 1
)

echo ================================================
echo    CAU HINH POSTGRESQL VA TAI KHOAN ADMIN
echo ================================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js LTS. Tai tai: https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [THONG BAO] Chua co node_modules, dang cai thu vien lan dau...
  call npm install || goto :loi
)

if exist ".env.local" goto :kiem_tra_admin

echo.
echo Can PostgreSQL dang chay truoc. Tai tai: https://www.postgresql.org/download/windows/
echo Vi du DATABASE_URL: postgresql://postgres:MAT_KHAU@127.0.0.1:5432/quan_ly_tam_ung
echo.
set "DBURL="
set /p DBURL=Nhap DATABASE_URL:
if not defined DBURL set "DBURL=postgresql://postgres:MAT_KHAU@127.0.0.1:5432/quan_ly_tam_ung"

echo.
echo Tai khoan admin dang nhap bang TEN DANG NHAP, khong phai email.
echo Ten dang nhap: 3-50 ky tu, gom chu khong dau, so, dau cham, gach duoi, gach ngang.
echo Mat khau: 8 ky tu tro len.
call :hoi_tai_khoan
if errorlevel 1 goto :thieu

chcp 65001 >nul
node scripts\ghi-env.mjs tao || goto :loi
goto :chay

:kiem_tra_admin
echo [THONG BAO] Da co .env.local. File nay KHONG bi ghi de.
findstr /b /c:"ADMIN_USERNAME=" ".env.local" >nul 2>&1
if not errorlevel 1 (
  echo Da co ADMIN_USERNAME trong .env.local nen bo qua buoc khai bao admin.
  goto :chay
)
echo.
echo [CANH BAO] .env.local chua co dong ADMIN_USERNAME nen chua tao duoc tai khoan admin.
echo           Chi can bo sung ten dang nhap va mat khau, phan ket noi database giu nguyen.
echo           Ten dang nhap: 3-50 ky tu, gom chu khong dau, so, dau cham, gach duoi, gach ngang.
echo.
call :hoi_tai_khoan
if errorlevel 1 goto :thieu

chcp 65001 >nul
node scripts\ghi-env.mjs bo-sung || goto :loi

:chay
echo.
echo Dang chay migration...
call npm run db:migrate || goto :loi
echo.
echo Dang tao/cap nhat admin...
call npm run db:seed-admin || goto :loi
echo.
echo ================================================
echo   THANH CONG.
echo   Hay chay CHAY-KIEM-TRA-DU-AN.bat va dang nhap bang
echo   TEN DANG NHAP admin vua tao (khong phai email).
echo ================================================
echo.
pause
exit /b 0

:hoi_tai_khoan
rem Dat rong truoc de gia tri cua lan chay truoc khong bi dung lai. set /p de nguyen
rem bien khi nguoi dung go Enter suong, nen phai kiem tra bang "if not defined".
set "ADMIN_USERNAME="
set "ADMIN_PASSWORD="
set "ADMINMAIL="
set /p ADMIN_USERNAME=Ten dang nhap admin:
set /p ADMIN_PASSWORD=Mat khau admin:
set /p ADMINMAIL=Email admin (khong bat buoc, bo trong cung duoc):
if not defined ADMIN_USERNAME exit /b 1
if not defined ADMIN_PASSWORD exit /b 1
exit /b 0

:thieu
echo.
echo [LOI] Phai nhap ten dang nhap va mat khau admin.
goto :loi

:loi
echo.
echo [LOI] Cai dat that bai. Kiem tra PostgreSQL dang chay va DATABASE_URL trong .env.local.
echo       Co the chay lai chinh file nay, .env.local se khong bi ghi de.
echo.
pause
exit /b 1
