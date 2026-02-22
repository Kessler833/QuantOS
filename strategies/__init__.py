import importlib
from pathlib import Path
from functools import wraps
import inspect

def _wrap(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        params = inspect.signature(fn).parameters
        has_var_keyword = any(
            p.kind == inspect.Parameter.VAR_KEYWORD
            for p in params.values()
        )
        if has_var_keyword:
            return fn(*args, **kwargs)
        clean = {k: v for k, v in kwargs.items() if k in params}
        return fn(*args, **clean)
    return wrapper

for file in Path(__file__).parent.glob("*.py"):
    if file.stem == "__init__":
        continue
    module = importlib.import_module(f".{file.stem}", package=__name__)
    if hasattr(module, file.stem):
        globals()[file.stem] = _wrap(getattr(module, file.stem))
