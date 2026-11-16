# Craft: trivia

Each fact names the commit it comes from.

## Trivia

- **A different name, twice.** Craft was `hadoku-printtool` for its first
  eight months (`7b87187`), and inside that name its card-proxy mode was
  `mtgMode` for exactly one commit before the very next commit, 24 minutes
  later, generalised it to support any game but Magic (`4a446a7`).
- **A whole other app, absorbed.** The palette route was its own small repo,
  `color_palette_picker`; its last commit, a week before Craft absorbed it
  as a second route, was `WolffM/color_palette_picker@e42fc45`. The absorbed
  code had loaded its colour library from a CDN `<script>` tag — something a
  published package cannot do — so it was rewritten in, which also lifted a
  20-colour ceiling the original had (`550bf7a`).
- **Five missing swatches.** A palette prefill asked for 21 colours from a
  flat, two-colour test image once returned only five. An empty colour box
  has no pixels to average, so it reported a colour that was nowhere in the
  picture — until that case was discarded instead of counted (`550bf7a`).
- **762 cards, by name.** Riftbound's card-proxy support grew from a handful
  of entries to a name index covering the game's full catalog, 762 cards
  (`6ba60e8`).
- **Worktrees were silently unguarded.** For months, a commit made from a
  git worktree (rather than the main checkout) skipped every lint and
  typecheck gate, with no warning and no failure. The hook path pointed at
  a generated, gitignored directory that only the main checkout had
  populated (`eae8ef5`).
- **No pull request was ever checked.** This repo had no CI on pull requests
  at all until one was added, deliberately with no file filter. A required
  check that only sometimes runs is a gate that is silently absent on some
  PRs and never-ending on others (`7816dc0`).
- **A busy Wednesday.** The single busiest day in the repo's history,
  2026-08-05, saw 23 commits — mostly a chain of automatic `@wolffm/*`
  dependency updates interleaved with the fixes those updates triggered
  (fact sheet, 2026-11-16).
- **Late nights.** Commits by a person cluster in the evening more than any
  other time of day: more land between 9 p.m. and 11 p.m. than in any other
  two-hour span (fact sheet, 2026-11-16).
