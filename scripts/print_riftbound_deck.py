"""
Produce print-ready sheets from a Riftbound deck list (.txt) — Python
mirror of what the browser TCG mode does. Useful for batch processing
without firing up the dev server.

Layout matches the in-browser compositor:
  - 8.5" x 11" sheets at 300 DPI (2550 x 3300 px)
  - 3 x 3 grid of 2.5" x 3.5" cards (750 x 1050 px each), centered

Back sheets: every front sheet gets a paired _back.png with the standard
Riftbound cardback in every occupied slot. NOTE: in Riftbound, `b`-suffix
CDN files (e.g. OGN-042b.webp) are NOT card backs — they're alt-art /
promo variants of the same card front. Real DFC mechanics don't apply
here, so the back is uniform across all slots.

Output: writes per-sheet .pngs next to the input file:
  temp/ahri.txt → temp/ahri_sheet1_front.png  + temp/ahri_sheet1_back.png
                  temp/ahri_sheet2_front.png  + temp/ahri_sheet2_back.png
                  ...

Usage:
  python scripts/print_riftbound_deck.py temp/ahri.txt temp/volibear.txt
"""
from __future__ import annotations

import argparse
import gzip
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = Path(__file__).resolve().parent
INDEX_PATH = REPO_ROOT / 'src' / 'domain' / 'processing' / 'tcg' / 'sources' / 'riftbound-index.json'
CARDBACK_PATH = SCRIPTS_DIR / 'assets' / 'cardback.png'

CDN = 'https://cdn.piltoverarchive.com/cards'
DPI = 300
PAGE_W_IN, PAGE_H_IN = 8.5, 11
CARD_W_IN, CARD_H_IN = 2.5, 3.5
COLS, ROWS = 3, 3
PAGE_W, PAGE_H = int(PAGE_W_IN * DPI), int(PAGE_H_IN * DPI)
CARD_W, CARD_H = int(CARD_W_IN * DPI), int(CARD_H_IN * DPI)
CARDS_PER_SHEET = COLS * ROWS


def fetch(url: str) -> bytes | None:
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'hadoku-craft/1.0 (+local script)',
            'Accept-Encoding': 'gzip',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            if resp.headers.get('Content-Encoding') == 'gzip':
                data = gzip.decompress(data)
            return data
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def parse_deck(text: str, index: dict[str, str]) -> tuple[list[str], list[str]]:
    """Return (resolved_ids, missing_names). Expands count multipliers."""
    ids: list[str] = []
    missing: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#') or line.endswith(':'):
            continue
        m = re.match(r'^(\d+)\s+(.+)$', line)
        if not m:
            continue
        count, name = int(m.group(1)), m.group(2).strip()
        if name in index:
            ids.extend([index[name]] * count)
        else:
            missing.append(f'{count}x {name}')
    return ids, missing


def grid_offsets() -> tuple[int, int]:
    grid_w = CARD_W * COLS
    grid_h = CARD_H * ROWS
    return ((PAGE_W - grid_w) // 2, (PAGE_H - grid_h) // 2)


def load_card(cid: str) -> Image.Image | None:
    """Load the front face of a card by ID."""
    body = fetch(f'{CDN}/{cid}.webp')
    if body is None:
        return None
    return Image.open(io.BytesIO(body)).convert('RGB')


def load_cardback() -> Image.Image:
    if not CARDBACK_PATH.exists():
        raise FileNotFoundError(
            f'Cardback not found at {CARDBACK_PATH}. Drop a card-proportioned PNG at that path.'
        )
    return Image.open(CARDBACK_PATH).convert('RGB')


def composite(
    fronts: list[Image.Image], cardback: Image.Image
) -> list[tuple[Image.Image, Image.Image]]:
    """Return list of (front_sheet, back_sheet). Back is filled with the
    cardback in every slot that the front has a card."""
    sheets: list[tuple[Image.Image, Image.Image]] = []
    xo, yo = grid_offsets()
    back_tile = cardback.resize((CARD_W, CARD_H), Image.LANCZOS)

    for page_start in range(0, len(fronts), CARDS_PER_SHEET):
        page = fronts[page_start:page_start + CARDS_PER_SHEET]
        front_sheet = Image.new('RGB', (PAGE_W, PAGE_H), 'white')
        back_sheet = Image.new('RGB', (PAGE_W, PAGE_H), 'white')

        for idx, front_img in enumerate(page):
            col, row = idx % COLS, idx // COLS
            x, y = xo + col * CARD_W, yo + row * CARD_H

            front_sheet.paste(front_img.resize((CARD_W, CARD_H), Image.LANCZOS), (x, y))

            # Back: same slot position. Cardback is uniform — no need to
            # mirror columns since every back is identical.
            back_sheet.paste(back_tile, (x, y))

        sheets.append((front_sheet, back_sheet))
    return sheets


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('decks', nargs='+', help='paths to .txt deck files')
    args = parser.parse_args()

    index = json.loads(INDEX_PATH.read_text(encoding='utf-8'))
    print(f'Loaded {len(index)} card-name entries from {INDEX_PATH.name}')

    cardback = load_cardback()
    print(f'Loaded cardback from {CARDBACK_PATH}')

    overall_status = 0

    for deck_path in args.decks:
        deck = Path(deck_path)
        if not deck.exists():
            print(f'\n[{deck.name}] ERROR: not found')
            overall_status = 1
            continue

        text = deck.read_text(encoding='utf-8')
        ids, missing = parse_deck(text, index)
        print(f'\n[{deck.name}] {len(ids)} cards resolved, {len(missing)} missing')
        for m in missing:
            print(f'  MISSING: {m}')

        unique_ids = sorted(set(ids))
        print(f'  Unique IDs: {len(unique_ids)} (this many distinct card images will be fetched)')

        if not ids:
            print(f'  Skipping {deck.name} - no resolvable cards')
            continue

        # Cache fetches so repeated cards (e.g. 6 Calm Rune) only hit the CDN once.
        cache: dict[str, Image.Image] = {}
        print(f'  Fetching {len(unique_ids)} unique card images from CDN...')
        for i, cid in enumerate(unique_ids, 1):
            img = load_card(cid)
            if img is None:
                print(f'    [{i}/{len(unique_ids)}] {cid}: not found on CDN - skipping')
                continue
            cache[cid] = img
        print(f'  Cached {len(cache)} images')

        fronts = [cache[cid] for cid in ids if cid in cache]
        sheets = composite(fronts, cardback)
        print(f'  Composited {len(sheets)} sheet(s)')

        for n, (front, back) in enumerate(sheets, 1):
            stem = deck.with_suffix('').name
            out_front = deck.parent / f'{stem}_sheet{n}_front.png'
            out_back = deck.parent / f'{stem}_sheet{n}_back.png'
            front.save(out_front, dpi=(DPI, DPI), optimize=True)
            back.save(out_back, dpi=(DPI, DPI), optimize=True)
            print(f'    wrote {out_front.name} + {out_back.name}')

    return overall_status


if __name__ == '__main__':
    sys.exit(main())
