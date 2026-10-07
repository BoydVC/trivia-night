"""Screenshots of the offline snapshot via headless Chrome demo URLs -> screenshots/ (one Chrome at a time to keep load light)."""
import os, subprocess, tempfile
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAP = "file://" + os.path.join(HERE, "dist", "trivia-night-snapshot.html")
SHOTS = [("01-setup", "demo=setup"), ("02-board-A", "demo=board&b=1"), ("03-board-B", "demo=board&b=2"), ("04-board-C", "demo=board&b=3"),
         ("05-clue", "demo=clue&b=1"), ("06-answer-with-source", "demo=answer&b=1"), ("07-daily-double", "demo=dd&b=2"),
         ("08-final", "demo=final&b=2"), ("09-champion-confetti", "demo=winner&b=1"), ("10-host-view", "host=1&demo=answer&b=1")]
def shot(name, q, size="1920,1080"):
    out = os.path.join(HERE, "screenshots", name + ".png")
    with tempfile.TemporaryDirectory() as prof:
        subprocess.run(["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--mute-audio", f"--user-data-dir={prof}",
                        f"--window-size={size}", "--virtual-time-budget=1500", f"--screenshot={out}", f"{SNAP}?{q}"], capture_output=True, timeout=90)
    print(("ok  " if os.path.exists(out) else "MISSING ") + out)
if __name__ == "__main__":
    os.makedirs(os.path.join(HERE, "screenshots"), exist_ok=True)
    for n, q in SHOTS: shot(n, q)
    shot("11-phone-board", "demo=board&b=3", "430,932")
