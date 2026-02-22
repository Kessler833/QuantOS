import streamlit as st
import yfinance as yf
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np
import importlib
from pathlib import Path
from streamlit_elements import elements, dashboard, mui

# ── AUTOMATISCHES LADEN ──────────────────────────────────
def load_modules(folder):
    modules = {}
    for file in Path(folder).glob("*.py"):
        if file.stem == "__init__":
            continue
        mod = importlib.import_module(f"{folder}.{file.stem}")
        if hasattr(mod, file.stem):
            modules[file.stem] = getattr(mod, file.stem)
    return modules

indicators = load_modules("indicators")
strategies = load_modules("strategies")

# ── SESSION STATE INIT ────────────────────────────────────
if "active_indicators" not in st.session_state:
    st.session_state.active_indicators = []
if "df" not in st.session_state:
    st.session_state.df = None

# ── SIDEBAR ──────────────────────────────────────────────
with st.sidebar:
    st.header("⚙️ Einstellungen")
    symbol   = st.text_input("Symbol", value="EURUSD=X")
    interval = st.selectbox("Timeframe", ["1d","1h","30m","15m","5m"])
    start    = st.date_input("Von", value=pd.to_datetime("2024-01-01"))
    end      = st.date_input("Bis",  value=pd.to_datetime("2025-01-01"))

    st.divider()
    st.subheader("📐 Indikator hinzufügen")
    available = [n for n in indicators if n not in st.session_state.active_indicators]
    selected  = st.selectbox("Indikator", available if available else ["– alle hinzugefügt –"])
    if st.button("➕ Hinzufügen", use_container_width=True):
        if selected in indicators:
            st.session_state.active_indicators.append(selected)
            st.rerun()

    # Aktive Indikatoren anzeigen mit X zum Entfernen
    if st.session_state.active_indicators:
        st.markdown("**Aktiv:**")
        for name in list(st.session_state.active_indicators):
            col1, col2 = st.columns([3, 1])
            col1.markdown(f"• {name.upper()}")
            if col2.button("✕", key=f"rm_{name}"):
                st.session_state.active_indicators.remove(name)
                st.rerun()

    st.divider()
    st.subheader("🧪 Strategie")
    sma_per       = st.slider("SMA Periode", 5, 200, 20)
    strategy_name = st.selectbox("Strategie", list(strategies.keys()))
    capital       = st.number_input("Startkapital (€)", value=10000)
    run           = st.button("▶ Backtest starten", use_container_width=True)

# ── DATEN LADEN ──────────────────────────────────────────
@st.cache_data
def load_data(symbol, start, end, interval):
    df = yf.download(
        symbol, start=start, end=end,
        interval=interval, auto_adjust=True,
        multi_level_index=False
    )
    df.columns = [c.lower() for c in df.columns]
    return df

if run:
    with st.spinner("Lade Daten..."):
        df = load_data(symbol, str(start), str(end), interval)

    if df.empty:
        st.error("Keine Daten. Symbol oder Zeitraum prüfen.")
        st.stop()

    for name in st.session_state.active_indicators:
        df = indicators[name](df)

    df = strategies[strategy_name](df, fast=sma_per, slow=50)

    if "signal" not in df.columns:
        st.error(f"Strategie '{strategy_name}' hat keine 'signal'-Spalte gesetzt.")
        st.stop()

    df["position"]  = df["signal"].shift(1).fillna(0)
    df["returns"]   = df["close"].pct_change()
    df["strat_ret"] = df["position"].clip(lower=0) * df["returns"]
    df["equity"]    = capital * (1 + df["strat_ret"]).cumprod()
    df["bh_equity"] = capital * (1 + df["returns"]).cumprod()

    peak   = df["equity"].cummax()
    max_dd = ((df["equity"] - peak) / peak).min() * 100
    sharpe = (df["strat_ret"].mean() / df["strat_ret"].std()) * np.sqrt(252) if df["strat_ret"].std() > 0 else 0
    wins   = (df["strat_ret"] > 0).sum()
    losses = (df["strat_ret"] < 0).sum()
    wr     = wins / (wins + losses) * 100 if (wins + losses) > 0 else 0
    tot_r  = (df["equity"].iloc[-1] / capital - 1) * 100
    bh_r   = (df["bh_equity"].iloc[-1] / capital - 1) * 100

    st.session_state.df      = df
    st.session_state.tot_r   = tot_r
    st.session_state.bh_r    = bh_r
    st.session_state.sharpe  = sharpe
    st.session_state.max_dd  = max_dd
    st.session_state.wr      = wr
    st.session_state.capital = capital

