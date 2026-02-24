============================================================
  QuantOS - Quant Trading Terminal
============================================================

INSTALLATION
------------
Voraussetzungen:
  - Node.js (https://nodejs.org)
  - Python 3.10+ (https://python.org/downloads)
    → Beim Setup "Add Python to PATH" aktivieren

1. Python-Abhängigkeiten installieren
   pip install fastapi uvicorn pydantic pandas numpy alpaca-py

2. Node-Abhängigkeiten installieren
   npm install

3. Alpaca API-Keys eintragen
   Datei: data/config.py
   → ALPACA_API_KEY und ALPACA_SECRET_KEY setzen
   → Kostenloser Account: https://alpaca.markets

4. Backend starten (Terminal 1)
   cd backend
   uvicorn main:app --reload --port 8000

5. Frontend starten (Terminal 2)
   npm start


UNTERSTÜTZTE SYMBOLE (Alpaca)
------------------------------
Aktien    → SPY, QQQ, AAPL, TSLA, NVDA, ...
Indizes   → SPY (S&P 500), QQQ (NASDAQ), DIA (DOW)
Crypto    → BTC/USD, ETH/USD, SOL/USD, LTC/USD, DOGE/USD
Forex     → (über Alpaca Forex-Feed)


NEUEN INDIKATOR HINZUFÜGEN
---------------------------
1. Neue .py Datei in indicators/ erstellen, z.B. macd.py
2. Funktion muss DataFrame entgegennehmen und zurückgeben:

   def macd(df, fast=12, slow=26, col="close"):
       ema_fast    = df[col].ewm(span=fast).mean()
       ema_slow    = df[col].ewm(span=slow).mean()
       df["macd"]  = ema_fast - ema_slow
       return df

3. Fertig – erscheint automatisch als Option im Backtester


NEUE STRATEGIE HINZUFÜGEN
--------------------------
1. Neue .py Datei in strategies/ erstellen, z.B. rsi_reversion.py
2. Funktion muss eine "signal"-Spalte setzen (1=Long, -1=Short, 0=neutral):

   def rsi_reversion(df, oversold=30, overbought=70, **kwargs):
       df["signal"] = 0
       df.loc[df["rsi"] < oversold,    "signal"] = 1
       df.loc[df["rsi"] > overbought,  "signal"] = -1
       return df

3. Fertig – erscheint automatisch im Strategie-Dropdown


NEUE SEITE HINZUFÜGEN
----------------------
1. Neue .py Datei in frontend/js/ und Eintrag in index.html
2. Nav-Item in der Sidebar eintragen (data-page="deinpage")
3. <div id="page-deinpage" class="page"> im main-content anlegen
