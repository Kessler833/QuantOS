from indicators import sma

def sma_cross(df, fast=20, slow=50):
    df = sma(df, fast)
    df = sma(df, slow)

    df["signal"] = 0
    df.loc[df[f"sma_{fast}"] > df[f"sma_{slow}"], "signal"] = 1
    df.loc[df[f"sma_{fast}"] < df[f"sma_{slow}"], "signal"] = -1
    return df
