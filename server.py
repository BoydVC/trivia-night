"""Trivia Night server on 127.0.0.1:4253 (stdlib). Serves the offline snapshot; host window = /?host=1 (same origin, so it syncs live)."""
import http.server, os, socketserver
HERE = os.path.dirname(os.path.abspath(__file__)); PORT = int(os.environ.get("TN_PORT", 4253))
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/healthz": return self._send(200, b'{"ok":true}', "application/json")
        f = {"/": "dist/trivia-night-snapshot.html", "/index.html": "dist/trivia-night-snapshot.html", "/host": "dist/trivia-night-snapshot.html", "/boards.json": "data/boards.json"}.get(p)
        if not f or not os.path.exists(os.path.join(HERE, f)): return self._send(404, b"not found", "text/plain")
        self._send(200, open(os.path.join(HERE, f), "rb").read(), "application/json" if f.endswith(".json") else "text/html; charset=utf-8")
    def _send(self, c, b, ct):
        self.send_response(c); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(b))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(b)
    def log_message(self, *a): pass
class S(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
if __name__ == "__main__":
    print(f"Trivia Night on http://127.0.0.1:{PORT}", flush=True); S(("127.0.0.1", PORT), H).serve_forever()
