# Craft: history

Craft began on 2025-12-29 as a single-purpose print-prep tool and grew into
two unrelated products sharing one build.

## The print tool

The first commit built `hadoku-printtool` from a hydrated app template
(`7b87187`), and the first real implementation landed the same day
(`9312e35`, `dce8be3`). Its Cloudflare Worker API handler was pulled out into
a separate `./api` export in March 2026 (`0f7da38`), the shape the package
still has: a UI library and a Worker handler factory published from the
same package.

## From one game to any game

In May 2026 the tool grew a trading-card proxy mode and a sticker mode in
one large commit (`0a4c171`). The proxy mode started out naming the one
game it supported, Magic: The Gathering, directly in its module name
(`mtgMode`). The very next commit, 24 minutes later, generalised it into a
game-agnostic `tcgMode` with Riftbound as its second supported game, plumbed
through a `CardSource` plugin per game (`4a446a7`). Riftbound then gained its own
in-browser deck editor with a per-slot alternate-art picker (`3779c44`), a
cutline option (`ba2632b`), and a name index expanded to the game's full
762-card catalog (`6ba60e8`).

Through the same period the app's colours and logging moved onto the
platform's shared theme tokens and logger (`f726232`), and in August its
last local copies of the theme were dropped in favour of the platform's own
theme root (`75f0156`).

## The rebrand

On 2026-08-24 the app was renamed from `hadoku-printtool` to `hadoku-craft`
— the package, the API base path, the Worker handler's name and every CSS
class prefix (`4de94d1`). The same day, Craft absorbed a second, unrelated
product: a standalone colour-palette picker, ported in whole as a second
route rather than linked to separately (`550bf7a`). The absorbed tool had
loaded its colour-quantization library from a CDN script, and a published
package cannot do that. So the quantizer was ported into this repo's own
code — which also lifted a 20-colour clamp the CDN version had, and made
the colour logic unit-testable for the first time. A header fix two weeks later
made sure the app introduced itself as "Craft", not "Hadoku Craft"
(`4f5efe0`).

## Trivia

The proxy mode's Magic data source once treated an empty network response
the same as a genuine "card not found". To a user, that looked identical to
a request that had simply been refused. The two cases were split apart in
September 2026 (`4a89d6c`), the same week a second proxy fix stopped the
mode from trusting a card's collector number over its name when the two
disagreed (`d79c80d`).
