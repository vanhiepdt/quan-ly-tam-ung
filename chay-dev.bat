@echo off
setlocal EnableExtensions
title Chay dev server - Quan ly tam ung
cd /d "%~dp0"

rem Cach dung:
rem   chay-dev.bat       -> mo web ngay: dung lai server dang chay neu can, roi mo trinh duyet
rem   chay-dev.bat moi   -> tat han server dang chay va khoi dong lai tu dau
rem
rem Vi sao co cac buoc kiem tra o duoi:
rem  - npm tra ma loi AM khi thieu package.json, va "if errorlevel 1" KHONG bat duoc
rem    ma am. Vi vay kiem tra package.json ngay tu dau, va dung "|| goto :loi" cho
rem    moi lenh npm de bat moi truong hop loi.
rem  - Next.js chi cho phep MOT dev server cho moi thu muc du an. Server dang chay
rem    duoc ghi trong .next\dev\lock dang {"pid":...,"port":...}.
rem  - Viec doc file lock duoc tach vao chuong trinh con :tim_dev_server. Neu doc
rem    ngay trong khoi if (...), bien se duoc mo rong truoc khi for chay xong nen
rem    luon rong, khien script tuong nham server dang chay la da tat.
rem  - Dev server cua Next.js tu nap lai giao dien moi khi file thay doi, nen khi
rem    server da chay thi chi mo trinh duyet chu khong khoi dong lai: khoi dong lai
rem    phai bien dich lai tu dau, rat cham. Chi khi vua doi thu vien hoac file cau
rem    hinh (package.json, next.config) moi that su can "moi".

set "PORT=3000"
if /i "%~1"=="moi" (set "KHOI_DONG_LAI=1") else (set "KHOI_DONG_LAI=")

if not exist "package.json" (
  echo [LOI] Khong tim thay package.json. Hay dat file nay trong thu muc du an.
  call :dung_man_hinh
  exit /b 1
)

echo ====================================
echo   KHOI DONG DEV SERVER
echo ====================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js LTS. Tai tai: https://nodejs.org/
  call :dung_man_hinh
  exit /b 1
)

if not exist "node_modules" (
  echo [THONG BAO] Chua co node_modules, dang cai thu vien lan dau...
  call npm install || (
    echo [LOI] npm install that bai.
    call :dung_man_hinh
    exit /b 1
  )
)

if not exist ".env.local" (
  echo [CANH BAO] Chua co .env.local nen web se bao loi khi truy van database.
  echo            Hay chay CAI-DAT-POSTGRESQL.bat truoc.
  echo.
)

call :tim_dev_server
if errorlevel 1 goto :khong_co_server
if defined KHOI_DONG_LAI goto :dung_server_cu

echo [THONG BAO] Dev server dang chay san:
echo              http://localhost:%DEV_PORT%   [PID %DEV_PID%]
echo.
echo              Next.js tu cap nhat giao dien ngay khi ban sua code, nen khong can
echo              khoi dong lai. Neu vua doi thu vien hoac file cau hinh thi chay:
echo              chay-dev.bat moi
echo.
call :mo_trinh_duyet %DEV_PORT%
call :dung_man_hinh
exit /b 0

:dung_server_cu
echo Dang dung dev server cu (PID %DEV_PID%) de khoi dong lai bang code moi nhat...
taskkill /F /T /PID %DEV_PID% >nul 2>&1
rem Cho mot nhip de he thong tra cong ve. Dung ping thay cho timeout vi timeout
rem bao loi khi stdin duoc chuyen huong tu file.
ping -n 2 127.0.0.1 >nul
if exist ".next\dev\lock" del /q ".next\dev\lock" >nul 2>&1

:khong_co_server
echo Dang giai phong cong %PORT% neu dang bi chiem...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr /c:"LISTENING" ^| findstr /c:":%PORT% "') do (
  echo   - Dong process PID %%p dang giu cong %PORT%
  taskkill /F /PID %%p >nul 2>&1
)

