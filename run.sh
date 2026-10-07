#!/usr/bin/env bash
# Boyd Family Trivia Night: ./run.sh build|start|stop|restart|status|shots|test|all
set -e; cd "$(dirname "$0")"
PORT=4253; PIDF=data/server.pid; LOG=data/server.log
status(){ if [ -f "$PIDF" ] && kill -0 "$(cat $PIDF)" 2>/dev/null && curl -sf "http://127.0.0.1:$PORT/healthz" >/dev/null; then echo "running on http://127.0.0.1:$PORT (pid $(cat $PIDF))"; else echo "not running"; return 1; fi; }
start(){ if status >/dev/null 2>&1; then status; return; fi; setsid nohup python3 server.py >>"$LOG" 2>&1 < /dev/null & echo $! > "$PIDF"; sleep 0.8; status; }
stop(){ [ -f "$PIDF" ] && kill "$(cat $PIDF)" 2>/dev/null || true; rm -f "$PIDF"; echo stopped; }
build(){ python3 build_data.py && python3 render.py; }
case "${1:-start}" in
  build) build;; start) start;; stop) stop;; restart) stop; start;; status) status;;
  shots) python3 tests/shots.py;; test) python3 tests/smoke_test.py;;
  fetch) python3 fetch_intros.py && python3 fetch_sources.py;;   # only needed when questions.py cites a new article
  all) build; python3 tests/shots.py; python3 tests/smoke_test.py; start;;
  *) echo "usage: $0 build|start|stop|restart|status|shots|test|fetch|all"; exit 2;;
esac
