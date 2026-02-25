import pandas as pd
import importlib
from pathlib import Path

def to_list(series):
    return [None if pd.isna(x) else round(float(x), 5) for x in series]

def load_modules(folder):
    modules = {}
    for file in Path(folder).glob("*.py"):
        if file.stem == "__init__":
            continue
        mod = importlib.import_module(f"{folder}.{file.stem}")
        if hasattr(mod, file.stem):
            modules[file.stem] = getattr(mod, file.stem)
    return modules
