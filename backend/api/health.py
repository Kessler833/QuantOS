from fastapi import APIRouter

router = APIRouter()

@router.post("/health")
async def health_check(request: dict):
    try:
        alpaca_key    = request.get("alpaca_key", "")
        alpaca_secret = request.get("alpaca_secret", "")
        
        if not alpaca_key or not alpaca_secret:
            return {"status": "ok", "alpaca_valid": False}
        
        try:
            from alpaca.trading.client import TradingClient
            client  = TradingClient(alpaca_key, alpaca_secret, paper=True)
            account = client.get_account()
            return {"status": "ok", "alpaca_valid": True, "account_status": account.status}
        except Exception as e:
            print(f"Alpaca validation error: {e}")
            return {"status": "ok", "alpaca_valid": False}
            
    except Exception as e:
        return {"status": "error", "message": str(e)}
