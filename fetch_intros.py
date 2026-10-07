"""Batched fetch: lead sections (intros) for up to 20 cited articles per request, to stay gentle on Wikipedia's rate limit.
Full text (fetch_sources.py) is then only needed for questions whose evidence is outside the intro."""
import json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import questions as q
OUT = os.path.join(HERE, "data", "sources"); mp = os.path.join(OUT, "_index.json")
def slug(t): return re.sub(r"[^A-Za-z0-9]+", "_", t).strip("_")
meta = json.load(open(mp)) if os.path.exists(mp) else {}
titles = sorted({x[6] for x in q.Q} | {s[0] for f in q.FINALS for s in f[5]})
todo = [t for t in titles if t not in meta]
print(len(todo), "to fetch", flush=True)
for i in range(0, len(todo), 20):
    batch = todo[i:i+20]
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "prop": "extracts|info", "inprop": "url", "exintro": 1, "explaintext": 1, "exlimit": 20, "redirects": 1, "titles": "|".join(batch), "format": "json", "formatversion": 2})
    req = urllib.request.Request(url, headers={"User-Agent": "BoydTriviaNight/1.0 (family quiz; source check)"})
    for attempt in range(15):
        try: data = json.load(urllib.request.urlopen(req, timeout=30))["query"]; break
        except urllib.error.HTTPError as ex:
            if ex.code != 429: raise
            w = int(ex.headers.get("Retry-After") or 30); print("429 wait", w, flush=True); time.sleep(w + 2)
    back = {}
    for r in data.get("normalized", []) + data.get("redirects", []): back[r["to"]] = back.get(r["from"], r["from"])
    for p in data["pages"]:
        if p.get("missing"): print("MISSING", p.get("title")); continue
        orig = back.get(p["title"], p["title"])
        if orig not in batch: orig = next((b for b in batch if b.lower() == p["title"].lower()), p["title"])
        open(os.path.join(OUT, slug(orig) + ".txt"), "w").write(p.get("extract", ""))
        meta[orig] = {"title": p["title"], "url": p["fullurl"], "revid": p.get("lastrevid"), "fetched": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "file": slug(orig) + ".txt", "chars": len(p.get("extract", "")), "part": "intro"}
        print(orig, "->", p["title"], len(p.get("extract", "")), flush=True)
    json.dump(meta, open(mp, "w"), indent=1)
    time.sleep(3)
print("done", flush=True)
