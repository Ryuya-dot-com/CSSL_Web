#!/usr/bin/env python3
"""Generate English stimulus audio with gTTS.

The script reads the canonical stimulus list from js/stimuli-data.js and writes
one MP3 per word under stimuli/audio/female/.
"""

from __future__ import annotations

import argparse
import re
import time
from pathlib import Path

from gtts import gTTS


ROOT = Path(__file__).resolve().parents[1]
STIMULI_JS = ROOT / "js" / "stimuli-data.js"
OUTPUT_DIR = ROOT / "stimuli" / "audio" / "female"


def load_words(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    words = re.findall(r"word:\s*'([^']+)'", text)
    seen: set[str] = set()
    unique_words: list[str] = []
    for word in words:
        if word not in seen:
            seen.add(word)
            unique_words.append(word)
    return unique_words


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Regenerate existing MP3 files.")
    parser.add_argument("--delay", type=float, default=0.2, help="Delay between gTTS requests in seconds.")
    parser.add_argument("--tld", default="com", help="gTTS top-level domain/accent option.")
    args = parser.parse_args()

    words = load_words(STIMULI_JS)
    if not words:
        raise SystemExit(f"No words found in {STIMULI_JS}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for index, word in enumerate(words, start=1):
        output_path = OUTPUT_DIR / f"{word}.mp3"
        if output_path.exists() and not args.force:
            print(f"[skip] {index:02d}/{len(words)} {word} -> {output_path}")
            continue

        print(f"[gTTS] {index:02d}/{len(words)} {word} -> {output_path}")
        tts = gTTS(text=word, lang="en", tld=args.tld, slow=False)
        tts.save(str(output_path))
        if args.delay > 0:
            time.sleep(args.delay)


if __name__ == "__main__":
    main()