# ── DASHBOARD LAYOUT MIT VERSCHIEBBAREN FENSTERN ─────────
if st.session_state.df is not None:
    df      = st.session_state.df
    capital = st.session_state.capital

    layout = [
        dashboard.Item("metriken",  0, 0, 12, 2,  isResizable=True),
        dashboard.Item("chart",     0, 2, 8,  6,  isResizable=True),
        dashboard.Item("equity",    8, 2, 4,  6,  isResizable=True),
    ]

    with elements("backtest_dashboard"):
        with dashboard.Grid(layout, draggableHandle=".drag-handle"):

            # ── METRIKEN ──────────────────────────────────
            with mui.Paper(key="metriken", sx={"p": 2, "bgcolor": "#1e1e2e"}):
                mui.Typography("≡ Performance", className="drag-handle",
                               sx={"cursor": "move", "mb": 1, "color": "#cdd6f4"})
                with mui.Stack(direction="row", spacing=3):
                    for label, value in [
                        ("Endkapital",   f"€{df['equity'].iloc[-1]:,.0f} ({st.session_state.tot_r:.1f}%)"),
                        ("Buy & Hold",   f"€{df['bh_equity'].iloc[-1]:,.0f} ({st.session_state.bh_r:.1f}%)"),
                        ("Sharpe",       f"{st.session_state.sharpe:.2f}"),
                        ("Max Drawdown", f"{st.session_state.max_dd:.1f}%"),
                        ("Win Rate",     f"{st.session_state.wr:.1f}%"),
                    ]:
                        with mui.Box(sx={"bgcolor": "#313244", "p": 1.5, "borderRadius": 2, "minWidth": 140}):
                            mui.Typography(label, sx={"fontSize": 11, "color": "#6c7086"})
                            mui.Typography(value, sx={"fontSize": 16, "fontWeight": "bold", "color": "#cdd6f4"})

            # ── CANDLESTICK CHART ──────────────────────────
            with mui.Paper(key="chart", sx={"p": 2, "bgcolor": "#1e1e2e"}):
                mui.Typography("≡ Chart", className="drag-handle",
                               sx={"cursor": "move", "mb": 1, "color": "#cdd6f4"})
                show_rsi = "rsi" in st.session_state.active_indicators and "rsi" in df.columns
                rows     = 1 + int(show_rsi)
                heights  = [0.75] + ([0.25] if show_rsi else [])
                fig      = make_subplots(rows=rows, cols=1, shared_xaxes=True,
                                         row_heights=heights, vertical_spacing=0.02)

                fig.add_trace(go.Candlestick(
                    x=df.index, open=df["open"], high=df["high"],
                    low=df["low"], close=df["close"], name="Preis",
                    increasing_line_color="#26a69a", decreasing_line_color="#ef5350"
                ), row=1, col=1)

                sma_colors = ["orange", "royalblue", "magenta", "yellow"]
                for i, col in enumerate([c for c in df.columns if c.startswith("sma_") or c.startswith("ema_")]):
                    fig.add_trace(go.Scatter(
                        x=df.index, y=df[col],
                        line=dict(color=sma_colors[i % len(sma_colors)], width=1.5),
                        name=col.upper()
                    ), row=1, col=1)

                if show_rsi:
                    fig.add_trace(go.Scatter(x=df.index, y=df["rsi"],
                        line=dict(color="#ab47bc", width=1.5), name="RSI"), row=2, col=1)
                    fig.add_hline(y=70, line_dash="dot", line_color="red",   row=2, col=1)
                    fig.add_hline(y=30, line_dash="dot", line_color="green", row=2, col=1)

                fig.update_layout(template="plotly_dark", height=400,
                                  xaxis_rangeslider_visible=False, margin=dict(t=10,b=10),
                                  legend=dict(orientation="h", y=1.02))
                st.plotly_chart(fig, use_container_width=True)

            # ── EQUITY KURVE ──────────────────────────────
            with mui.Paper(key="equity", sx={"p": 2, "bgcolor": "#1e1e2e"}):
                mui.Typography("≡ Equity Kurve", className="drag-handle",
                               sx={"cursor": "move", "mb": 1, "color": "#cdd6f4"})
                fig2 = go.Figure()
                fig2.add_trace(go.Scatter(x=df.index, y=df["equity"],
                    fill="tozeroy", fillcolor="rgba(38,166,154,0.15)",
                    line=dict(color="#26a69a", width=2), name="Strategie"))
                fig2.add_trace(go.Scatter(x=df.index, y=df["bh_equity"],
                    line=dict(color="gray", width=1.5, dash="dot"), name="Buy & Hold"))
                fig2.update_layout(template="plotly_dark", height=380,
                                   margin=dict(t=10,b=10),
                                   xaxis_rangeslider_visible=False)
                st.plotly_chart(fig2, use_container_width=True)
