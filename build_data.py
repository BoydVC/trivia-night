"""questions.py + data/sources (Wikipedia plain text) -> data/boards.json with a verbatim evidence quote per question.
A question is only kept if one sentence of its cited article contains all its keywords AND the answer (proof)."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import questions as q
SRC = os.path.join(HERE, "data", "sources")
META = json.load(open(os.path.join(SRC, "_index.json")))

def norm(s): return re.sub(r"\s+", " ", s.replace("\u2009", " ").replace("\xa0", " ")).strip()
ABBR = re.compile(r"\b(St|Mr|Mrs|Dr|Jr|Sr|No|vs|Mt|Ft|U\.S|D\.C|[A-Z])\.(?=\s)")
def sentences(text):
    text = norm(re.sub(r"=+ [^=]+ =+", ". ", text))
    text = ABBR.sub(lambda m: m.group(1) + "\u2024", text)  # protect "St. Louis", "Robert H. Goddard", "U.S. Navy"
    return [re.sub(r"([.!?\"”])\s*\.$", r"\1", s.strip().replace("\u2024", ".")) for s in re.split(r"(?<=[.!?])\s+(?=[A-Z\"“(])", text) if s.strip()]

_cache = {}
def evidence(title, kw, proof, subject=False):
    """subject=True: the cited article is ABOUT the answer (answer is in the article title), so the sentence only
    needs the keywords; otherwise the sentence must also contain the answer text (proof)."""
    if title not in META: return None, "source not fetched"
    if title not in _cache: _cache[title] = sentences(open(os.path.join(SRC, META[title]["file"])).read())
    for s in _cache[title]:
        lo = s.lower()
        if all(k.lower() in lo for k in kw) and (subject or proof.lower() in lo) and len(s) < 900:
            return s, None
    return None, f"no sentence with {kw} + {proof!r}"

def src_obj(title, quote):
    m = META[title]
    return {"title": m["title"], "url": m["url"], "revid": m["revid"], "quote": quote, "publisher": "Wikipedia"}

def build():
    out = {"categories": [{"key": k, "name": n} for k, n in q.CATS], "values": q.VALUES, "boards": [], "_note": "Every clue cites a public Wikipedia article; quote = verbatim sentence from that article (revid noted) that contains the answer."}
    fails = []
    for b, bname in q.BOARDS.items():
        board = {"id": b, "name": bname, "cells": [], "final": None}
        for (bb, cat, tier, clue, ans, acc, title, kw, proof) in q.Q:
            if bb != b: continue
            names = [ans] + list(acc) + ([proof] if proof else [])
            subject = any(n.lower() in META.get(title, {}).get("title", title).lower() for n in names if len(n) > 2)
            quote, err = evidence(title, kw, proof or ans, subject)
            if err: fails.append(f"B{b} {cat} {q.VALUES[tier-1]}: {ans} :: {title}: {err}"); continue
            board["cells"].append({"id": f"b{b}-{cat}-{tier}", "cat": cat, "value": q.VALUES[tier-1], "clue": clue, "answer": ans, "accept": acc, "sources": [src_obj(title, quote)], "subjectArticle": subject})
        f = next(x for x in q.FINALS if x[0] == b)
        srcs = []
        for (title, kw, proof) in f[5]:
            quote, err = evidence(title, kw, proof)
            if err: fails.append(f"B{b} FINAL {f[3]} :: {title}: {err}")
            else: srcs.append(src_obj(title, quote))
        board["final"] = {"id": f"b{b}-final", "category": f[1], "clue": f[2], "answer": f[3], "accept": f[4], "sources": srcs}
        out["boards"].append(board)
    return out, fails

if __name__ == "__main__":
    out, fails = build()
    json.dump(out, open(os.path.join(HERE, "data", "boards.json"), "w"), indent=1, ensure_ascii=False)
    n = sum(len(b["cells"]) for b in out["boards"])
    print(f"{n} clues + {len(out['boards'])} finals; {len(fails)} failures")
    for f in fails: print("  FAIL", f)
