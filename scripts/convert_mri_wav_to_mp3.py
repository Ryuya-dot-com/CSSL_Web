#!/usr/bin/env python3
"""Convert canonical MRI WAV stimulus audio to web MP3 copies.

Run this from the fMRI_CSSL checkout. The script reads
../Experiment/stimuli_map.json, takes WAV files from
../Experiment/stimuli/audio/female/, and writes MP3 files to this web tree's
stimuli/audio/female/ directory.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path


WEB_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = WEB_ROOT.parent
EXPERIMENT_DIR = PROJECT_ROOT / "Experiment"
STIMULI_MAP = EXPERIMENT_DIR / "stimuli_map.json"
SOURCE_DIR = EXPERIMENT_DIR / "stimuli" / "audio" / "female"
OUTPUT_DIR = WEB_ROOT / "stimuli" / "audio" / "female"


def load_required_words() -> list[str]:
    entries = json.loads(STIMULI_MAP.read_text(encoding="utf-8"))
    return [entry["filename"] for entry in entries]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bitrate", default="128k", help="MP3 audio bitrate passed to ffmpeg.")
    args = parser.parse_args()

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise SystemExit("ffmpeg is required but was not found on PATH")
    if not STIMULI_MAP.exists():
        raise SystemExit(f"Missing canonical stimulus map: {STIMULI_MAP}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for word in load_required_words():
        source = SOURCE_DIR / f"{word}.wav"
        target = OUTPUT_DIR / f"{word}.mp3"
        if not source.exists():
            raise SystemExit(f"Missing source WAV: {source}")
        subprocess.run(
            [
                ffmpeg,
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(source),
                "-codec:a",
                "libmp3lame",
                "-b:a",
                args.bitrate,
                "-ar",
                "44100",
                "-ac",
                "1",
                str(target),
            ],
            check=True,
        )
        print(f"{source.name} -> {target.relative_to(WEB_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
