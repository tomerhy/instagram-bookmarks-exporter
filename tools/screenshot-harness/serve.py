#!/usr/bin/env python3
"""Serve the real popup/gallery pages with a stubbed chrome.* for screenshots.

    python3 tools/screenshot-harness/serve.py [--port 8777]

Then open:
    /popup.html            the toolbar popup, idle, with a seeded library
    /popup.html?consent=0  same, with consent absent (for the disclosure shot)
    /gallery.html          the Library, populated with synthetic records

Nothing in the repository is modified: the pages are assembled into a temporary
directory and served from there. See README.md for what is substituted.
"""
import argparse
import http.server
import json
import os
import re
import shutil
import socketserver
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))

# Everything the two pages load, plus the icons they reference.
COPY = ["popup.html", "popup.js", "gallery.html", "gallery.js", "tokens.css",
        "legacy-cleanup.js", "url-allowlist.js", "library-sanitize.js"]
COPY_DIRS = [("lib", "lib"), ("assets/icons", "assets/icons")]


def build(port):
    tmp = tempfile.mkdtemp(prefix="sbe-shots-")
    for f in COPY:
        shutil.copy2(os.path.join(ROOT, f), os.path.join(tmp, f))
    for src, dst in COPY_DIRS:
        s = os.path.join(ROOT, src)
        if os.path.isdir(s):
            shutil.copytree(s, os.path.join(tmp, dst))
    shutil.copytree(os.path.join(HERE, "media"), os.path.join(tmp, "media"))
    for f in ("harness-stub.js", "harness-allowlist-widen.js",
              "harness-actions.js"):
        shutil.copy2(os.path.join(HERE, f), os.path.join(tmp, f))

    origin = "http://127.0.0.1:%d" % port
    seed = json.load(open(os.path.join(HERE, "seed-library.json"),
                          encoding="utf-8"))
    seed = json.loads(json.dumps(seed).replace("PLACEHOLDER_ORIGIN", origin))
    payload = json.dumps({"images": seed["images"], "videos": seed["videos"]})

    inject_head = ('<script>window.__HARNESS_SEED__ = %s;</script>\n'
                   '  <script src="harness-stub.js"></script>\n  ' % payload)

    for page in ("popup.html", "gallery.html"):
        p = os.path.join(tmp, page)
        html = open(p, encoding="utf-8").read()
        # Stub chrome.* before any of the page's own scripts run.
        first = re.search(r'<script src="', html)
        html = html[:first.start()] + inject_head + html[first.start():]
        # Widen the media check after the allowlist loads, before gallery.js.
        html = html.replace(
            '<script src="gallery.js"></script>',
            '<script src="harness-allowlist-widen.js"></script>\n'
            '  <script src="gallery.js"></script>')
        html = html.replace(
            '</body>', '  <script src="harness-actions.js"></script>\n</body>')
        open(p, "w", encoding="utf-8").write(html)
    return tmp


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8777)
    args = ap.parse_args()
    tmp = build(args.port)

    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=tmp, **kw)

        def log_message(self, *a):
            pass

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", args.port), H) as httpd:
        print("serving %s on http://127.0.0.1:%d/" % (tmp, args.port))
        print("  /popup.html            popup, idle")
        print("  /popup.html?consent=0  popup, first-run disclosure")
        print("  /gallery.html          Library, populated")
        print("  add &act=disclosure|search|album|videos for a scripted state")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
