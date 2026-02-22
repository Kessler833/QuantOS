@echo off
cd /d "%~dp0"
echo Starte StrategyOS...
start "" streamlit run app.py
timeout /t 2 >nul
start http://localhost:8501
