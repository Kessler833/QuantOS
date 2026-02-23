# backend/api/symbols.py
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import GetAssetsRequest
from alpaca.trading.enums import AssetClass

from data import config

_trading_client = TradingClient(config.ALPACA_API_KEY, config.ALPACA_SECRET_KEY)


def get_equity_symbols() -> dict:
    """
    Liefert Symbole gruppiert nach Asset Class:
    {
      "groups": {
        "ETFs": [...],
        "Large Cap Stocks": [...],
        "Mid Cap Stocks": [...],
        "Small Cap Stocks": [...]
      },
      "flat": [...]  # alphabetisch sortierte Flat-Liste
    }
    """
    req = GetAssetsRequest(
        status="active",
        asset_class=AssetClass.US_EQUITY,
    )
    assets = _trading_client.get_all_assets(req)
    
    etfs = []
    large_cap = []
    mid_cap = []
    small_cap = []
    
    for a in assets:
        if not a.tradable:
            continue
        
        item = {
            "symbol": a.symbol,
            "name": a.name,
            "exchange": a.exchange,
        }
        
        # ETF-Erkennung: über Name oder spezielle Exchanges
        is_etf = (
            "ETF" in a.name.upper() or 
            "FUND" in a.name.upper() or
            a.exchange in ["ARCA", "BATS"]
        )
        
        if is_etf:
            etfs.append(item)
        else:
            # Gruppierung nach Market Cap (falls verfügbar, sonst Default Mid Cap)
            # Alpaca Assets API hat kein Market Cap Field direkt – Heuristik:
            # Large Cap: bekannte Ticker oder "freetrade: True" + NYSE/NASDAQ
            # Für Demo nehmen wir einfache Heuristik
            if a.symbol in ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "WMT"]:
                large_cap.append(item)
            elif len(a.symbol) <= 4:  # Heuristik: kurze Ticker eher Large/Mid
                mid_cap.append(item)
            else:
                small_cap.append(item)
    
    # Alphabetisch sortieren
    etfs.sort(key=lambda x: x["symbol"])
    large_cap.sort(key=lambda x: x["symbol"])
    mid_cap.sort(key=lambda x: x["symbol"])
    small_cap.sort(key=lambda x: x["symbol"])
    
    # Flat-Liste für alphabetische Ansicht
    flat = etfs + large_cap + mid_cap + small_cap
    flat.sort(key=lambda x: x["symbol"])
    
    return {
        "groups": {
            "ETFs": etfs,
            "Large Cap Stocks": large_cap,
            "Mid Cap Stocks": mid_cap,
            "Small Cap Stocks": small_cap,
        },
        "flat": flat
    }
