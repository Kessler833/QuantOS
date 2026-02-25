<<<<<<< HEAD
from fastapi import APIRouter
from backend.core.utils import load_modules
=======
from fastapi import APIRouter, HTTPException
from backend.core.utils import load_modules
from backend.data.symbols import get_all_symbols

>>>>>>> fa1e9cdf2b4f300783f443f017b80fcb337aaa49

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
