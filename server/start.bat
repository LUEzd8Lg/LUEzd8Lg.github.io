@echo off
chcp 65001 > nul
echo ============================================================
echo   Worldview Archive Server  -  本地启动脚本 (Windows)
echo ============================================================
echo.

where node > nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [错误] 未检测到 Node.js，请先安装：
  echo        https://nodejs.org/zh-cn/  （下载 LTS 版本）
  echo        安装后重新运行本脚本。
  echo.
  pause
  exit /b 1
)

echo [1/3] 检查依赖...
if not exist "node_modules" (
  echo       首次启动，正在安装依赖...
  call npm install
  if %ERRORLEVEL% NEQ 0 (
    echo [错误] 依赖安装失败，请检查网络。
    pause
    exit /b 1
  )
)

if not exist ".env" (
  echo [2/3] 未找到 .env，从 .env.example 复制一份（演示模式）...
  copy ".env.example" ".env" > nul
  echo       提示：编辑 .env 切换 SMS_PROVIDER / EMAIL_PROVIDER 到真实通道。
) else (
  echo [2/3] .env 已就绪。
)

echo [3/3] 启动服务...
echo.
call npm start
pause
