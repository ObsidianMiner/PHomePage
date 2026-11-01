# This file sets up the phome:// protocol so that the homepage can run python scripts.

import sys
from pathlib import Path
import os
import venv
import subprocess

base_dir = Path(__file__).resolve().parent
helper_path = (base_dir / "home_helper.pyw").resolve()
venv_path =(base_dir / ".venv").resolve()

if(not helper_path.exists()):
    raise FileNotFoundError("home_helper.pyw not found in the current directory! Please run setup.py from the same directory as home_helper.pyw")

def install_requirements(python_path):
    """Install dependencies into the virtual environment."""

    requirements_file = base_dir / "python_requirements.txt"

    if not requirements_file.exists():
        print("No requirements.txt found. Skipping dependency installation.")
        return

    print("Installing Python dependencies...")

    subprocess.run(
        [
            str(python_path),
            "-m",
            "pip",
            "install",
            "-r",
            str(requirements_file)
        ],
        check=True
    )

    print("Dependencies installed successfully.")

def setup_venv():
    """Create the virtual environment if it does not already exist."""

    if not venv_path.exists():
        print("Creating virtual environment...")
        venv.create(venv_path, with_pip=True)
        print("Virtual environment created successfully.")
    else:
        print("Virtual environment already exists.")

    if sys.platform == "win32":
        python_path = venv_path / "Scripts" / "python.exe"
        pythonw_path = venv_path / "Scripts" / "pythonw.exe"

        if not python_path.exists() or not pythonw_path.exists():
            raise FileNotFoundError("Virtual environment Python executable not found.")

        return python_path, pythonw_path
    elif sys.platform == "linux":
        python_path = venv_path / "bin" / "python3"

        if not python_path.exists():
            raise FileNotFoundError("Virtual environment Python executable not found.")

        return python_path, python_path

    else:
        raise RuntimeError("Platform not supported.")

def install_for_windows(pythonw_path):
    # Installs on the current user via registry keys
    import winreg

    print("python path found:")
    print(pythonw_path)

    command = f'"{pythonw_path}" "{helper_path}" "%1"'

    baseRegPath = r"SOFTWARE\Classes\phome"

    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, baseRegPath) as protocolKey:
        winreg.SetValueEx(protocolKey, "", 0, winreg.REG_SZ, "URL:phome protocol")
        winreg.SetValueEx(protocolKey, "URL Protocol", 0, winreg.REG_SZ, "")
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, baseRegPath + r"\shell\open\command") as commandKey:
        winreg.SetValueEx(commandKey, "", 0, winreg.REG_SZ, command)

    print("Successfully installed the phome protocol for windows.")

def install_for_linux(python_path):
    #Installs a .desktop file to .local/share/applications

    if(os.getenv("SUDO_USER")):
        raise Exception("Sudo not supported because it clears the environment variables containing your home directory.")

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
        print("WARNING: update-desktop-database not installed. A device restart may be necessary before home helper works.")

    print("Successfully installed the phome protocol for linux.")


if __name__ == "__main__":
    python_path, pythonw_path = setup_venv()
    install_requirements(python_path)
    if sys.platform == "win32":
        install_for_windows(pythonw_path)
    elif sys.platform == "linux":
        install_for_linux(python_path)
    else:
        print("Platform not supported, only windows and linux are supported.")
        sys.exit(1)