import sys
import subprocess
import urllib.parse
import os
import sys
import json
import tempfile


def parse_args():
    if len(sys.argv) < 2:
        return None

    raw = sys.argv[1]

    raw = raw.replace("phome://", "")
    raw = raw.replace("phome:", "")

    if raw.startswith("http"):
        return {"url": [raw]}

    return urllib.parse.parse_qs(raw)

def write_response(data):
    path = os.path.join(tempfile.gettempdir(), "phome_response.json")
    print(path)
    input()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)

def send_callback(action, data):
    print(f"CALLBACK|{action}|{json.dumps(data)}")
# -------- OPEN URL --------
def open_url(url, browser="chrome", profile:str=None):
    url = urllib.parse.unquote(url)

    if os.name == "nt":  # Windows
        if browser == "firefox":
            firefox_path = r'"C:\Program Files\Mozilla Firefox\firefox.exe"'
            cmd = f'{firefox_path} "{url}"'
            subprocess.Popen(cmd)
            return

        chrome_path = r'"C:\Program Files\Google\Chrome\Application\chrome.exe"'
        if not os.path.exists(chrome_path.strip('"')):
            chrome_path = r'"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"'

        cmd = f'{chrome_path}'

        if profile:
            cmd += f' --profile-directory="{profile}"'  # or use {profile}

        cmd += f' "{url}"'

        subprocess.Popen(cmd)

    else:  # Linux
        if browser == "firefox":
            subprocess.Popen(["firefox", url])
        else:
            cmd = ["google-chrome"]
            if profile:
                cmd.append(f'--profile-directory={profile}')
            cmd.append(url)
            subprocess.Popen(cmd)


# -------- OPEN APP --------
def open_app(path, args=None):
    path = urllib.parse.unquote(path)

    cmd = [path]

    if args:
        # split args safely
        cmd.extend(args.split(" "))

    subprocess.Popen(cmd)

# ------- Find Apps -------
def get_windows_apps():
    paths = [
        os.path.expandvars(r"%APPDATA%\Microsoft\Windows\Start Menu\Programs"),
        os.path.expandvars(r"%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs")
    ]

    apps = []

    for base in paths:
        for root, _, files in os.walk(base):
            for file in files:
                if file.endswith(".lnk"):
                    full_path = os.path.join(root, file)
                    name = os.path.splitext(file)[0]
                    apps.append({
                        "name": name,
                        "path": full_path
                    })

    return apps

def get_linux_apps():
    paths = [
        "/usr/share/applications",
        os.path.expanduser("~/.local/share/applications")
    ]

    apps = []

    for base in paths:
        if not os.path.exists(base):
            continue

        for file in os.listdir(base):
            if not file.endswith(".desktop"):
                continue

            full_path = os.path.join(base, file)

            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()

                name = None
                exec_cmd = None

                for line in lines:
                    if line.startswith("Name="):
                        name = line.strip().split("=",1)[1]
                    elif line.startswith("Exec="):
                        exec_cmd = line.strip().split("=",1)[1]

                if name and exec_cmd:
                    # clean exec (remove % args)
                    exec_cmd = exec_cmd.split(" ")[0]
                    apps.append({
                        "name": name,
                        "path": exec_cmd
                    })

            except:
                continue

    return apps

def get_all_apps():
    if os.name == "nt":
        return get_windows_apps()
    else:
        return get_linux_apps()


def main():
    args = parse_args()
    if not args:
        return

    url = args.get("url", [None])[0]
    browser = args.get("browser", ["chrome"])[0]
    if browser:
        browser = browser.removesuffix('/')
    profile = args.get("profile", [None])[0]
    if profile:
        profile = profile.removesuffix('/')

    app = args.get("app", [None])[0]
    app_args = args.get("args", [None])[0]
    
    if app:
        app = app.removesuffix('/')
    if url:
        url = url.removesuffix('/')
    
    if url:
        if url == "getapps":
            apps = get_all_apps()
            write_response({"type": "apps", "data": apps})
            return
        else:
            open_url(url, browser, profile)
    elif app:
        open_app(app, app_args)


if __name__ == "__main__":
    main()