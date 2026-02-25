from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class SymbolsRequest(BaseModel):
    alpaca_key:    str = ""
    alpaca_secret: str = ""

@router.post("/symbols")
def get_symbols(req: SymbolsRequest):
    """Gibt Liste aller handelbaren Symbole zurück"""
    try:
        if not req.alpaca_key or not req.alpaca_secret:
            raise HTTPException(status_code=401, detail="Keine API-Keys konfiguriert.")

        from alpaca.trading.client import TradingClient
        from alpaca.trading.requests import GetAssetsRequest
        from alpaca.trading.enums import AssetClass, AssetStatus

        trading_client = TradingClient(req.alpaca_key, req.alpaca_secret, paper=True)
        assets = trading_client.get_all_assets(GetAssetsRequest(
            asset_class=AssetClass.US_EQUITY,
            status=AssetStatus.ACTIVE
        ))

        symbols = []
        for a in assets:
            if not a.tradable or '/' in a.symbol or '.' in a.symbol or len(a.symbol) > 5:
                continue
            
            symbols.append({
                'symbol': a.symbol,
                'name': a.name,
                'exchange': a.exchange.value if hasattr(a.exchange, 'value') else str(a.exchange),
                'type': 'Stock',  # Vereinfacht, könnte erweitert werden
            })

        print(f"[Symbols] {len(symbols)} Symbole zurückgegeben")
        return symbols

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
