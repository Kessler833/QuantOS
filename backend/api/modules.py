from fastapi import APIRouter, HTTPException
from ..core.utils import load_modules  # ← geändert
from data.symbols import get_all_symbols


router = APIRouter()

indicators = load_modules("indicators")
strategies = load_modules("strategies")

@router.get("/modules")
def get_modules():
    return {
        "indicators": list(indicators.keys()),
        "strategies": list(strategies.keys())
    }

@router.get("/symbols")
def list_symbols(alpaca_key: str = "", alpaca_secret: str = ""):
    try:
        return get_all_symbols(alpaca_key, alpaca_secret)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
