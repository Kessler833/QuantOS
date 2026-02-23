# data/symbols.py
from typing import Dict, List, Any, Set
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import GetAssetsRequest
from alpaca.trading.enums import AssetClass, AssetStatus

from . import config

_trading_client = TradingClient(config.ALPACA_API_KEY, config.ALPACA_SECRET_KEY)


def get_equity_symbols() -> Dict[str, Any]:
    """
    Liefert Symbole mit Metadaten für flexible Frontend-Sortierung.
    """
    req = GetAssetsRequest(
        status=AssetStatus.ACTIVE,
        asset_class=AssetClass.US_EQUITY,
    )
    assets = _trading_client.get_all_assets(req)
    
    # Sektor-Mapping (Top-Stocks nach Sektor)
    sector_map: Dict[str, str] = {
        # Technology
        "AAPL": "Technology", "MSFT": "Technology", "GOOGL": "Technology", "GOOG": "Technology",
        "META": "Technology", "NVDA": "Technology", "TSLA": "Technology", "ADBE": "Technology",
        "CRM": "Technology", "ORCL": "Technology", "CSCO": "Technology", "INTC": "Technology",
        "AMD": "Technology", "QCOM": "Technology", "TXN": "Technology", "NOW": "Technology",
        "AVGO": "Technology", "NFLX": "Technology", "IBM": "Technology",
        
        # Healthcare
        "JNJ": "Healthcare", "UNH": "Healthcare", "PFE": "Healthcare", "ABBV": "Healthcare",
        "TMO": "Healthcare", "ABT": "Healthcare", "MRK": "Healthcare", "LLY": "Healthcare",
        "BMY": "Healthcare", "AMGN": "Healthcare", "GILD": "Healthcare", "MDT": "Healthcare",
        "ISRG": "Healthcare", "VRTX": "Healthcare", "ZTS": "Healthcare", "REGN": "Healthcare",
        "CI": "Healthcare", "CVS": "Healthcare", "BSX": "Healthcare", "EW": "Healthcare",
        
        # Finance
        "JPM": "Finance", "BAC": "Finance", "WFC": "Finance", "GS": "Finance", "MS": "Finance",
        "SCHW": "Finance", "BLK": "Finance", "C": "Finance", "AXP": "Finance", "SPGI": "Finance",
        "CME": "Finance", "ICE": "Finance", "FIS": "Finance", "MCO": "Finance", "AON": "Finance",
        "V": "Finance", "MA": "Finance", "PYPL": "Finance",
        
        # Consumer
        "AMZN": "Consumer", "WMT": "Consumer", "HD": "Consumer", "DIS": "Consumer",
        "NKE": "Consumer", "COST": "Consumer", "TGT": "Consumer", "SBUX": "Consumer",
        "LOW": "Consumer", "TJX": "Consumer", "BKNG": "Consumer", "MCD": "Consumer",
        "MDLZ": "Consumer", "CL": "Consumer", "PG": "Consumer", "KO": "Consumer",
        "PEP": "Consumer", "PM": "Consumer", "MO": "Consumer",
        
        # Energy
        "CVX": "Energy", "XOM": "Energy", "COP": "Energy", "SLB": "Energy",
        "EOG": "Energy", "PSX": "Energy", "MPC": "Energy", "VLO": "Energy",
        
        # Industrial
        "BA": "Industrial", "HON": "Industrial", "UNP": "Industrial", "CAT": "Industrial",
        "GE": "Industrial", "RTX": "Industrial", "MMM": "Industrial", "UPS": "Industrial",
        "DE": "Industrial", "NSC": "Industrial",
        
        # Utilities
        "NEE": "Utilities", "DUK": "Utilities", "SO": "Utilities", "D": "Utilities",
    }
    
    # Top-100 Most Traded (für Popularity-Sortierung)
    top_traded: Set[str] = {
        "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "GOOG", "SPY", "QQQ",
        "AMD", "NFLX", "BABA", "INTC", "DIS", "PYPL", "MRNA", "NIO", "PLTR", "SOFI",
    }
    
    # Market Cap Kategorien
    mega_cap_symbols: Set[str] = {
        "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA", "BRK.B"
    }
    
    symbols: List[Dict[str, Any]] = []
    
    for a in assets:
        if not a.tradable:
            continue
        
        # ETF-Erkennung
        is_etf = (
            "ETF" in a.name.upper() or 
            "FUND" in a.name.upper() or
            (hasattr(a.exchange, 'value') and a.exchange.value in ["ARCA", "BATS"])
        )
        
        # Market Cap Kategorie
        market_cap: str
        if a.symbol in mega_cap_symbols:
            market_cap = "Mega Cap"
        elif a.symbol in top_traded:
            market_cap = "Large Cap"
        elif len(a.symbol) <= 4:
            market_cap = "Mid Cap"
        else:
            market_cap = "Small Cap"
        
        item: Dict[str, Any] = {
            "symbol": a.symbol,
            "name": a.name,
            "exchange": a.exchange.value if hasattr(a.exchange, 'value') else str(a.exchange),
            "type": "ETF" if is_etf else "Stock",
            "sector": sector_map.get(a.symbol, "Other"),
            "market_cap": market_cap,
            "is_popular": a.symbol in top_traded,
        }
        
        symbols.append(item)
    
    # Alphabetisch sortieren (Standard)
    symbols.sort(key=lambda x: x["symbol"])
    
    return {
        "symbols": symbols,
        "metadata": {
            "total": len(symbols),
            "types": list(set(s["type"] for s in symbols)),
            "sectors": list(set(s["sector"] for s in symbols)),
            "market_caps": ["Mega Cap", "Large Cap", "Mid Cap", "Small Cap"]
        }
    }
