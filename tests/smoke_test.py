"""Smoke test for Boyd Family Trivia Night. Run: python3 tests/smoke_test.py  (exit 1 on any failure)."""
import json, os, re, subprocess, sys, tempfile, urllib.request
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, HERE)
import questions as Q
FAILS, N = [], [0]
def check(ok, msg):
    N[0] += 1
    if not ok: FAILS.append(msg)
norm = lambda s: re.sub(r"\s+", " ", s.replace("\u2009", " ").replace("\xa0", " ")).strip()
low = lambda s: norm(s).lower()

D = json.load(open(os.path.join(HERE, "data", "boards.json")))
IDX = json.load(open(os.path.join(HERE, "data", "sources", "_index.json")))
TEXT = {m["title"]: norm(open(os.path.join(HERE, "data", "sources", m["file"])).read()) for t, m in IDX.items()}  # keyed by resolved article title (redirects followed)
cats = [c["key"] for c in D["categories"]]
check(cats == ["md", "bal", "soc", "space", "sci", "word"], "six categories in order")
check(D["values"] == [200, 400, 600, 800, 1000], "values 200..1000")
check(len(D["boards"]) == 3, "three boards")
# words that must never appear in a clue (family names / home town / kids' schools & clubs). Questions are public trivia only.
PRIVATE = ["Millersville", "Boyd", "Miranda", "Char", "Charlotte", "Vic", "Victoria", "Victor", "Severna", "Crofton", "Arundel High", "travel team", "our family", "your dad", "your mom"]

def check_sources(item, where, subject_ok):
    srcs = item.get("sources") or []
    check(len(srcs) >= 1, f"{where}: has a source")
    for s in srcs:
        check(s.get("url", "").startswith("https://en.wikipedia.org/wiki/"), f"{where}: wikipedia url")
        check(isinstance(s.get("revid"), int) and s["revid"] > 0, f"{where}: revid")
        check(s.get("publisher") == "Wikipedia", f"{where}: publisher")
        t = s.get("title"); check(t in TEXT, f"{where}: source text stored for {t}")
        q = norm(s.get("quote", "")); check(len(q) > 20, f"{where}: quote present")
        if t in TEXT: check(q in TEXT[t], f"{where}: quote is verbatim in stored article text ({t})")
    names = [item["answer"]] + item.get("accept", [])
    in_quote = any(low(n) in low(s.get("quote", "")) for s in srcs for n in names)
    in_title = any(low(n) in low(s.get("title", "")) or low(s.get("title", "")) in low(n) for s in srcs for n in names)
    proofs = [low(p) for p in PROOFS.get(item["id"], []) if p]
    in_proof = proofs and all(any(p in low(s.get("quote", "")) for s in srcs) for p in proofs)
    check(in_quote or (subject_ok and in_title) or in_proof, f"{where}: quote supports answer '{item['answer']}'")

def check_answer(item, where, board_answers):
    a = item["answer"].strip()
    check(bool(a) and len(a) <= 40, f"{where}: answer non-empty and short")
    check(" or " not in f" {a.lower()} " and "/" not in a and ";" not in a, f"{where}: answer is a single unambiguous response ('{a}')")
    clue = low(item["clue"])
    check(not re.search(r"\b" + re.escape(a.lower()) + r"\b", clue), f"{where}: answer not given away in clue")
    check(a.lower() not in board_answers, f"{where}: answer unique on its board ('{a}')"); board_answers.add(a.lower())
    check(len(item["clue"]) >= 25 and len(item["clue"]) <= 200, f"{where}: clue length sane")
    for w in PRIVATE: check(not re.search(r"\b" + re.escape(w.lower()) + r"\b", clue), f"{where}: no family/private term '{w}' in clue")
    for alt in item.get("accept", []): check(alt.strip() and alt.lower() != a.lower(), f"{where}: accept alias '{alt}' sane")

