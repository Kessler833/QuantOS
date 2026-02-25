from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Dict, List
import pandas as pd
import json
import asyncio
import time

from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from alpaca.data.enums import Adjustment, DataFeed

router = APIRouter()

# ─── In-Memory Cache ─────────────────────────────────────────────────────────
_symbol_cache: Dict[str, object] = {"symbols": [], "ts": 0.0}
_bars_cache: Dict[str, object] = {
    "bars": {},
    "ts": 0.0,
    "key": "",
    "last_duration": None,  # Sekunden für letzten kompletten Load
}
SYMBOL_CACHE_TTL = 3600  # 1 Stunde
BARS_CACHE_TTL = 300     # 5 Minuten
# ─────────────────────────────────────────────────────────────────────────────


class HeatmapRequest(BaseModel):
    alpaca_key: str = ""
    alpaca_secret: str = ""


# ─── Sync-Helfer ─────────────────────────────────────────────────────────────
def _sync_fetch_symbols(key: str, secret: str) -> List[str]:
    """Holt alle handelbaren US-Aktien Symbole von Alpaca."""
    from alpaca.trading.client import TradingClient
    from alpaca.trading.requests import GetAssetsRequest
    from alpaca.trading.enums import AssetClass, AssetStatus

    tc = TradingClient(key, secret, paper=True)

    assets = tc.get_all_assets(GetAssetsRequest(
        asset_class=AssetClass.US_EQUITY,
        status=AssetStatus.ACTIVE
    ))
    symbols: List[str] = []
    for a in assets:
        if (
            getattr(a, "tradable", False)
            and "/" not in a.symbol
            and "." not in a.symbol
            and len(a.symbol) <= 5
        ):
            symbols.append(a.symbol)
    return symbols


def _sync_fetch_batch(
    client: StockHistoricalDataClient,
    batch: List[str],
    start_dt: datetime,
    end_dt: datetime
) -> Dict[str, pd.DataFrame]:
    """Holt Bar-Daten für ein Batch von Symbolen."""
    req = StockBarsRequest(
        symbol_or_symbols=batch,
        timeframe=TimeFrame.Day,
        start=start_dt,
        end=end_dt,
        feed=DataFeed.SIP,
        adjustment=Adjustment.ALL
    )
    try:
        df = client.get_stock_bars(req).df
    except Exception as e:
        print(f"[Heatmap] get_stock_bars error: {e}")
        return {}

    result: Dict[str, pd.DataFrame] = {}
    if not df.empty and isinstance(df.index, pd.MultiIndex):
        for sym in batch:
            try:
                sym_df = df.xs(sym, level="symbol")
                if len(sym_df) >= 2:
                    result[sym] = sym_df
            except KeyError:
                continue
    return result
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/heatmap/stream")
async def get_heatmap_stream(req: HeatmapRequest):
    """Streaming endpoint mit Progress-Updates, ETA und Caching."""

    async def event_generator():
        try:
            if not req.alpaca_key or not req.alpaca_secret:
                yield "data: " + json.dumps(
                    {"error": "Keine API-Keys konfiguriert"}
                ) + "\n\n"
                return

            stock_client = StockHistoricalDataClient(
                req.alpaca_key,
                req.alpaca_secret
            )
            now = time.time()

            # ── Stage 1: Symbole (Cache) ─────────────────────────────────────
            yield "data: " + json.dumps(
                {"stage": "symbols", "message": "Lade Symbolliste..."}
            ) + "\n\n"

            if (
                now - float(_symbol_cache["ts"]) > SYMBOL_CACHE_TTL
                or not _symbol_cache["symbols"]
            ):
                symbols = await asyncio.to_thread(
                    _sync_fetch_symbols, req.alpaca_key, req.alpaca_secret
                )
                _symbol_cache["symbols"] = symbols
                _symbol_cache["ts"] = now
            else:
                symbols = _symbol_cache["symbols"]  # type: ignore

            total_symbols = len(symbols)
            yield "data: " + json.dumps(
                {
                    "stage": "symbols",
                    "total": total_symbols,
                    "message": f"{total_symbols} Symbole gefunden",
                }
            ) + "\n\n"

            # ── Stage 2: Bars laden (Cache + sequentiell mit ETA) ────────────
            cache_key = req.alpaca_key[:8]

            if (
                now - float(_bars_cache["ts"]) < BARS_CACHE_TTL
                and _bars_cache["key"] == cache_key
                and _bars_cache["bars"]
            ):
                all_bars = _bars_cache["bars"]  # type: ignore
                yield "data: " + json.dumps(
                    {
                        "stage": "loading-cache",
                        "loaded": len(all_bars),
                        "total": total_symbols,
                        "progress": 100,
                        "message": f"Cache: {len(all_bars)} Symbole",
                    }
                ) + "\n\n"
            else:
                # 370 Tage Window für 1Y
                start_dt = datetime.now() - timedelta(days=370)
                end_dt = datetime.now() - timedelta(minutes=80)
                all_bars: Dict[str, pd.DataFrame] = {}

                batch_size = 500
                batches: List[List[str]] = []
                for i in range(0, len(symbols), batch_size):
                    batches.append(symbols[i:i + batch_size])
                total_batches = len(batches)

                load_start_time = time.time()

                # Erste ETA-Schätzung aus vorherigem Lauf (falls vorhanden)
                initial_eta = None
                if _bars_cache.get("last_duration"):
                    try:
                        initial_eta = int(_bars_cache["last_duration"])  # type: ignore
                    except Exception:
                        initial_eta = None

                yield "data: " + json.dumps(
                    {
                        "stage": "loading-init",
                        "total_batches": total_batches,
                        "message": "Starte Datenladen...",
                        "eta_seconds": initial_eta,
                    }
                ) + "\n\n"

                for idx, batch in enumerate(batches, start=1):
                    # Event: Batch startet
                    yield "data: " + json.dumps(
                        {
                            "stage": "batch_start",
                            "batch": idx,
                            "total_batches": total_batches,
                            "symbols_in_batch": len(batch),
                            "message": f"Starte Batch {idx}/{total_batches}",
                        }
                    ) + "\n\n"

                    try:
                        batch_result = await asyncio.to_thread(
                            _sync_fetch_batch,
                            stock_client,
                            batch,
                            start_dt,
                            end_dt,
                        )
                    except Exception as e:
                        print(f"[Heatmap] Batch {idx} error: {e}")
                        batch_result = {}

                    all_bars.update(batch_result)

                    if total_batches > 0:
                        progress = int(float(idx) / float(total_batches) * 100.0)
                    else:
                        progress = 100

                    elapsed = time.time() - load_start_time
                    if idx > 0:
                        avg_batch_time = elapsed / float(idx)
                        remaining = avg_batch_time * float(total_batches - idx)
                        eta_seconds = int(remaining)
                    else:
                        eta_seconds = None

                    msg = f"{idx}/{total_batches} Batches: {len(all_bars)} Symbole"
                    yield "data: " + json.dumps(
                        {
                            "stage": "batch_done",
                            "batch": idx,
                            "total_batches": total_batches,
                            "loaded": len(all_bars),
                            "total": total_symbols,
                            "progress": progress,
                            "eta_seconds": eta_seconds,
                            "message": msg,
                        }
                    ) + "\n\n"

                _bars_cache["bars"] = all_bars
                _bars_cache["ts"] = now
                _bars_cache["key"] = cache_key
                _bars_cache["last_duration"] = time.time() - load_start_time

            # ── Stage 3: Berechnung ───────────────────────────────────────────
            yield "data: " + json.dumps(
                {
                    "stage": "calculating",
                    "message": f"Berechne für {len(all_bars)} Symbole...",
                }
            ) + "\n\n"

            cutoffs = {
                "1D": datetime.now() - timedelta(days=2),
                "1W": datetime.now() - timedelta(days=7),
                "1M": datetime.now() - timedelta(days=30),
                "1Y": datetime.now() - timedelta(days=365),
            }

            results: Dict[str, Dict[str, float]] = {}
            for sym, df in all_bars.items():
                try:
                    last_close = float(df["close"].iloc[-1])
                except Exception:
                    continue

                changes: Dict[str, float] = {}
                for tf, cutoff in cutoffs.items():
                    try:
                        ts = pd.Timestamp(cutoff).tz_localize("UTC")
                        valid = df[df.index >= ts]
                        if not valid.empty:
                            open_price = float(valid["open"].iloc[0])
                            if open_price > 0.0:
                                pct = (last_close - open_price) / open_price * 100.0
                                changes[tf] = round(pct, 2)
                            else:
                                changes[tf] = None  # type: ignore
                        else:
                            changes[tf] = None  # type: ignore
                    except Exception:
                        changes[tf] = None  # type: ignore

                res_entry: Dict[str, float] = {"price": round(last_close, 2)}
                for k, v in changes.items():
                    res_entry[k] = v  # type: ignore
                results[sym] = res_entry

            yield "data: " + json.dumps(
                {"stage": "done", "symbols": results, "count": len(results)}
            ) + "\n\n"

        except Exception as e:
            yield "data: " + json.dumps({"error": str(e)}) + "\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/heatmap")
