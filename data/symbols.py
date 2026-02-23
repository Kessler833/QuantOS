# data/symbols.py
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import GetAssetsRequest
from alpaca.trading.enums import AssetClass, AssetStatus

from . import config

_trading_client = TradingClient(config.ALPACA_API_KEY, config.ALPACA_SECRET_KEY)


def get_equity_symbols():
    """
    Liefert Liste aller handelbaren US-Aktien und ETFs von Alpaca.
    Alphabetisch sortiert nach Symbol.
    """
    req = GetAssetsRequest(
        status=AssetStatus.ACTIVE,
        asset_class=AssetClass.US_EQUITY,
    )
    assets = _trading_client.get_all_assets(req)
    
    symbols = []
    for a in assets:
        if a.tradable:
            symbols.append({
                "symbol": a.symbol,
                "name": a.name,
                "exchange": a.exchange.value if hasattr(a.exchange, 'value') else str(a.exchange),
            })
    
    # Alphabetisch sortieren
    symbols.sort(key=lambda x: x["symbol"])
    
    return {"symbols": symbols}
