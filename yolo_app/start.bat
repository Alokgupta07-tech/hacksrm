@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"

echo Starting YOLO Vision Servers...

start /B cmd /c "cd server && .\venv\Scripts\python.exe main.py"
echo Backend starting on http://localhost:8000 ...

start /B cmd /c "cd client && npm run dev"
echo Frontend starting on http://localhost:3000 ...

echo Both servers are spinning up. Open http://localhost:3000 in your browser.
pause
