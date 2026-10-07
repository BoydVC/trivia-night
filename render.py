"""data/boards.json + web/ -> dist/trivia-night-snapshot.html (one self-contained offline file; fonts subset + inlined)."""
import base64, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = [("TN Display", "Anton-Regular.ttf", "400"), ("TN Cond", "BarlowCondensed-Bold.ttf", "700"), ("TN Cond", "BarlowCondensed-SemiBold.ttf", "600"), ("TN Body", "Barlow-Medium.ttf", "400 600")]

def font(fn):
    src = os.path.join(HERE, "web", "fonts", fn); out = src.replace(".ttf", ".subset.woff")
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(src):
        from fontTools import subset
        o = subset.Options(); o.flavor = "woff"; o.layout_features = ["*"]
        f = subset.load_font(src, o); s = subset.Subsetter(o)
        s.populate(unicodes=list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x00B7, 0x2212, 0x2713, 0x2717, 0x2605, 0x21B6, 0x25B6, 0x23CE, 0x2423, 0x29C9])
        s.subset(f); subset.save_font(f, out, o)
    return base64.b64encode(open(out, "rb").read()).decode()

def page():
    data = json.load(open(os.path.join(HERE, "data", "boards.json")))
    ff = "".join(f"@font-face{{font-family:'{fam}';src:url(data:font/woff;base64,{font(fn)}) format('woff');font-weight:{w};font-display:block}}\n" for fam, fn, w in FONTS)
    css = open(os.path.join(HERE, "web", "style.css")).read(); js = open(os.path.join(HERE, "web", "app.js")).read()
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>Boyd Family Trivia Night</title><style>{ff}{css}</style></head><body><div id="app"></div>
<script>window.TN_DATA={blob};</script><script>{js}</script></body></html>"""

if __name__ == "__main__":
    os.makedirs(os.path.join(HERE, "dist"), exist_ok=True)
    out = os.path.join(HERE, "dist", "trivia-night-snapshot.html")
    html = page(); open(out + ".tmp", "w").write(html); os.replace(out + ".tmp", out)
    print(out, f"{len(html)/1024:.0f} KB")