echo.
echo Dang khoi dong Next.js dev server...
echo Server se chay tai: http://localhost:%PORT%
echo Trinh duyet se tu mo ngay khi server san sang.
echo.
echo Nhan Ctrl+C de dung server
echo ====================================
echo.

rem Cho server san sang roi moi mo trinh duyet, chay song song o tien trinh rieng. Khong the
rem cho ngay trong cua so nay vi lenh npm run dev ben duoi chiem cua so do den khi tat.
rem Neu mo trinh duyet truoc khi Next.js kip nghe cong thi chi thay trang loi.
rem Dung "start /b" de khong bat them cua so console nao.
start "" /b powershell -NoProfile -NonInteractive -Command "for($i=0;$i -lt 120;$i++){try{Invoke-WebRequest -Uri 'http://localhost:%PORT%/' -UseBasicParsing -TimeoutSec 2|Out-Null;break}catch{Start-Sleep -Milliseconds 500}}; Start-Process 'http://localhost:%PORT%/'"

call npm run dev || goto :loi
call :dung_man_hinh
exit /b 0

:loi
echo.
echo [LOI] Dev server thoat voi loi. Xem thong bao ngay phia tren.
call :dung_man_hinh
exit /b 1

rem Dung man hinh cho nguoi dung doc ket qua truoc khi cua so dong mat. Khi chay tu file .bat
rem bang cach nhay dup chuot, cua so se tat ngay neu khong cho; khi chay tu dong lenh san co
rem (stdin khong phai ban phim) thi bo qua de khong treo script tu dong.
rem KHONG_DUNG=1 duoc dat khi file nay duoc goi tu mot file .bat khac da co cho rieng.
:dung_man_hinh
if defined KHONG_DUNG exit /b 0
echo.
pause
exit /b 0

:mo_trinh_duyet
start "" "http://localhost:%1/"
echo Da mo trinh duyet tai http://localhost:%1
exit /b 0

rem Tra ve 0 neu tim thay dev server dang chay that, 1 neu khong.
rem Ket qua nam o DEV_PID va DEV_PORT.
:tim_dev_server
set "DEV_PID="
set "DEV_PORT="
if not exist ".next\dev\lock" goto :tim_qua_cong
rem Next.js dang mo file lock nay doc quyen nen tren Windows khong doc duoc noi dung: ca
rem "for /f" lan "type" deu bao "being used by another process". Boc trong khoi 2>nul de
rem thong bao do khong hien ra lam nguoi dung tuong co loi; doc duoc thi dung, khong thi
rem roi xuong :tim_qua_cong tim server qua cong 3000.
2>nul (for /f "usebackq tokens=2,4 delims=:," %%a in (".next\dev\lock") do (
  set "DEV_PID=%%a"
  set "DEV_PORT=%%b"
))
if not defined DEV_PID goto :tim_qua_cong
rem for o tren da chay xong nen %DEV_PID% co gia tri that o dong nay.
tasklist /FI "PID eq %DEV_PID%" /FI "IMAGENAME eq node.exe" 2>nul | findstr /c:"%DEV_PID%" >nul
if not errorlevel 1 exit /b 0
echo [THONG BAO] Don file lock con lai cua dev server da tat.
del /q ".next\dev\lock" >nul 2>&1
set "DEV_PID="
set "DEV_PORT="

:tim_qua_cong
rem Khong co file lock: tim dev server dang chay qua cong %PORT%.
for /f "tokens=5" %%p in ('netstat -aon ^| findstr /c:"LISTENING" ^| findstr /c:":%PORT% "') do (
  call :la_node %%p
  if not errorlevel 1 (
    set "DEV_PID=%%p"
    set "DEV_PORT=%PORT%"
  )
)
if defined DEV_PID exit /b 0
exit /b 1

:la_node
tasklist /FI "PID eq %1" /FI "IMAGENAME eq node.exe" 2>nul | findstr /c:"%1" >nul
exit /b %errorlevel%
