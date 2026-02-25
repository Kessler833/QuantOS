from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import datetime, timedelta
import pandas as pd
import json
import asyncio

from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from alpaca.data.enums import Adjustment, DataFeed

router = APIRouter()

class HeatmapRequest(BaseModel):
    alpaca_key:    str = ""
    alpaca_secret: str = ""

@router.post("/heatmap/stream")
async def get_heatmap_stream(req: HeatmapRequest):
    """Streaming endpoint mit Progress-Updates"""
    
    async def event_generator():
        try:
            if not req.alpaca_key or not req.alpaca_secret:
                yield f"data: {json.dumps({'error': 'Keine API-Keys konfiguriert'})}\n\n"
                return

            stock_client = StockHistoricalDataClient(req.alpaca_key, req.alpaca_secret)

            from alpaca.trading.client import TradingClient
            from alpaca.trading.requests import GetAssetsRequest
            from alpaca.trading.enums import AssetClass, AssetStatus

            # 1. Symbole laden
            yield f"data: {json.dumps({'stage': 'symbols', 'message': 'Lade Symbolliste...'})}\n\n"
            await asyncio.sleep(0)
            
            trading_client = TradingClient(req.alpaca_key, req.alpaca_secret, paper=True)
            assets = trading_client.get_all_assets(GetAssetsRequest(
                asset_class=AssetClass.US_EQUITY,
                status=AssetStatus.ACTIVE
            ))
            
            symbols = [
                a.symbol for a in assets
                if a.tradable and '/' not in a.symbol and '.' not in a.symbol and len(a.symbol) <= 5
            ]

            total_symbols = len(symbols)
            yield f"data: {json.dumps({'stage': 'symbols', 'total': total_symbols, 'message': f'{total_symbols} Symbole gefunden'})}\n\n"
            await asyncio.sleep(0)

            # 2. Bars laden in Batches
            start_dt = datetime.now() - timedelta(days=7)
            end_dt   = datetime.now() - timedelta(minutes=80)
            all_bars = {}
            batch_size = 500
            total_batches = (len(symbols) + batch_size - 1) // batch_size

            for batch_idx in range(0, len(symbols), batch_size):
                batch = symbols[batch_idx:batch_idx + batch_size]
                batch_num = batch_idx // batch_size + 1
                
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
                    
                    if not bars_df.empty and isinstance(bars_df.index, pd.MultiIndex):
                        for sym in batch:
                            try:
                                sym_df = bars_df.xs(sym, level='symbol')
                                if len(sym_df) >= 2:
                                    all_bars[sym] = sym_df
                            except KeyError:
                                pass
                    
                    loaded = len(all_bars)
                    progress = int((batch_num / total_batches) * 100)
                    
                    yield f"data: {json.dumps({{'stage': 'loading', 'loaded': loaded, 'total': total_symbols, 'batch': batch_num, 'total_batches': total_batches, 'progress': progress, 'message': f'Batch {batch_num}/{total_batches}: {loaded} Symbole geladen'}})}\n\n"
                    await asyncio.sleep(0)
                    
                except Exception as e:
                    print(f"[Heatmap] Batch {batch_num} error: {e}")
                    continue

            # 3. Veränderungen berechnen
            yield f"data: {json.dumps({'stage': 'calculating', 'message': f'Berechne Veränderungen für {len(all_bars)} Symbole...'})}\n\n"
            await asyncio.sleep(0)

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

            # 4. Fertig
            yield f"data: {json.dumps({'stage': 'done', 'symbols': results, 'count': len(results)})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/heatmap")
def get_heatmap(req: HeatmapRequest):
    """Original endpoint (ohne Streaming) - bleibt als Fallback"""
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
