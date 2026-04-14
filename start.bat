@echo off
echo Starting Self-Learn Quiz (3 services)...
echo.

start "RAG Service" cmd /k "cd rag-service && uvicorn main:app --port 8000 --reload"
timeout /t 2 /nobreak >nul

start "Backend" cmd /k "cd backend && npm run dev"
timeout /t 2 /nobreak >nul

start "Frontend" cmd /k "cd frontend && npm run dev"

echo All services starting in separate windows.
