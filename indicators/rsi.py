def rsi(df, period=14, col="close"):
    delta = df[col].diff()
    gain  = delta.clip(lower=0).rolling(period).mean()
    loss  = (-delta.clip(upper=0)).rolling(period).mean()
    df["rsi"] = 100 - (100 / (1 + gain / loss))
    return df
