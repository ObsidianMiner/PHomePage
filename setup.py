# This file sets up the phome:// protocol so that the homepage can run python scripts.

import sys
import winreg
from pathlib import Path

helper_path = (Path(__file__).resolve() / "home_helper.pyw").resolve()

def install_for_windows():
    # Instals on the current user via registry keys

    command = f'pyw.exe "{helper_path}" "%1"'

    base = r"software/Classes/phome"

    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base) as protocolKey:
        winreg.SetValueEx(protocolKey, "", 0, winreg.REG_SZ, "URL:phome protocol")
        winreg.SetValueEx(protocolKey, "URL Protocol", 0, winreg.REG_SZ, "")
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base + r"\shell\open\command") as commandKey:
        winreg.SetValueEx(commandKey, "", 0, winreg.REG_SZ, command)

def install_for_linux():
    desktop_dir = Path.home() / ".local" / "share" / "applications"
    desktop_dir.mkdir(parents=True, exist_ok=True)

    desktop_file = desktop_dir / "home_helper.desktop"
    desktop_file.write_text(
        f"[Desktop Entry]\n"
        f"Name=PHome Protocol\n"
        f'Exec=/usr/bin/python3 "{helper_path}" %u\n'
        "Type=Application\n"
        "NoDisplay=true\n"
        "MimeType=x-scheme-handler/phome;\n"
    )

    
if __name__ == "__main__":
    if sys.platform == "win32":
        install_for_windows()
    elif sys.platform == "linux":
        install_for_linux()
    else:
        print("Platform not supported, only windows and linux are supported.")