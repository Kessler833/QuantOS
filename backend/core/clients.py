from alpaca.data.historical import StockHistoricalDataClient, CryptoHistoricalDataClient
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit

_default_stock_client  = None
_default_crypto_client = CryptoHistoricalDataClient()

SYMBOL_MAP = {
    "^GSPC": "SPY",  "^SPX": "SPY",  "^DJI":  "DIA",
    "^IXIC": "QQQ",  "^NDX": "QQQ",
    "BTC-USD": "BTC/USD", "ETH-USD": "ETH/USD",
}

CRYPTO_SYMBOLS = {"BTC/USD", "ETH/USD", "SOL/USD", "LTC/USD", "DOGE/USD"}

TIMEFRAME_MAP = {
    "1d":  TimeFrame.Day,
    "1h":  TimeFrame.Hour,
    "30m": TimeFrame(30, TimeFrameUnit.Minute),
    "15m": TimeFrame(15, TimeFrameUnit.Minute),
    "5m":  TimeFrame(5,  TimeFrameUnit.Minute),
    "1m":  TimeFrame.Minute,
}
