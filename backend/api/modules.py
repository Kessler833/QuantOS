from fastapi import APIRouter
from backend.core.utils import load_modules

router = APIRouter()

indicators = load_modules("indicators")
strategies = load_modules("strategies")

@router.get("/modules")
def get_modules():
    return {
        "indicators": list(indicators.keys()),
        "strategies": list(strategies.keys())
    }
# ↑ GET /symbols komplett raus — der POST /symbols in api/symbols.py macht das schon
