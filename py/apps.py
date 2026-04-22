import os


def get_windows_apps():
    paths = [
        os.path.expandvars(r"%APPDATA%\Microsoft\Windows\Start Menu\Programs"),
        os.path.expandvars(r"%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs"),
    ]
    apps = []
    for base in paths:
        for root, _, files in os.walk(base):
            for file in files:
                if file.endswith(".lnk"):
                    apps.append({
                        "name": os.path.splitext(file)[0],
                        "path": os.path.join(root, file)
                    })
    return apps


def get_linux_apps():
    paths = [
        "/usr/share/applications",
        os.path.expanduser("~/.local/share/applications"),
    ]
    apps = []
    for base in paths:
        if not os.path.exists(base):
            continue
        for file in os.listdir(base):
            if not file.endswith(".desktop"):
                continue
            try:
                name = exec_cmd = None
                with open(os.path.join(base, file), encoding="utf-8") as f:
                    for line in f:
                        if line.startswith("Name="):
                            name = line.strip().split("=", 1)[1]
                        elif line.startswith("Exec="):
                            exec_cmd = line.strip().split("=", 1)[1].split()[0]
                if name and exec_cmd:
                    apps.append({"name": name, "path": exec_cmd})
            except Exception:
                continue
    return apps


def get_all_apps():
    return get_windows_apps() if os.name == "nt" else get_linux_apps()
