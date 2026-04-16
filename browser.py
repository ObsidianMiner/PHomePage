import os
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


def open_app(path, args=None):
    path = urllib.parse.unquote(path)
    cmd = [path]
    if args:
        cmd.extend(args.split(" "))
    subprocess.Popen(cmd)