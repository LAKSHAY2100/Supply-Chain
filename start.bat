@echo off
REM ChainGuard AI launcher - opens backend (uvicorn) and frontend (vite) in two windows.

setlocal
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

echo.
echo ===============================================================
echo  ChainGuard AI - launching backend and frontend
echo  Backend  : http://localhost:8000  (docs at /docs)
echo  Frontend : http://localhost:5173
echo  Close the two new windows to stop the servers.
echo ===============================================================
echo.

REM ---------- Backend ----------
if not exist "%BACKEND%\.venv\Scripts\activate.bat" (
    echo [setup] Creating Python virtualenv ...
    pushd "%BACKEND%"
    python -m venv .venv || ( echo Failed to create venv. & popd & exit /b 1 )
    call ".venv\Scripts\activate.bat"
    pip install -r requirements.txt
    popd
)

start "ChainGuard - Backend (uvicorn)" cmd /k ^
    "cd /d ""%BACKEND%"" && call .venv\Scripts\activate.bat && uvicorn main:app --reload --port 8000"

REM ---------- Frontend ----------
if not exist "%FRONTEND%\node_modules" (
    echo [setup] Installing frontend dependencies ...
    pushd "%FRONTEND%"
    call npm install --ignore-scripts --no-audit --no-fund
    popd
)

start "ChainGuard - Frontend (vite)" cmd /k ^
    "cd /d ""%FRONTEND%"" && npm run dev"

echo.
echo Two terminal windows have been opened.
echo Press any key in this window to close this launcher (servers keep running).
pause >nul
endlocal
