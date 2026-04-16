import os
import json

GALLERY_DIR = "gallery"
OUTPUT_FILE = "js/galleryphotos.local.js"

VALID_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif")

def main():
    structure = {}

    for root, _, files in os.walk(GALLERY_DIR):
        for file in files:
            if not file.lower().endswith(VALID_EXTENSIONS):
                continue

            full_path = os.path.join(root, file)

            # Get path relative to gallery/
            rel_path = os.path.relpath(full_path, GALLERY_DIR)
            rel_path = rel_path.replace(os.sep, "/")

            # Determine top-level folder (category)
            parts = rel_path.split("/")
            if len(parts) > 1:
                category = parts[0]
            else:
                category = "root"  # fallback if image is directly in gallery/

            # Build final web path
            web_path = f"{GALLERY_DIR}/{rel_path}"

            structure.setdefault(category, []).append(web_path)

    # Sort each category and the keys
    for category in structure:
        structure[category].sort()

    sorted_structure = dict(sorted(structure.items()))

    with open(OUTPUT_FILE, "w") as f:
        f.write("const GALLERY_STRUCTURE = ")
        f.write(json.dumps(sorted_structure, indent=2))
        f.write(";")

    total_images = sum(len(v) for v in structure.values())
    print(f"Generated {OUTPUT_FILE} with {total_images} images across {len(structure)} categories.")

if __name__ == "__main__":
    main()