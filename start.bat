@echo off
chcp 65001 >nul
title Business Empire
cd /d "%~dp0"
set PORT=8020

rem 已经在运行就直接开浏览器
curl -fsS -m 1 http://127.0.0.1:%PORT%/api/health 2>nul | findstr /C:"\"ok\":true" >nul
if not errorlevel 1 (
  echo   服务已在运行，正在打开浏览器 ...
  start "" http://127.0.0.1:%PORT%
  exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] 未检测到 Node.js / Node.js not found
  echo.
  echo   请先安装 Node.js v24 LTS 或更高版本:
  echo     1^) 打开 PowerShell 执行:  winget install OpenJS.NodeJS.LTS
  echo     2^) 或访问 https://nodejs.org 下载 LTS 安装包
  echo   安装完成后请重新打开本窗口。
  echo.
  pause
  exit /b 1
)

echo.
echo   正在启动 Business Empire ... / Starting Business Empire ...
echo   浏览器地址: http://127.0.0.1:%PORT%
echo   关闭此窗口即停止游戏服务。
echo.

rem 等服务起来后再开浏览器
start "" /b cmd /c "timeout /t 3 >nul & start "" http://127.0.0.1:%PORT%"
node server.js
echo.
echo   服务已停止 / Server stopped.
pause
