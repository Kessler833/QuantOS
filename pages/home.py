import streamlit as st
from pathlib import Path

st.markdown("""
<style>
.card {
    background-color: #1e1e2e;
    border: 1px solid #313244;
    border-radius: 12px;
    padding: 24px;
    text-align: center;
}
.card:hover { border-color: #26a69a; }
.card h3  { color: #cdd6f4; margin-bottom: 8px; }
.card p   { color: #6c7086; font-size: 0.9rem; }
.card .icon { font-size: 2.5rem; margin-bottom: 12px; }
</style>
""", unsafe_allow_html=True)

st.markdown("# 📈 StrategyOS")
st.markdown("##### Deine persönliche Quant-Trading-Plattform")
st.divider()

# Automatisch alle Pages außer home als Karte anzeigen
PAGE_META = {
    "backtest":  ("📊", "Strategien auf historischen Daten testen und Performance-Metriken auswerten."),
    "markov":    ("🔗", "Marktregime mit Hidden Markov Models erkennen."),
    "optimizer": ("⚙️", "Parameter automatisch optimieren und beste Kombinationen finden."),
}

pages = sorted([
    f for f in Path("pages").glob("*.py")
    if f.stem != "home"
])

if pages:
    cols = st.columns(len(pages))
    for col, page in zip(cols, pages):
        name  = page.stem
        icon, desc = PAGE_META.get(name, ("📄", "Modul verfügbar."))
        title = name.replace("_", " ").title()
        with col:
            st.markdown(f"""
            <div class="card">
                <div class="icon">{icon}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
            </div>
            """, unsafe_allow_html=True)
            st.page_link(str(page), label=f"→ Zu {title}", use_container_width=True)

st.divider()

# Modul-Counter
st.markdown("### 📁 Geladene Module")
def count_modules(folder):
    return len([f for f in Path(folder).glob("*.py") if f.stem != "__init__"])

c1, c2 = st.columns(2)
c1.metric("Indikatoren", count_modules("indicators"))
c2.metric("Strategien",  count_modules("strategies"))
