"""Build tunnel-section textures from the mileage-named face photographs."""

from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data"
OUTPUT = ROOT / "public" / "data" / "face_sketch"
RECORDS = [
    ("X1DK2+880.6.jpg", "X1DK2_880_6_fitted.jpg", 8.16, 7.73),
    ("X1DK2+885.4.jpg", "X1DK2_885_4_fitted.jpg", 8.16, 7.73),
    ("X1DK2+892.6.jpg", "X1DK2_892_6_fitted.jpg", 8.16, 7.73),
    ("X1DK2+900.0.jpg", "X1DK2_900_0_fitted.jpg", 7.73, 8.16),
    ("X1DK2+905.0.jpg", "X1DK2_905_0_fitted.jpg", 8.16, 7.73),
]


def centre_crop(image: Image.Image, aspect: float) -> Image.Image:
    source_aspect = image.width / image.height
    if source_aspect > aspect:
        width = round(image.height * aspect)
        left = (image.width - width) // 2
        return image.crop((left, 0, left + width, image.height))
    height = round(image.width / aspect)
    top = (image.height - height) // 2
    return image.crop((0, top, image.width, top + height))


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for source_name, output_name, width_m, height_m in RECORDS:
        with Image.open(SOURCE / source_name) as source:
            photograph = centre_crop(source.convert("RGB"), width_m / height_m)
            target_width = 1024
            target_height = round(target_width * height_m / width_m)
            resampling = getattr(Image, "Resampling", Image).LANCZOS
            photograph = photograph.resize((target_width, target_height), resampling)
            photograph.save(OUTPUT / output_name, quality=90, optimize=True)
            print(f"Built {output_name}: {photograph.width}x{photograph.height}")


if __name__ == "__main__":
    main()
