import streamlit as st
from pathlib import Path

st.set_page_config(page_title="StrategyOS", page_icon="📈", layout="wide")

# Icons pro Dateiname – einfach erweitern wenn neue Pages kommen
PAGE_ICONS = {
    "home":      "🏠",
    "backtest":  "📊",
    "markov":    "🔗",
    "optimizer": "⚙️",
}

# Pages-Ordner automatisch scannen
def build_navigation():
    pages_dir = Path("pages")
    home      = None
    tools     = []

    for file in sorted(pages_dir.glob("*.py")):
        name  = file.stem
        icon  = PAGE_ICONS.get(name, "📄")
        title = name.replace("_", " ").title()
        page  = st.Page(str(file), title=title, icon=icon,
                        default=(name == "home"))
        if name == "home":
            home = page
        else:
            tools.append(page)

    nav = {}
    if home:
        nav[""]      = [home]
    if tools:
        nav["Tools"] = tools

    return nav

pg = st.navigation(build_navigation())
pg.run()
