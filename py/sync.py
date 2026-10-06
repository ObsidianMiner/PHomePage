import json
import urllib.request
import urllib.error


def _request(worker_url, secret, username, path, method, body=None):
    url = f"{worker_url.rstrip('/')}/{path}"
    data = body.encode("utf-8") if body is not None else None

    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Content-Type": "application/json",
            "X-Secret": secret,
            "Username" : username,
            "User-Agent": "Mozilla/5.0"
        }
    )

    with urllib.request.urlopen(req, timeout=4) as resp:
        return resp.read().decode("utf-8")


def sync_push(worker_url, secret, username, links_json, notes_text):
    _request(worker_url, secret, username, "links", "PUT", links_json)
    _request(worker_url, secret, username, "notes", "PUT", notes_text)
    return {"ok": True}


def sync_pull(worker_url, secret, username):
    links = _request(worker_url, secret, username, "links", "GET")
    notes = _request(worker_url, secret, username, "notes", "GET")
    return {"ok": True, "links": links, "notes": notes}

def sync_register(worker_url, username):
    response = _request(worker_url, "No Secret", username, "register", "POST")
    response_json = json.loads(response)
    return {"ok": True, "username": response_json["username"], "secret": response_json["secret"]}