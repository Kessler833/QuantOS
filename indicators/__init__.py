import importlib
from pathlib import Path
from functools import wraps

def _wrap(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        # unbekannte kwargs rausfiltern bevor sie die Funktion erreichen
        import inspect
        valid = inspect.signature(fn).parameters
        clean = {k: v for k, v in kwargs.items() if k in valid}
        return fn(*args, **clean)
    return wrapper

for file in Path(__file__).parent.glob("*.py"):
    if file.stem == "__init__":
        continue
    module = importlib.import_module(f".{file.stem}", package=__name__)
    if hasattr(module, file.stem):
        globals()[file.stem] = _wrap(getattr(module, file.stem))