def get_heatmap(req: HeatmapRequest):
    """Original Endpoint (ohne Streaming) – Fallback, 370-Tage-Window."""
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

        symbols: List[str] = []
        for a in assets:
            if (
                getattr(a, "tradable", False)
                and "/" not in a.symbol
                and "." not in a.symbol
                and len(a.symbol) <= 5
            ):
                symbols.append(a.symbol)

        start_dt = datetime.now() - timedelta(days=370)
        end_dt = datetime.now() - timedelta(minutes=80)
        all_bars: Dict[str, pd.DataFrame] = {}

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
                            sym_df = bars_df.xs(sym, level="symbol")
                            if len(sym_df) >= 2:
                                all_bars[sym] = sym_df
                        except KeyError:
                            continue
                print(f"[Heatmap] Batch {i // 500 + 1}: {len(all_bars)} Symbole geladen")
            except Exception as e:
                print(f"[Heatmap] Batch {i} error: {e}")
                continue

        cutoffs = {
            "1D": datetime.now() - timedelta(days=2),
            "1W": datetime.now() - timedelta(days=7),
            "1M": datetime.now() - timedelta(days=30),
            "1Y": datetime.now() - timedelta(days=365),
        }

        results: Dict[str, Dict[str, float]] = {}
        for sym, df in all_bars.items():
            try:
                last_close = float(df["close"].iloc[-1])
            except Exception:
                continue

            changes: Dict[str, float] = {}
            for tf, cutoff in cutoffs.items():
                try:
                    ts = pd.Timestamp(cutoff).tz_localize("UTC")
                    valid = df[df.index >= ts]
                    if not valid.empty:
                        open_price = float(valid["open"].iloc[0])
                        if open_price > 0.0:
                            pct = (last_close - open_price) / open_price * 100.0
                            changes[tf] = round(pct, 2)
                        else:
                            changes[tf] = None  # type: ignore
                    else:
                        changes[tf] = None  # type: ignore
                except Exception:
                    changes[tf] = None  # type: ignore

            res_entry: Dict[str, float] = {"price": round(last_close, 2)}
            for k, v in changes.items():
                res_entry[k] = v  # type: ignore
            results[sym] = res_entry

        return {"symbols": results, "count": len(results)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
