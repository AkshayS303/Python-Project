@echo off
title MatSolve - Linear Equation & Word Problem Solver
cd /d "%~dp0"

echo ========================================================
echo       Starting MatSolve Web Application...
echo ========================================================

set PYTHON_EXE="%LOCALAPPDATA%\Programs\Python\Python312\python.exe"

if exist %PYTHON_EXE% (
    set PY_CMD=%PYTHON_EXE%
) else (
    set PY_CMD=python
)

echo [*] Installing required packages (FastAPI, NumPy, Uvicorn, etc.)...
%PY_CMD% -m pip install -r requirements.txt --quiet

echo [*] Launching server on http://localhost:8000 ...
echo [*] Press Ctrl+C to stop.
echo.

%PY_CMD% server.py

pause
