# This file sets up the phome:// protocol so that the homepage can run python scripts.

import sys
from pathlib import Path
import os

helper_path = (Path(__file__).resolve().parent / "home_helper.pyw").resolve()

if(not helper_path.exists()):
    raise FileNotFoundError("home_helper.pyw not found in the current directory! Please run setup.py from the same directory as home_helper.pyw")


def install_for_windows():
    # Installs on the current user via registry keys
    import winreg

    python_path = (Path(sys.executable).parent / "pythonw.exe").resolve()

    if(not python_path.exists()):
        raise FileNotFoundError("Could not find pythonw.exe")

    print("python path found:")
    print(python_path)

    command = f'"{python_path}" "{helper_path}" "%1"'

    baseRegPath = r"SOFTWARE\Classes\phome"

    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, baseRegPath) as protocolKey:
        winreg.SetValueEx(protocolKey, "", 0, winreg.REG_SZ, "URL:phome protocol")
        winreg.SetValueEx(protocolKey, "URL Protocol", 0, winreg.REG_SZ, "")
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, baseRegPath + r"\shell\open\command") as commandKey:
        winreg.SetValueEx(commandKey, "", 0, winreg.REG_SZ, command)

    print("Successfully installed the phome protocol for windows.")

def install_for_linux():
    #Installs a .desktop file to .local/share/applications

    if(os.getenv("SUDO_USER")):
        raise Exception("Sudo not supported because it clears the environment variables.")

    python_path = Path(sys.executable)

    if(not python_path.exists()):
        raise FileNotFoundError("No python3 file could be found")

    print("python path found:")
    print(python_path)
    
    if(os.getenv("XDG_DATA_HOME")):
        desktop_dir = Path(os.getenv("XDG_DATA_HOME")) / "applications"
    else:
        desktop_dir = Path.home() / ".local" / "share" / "applications"
    
    desktop_dir.mkdir(parents=True, exist_ok=True)

    desktop_file = desktop_dir / "home_helper.desktop"
    desktop_file.write_text(
        f"[Desktop Entry]\n"
        f"Name=PHome Protocol\n"
        f'Exec="{python_path}" "{helper_path}" %u\n'
        "Type=Application\n"
        "NoDisplay=true\n"
        "MimeType=x-scheme-handler/phome;\n"
    )

    import subprocess
    try:
        subprocess.run(["update-desktop-database", str(desktop_dir.resolve())])
    except:
        print("update-desktop-database not installed. A device restart may be necessary.")

    print("Successfully installed the phome protocol for linux.")


if __name__ == "__main__":
    if sys.platform == "win32":
        install_for_windows()
    elif sys.platform == "linux":
        install_for_linux()
    else:
        print("Platform not supported, only windows and linux are supported.")
        sys.exit(1)