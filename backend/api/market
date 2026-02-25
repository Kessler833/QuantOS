from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
import pandas as pd

from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from alpaca.data.enums import Adjustment, DataFeed

router = APIRouter()

class HeatmapRequest(BaseModel):
    alpaca_key:    str = ""
    alpaca_secret: str = ""

@router.post("/heatmap")
def get_heatmap(req: HeatmapRequest):
    try:
        if not req.alpaca_key or not req.alpaca_secret:
            raise HTTPException(status_code=401, detail="Keine API-Keys konfiguriert.")

        stock_client = StockHistoricalDataClient(req.alpaca_key, req.alpaca_secret)

        from alpaca.trading.client import TradingClient
        from alpaca.trading.requests import GetAssetsRequest
        from alpaca.trading.enums import AssetClass, AssetStatus

        trading_client = TradingClient(req.alpaca_key, req.alpaca_secret, paper=True)
        assets = trading_client.get_all_assets(GetAssetsRequest(
            asset_class=AssetClass.US_EQUITY,
            status=AssetStatus.ACTIVE
        ))
        
        symbols = [
            a.symbol for a in assets
            if a.tradable and '/' not in a.symbol and '.' not in a.symbol and len(a.symbol) <= 5
        ]

        start_dt = datetime.now() - timedelta(days=366)
        end_dt   = datetime.now() - timedelta(minutes=80)
        all_bars = {}

        for i in range(0, len(symbols), 500):
            batch = symbols[i:i + 500]
            try:
                bars_req = StockBarsRequest(
                    symbol_or_symbols=batch,
                    timeframe=TimeFrame.Day,
                    start=start_dt,
                    end=end_dt,
                    feed=DataFeed.SIP,
                    adjustment=Adjustment.ALL
                )
                bars_df = stock_client.get_stock_bars(bars_req).df
                if bars_df.empty:
                    continue
                if isinstance(bars_df.index, pd.MultiIndex):
                    for sym in batch:
                        try:
                            sym_df = bars_df.xs(sym, level='symbol')
                            if len(sym_df) >= 2:
                                all_bars[sym] = sym_df
                        except KeyError:
                            pass
                print(f"[Heatmap] Batch {i//500 + 1}: {len(all_bars)} Symbole geladen")
            except Exception as e:
                print(f"[Heatmap] Batch {i} error: {e}")
                continue

        cutoffs = {
            '1D': datetime.now() - timedelta(days=2),
            '1W': datetime.now() - timedelta(days=7),
            '1M': datetime.now() - timedelta(days=30),
            '1Y': datetime.now() - timedelta(days=365),
        }

        results = {}
        for sym, df in all_bars.items():
            last_close = float(df['close'].iloc[-1])
            changes    = {}
            for tf, cutoff in cutoffs.items():
                try:
                    ts    = pd.Timestamp(cutoff).tz_localize('UTC')
                    valid = df[df.index >= ts]
                    if not valid.empty and float(valid['open'].iloc[0]) > 0:
                        changes[tf] = round(
                            (last_close - float(valid['open'].iloc[0])) / float(valid['open'].iloc[0]) * 100, 2
                        )
                    else:
                        changes[tf] = None
                except Exception:
                    changes[tf] = None

            results[sym] = {'price': round(last_close, 2), **changes}

        return {'symbols': results, 'count': len(results)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
