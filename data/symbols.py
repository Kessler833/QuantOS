# data/symbols.py
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import GetAssetsRequest
from alpaca.trading.enums import AssetClass, AssetStatus

from . import config

_trading_client = TradingClient(config.ALPACA_API_KEY, config.ALPACA_SECRET_KEY)


def get_equity_symbols():
    """
    Liefert Symbole gruppiert nach Asset Class + Flat-Liste.
    Format: {
      "groups": {
        "ETFs": [...],
        "Large Cap Stocks": [...],
        "Mid Cap Stocks": [...],
        "Small Cap Stocks": [...]
      },
      "flat": [...]
    }
    """
    req = GetAssetsRequest(
        status=AssetStatus.ACTIVE,
        asset_class=AssetClass.US_EQUITY,
    )
    assets = _trading_client.get_all_assets(req)
    
    etfs = []
    large_cap = []
    mid_cap = []
    small_cap = []
    
    # Bekannte Large-Cap Ticker
    known_large_caps = {
        "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "TSLA", "META", "BRK.B",
        "JPM", "V", "WMT", "JNJ", "MA", "PG", "UNH", "HD", "BAC", "DIS", "NFLX",
        "ADBE", "CRM", "AVGO", "ORCL", "COST", "PEP", "TMO", "CSCO", "ACN", "MRK"
    }
    
    for a in assets:
        if not a.tradable:
            continue
        
        item = {
            "symbol": a.symbol,
            "name": a.name,
            "exchange": a.exchange.value if hasattr(a.exchange, 'value') else str(a.exchange),
        }
        
        # ETF-Erkennung
        is_etf = (
            "ETF" in a.name.upper() or 
            "FUND" in a.name.upper() or
            (hasattr(a.exchange, 'value') and a.exchange.value in ["ARCA", "BATS"])
        )
        
        if is_etf:
            etfs.append(item)
        elif a.symbol in known_large_caps:
            large_cap.append(item)
        elif len(a.symbol) <= 4:
            mid_cap.append(item)
        else:
            small_cap.append(item)
    
    # Alphabetisch sortieren
    etfs.sort(key=lambda x: x["symbol"])
    large_cap.sort(key=lambda x: x["symbol"])
    mid_cap.sort(key=lambda x: x["symbol"])
    small_cap.sort(key=lambda x: x["symbol"])
    
    # Flat-Liste
    flat = etfs + large_cap + mid_cap + small_cap
    
    return {
        "groups": {
            "ETFs": etfs,
            "Large Cap Stocks": large_cap,
            "Mid Cap Stocks": mid_cap,
            "Small Cap Stocks": small_cap,
        },
        "flat": flat
    }
