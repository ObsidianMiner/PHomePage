import base64
import os
import sys
import json
import threading
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

# This is going to make a proper python virtual environment setup required.
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from hh_modules.browser import open_url
from hh_modules.apps import get_all_allowed_apps, open_app

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


def get(args, key, default=None, uri=None):
    val = args.get(key, [default])[0]
    if isinstance(val, str):
        val = val.removesuffix("/")
    if val and uri:
        val = urllib.parse.unquote(val)
    return val


# ======================
# ENCRYPTION FROM JS
# ======================

def KeyTextToKey(key_as_text: str):
    """
    Converts a Base64-encoded AES key into an AES-GCM key.
    Equivalent to JavaScript KeyTextToKey().
    """
    key_bytes = base64.b64decode(key_as_text)

    if len(key_bytes) != 32:
        raise ValueError("AES-256 keys must be exactly 32 bytes")

    return AESGCM(key_bytes)


def TryEncryptWithKey(key, to_encrypt):
    """
    Encrypts a string using AES-GCM.
    Returns Base64(IV + Ciphertext + Authentication Tag).
    Equivalent to JavaScript TryEncryptWithKey().
    to_encrypt must be encoded with utf-8
    """
    if not key:
        return to_encrypt

    # Generate a random 12-byte IV
    iv = os.urandom(12)

    # Encrypt (cryptography automatically appends the 16-byte GCM tag)
    ciphertext = key.encrypt(iv, to_encrypt, None)

    # Combine IV + ciphertext + authentication tag
    combined_bytes = iv + ciphertext

    # Base64 encode
    return base64.b64encode(combined_bytes).decode("ascii")

# ======================
# ONE-SHOT RESPONSE SERVER
# ======================


def serve_response_once(data, res_crypt_key=None):
    """Spin up a localhost server that serves `data` as JSON exactly once, then stops."""

    payload = json.dumps(data).encode("utf-8")

    if res_crypt_key:
        payload = TryEncryptWithKey(KeyTextToKey(res_crypt_key), payload).encode("utf-8")
    
    # Confirmed by here that payload is a valid str aEx...=

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(payload)))
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
    t.join(timeout=3)  # wait up to 3s for JS to poll


# ======================
# MAIN
# ======================

def main():
    args = parse_args()
    if not args:
        return

    action        = get(args, "action")
    url           = get(args, "url")
    browser       = get(args, "browser", "chrome")
    profile       = get(args, "profile")
    app           = get(args, "app")
    app_args      = get(args, "args")
    res_crypt_key = get(args, "res_crypt_key", None, True)


    # -- Open URL --
    if url:
        open_url(url, browser, profile)
        return

    # -- Get All Installed Apps --
    if action == "getapps":
        try:
            from hh_modules.apps import get_all_allowed_apps, other_allowed_apps, filter_and_format_apps, save_apps_to_file
            raw_apps = get_all_allowed_apps() + other_allowed_apps
            formatted_apps = filter_and_format_apps(raw_apps)
            res = save_apps_to_file(formatted_apps)
            serve_response_once({
                "type": "apps",
                "action": "getapps",
                "ok": True,
                "total_apps": len(formatted_apps),
                "data": formatted_apps,
                "output_file": res.get("output_file")
            }, res_crypt_key)
        except Exception as e:
            serve_response_once({
                "type": "apps",
                "action": "getapps",
                "ok": False,
                "error": str(e)
            }, res_crypt_key)
        return
    
    # -- Open App --
    if app:
        open_app(app, app_args)
        return

    # -- Gallery Rebuild --
    if action in ("refresh_gallery", "rebuild_gallery", "generate_gallery"):
        try:
            from hh_modules.generate_gallery import generate_gallery
            res = generate_gallery()
            serve_response_once({"type": "gallery", "action": "refresh", **res}, res_crypt_key)
        except Exception as e:
            serve_response_once({"type": "gallery", "action": "refresh", "ok": False, "error": str(e)}, res_crypt_key)
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
            serve_response_once({"type": "folder", "action": "open", "ok": True, "path": target_folder}, res_crypt_key)
        except Exception as e:
            serve_response_once({"type": "folder", "action": "open", "ok": False, "error": str(e)}, res_crypt_key)
        return
    
if __name__ == "__main__":
    try:
        main()
    except BaseException as e:
        from pathlib import Path
        import traceback
        error_message_with_trace = traceback.format_exc()
        
        with open(Path(__file__).with_name("home_helper_last_error.txt"), "w", encoding="utf-8") as ofile:
            ofile.write(error_message_with_trace)