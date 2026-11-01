import os
import sys
import subprocess
import urllib.parse


def open_url(url, browser="chrome", profile=None):
    url = urllib.parse.unquote(url)

    if os.name == "nt":
        if browser == "firefox":
            firefox = r'"C:\Program Files\Mozilla Firefox\firefox.exe"'
            subprocess.Popen(f'{firefox} "{url}"')
            return

        chrome = r'"C:\Program Files\Google\Chrome\Application\chrome.exe"'
        if not os.path.exists(chrome.strip('"')):
            chrome = r'"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"'

        cmd = chrome
        if profile:
            cmd += f' --profile-directory="{profile}"'
        cmd += f' "{url}"'
        subprocess.Popen(cmd)

    else:
        if browser == "firefox":
            subprocess.Popen(["firefox", url])
        else:
            cmd = ["google-chrome"]
            if profile:
                cmd.append(f"--profile-directory={profile}")
            cmd.append(url)
            subprocess.Popen(cmd)


def open_folder(path):
    """Open folder in OS filesystem viewer (Explorer on Windows, xdg-open on Linux, open on macOS)."""
    path = urllib.parse.unquote(str(path))
    path = os.path.abspath(path)
    os.makedirs(path, exist_ok=True)

    if os.name == "nt":
        os.startfile(path)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", path])
    else:
        subprocess.Popen(["xdg-open", path])