@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if /i "%~1"=="len" goto :len
if /i "%~1"=="tat" goto :tat
if /i "%~1"=="trang-thai" goto :trangthai
echo Cach dung: chay-onlyoffice.bat len^|tat^|trang-thai
exit /b 1
:len
node scripts/ghi-env.mjs onlyoffice || exit /b 1
docker compose --env-file .env.local -p tai-chinh-onlyoffice -f docker-compose.onlyoffice.yml up -d --wait --wait-timeout 360 || exit /b 1
echo OnlyOffice san sang. Khoi dong lai ung dung de nap cau hinh moi.
exit /b 0
:tat
docker compose --env-file .env.local -p tai-chinh-onlyoffice -f docker-compose.onlyoffice.yml stop onlyoffice
exit /b %errorlevel%
:trangthai
docker compose --env-file .env.local -p tai-chinh-onlyoffice -f docker-compose.onlyoffice.yml ps
exit /b %errorlevel%
