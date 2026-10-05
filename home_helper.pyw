import sys
import json
import threading
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

from py.browser import open_url, open_app
from py.apps import get_all_apps
from py.sync import sync_push, sync_pull

RESPONSE_PORT = 19420


# ======================
# ARGUMENT PARSING
# ======================

def parse_args():
    if len(sys.argv) < 2:
        return {}

    raw = sys.argv[1]
    raw = raw.removeprefix("phome://").removeprefix("phome:")

    if raw.startswith("http"):
        return {"url": [raw]}

    return urllib.parse.parse_qs(raw)


def get(args, key, default=None):
    val = args.get(key, [default])[0]
    if isinstance(val, str):
        val = val.removesuffix("/")
    return val


# ======================
# ONE-SHOT RESPONSE SERVER
# ======================

def serve_response_once(data):
    """Spin up a localhost server that serves `data` as JSON exactly once, then stops."""

    payload = json.dumps(data).encode("utf-8")

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *args):
            pass  # silence request logs

    server = HTTPServer(("127.0.0.1", RESPONSE_PORT), Handler)
    # serve_forever in a thread, stop after first request
    def run():
        server.handle_request()  # handles exactly one request then returns
    t = threading.Thread(target=run, daemon=True)
    t.start()
    t.join(timeout=30)  # wait up to 30s for JS to poll


# ======================
# MAIN
# ======================

def main():
    args = parse_args()
    if not args:
        return

    action    = get(args, "action")
    url       = get(args, "url")
    browser   = get(args, "browser", "chrome")
    profile   = get(args, "profile")
    app       = get(args, "app")
    app_args  = get(args, "args")

    # -- Open URL --
    if url:
        if url == "getapps":
            apps = get_all_apps()
            serve_response_once({"type": "apps", "data": apps})
        else:
            open_url(url, browser, profile)
        return

    # -- Open App --
    if app:
        open_app(app, app_args)
        return

    # -- Sync --
    if action == "sync_push":
        try:
            worker_url = get(args, "worker_url")
            secret     = get(args, "secret")
            links      = urllib.parse.unquote(get(args, "links", "[]"))
            notes      = urllib.parse.unquote(get(args, "notes", ""))
            try:
                result = sync_push(worker_url, secret, links, notes)
                serve_response_once({"type": "sync", "action": "push", **result})
            except Exception as e:
                serve_response_once({"type": "sync", "action": "push", "ok": False, "error": str(e)})
            return
        except Exception as e:
            print(e)

    if action == "sync_pull":
        worker_url = get(args, "worker_url")
        secret     = get(args, "secret")
        try:
            result = sync_pull(worker_url, secret)
            serve_response_once({"type": "sync", "action": "pull", **result})
        except Exception as e:
            serve_response_once({"type": "sync", "action": "pull", "ok": False, "error": str(e)})
        return

    # -- Gallery Rebuild --
    if action in ("refresh_gallery", "rebuild_gallery", "generate_gallery"):
        try:
            from py.generate_gallery import generate_gallery
            res = generate_gallery()
            serve_response_once({"type": "gallery", "action": "refresh", **res})
        except Exception as e:
            serve_response_once({"type": "gallery", "action": "refresh", "ok": False, "error": str(e)})
        return

    # -- Open Folder / Gallery Folder --
    if action in ("open_gallery_folder", "open_folder"):
        try:
            import os
            base_dir = os.path.dirname(os.path.abspath(__file__))
            folder = get(args, "folder")
            if folder:
                target_folder = os.path.join(base_dir, "gallery", urllib.parse.unquote(folder))
            else:
                custom_path = get(args, "path")
                if custom_path:
                    target_folder = urllib.parse.unquote(custom_path)
                else:
                    target_folder = os.path.join(base_dir, "gallery")

            open_folder(target_folder)
            serve_response_once({"type": "folder", "action": "open", "ok": True, "path": target_folder})
        except Exception as e:
            serve_response_once({"type": "folder", "action": "open", "ok": False, "error": str(e)})
        return


if __name__ == "__main__":
    main()