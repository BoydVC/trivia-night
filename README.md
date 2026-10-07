# Boyd Family Trivia Night

A Jeopardy-style game for the kitchen TV. It has 6 categories × 5 values, 3 different boards (A · Crabs & Chopsticks, B · Purple Reign, C · Blue Skies) and a Final for each board. That's **93 questions in all** (90 board clues + 3 Finals).

**Categories:** Maryland & Baltimore · Ravens & Orioles · Chelsea & World Soccer · Rockets & Space · 8th/6th-Grade Science · Word Play

## Play
- **Served (best):** `./run.sh start`, then open http://127.0.0.1:4253 on the TV. Open the host window with **H** or `http://127.0.0.1:4253/?host=1` on a laptop or phone. It updates live because it's the same origin.
- **Offline:** open `dist/trivia-night-snapshot.html` directly. It's one file with fonts and data inlined and needs no network. The host window can't sync across `file://` windows, so use **A** (answer peek) instead.

**Setup:** pick a board (keys 1–3) and a team preset: Everyone (4), Kids vs Parents, Boyd+Vic vs Miranda+Char, or 3 teams. You can also use ±team and type names.

**Keys** (touch/click works for everything):

| Key | Action |
|---|---|
| Arrows + Enter / tap | open a square |
| Space | reveal the answer |
| 1–4 | team correct (+value) |
| Shift+1–4 | team wrong (−value) |
| Esc / Enter | back to the board |
| U | undo |
| H | host window |
| A | answer peek |
| F | Final |
| M | mute |
| Z | fullscreen |

**Daily Doubles:** each new game hides 2, on rows $600 and up in different categories. Pick the team, enter the wager (up to their score, or up to $1,000 if their score is lower) and play the clue.

**Final:** category → secret wagers (capped at each team's score) → 30-second clock with think music → mark answers → champion screen with confetti.

Sounds are made in the browser (Web Audio) and confetti is drawn on a canvas, so nothing is downloaded. Game state is saved in localStorage (`boyd-trivia-v1`), so a page refresh keeps the score.

## Sources: every question is grounded
- `questions.py` is the question bank. Each entry has the clue, the answer, accepted aliases, the cited Wikipedia article, and keywords plus a proof string.
- `fetch_intros.py` / `fetch_sources.py` download the cited articles (plain-text extracts, MediaWiki API) into `data/sources/`, with the revid and fetch time in `_index.json`.
- `build_data.py` keeps a clue only if one **verbatim sentence** of the cited article contains the keywords and the answer. The exception is an article whose title is the answer itself, where the keywords are enough. That sentence, the URL and the revid are saved with the clue in `data/boards.json`. The host view and the answer screen show the source.
- No personal or family details appear in any clue. The smoke test checks for family names, the home town and similar terms.

## Files
- `run.sh`: `build | start | stop | restart | status | shots | test | fetch | all`. The server runs under setsid nohup with its pid in `data/server.pid` and its log in `data/server.log`.
- `server.py`: stdlib server on 127.0.0.1:4253 with `/`, `/?host=1`, `/boards.json` and `/healthz`.
- `render.py`: builds `dist/trivia-night-snapshot.html` from `web/style.css`, `web/app.js`, `data/boards.json` and subset WOFF fonts.
- `tests/smoke_test.py`: about 2,700 checks.
  - Every question has a Wikipedia source with a revid, and its quote appears verbatim in the stored article and supports the answer.
  - Answers are short and unambiguous, with no "or" or "/", aren't given away in the clue, and are unique per board.
  - Each board is a full 6×5 grid, and the Daily Double pool works.
  - The snapshot is self-contained and renders board, answer, host and champion screens in headless Chrome.
  - The server answers (if it's running).
- `tests/shots.py`: saves the screenshots in `screenshots/`.

## Adding a question
Add a tuple to `questions.py` that cites a Wikipedia article. Then run `./run.sh fetch` (only if it's a new article) and `./run.sh build && ./run.sh test`. If no sentence in the article backs the clue, the build reports a failure. In that case, fix the clue; don't loosen the check.


---
## Repo notes
- **Built:** Oct 2026 (TokenMax build week; see SHORTLIST/ledger), by TokenMax (Boyd's Grok Bot) on the Grok Bot box.
- **Run:** `./run.sh` (then open the localhost URL it prints).
- Imported from `/workspace/tokenmax/trivia-night` on Oct 23, 2026. node_modules, virtualenvs, logs and files over 20 MB were left out.
