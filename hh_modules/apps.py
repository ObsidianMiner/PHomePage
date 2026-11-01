import os
import subprocess
import struct

# Add other apps here that you want to be allowed, but are not in the start menu / .desktop files.
other_allowed_apps = []

# 
white_listed_args = []
def parse_lnk_target(lnk_path):
    """
    Parses a .lnk file purely in Python by reading its binary structure.
    Extremely fast, zero dependencies, no subprocesses.
    """
    try:
        with open(lnk_path, 'rb') as f:
            # 1. Read Shell Link Header (76 bytes)
            header = f.read(76)
            
            # Validate header size and the .lnk file signature (0x0000004C)
            if len(header) < 76 or header[:4] != b'\x4C\x00\x00\x00':
                return "" 
            
            # Extract LinkFlags (offset 20, 4 bytes, little-endian)
            link_flags = struct.unpack('<I', header[20:24])[0]
            has_link_target_id_list = bool(link_flags & 0x01)
            has_link_info = bool(link_flags & 0x02)
            
            # 2. Skip LinkTargetIDList if present to reach the LinkInfo structure
            if has_link_target_id_list:
                size_bytes = f.read(2)
                if len(size_bytes) < 2:
                    return ""
                id_list_size = struct.unpack('<H', size_bytes)[0]
                # Jump ahead by the size of the ID list
                f.seek(id_list_size, os.SEEK_CUR)
            
            # 3. Parse the LinkInfo structure where the target path is stored
            if has_link_info:
                link_info_start = f.tell()
                link_info_header = f.read(28)
                if len(link_info_header) < 28:
                    return ""
                
                (link_info_size, 
                 link_info_header_size, 
                 info_flags, 
                 vol_id_offset, 
                 local_base_path_offset, 
                 network_link_offset, 
                 path_suffix_offset) = struct.unpack('<IIIIIII', link_info_header)
                
                # Check if the VolumeIDAndLocalBasePath flag (Bit 0) is set
                if info_flags & 0x01:
                    
                    # Check if a Unicode path exists (Header size >= 36 indicates Unicode support)
                    if link_info_header_size >= 36:
                        extra_header = f.read(8)
                        local_base_path_offset_unicode = struct.unpack('<I', extra_header[:4])[0]
                        
                        if local_base_path_offset_unicode > 0:
                            f.seek(link_info_start + local_base_path_offset_unicode)
                            path_bytes = bytearray()
                            while True:
                                char = f.read(2) # Read 2 bytes for UTF-16
                                if not char or char == b'\x00\x00':
                                    break
                                path_bytes.extend(char)
                            return path_bytes.decode('utf-16-le', errors='ignore')
                    
                    # Fallback to standard ANSI local path
                    f.seek(link_info_start + local_base_path_offset)
                    path_bytes = bytearray()
                    while True:
                        char = f.read(1)
                        if not char or char == b'\x00':
                            break
                        path_bytes.extend(char)
                    
                    # 'mbcs' handles the default local Windows codepage mapping
                    return path_bytes.decode('mbcs', errors='ignore')
                    
    except Exception as e:
        pass # Silently handle permission errors or corrupted links
        
    return ""

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
                    lnk_path = os.path.join(root, file)
                    target_path = parse_lnk_target(lnk_path)
                    if target_path:
                        apps.append({
                            "name": os.path.splitext(file)[0],
                            "path": target_path
                        })
    return apps

def append_white_listed_args(cmd : list, args):
    if args:
        split_args = args.split(" ")
        for arg in split_args:
            if arg in white_listed_args:
                cmd.extend(arg)

def open_app(app_name, args=None):
    apps = get_all_allowed_apps() + other_allowed_apps
    for app in apps:
        if(app["name"] == app_name):
            cmd = [app["path"]]
            append_white_listed_args(cmd, args)
            subprocess.Popen(cmd)
            return
    raise ValueError(f"{app_name} is not in the windows start menu or a .desktop in the users applications directory.")



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


def get_all_allowed_apps():
    return get_windows_apps() if os.name == "nt" else get_linux_apps()
