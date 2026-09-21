@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Mo web test kem OnlyOffice
if not "%~1"=="" if /i not "%~1"=="kiem-tra" if /i not "%~1"=="moi" goto :cachdung

echo ================================================
echo   MO WEB TEST - http://localhost:3000
echo ================================================
echo Can Docker Desktop dang chay. Chi dung tren may nay.
echo DU LIEU NHAP TREN WEB SE LUU VAO DATABASE DANG CAU HINH.
echo Script khong chay migration, khong tao lai tai khoan.
echo.
echo Test hoa don PDF/AI khong can Word: TEST-HOA-DON.bat
echo Sau khi dang nhap:
echo   - Giao dich / Them giao dich / Doc tu hoa don (PDF)
echo   - Cai dat / Cai dat AI: Test API va Tim model hien co
echo.
where node >nul 2>&1 || goto :thieu_node
where npm >nul 2>&1 || goto :thieu_node
if not exist ".env.local" (
  echo [LOI] Chua co .env.local. Chay CAI-DAT-POSTGRESQL.bat de cau hinh lan dau.
  goto :loi
)
if not exist "node_modules" (
  call npm install || goto :loi
)
call "%~dp0chay-onlyoffice.bat" len || goto :loi
node --env-file=.env.local "%~dp0scripts\kiem-tra-moi-truong.mjs" || goto :loi
if /i "%~1"=="kiem-tra" exit /b 0

echo.
echo Mo giay cua giao dich, bam Mo trinh soan thao de test Word.
echo Neu vua doi .env.local: luu va dong editor, roi chay MO-WEB-TEST.bat moi.
echo Neu vua doi next.config / pdfjs ma van loi dung anh hoa don: chay lai voi moi.
if /i "%~1"=="moi" (
  call "%~dp0chay-dev.bat" moi
) else (
  call "%~dp0chay-dev.bat"
)
exit /b %errorlevel%
:thieu_node
echo [LOI] Can cai Node.js LTS va npm.
:loi
echo [LOI] Chua san sang. Xem nguyen nhan o tren; khong tu chay migration.
if not defined KHONG_DUNG pause
exit /b 1
:cachdung
echo Cach dung: MO-WEB-TEST.bat [kiem-tra^|moi]
exit /b 1
