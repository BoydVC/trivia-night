"""Fetch plain-text Wikipedia articles cited by questions.py into data/sources/ (one polite request at a time)."""
import json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import questions as q
OUT = os.path.join(HERE, "data", "sources")
def slug(t): return re.sub(r"[^A-Za-z0-9]+", "_", t).strip("_")
titles = sorted({x[6] for x in q.Q} | {s[0] for f in q.FINALS for s in f[5]})
FORCE = [a for a in sys.argv[1:] if not a.startswith("--")]  # titles to (re)fetch as FULL text
meta = {}
mp = os.path.join(OUT, "_index.json")
if os.path.exists(mp): meta = json.load(open(mp))
for t in titles:
    if t in meta and t not in FORCE: continue
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "prop": "extracts|info", "inprop": "url", "explaintext": 1, "redirects": 1, "titles": t, "format": "json", "formatversion": 2})
    req = urllib.request.Request(url, headers={"User-Agent": "BoydTriviaNight/1.0 (family quiz; source check)"})
    for attempt in range(6):
        try:
            p = json.load(urllib.request.urlopen(req, timeout=30))["query"]["pages"][0]; break
        except urllib.error.HTTPError as ex:
            if ex.code != 429: raise
            wait = int(ex.headers.get("Retry-After") or 0) or 10 * (attempt + 1)
            print("429, waiting", wait, flush=True); time.sleep(wait)
    else:
        print("GAVE UP", t); continue
    if p.get("missing"): print("MISSING", t); continue
    open(os.path.join(OUT, slug(t) + ".txt"), "w").write(p["extract"])
    meta[t] = {"title": p["title"], "url": p["fullurl"], "revid": p.get("lastrevid"), "fetched": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "file": slug(t) + ".txt", "chars": len(p["extract"]), "part": "full"}
    print(f"{t} -> {p['title']} ({len(p['extract'])} chars)", flush=True)
    json.dump(meta, open(mp, "w"), indent=1)
    time.sleep(2.0)
json.dump(meta, open(mp, "w"), indent=1)
