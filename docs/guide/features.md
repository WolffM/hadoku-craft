# Craft: features

What each mode does and how to drive it. How it is built is in
[contributing.md](contributing.md).

Craft is two routes in one build: **Print** (`/craft`) and **Palette**
(`/craft/palette`). A header switch moves between them without reloading the
page.

## Print sheets

**What it does.** Four of the six print modes turn a source image, or a pool
of them, into a page-sized sheet ready to send to a printer:

- **Simple Tiling** repeats one image in a grid across the sheet (wallet
  photos, small stickers cut by hand).
- **Postcard Duplex** builds a front sheet and a column-mirrored back sheet,
  for double-sided postcards: each tile's back lines up with its front once
  the stack is flipped and reprinted.
- **Collage** packs a whole pool of differently-sized images onto one sheet,
  solving for a scale that fits everything. Four layout algorithms: Row
  Packing (good for similar-sized images), Masonry (Pinterest-style columns,
  good for portrait-heavy sets), Guillotine (space-efficient, best for mixed
  sizes) and Spiral (fills from the edges inward). A seeded random number
  generator drives the packing, so reprocessing without changing the seed
  reproduces the same arrangement.
- **Calibration Sheet** renders a grid of colour/density variations of one
  image, so you can pick the variation that prints closest to what you see
  on screen.

**How to use it.** Pick a mode from the mode selector, add a source image (and
a back image for Duplex, or a pool for Collage), then set paper size, tile
size and DPI in the sidebar. **Process** builds the sheet; **Export** saves it
as PNG or TIFF. Collage additionally offers gap size, max downscale, a floor
on placed image size, image-size normalization and whether cropping is
allowed.

**What it does not do.** Calibration Sheet runs through the local
ImageMagick/Python processing server (see
[contributing.md](contributing.md#run-it-locally)); if that server is not
running, Process fails with a message saying so rather than silently
producing nothing. Simple Tiling, Postcard Duplex and Collage run entirely in
the browser and need no server. There is no way to mix layout algorithms
within one Collage sheet.

## TCG proxy sheets

**What it does.** Lays out trading-card proxies at true card size for
printing and cutting. Supports Magic: The Gathering (cards fetched from
[Scryfall](https://scryfall.com)) and Riftbound (fetched from a public
Riftbound card CDN), plus any custom images you supply yourself. Cards can be
entered as a deck list (name and count per line, or a Scryfall URL per line
for MTG) or built from your own uploaded images. An in-browser deck editor
lets you swap in an alternate art printing for any slot. An optional cutline
is drawn around each card.

**How to use it.** Switch to the **TCG Proxies** mode, pick a game, and either
paste a deck list or add your own images. Review the deck in the editor,
swap alternate art where one exists, toggle cutlines, then **Process** to
build the sheet.

**What it does not do.** It fetches card art over the network at process
time, so it needs a working connection to the card source; there is no
offline card cache beyond what your browser keeps for the session. Only
Magic and Riftbound have a built-in card source; any other game has to be
driven entirely from your own images, with no name lookup.

## Sticker sheets

**What it does.** Runs a pool of images through a background-removal and
cutline pipeline and tiles the results onto an 8.5"×11" sheet at 300 DPI,
with 0.2" of padding per sticker. Also accepts pre-cleaned PNGs with a
transparent background, skipping background removal for those. The cutline
offset has four preset sizes, or a custom offset in inches.

**How to use it.** Switch to the **Stickers** mode, add images to the pool,
pick an offset size (or a custom one), set how many copies of each sticker to
place, and **Process**.

**What it does not do.** This mode always runs through the local processing
server (background removal needs a real image model, not something a
browser can do); without that server running, Process fails with a message
saying so. There is no preview of the cutline before processing.

## Palette extraction

**What it does.** Builds a palette of up to 21 colours from an image, by hand
or automatically.

- **Click the image** to sample one colour (averaged over a 3×3 pixel block,
  so JPEG compression noise doesn't decide the value).
- **Prefill** extracts the image's dominant colours directly.
- **Prefill (5+16)** treats the image as a colour _system_ instead of a flat
  list: one primary colour plus four variations, then four secondary colours
  plus three variations each — 21 colours exactly, grouped by family.
- **Crop-Prefill** (either prefill, run on a dragged rectangle) extracts from
  just that region instead of the whole image.
- Pan by dragging, zoom with the scroll wheel.
- **Undo** steps back up to 10 changes.

Keyboard: `Ctrl+Z` undo, `Ctrl+S` crop-prefill, `Ctrl+D` crop-prefill (5+16).

**How to use it.** Open `/craft/palette`, load an image, then click colours or
run a prefill from the toolbar. Swatches are sorted by hue; drag to reorder,
or remove one you don't want.

**What it does not do.** Colour extraction (modified median-cut
quantization) runs entirely in the browser; no image or colour data leaves
your machine. An image with fewer distinct colours than the slot count asked
for returns fewer, honestly-distinct swatches rather than padding with
near-duplicates.

## Palette export

**What it does.** **Copy Palette** puts every swatch's hex code on the
clipboard as a comma-separated list. **Export Palette** renders the palette
as a labelled PNG grid you can save.

**How to use it.** From the Palette route, use the toolbar buttons or
`Ctrl+C` (copy) / `Ctrl+E` (export).

**What it does not do.** Export is a flat image, not a structured file (no
JSON, no `.ase`/`.gpl` swatch file); reuse elsewhere means copying the hex
list instead.

## Trivia

A prefill built for 21 colour slots from a flat, two-colour test graphic once
came back with only five distinct swatches: an "empty" colour box, one with
no pixels sampled into it, falls back to its geometric midpoint, a colour
that is nowhere in the picture, and that case is now discarded rather than
counted (`550bf7a`).
