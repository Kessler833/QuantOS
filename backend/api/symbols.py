# backend/api/symbols.py
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import GetAssetsRequest
from alpaca.trading.enums import AssetClass

from data import config

_trading_client = TradingClient(config.ALPACA_API_KEY, config.ALPACA_SECRET_KEY)


def get_equity_symbols() -> list[dict]:
    """
    Liefert eine Liste aktiver, handelbarer US-Aktien & ETFs als Dicts:
    { "symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "exchange": "ARCA" }
    """
    req = GetAssetsRequest(
        status="active",
        asset_class=AssetClass.US_EQUITY,
    )
    assets = _trading_client.get_all_assets(req)
    out: list[dict] = []
    for a in assets:
        if not a.tradable:
            continue
        out.append(
            {
                "symbol": a.symbol,
                "name": a.name,
                "exchange": a.exchange,
            }
        )
    # Optional: alphabetisch sortieren
    out.sort(key=lambda x: x["symbol"])
    return out
