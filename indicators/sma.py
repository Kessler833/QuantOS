def sma(df, period=20, col="close"):
    df[f"sma_{period}"] = df[col].rolling(period).mean()
    return df