PROOFS = {}
for (b, cat, tier, clue, ans, acc, title, kw, proof) in Q.Q: PROOFS[f"b{b}-{cat}-{tier}"] = [proof] if proof else []
for f in Q.FINALS: PROOFS[f"b{f[0]}-final"] = []
total = 0
for b in D["boards"]:
    seen, cells = set(), b["cells"]
    check(len(cells) == 30, f"board {b['id']}: 30 cells")
    grid = {(c["cat"], c["value"]) for c in cells}
    check(grid == {(k, v) for k in cats for v in D["values"]}, f"board {b['id']}: every category x value filled once")
    check(len({c["id"] for c in cells}) == 30, f"board {b['id']}: unique ids")
    for c in cells:
        w = f"{c['id']} ({c['answer']})"; total += 1
        check_sources(c, w, c.get("subjectArticle", False)); check_answer(c, w, seen)
    f = b["final"]; total += 1
    f.setdefault("id", f"b{b['id']}-final")
    check(f["category"] and f["clue"] and f["answer"], f"board {b['id']}: final complete")
    check_sources(f, f"board {b['id']} final", False); check_answer(f, f"board {b['id']} final", seen)
check(total == 93, f"93 questions total (got {total})")
# replay value: no answer repeated across the three boards' clues
allans = [low(c["answer"]) for b in D["boards"] for c in b["cells"]]
check(len(allans) - len(set(allans)) <= 2, f"answers mostly unique across boards (dupes: {sorted({a for a in allans if allans.count(a) > 1})})")

# Daily Double rule (mirrors fresh() in app.js): 2 cells, value >= 600, different categories -> always possible
for b in D["boards"]:
    pool = {c["cat"] for c in b["cells"] if c["value"] >= 600}
    check(len(pool) >= 2, f"board {b['id']}: Daily Double pool spans >=2 categories")

# snapshot: self-contained + actually renders in headless Chrome
snap = os.path.join(HERE, "dist", "trivia-night-snapshot.html")
check(os.path.exists(snap), "snapshot exists")
if os.path.exists(snap):
    html = open(snap).read()
    check(not re.search(r'(src|href)=["\']https?://', html) and "@import" not in html and "fonts.googleapis" not in html, "snapshot has no external resources")
    check(html.count("data:font/woff;base64,") == 4, "fonts inlined")
    check("window.TN_DATA=" in html, "data inlined")
    def dom(q):
        with tempfile.TemporaryDirectory() as prof:
            r = subprocess.run(["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu", "--mute-audio", f"--user-data-dir={prof}",
                                "--virtual-time-budget=1500", "--dump-dom", f"file://{snap}?{q}"], capture_output=True, text=True, timeout=90)
        return r.stdout
    d1 = dom("demo=board&b=2")
    check(d1.count('class="cell') >= 30 and "Purple Reign" in d1 and all(c["name"].replace("&", "&amp;") in d1 for c in D["categories"]), "board renders 30 cells + 6 category names")
    d2 = dom("demo=answer&b=1")
    c = next(c for c in D["boards"][0]["cells"] if c["cat"] == "space" and c["value"] == 600)
    check(c["answer"] in d2 and "wikipedia.org" in d2, "answer screen renders answer + source link")
    d3 = dom("host=1&demo=answer&b=1")
    check("HOST VIEW" in d3 and str(c["sources"][0]["revid"]) in d3, "host view renders with source revid")
    d4 = dom("demo=winner&b=1")
    check("Miranda" in d4 and "confetti" in d4, "champion screen renders")

# server (only if it's running)
try:
    body = urllib.request.urlopen("http://127.0.0.1:4253/healthz", timeout=3).read()
    check(b'"ok"' in body, "server /healthz")
    page = urllib.request.urlopen("http://127.0.0.1:4253/?host=1", timeout=5).read()
    check(b"window.TN_DATA=" in page, "server serves the game")
except OSError:
    print("(server not running on 4253; skipped server checks)")

print(f"{N[0] - len(FAILS)}/{N[0]} checks passed; {total} questions ({total - 3} board clues + 3 finals)")
for f in FAILS[:60]: print("  FAIL", f)
sys.exit(1 if FAILS else 0)
