from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import health, modules, market, backtest, symbols

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router registrieren
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(modules.router, prefix="/api", tags=["modules"])
app.include_router(market.router, prefix="/api", tags=["market"])
app.include_router(backtest.router, prefix="/api", tags=["backtest"])
app.include_router(symbols.router, prefix="/api", tags=["symbols"])
