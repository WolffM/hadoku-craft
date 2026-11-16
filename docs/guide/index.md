---
title: Craft
summary: >-
  Print-prep and colour toolkit: lay a photo (or a pool of them) out on a
  sheet for printing, or pull a colour palette out of an image. Two routes,
  no sign-in, open to anyone who can reach the site.
features:
  - name: Print sheets
    summary: 'Tile, duplex, collage or calibration-test an image for printing.'
    anchor: print-sheets
  - name: TCG proxy sheets
    summary: 'Lay out Magic or Riftbound proxies at true card size, from a deck list, a URL list or your own images.'
    anchor: tcg-proxy-sheets
  - name: Sticker sheets
    summary: 'Background removal and cutlines for die-cut stickers, from a pool of images.'
    anchor: sticker-sheets
  - name: Palette extraction
    summary: 'Click a pixel, or let it find up to 21 colours in an image automatically.'
    anchor: palette-extraction
  - name: Palette export
    summary: 'Copy the palette as hex, or export it as a labelled PNG grid.'
    anchor: palette-export
trivia:
  - 'Craft started life as a different app entirely: its first commit called it `hadoku-printtool` (`7b87187`).'
  - 'Its palette route began life as its own small repo; the last commit there, a week before Craft absorbed it, was `WolffM/color_palette_picker@e42fc45`.'
  - 'The card-proxy mode started out naming one game, MTG, in its own code (`mtgMode`); the very next commit, 24 minutes later, renamed it to support any trading card game, Riftbound included (`4a446a7`).'
  - "Quantizing a flat two-colour graphic for 21 palette slots once came back with five, because an 'empty' colour box has no pixels to average and reports a colour that is nowhere in the picture (`550bf7a`)."
---

# Craft

Craft is two small tools behind one build: **print** (`/craft`) and **palette**
(`/craft/palette`). Open either one directly, or switch between them from the
header; nothing to sign into, nothing to install.

Print turns one image, or a pool of them, into a sheet ready to print: tiled,
duplexed for postcards, auto-packed as a collage, laid out as trading-card
proxies, or prepared as die-cut stickers. Palette turns an image into a set of
colours you can copy or export, picked by hand or found automatically.

![Craft's Print route: the mode tabs across the top, a source-image drop zone and paper settings on the left, and the result pane on the right](images/print.webp)

- [Features](features.md): what each mode does and how to drive it.
- [Contributing](contributing.md): running it locally, the architecture, the
  checks it must pass.
- [History](history.md): a rename, an absorbed sibling app, and a proxy mode
  that outgrew one card game.
- [Trivia](trivia.md)

## Trivia

The palette route was once its own small repo; Craft absorbed it whole,
ColorThief CDN script and all, and rewrote the colour-finding to not need a
CDN at all ([history](history.md#the-rebrand)).
