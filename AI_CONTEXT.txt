============================================================
  StrategyOS - Trading Platform
============================================================

INSTALLATION
------------
1. Python installieren
   - Download: https://python.org/downloads
   - Beim Setup "Add Python to PATH" aktivieren

2. Bibliotheken installieren
   Terminal oeffnen und eingeben:
   pip install streamlit plotly yfinance pandas numpy

3. Starten
   Doppelklick auf start.bat


ORDNERSTRUKTUR
--------------
TradingPlatform/
├── app.py              → Einstiegspunkt, Navigation
├── start.bat           → App starten per Doppelklick
├── pages/
│   ├── home.py         → Homescreen
│   └── backtest.py     → Backtesting-Tool
├── indicators/
│   ├── __init__.py     → automatisches Laden
│   └── rsi.py          → Beispiel
└── strategies/
    ├── __init__.py     → automatisches Laden
    └── sma_cross.py    → Beispiel


NEUEN INDIKATOR HINZUFUEGEN
----------------------------
1. Neue .py Datei in indicators/ erstellen, z.B. macd.py
2. Funktion muss DataFrame entgegennehmen und zurueckgeben:

   def macd(df, fast=12, slow=26, col="close"):
       ema_fast   = df[col].ewm(span=fast).mean()
       ema_slow   = df[col].ewm(span=slow).mean()
       df["macd"] = ema_fast - ema_slow
       return df

3. Fertig - erscheint automatisch als Checkbox im Backtester


NEUE STRATEGIE HINZUFUEGEN
---------------------------
1. Neue .py Datei in strategies/ erstellen, z.B. rsi_reversion.py
2. Funktion muss signal-Spalte setzen (1=Long, -1=Short, 0=neutral):

   def rsi_reversion(df, oversold=30, overbought=70, **kwargs):
       df["signal"] = 0
       df.loc[df["rsi"] < oversold,   "signal"] = 1
       df.loc[df["rsi"] > overbought, "signal"] = -1
       return df

3. Fertig - erscheint automatisch im Dropdown im Backtester


NEUE PAGE HINZUFUEGEN
----------------------
1. Neue .py Datei in pages/ erstellen, z.B. markov.py
2. Normaler Streamlit-Code:

   import streamlit as st
   st.title("Markov Model")

3. Optional: Icon in app.py → PAGE_ICONS eintragen
   Optional: Beschreibung in pages/home.py → PAGE_META eintragen
4. Erscheint automatisch in Navigation und Homescreen


UNTERSTUETZTE SYMBOLE (yfinance)
----------------------------------
Forex      → EURUSD=X, GBPUSD=X
Indices    → ^GDAXI (DAX), ^SPX (S&P 500)
Aktien     → AAPL, TSLA
Crypto     → BTC-USD, ETH-USD
Rohstoffe  → GC=F (Gold), CL=F (Oel)
