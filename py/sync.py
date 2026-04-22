import json
import urllib.request
import urllib.error


def _request(worker_url, secret, path, method, body=None):
    url = f"{worker_url.rstrip('/')}/{path}"
    data = body.encode("utf-8") if body is not None else None

    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Content-Type": "application/json",
            "X-Secret": secret,
            "User-Agent": "Mozilla/5.0"
        }
    )

    with urllib.request.urlopen(req, timeout=4) as resp:
        return resp.read().decode("utf-8")


def sync_push(worker_url, secret, links_json, notes_text):
    _request(worker_url, secret, "links", "PUT", links_json)
    _request(worker_url, secret, "notes", "PUT", notes_text)
    return {"ok": True}


def sync_pull(worker_url, secret):
    links = _request(worker_url, secret, "links", "GET")
    notes = _request(worker_url, secret, "notes", "GET")
    return {"ok": True, "links": links, "notes": notes}
