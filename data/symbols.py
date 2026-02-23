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
    
    # Top-100 Most Traded
    top_traded: Set[str] = {
        "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "GOOG", "SPY", "QQQ",
        "AMD", "NFLX", "BABA", "INTC", "DIS", "PYPL", "MRNA", "NIO", "PLTR", "SOFI",
    }
    
    # Market Cap Kategorien
    mega_cap_symbols: Set[str] = {
        "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA", "BRK.B"
    }
    
    # Index-Tracking ETFs (für "Indices" Kategorie)
    index_etfs: Set[str] = {
        "SPY", "QQQ", "IWM", "DIA", "VOO", "VTI", "IVV", "MDY", "IJH", "IJR",
        "RSP", "SPLG", "SPYG", "SPYV", "VUG", "VTV", "QQQM", "ONEQ"
    }
    
    # Sector ETFs
    sector_etfs: Set[str] = {
        "XLF", "XLE", "XLK", "XLV", "XLI", "XLP", "XLY", "XLU", "XLB", "XLRE",
        "VGT", "VHT", "VFH", "VDE", "VIS", "VDC", "VAW", "VNQ"
    }
    
    # Bond ETFs
    bond_etfs: Set[str] = {
        "AGG", "BND", "VCIT", "VCSH", "VGIT", "VGLT", "LQD", "HYG", "JNK", "TLT",
        "IEF", "SHY", "TIP", "VTIP", "MUB", "BNDX"
    }
    
    # Commodity ETFs
    commodity_etfs: Set[str] = {
        "GLD", "SLV", "USO", "UNG", "DBA", "DBC", "PDBC", "IAU", "GLTR", "COMT"
    }
    
    # International/Emerging Market ETFs
    international_etfs: Set[str] = {
        "VEA", "IEFA", "EFA", "VWO", "IEMG", "VXUS", "EEM", "IXUS", "ACWI", "VEU",
        "SCHF", "SPDW", "IDEV", "EWJ", "EWZ", "FXI", "MCHI"
    }
    
    # Crypto-Related (Crypto Mining, Crypto ETFs)
    crypto_related: Set[str] = {
        "MARA", "RIOT", "COIN", "MSTR", "CLSK", "CIFR", "HUT", "BITF", "BITO", "BITI"
    }
    
    symbols: List[Dict[str, Any]] = []
    
    for a in assets:
        if not a.tradable:
            continue
        
        symbol = a.symbol
        name_upper = a.name.upper()
        
        # Asset Type Klassifizierung
        asset_type: str
        
        if symbol in crypto_related or "BITCOIN" in name_upper or "CRYPTO" in name_upper:
            asset_type = "Crypto & Blockchain"
        elif symbol in index_etfs:
            asset_type = "Index ETF"
        elif symbol in sector_etfs:
            asset_type = "Sector ETF"
        elif symbol in bond_etfs:
            asset_type = "Bond ETF"
        elif symbol in commodity_etfs:
            asset_type = "Commodity ETF"
        elif symbol in international_etfs:
            asset_type = "International ETF"
        elif "ETF" in name_upper or "FUND" in name_upper or (hasattr(a.exchange, 'value') and a.exchange.value in ["ARCA", "BATS"]):
            asset_type = "Other ETF"
        else:
            asset_type = "Stock"
        
        # Market Cap Kategorie
        market_cap: str
        if symbol in mega_cap_symbols:
            market_cap = "Mega Cap"
        elif symbol in top_traded:
            market_cap = "Large Cap"
        elif len(symbol) <= 4:
            market_cap = "Mid Cap"
        else:
            market_cap = "Small Cap"
        
        item: Dict[str, Any] = {
            "symbol": symbol,
            "name": a.name,
            "exchange": a.exchange.value if hasattr(a.exchange, 'value') else str(a.exchange),
            "type": asset_type,
            "sector": sector_map.get(symbol, "Other"),
            "market_cap": market_cap,
            "is_popular": symbol in top_traded,
        }
        
        symbols.append(item)
    
    # Alphabetisch sortieren
    symbols.sort(key=lambda x: x["symbol"])
    
    return {
        "symbols": symbols,
        "metadata": {
            "total": len(symbols),
            "types": sorted(list(set(s["type"] for s in symbols))),
            "sectors": sorted(list(set(s["sector"] for s in symbols))),
            "market_caps": ["Mega Cap", "Large Cap", "Mid Cap", "Small Cap"]
        }
    }
