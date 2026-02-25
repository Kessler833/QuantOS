from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import pandas as pd
import numpy as np

from alpaca.data.historical import StockHistoricalDataClient, CryptoHistoricalDataClient
from alpaca.data.requests import StockBarsRequest, CryptoBarsRequest
from alpaca.data.enums import Adjustment, DataFeed

from ..core.clients import _default_stock_client, _default_crypto_client, SYMBOL_MAP, CRYPTO_SYMBOLS, TIMEFRAME_MAP  # ← geändert
from ..core.utils import to_list, load_modules  # ← geändert


router = APIRouter()

indicators = load_modules("indicators")
strategies = load_modules("strategies")

class BacktestRequest(BaseModel):
    symbol:            str       = "SPY"
    interval:          str       = "1d"
    start:             str       = "2024-01-01"
    end:               str       = "2025-01-01"
    capital:           float     = 10000
    sma_period:        int       = 20
    strategy:          str       = ""
    active_indicators: list[str] = []
    alpaca_key:        str       = ""
    alpaca_secret:     str       = ""

@router.post("/backtest")
def run_backtest(req: BacktestRequest):
    try:
        if req.alpaca_key and req.alpaca_secret:
            stock_client  = StockHistoricalDataClient(req.alpaca_key, req.alpaca_secret)
            crypto_client = CryptoHistoricalDataClient()
        elif _default_stock_client:
            stock_client  = _default_stock_client
            crypto_client = _default_crypto_client
        else:
            raise HTTPException(
                status_code=401,
                detail="Keine Alpaca API-Keys konfiguriert. Bitte in 'Data & Synchro' eintragen."
            )

        mapped   = SYMBOL_MAP.get(req.symbol, req.symbol)
        tf       = TIMEFRAME_MAP.get(req.interval)
        start_dt = datetime.strptime(req.start, "%Y-%m-%d")
        end_dt   = datetime.strptime(req.end,   "%Y-%m-%d")

        if mapped in CRYPTO_SYMBOLS:
            bars_req = CryptoBarsRequest(
                symbol_or_symbols=mapped, timeframe=tf,
                start=start_dt, end=end_dt
            )
            bars = crypto_client.get_crypto_bars(bars_req)
        else:
            bars_req = StockBarsRequest(
                symbol_or_symbols=mapped, timeframe=tf,
                start=start_dt, end=end_dt,
                feed=DataFeed.SIP,
                adjustment=Adjustment.ALL
            )
            bars = stock_client.get_stock_bars(bars_req)

        df = bars.df
        if isinstance(df.index, pd.MultiIndex):
            df = df.reset_index(level=0, drop=True)
        df.columns = [c.lower() for c in df.columns]

        if df.empty:
            raise HTTPException(status_code=400, detail="Keine Daten. Symbol oder Zeitraum prüfen.")

        for name in req.active_indicators:
            if name in indicators:
                df = indicators[name](df)

        strategy_name = req.strategy or (list(strategies.keys())[0] if strategies else None)
        if not strategy_name or strategy_name not in strategies:
            raise HTTPException(status_code=400, detail=f"Strategie '{strategy_name}' nicht gefunden.")

        df = strategies[strategy_name](df, fast=req.sma_period, slow=50)

        if "signal" not in df.columns:
            raise HTTPException(status_code=400, detail="Strategie hat keine 'signal'-Spalte.")

        df["position"]  = df["signal"].shift(1).fillna(0)
        df["returns"]   = df["close"].pct_change()
        df["strat_ret"] = df["position"].clip(lower=0) * df["returns"]
        df["equity"]    = req.capital * (1 + df["strat_ret"]).cumprod()
        df["bh_equity"] = req.capital * (1 + df["returns"]).cumprod()

        equity_high_list, equity_low_list = [], []
        equity_vals   = df["equity"].values
        position_vals = df["position"].values
        high_vals     = df["high"].values
        low_vals      = df["low"].values
        close_vals    = df["close"].values

        for i in range(len(df)):
            eq = float(equity_vals[i])
            if position_vals[i] == 1 and close_vals[i] > 0:
                equity_high_list.append(eq * float(high_vals[i]) / float(close_vals[i]))
                equity_low_list.append( eq * float(low_vals[i])  / float(close_vals[i]))
            else:
                equity_high_list.append(eq)
                equity_low_list.append(eq)

        df["equity_high"] = equity_high_list
        df["equity_low"]  = equity_low_list

        peak          = df["equity"].cummax()
        max_dd        = ((df["equity"] - peak) / peak).min() * 100
        sharpe        = (df["strat_ret"].mean() / df["strat_ret"].std()) * np.sqrt(252) if df["strat_ret"].std() > 0 else 0
        wins          = (df["strat_ret"] > 0).sum()
        losses        = (df["strat_ret"] < 0).sum()
        wr            = wins / (wins + losses) * 100 if (wins + losses) > 0 else 0
        tot_r         = (df["equity"].iloc[-1] / req.capital - 1) * 100
        bh_r          = (df["bh_equity"].iloc[-1] / req.capital - 1) * 100
        total_trades  = int(wins + losses)
        gross_profit  = float(df.loc[df["strat_ret"] > 0, "strat_ret"].sum())
        gross_loss    = abs(float(df.loc[df["strat_ret"] < 0, "strat_ret"].sum()))
        profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else 999
        calmar        = round(float(tot_r / abs(float(max_dd))), 2) if max_dd != 0 else 0

        proj_days  = max(5, len(df) // 4)
        daily_mean = float(df["strat_ret"].mean())
        daily_std  = float(df["strat_ret"].std())
        last_eq    = float(df["equity"].iloc[-1])
        last_date  = df.index[-1]

        future_dates = []
        cur = last_date
        while len(future_dates) < proj_days:
            cur = cur + pd.Timedelta(days=1)
            if cur.weekday() < 5:
                future_dates.append(cur)

        proj_upper = [last_eq * ((1 + daily_mean + daily_std) ** i) for i in range(1, proj_days + 1)]
        proj_lower = [last_eq * ((1 + daily_mean - daily_std) ** i) for i in range(1, proj_days + 1)]
        proj_mid   = [last_eq * ((1 + daily_mean) ** i)             for i in range(1, proj_days + 1)]
        proj_dates = [d.strftime("%Y-%m-%d") for d in future_dates]

        indicator_cols = [c for c in df.columns if c.startswith("sma_") or c.startswith("ema_")]

        return {
            "chart": {
                "dates":      df.index.strftime("%Y-%m-%d %H:%M").tolist(),
                "open":       to_list(df["open"]),
                "high":       to_list(df["high"]),
                "low":        to_list(df["low"]),
                "close":      to_list(df["close"]),
                "indicators": {col: to_list(df[col]) for col in indicator_cols},
                "rsi":        to_list(df["rsi"]) if "rsi" in df.columns else []
            },
            "equity": {
                "dates":       df.index.strftime("%Y-%m-%d %H:%M").tolist(),
                "equity":      to_list(df["equity"]),
                "bh_equity":   to_list(df["bh_equity"]),
                "equity_high": to_list(df["equity_high"]),
                "equity_low":  to_list(df["equity_low"]),
                "projection": {
                    "dates": proj_dates,
                    "upper": [round(v, 2) for v in proj_upper],
                    "lower": [round(v, 2) for v in proj_lower],
                    "mid":   [round(v, 2) for v in proj_mid]
                }
            },
            "performance": {
                "end_capital":   round(float(df["equity"].iloc[-1]), 2),
                "total_return":  round(float(tot_r), 2),
                "bh_return":     round(float(bh_r), 2),
                "bh_capital":    round(float(df["bh_equity"].iloc[-1]), 2),
                "sharpe":        round(float(sharpe), 2),
                "max_drawdown":  round(float(max_dd), 2),
                "win_rate":      round(float(wr), 2),
                "total_trades":  total_trades,
                "profit_factor": profit_factor,
                "calmar":        calmar,
                "capital":       req.capital
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
