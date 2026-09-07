# Ticker — Quarto / reveal.js presentation

## Context

The repo currently holds one artefact: `Ticker-Engineering-Guide.pdf`, a 12-page
engineering guide for **Ticker**, a single-machine stock dashboard (live prices over
WebSocket, an append-only FIFO ledger, and an AI analyst that can propose changes but
never make them). It runs live at <https://ticker-dash.fly.dev/>.

We want to turn that document into a **15-minute conference-grade talk** built with
Quarto + reveal.js: bespoke theming, interactive Plotly charts, the guide's three
figures rebuilt as themed Mermaid diagrams, and a slide that embeds the running app
so the talk ends on the real thing rather than a screenshot.

Decisions already made with the user:

| Question | Decision |
|---|---|
| Live demo | Full-bleed `background-iframe` **plus** an always-visible "Open ↗" escape hatch |
| Chart data | Illustrative series derived from the guide's stated numbers, **captioned as illustrative** |
| Figures 1–3 | Mermaid, restyled in the app's palette |
| Scope | ~18 slides, 15 minutes |

### What reconnaissance already established

- `quarto 1.10.18`, Python 3.14.3, Jupyter engine OK, headless Chrome present. **No R** —
  the deck must use the Jupyter/Python engine.
- `plotly 6.7.0`, `pandas 3.0.2`, `numpy 2.4.4`, `ipykernel 7.2.0` are all installed.
  **No new dependencies are needed.**
- `https://ticker-dash.fly.dev/` sends **no `X-Frame-Options` and no CSP `frame-ancestors`**
  → it *can* be iframed. It has no CORS headers, so live `fetch()` of `/api/health` from
  the deck is blocked; don't attempt it.
- The app publishes its own design tokens in `/assets/index-*.css`. **Use them verbatim**
  so the deck and the product look like one system:

  ```
  --ink   #0e1116   --paper #f5f2ec   --slate #1a2028
  --gain  #2f7d6e   --loss  #a8442f   --brass #c9a227
  display: "Bricolage Grotesque" 700   body: "Instrument Sans"   data: "IBM Plex Mono"
  ```

  In dark mode the app flips `--ink`/`--paper`; the deck is dark, so text `#f5f2ec`
  on `#0e1116`, with `--brass` as the accent — which is also the colour the guide uses
  for "the gold path" (the pushed live-price route). That coincidence is the deck's
  visual spine: **gold = pushed, everything else = requested.**

---

## Files to create

```
Quarto_Presentation/
├── ticker.qmd                 # the deck (all content + Python chart cells)
├── theme/ticker.scss          # reveal theme built from the app's tokens
├── theme/reveal-fixes.js      # Plotly resize-on-slidechange + iframe overlay wiring
├── figs/                      # poster image(s) for the demo fallback
├── requirements.txt           # plotly, pandas, numpy (pin what's installed)
└── Ticker-Engineering-Guide.pdf   (unchanged)
```

Everything lives in one `.qmd`; no `_quarto.yml` is needed for a single deck.

---

## 1. `ticker.qmd` front matter

```yaml
---
title: "Ticker"
subtitle: "One machine · three rented services · 291 tests"
date: today
format:
  revealjs:
    theme: [dark, theme/ticker.scss]
    width: 1600
    height: 900
    slide-number: c/t
    transition: slide
    background-transition: fade
    hash: true
    menu: true
    chalkboard: true
    preview-links: auto
    highlight-style: github-dark
    footer: "Ticker · Engineering Guide · ticker-dash.fly.dev"
    include-after-body: theme/reveal-fixes.js
    mermaid:
      theme: dark
jupyter: python3
execute:
  echo: false
  warning: false
  freeze: auto
---
```

`freeze: auto` keeps re-renders fast once the charts are settled.

**Standalone build (for sharing one file):**
`quarto render ticker.qmd -M embed-resources:true` → a single self-contained HTML.
For that to work offline, the setup cell must inline plotly.js (see §3).

---

## 2. `theme/ticker.scss`

Quarto SCSS needs the two sentinel comments. Structure:

```scss
/*-- scss:defaults --*/
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:wght@400;500;600&display=swap');

$paper: #0e1116;  $ink: #f5f2ec;  $slate: #1a2028;
$gain:  #2f7d6e;  $loss: #a8442f; $brass: #c9a227;

$body-bg: $paper;
$body-color: $ink;
$link-color: $brass;
$presentation-font-family: "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
$presentation-heading-font: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
$presentation-heading-color: $ink;
$presentation-font-size-root: 34px;
$code-block-font-size: 0.55em;

/*-- scss:rules --*/
```

Rules to author (these are what make it look designed rather than templated):

- `.kicker` — the guide's small-caps eyebrow label: `IBM Plex Mono`, `0.42em`,
  `letter-spacing: .18em`, `text-transform: uppercase`, colour `$brass`, with a
  1px `$brass` rule under it. Used on nearly every slide, mirroring
  `FIGURE 1 · RUNTIME ARCHITECTURE`.
- `.stat-grid` / `.stat` — CSS grid of stat tiles: mono label in `$brass` above a
  large `Bricolage Grotesque` value. Drives the "At a glance" and "Status" slides.
- `.gain` / `.loss` / `.brass` — inline colour utilities for numbers.
- `.mono` — `IBM Plex Mono` for module paths (`services/price_hub.py · flush()`).
- `.rule` — the hairline divider the guide uses between sections.
- `.demo-overlay` — the live-demo escape hatch: fixed bottom-right, `z-index: 60`,
  `pointer-events: auto`, brass border, backdrop blur.
- Mermaid overrides — force the Mermaid SVG to inherit the deck fonts and let
  `.gold-path` edges render in `$brass` with a thicker stroke.
- Tighten reveal defaults: `.reveal h2 { letter-spacing: -0.02em; }`, remove the
  default `text-transform` on headings, and set `.reveal section img { border-radius: 6px }`.

Headings are `Bricolage Grotesque 700` with tight tracking — matching the app's
`--font-display` exactly.

---

## 3. Python setup cell (first cell of the deck)

```python
#| label: setup
import numpy as np, pandas as pd
import plotly.graph_objects as go, plotly.io as pio

INK, PAPER = "#f5f2ec", "#0e1116"
SLATE, GAIN, LOSS, BRASS = "#1a2028", "#2f7d6e", "#a8442f", "#c9a227"

pio.templates["ticker"] = go.layout.Template(layout=dict(
    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
    font=dict(family="Instrument Sans, system-ui", color=INK, size=15),
    colorway=[BRASS, GAIN, LOSS, "#7a8794"],
    xaxis=dict(gridcolor="#232a33", zeroline=False),
    yaxis=dict(gridcolor="#232a33", zeroline=False),
    margin=dict(l=60, r=30, t=40, b=50), hovermode="x unified",
))
pio.templates.default = "ticker"
pio.renderers.default = "notebook"   # inlines plotly.js -> offline + embed-resources safe
rng = np.random.default_rng(20260907)  # fixed seed: charts are reproducible
```

Two things matter here and are easy to get wrong:

1. **`pio.renderers.default = "notebook"`** inlines plotly.js instead of pulling it
   from a CDN. Without it the deck breaks on a conference wifi failure and
   `embed-resources` produces a file that still needs the network.
2. **Transparent backgrounds** (`rgba(0,0,0,0)`) — otherwise every chart shows a
   white rectangle on the dark deck.

Every chart is emitted with `fig.show(config={"displayModeBar": False})` (or a
minimal mode bar where zoom genuinely helps), and every chart slide carries a
caption in `.kicker` style ending in **"illustrative — shape, not real trades"**.

---

## 4. `theme/reveal-fixes.js`

Two problems, both known reveal.js/Plotly gotchas, both must be solved here:

```html
<script>
window.addEventListener('load', function () {
  if (!window.Reveal) return;

  // 1. Plotly divs render at zero width inside hidden slides.
  //    Resize whatever is on the slide we just landed on.
  function resizeSlide(ev) {
    var s = (ev && ev.currentSlide) || Reveal.getCurrentSlide();
    if (!s || !window.Plotly) return;
    s.querySelectorAll('.plotly-graph-div')
     .forEach(function (d) { Plotly.Plots.resize(d); });
  }
  Reveal.on('slidechanged', resizeSlide);
  Reveal.on('ready', resizeSlide);
  window.addEventListener('resize', resizeSlide);

  // 2. On a background-interactive slide the iframe swallows clicks; keep the
  //    escape-hatch button clickable above it.
  Reveal.on('slidechanged', function (ev) {
    document.querySelectorAll('.demo-overlay')
      .forEach(function (o) { o.style.pointerEvents = 'auto'; });
  });
});
</script>
```

Without hook #1, roughly half the Plotly charts appear as a thin sliver the first
time you navigate to them. This is the single most common failure mode of
Plotly-in-reveal and is worth verifying explicitly.

---

## 5. Slide-by-slide outline (18 slides ≈ 15 min)

| # | Slide | Build notes |
|---|---|---|
| 1 | **Title** | Full-bleed `$paper`; `.kicker` "ENGINEERING GUIDE · V1.0 · SEPTEMBER 2026"; huge `Ticker` in Bricolage; the guide's one-paragraph abstract; brass hairline. |
| 2 | **At a glance** | `.stat-grid` × 6: LIVE `ticker-dash.fly.dev` · BACKEND `Python 3.12 / FastAPI` · FRONTEND `React 18 / Vite` · TESTS `291` · MACHINES `1` · COST `~$3/mo`. Fragments so tiles land one by one. |
| 3 | **One process, on purpose** | The constraint framing: the market feed allows one connection per key; the database is a file that cannot be mounted twice. *Deliberate constraint, not a limit of scale.* |
| 4 | **Figure 1 · Runtime architecture** | Mermaid `flowchart TB`, five bands: Sources → Providers → Services → API+Auth → Browser. `subgraph` per band. |
| 5 | **Figure 1 · The gold path** | Same diagram, `classDef gold stroke:#c9a227,stroke-width:3px` applied to Finnhub socket → PriceHub → `/ws/prices` → Zustand → TickerTape. Two static states rather than fragmenting nodes (Mermaid nodes can't be reveal-fragmented reliably). |
| 6 | ⭐ **The rate mismatch** | **Centrepiece Plotly chart.** ~300 trade prints/sec as a dense scatter rug over 3 s, against the coalesced step line at one point per 250 ms. Annotation: "≈900 prints in → 12 frames out". `updatemenus` buttons switch the flush interval **100 / 250 / 1000 ms** so you can show the tradeoff live. |
| 7 | **Figure 2 · Three paths** | Mermaid, three lanes: **A live price** (pushed, never touches the DB) · **B portfolio** (writes) · **C chat turn** (proposes). The diamond gate on track C highlighted in brass. |
| 8 | **Track B · Transactions are truth** | Plotly FIFO chart: buy lots at different prices, a sell consuming oldest-first, realized P/L. `updatemenus` toggles **FIFO vs average cost** — the two give different realized P/L, which is exactly the guide's argument for storing no share count. |
| 9 | **Track C · Proposes, never executes** | The capability argument: the tool dispatcher holds a read-only `PortfolioReader`, *not a connection* — "it cannot write, because it holds no object capable of writing." Styled confirm-card mock in the app palette; 5-minute expiry; replayed confirm → 410. |
| 10 | **Value over time** | Plotly area (market value) + step line (cost basis), with `rangeselector` buttons (1M/3M/6M/1Y) mirroring the app's range buttons. Include a shaded "no history for this symbol" band → the *degrade honestly, never guess* rule: named, never zero-filled. |
| 11 | **Four rented services** | 2×2 grid: Finnhub (live, free) · Twelve Data (history, 800/day) · Anthropic (analyst, per-use) · Fly.io (~$3/mo). Each with its **"without it"** line — that column is what makes the slide interesting. |
| 12 | **Five constraints** | One machine · the ledger is the only truth · model proposes / person disposes · reports but never advises · degrade honestly. Compact, mono sub-lines. |
| 13 | **Figure 3 · How it was built** | Mermaid loop: spec (`plan.md` §1–§14, `prompts.md`, `CLAUDE.md`) → read phase spec → inspect & verify externals → implement → verify locally (291 pytest · ruff · tsc · docker build) → **All green?** → ship → observe in production → back to the top. |
| 14 | **How defects surfaced** | The four channels — test suite · code review (a cache leak) · production (market hours only) · screenshots (a chart dying on a CSS colour token). Punchline: **three of four only fire after deploy.** |
| 15 | **Operations & cost** | Plotly horizontal bar to "under $10" using the guide's real figures. Plus the migration note: run at boot, idempotently — never as a release command, because that machine has no volume attached. And backups via SQLite online backup, not a file copy. |
| 16 | **Status · what is built** | `.stat-grid` × 6: market data · portfolio · analyst · watchlist · security · operations. |
| 17 | ⭐ **LIVE DEMO** | Full-bleed background iframe (see §6). |
| 18 | **Close** | *Not investment advice.* + the guide's footer line: `ONE MACHINE · THREE RENTED SERVICES · 291 TESTS`. |

Every slide gets a `::: {.notes}` block — a 15-minute talk needs the pacing cues,
and it makes reveal's speaker view (`S`) actually useful.

---

## 6. The live-demo slide

```markdown
## {#live-demo background-iframe="https://ticker-dash.fly.dev/" background-interactive}

::: {.demo-overlay}
[Open live demo ↗](https://ticker-dash.fly.dev/){target="_blank" rel="noopener"}
:::
```

Notes that decide whether this works in the room:

- Reveal lazy-loads background iframes, so the app is only hit when you approach
  the slide — no cost to the first 16 slides.
- `background-interactive` lets you click *into* the app. The `.demo-overlay`
  needs `z-index` above `.slide-background` and `pointer-events: auto` (both in
  the SCSS + the JS hook) or the iframe eats the button.
- **The app is passphrase-gated.** A session cookie set inside a cross-site iframe
  is likely to be blocked or partitioned by Safari and by Chrome's third-party
  cookie rules. Mitigations, in order: (a) log in to `ticker-dash.fly.dev` in a
  normal tab of the same browser before presenting; (b) if the iframe still shows
  the gate, hit the overlay button and demo in a real tab — the deck stays open
  behind it. This is why the escape hatch is not optional.
- **Poster fallback:** put a dashboard screenshot at `figs/dashboard.png` and show
  it as the slide background if the iframe is unusable. A headless-Chrome capture
  only gets the login gate (the app is gated), so this file has to come from the
  user — **please drop one in `figs/`**. If none is supplied, build a CSS-only mock
  poster in the app palette instead and label it as a mock.

---

## 7. Content fidelity — read this before writing prose

The guide's text was extracted from the PDF programmatically. Some ligature glyphs
lack `ToUnicode` mappings and came through as `?`. The reconstruction is
unambiguous from context, but **do not copy `?` into slides**:

`Eve?thing`→Everything · `b?wse?`→browser · `p?cess`→process · `ma?et`→market ·
`Fi?ub`→Finnhub · `Ant?opic`→Anthropic · `Zusta?`→Zustand · `Das?oard`→Dashboard ·
`engi?`→engine · `Performa?e`→Performance · `?ute`→route · `le?er`→ledger ·
`?itten`→written · `?ile`→while · `?ether`→whether · `H?S`→HTTPS · `jou?al`→journal

Spot-check any quoted sentence against the PDF before it goes on a slide. Direct
quotes worth using verbatim: *"The rate mismatch is the design problem."*,
*"The model can create a proposal; it cannot execute one."*,
*"it cannot write, because it holds no object capable of writing."*,
*"Three of the four channels only fire after deploy."*

---

## 8. Verification

```bash
quarto render ticker.qmd && open ticker.html
```

Then check, in order — these are the things that actually break:

1. **Plotly sizing** — arrow through slides 6, 8, 10, 15. Each chart must fill its
   slide on *first* arrival, not after a window resize. If any renders as a sliver,
   `reveal-fixes.js` is not loading — confirm `include-after-body` resolved.
2. **Plotly interactivity** — the flush-interval buttons on slide 6 and the
   FIFO/average toggle on slide 8 must actually redraw.
3. **Mermaid** — slides 4, 5, 7, 13 render as SVG (not raw text), inherit the deck
   fonts, and the gold path is visibly brass on slide 5.
4. **Theme** — no white chart backgrounds; Bricolage/Instrument Sans/IBM Plex Mono
   all loading (check DevTools Network for the Google Fonts request).
5. **Live demo** — slide 17 loads the app; the overlay button is clickable and
   opens a new tab. Test in the browser you will actually present from.
6. **Speaker view** — press `S`; notes appear and the timer runs.
7. **Offline** — turn off wifi and reload: charts must still render (proves
   plotly.js is inlined). Only the demo iframe and webfonts should fail.
8. **PDF export** — `open "ticker.html?print-pdf"` then print to PDF, as a backup
   deliverable.
9. **Standalone** — `quarto render ticker.qmd -M embed-resources:true` produces a
   single shareable HTML file.

## Out of scope

- No live `fetch()` of `/api/health` — the API sends no CORS headers, so it would
  fail silently in the browser. Confirmed by request.
- No new Python packages; plotly/pandas/numpy are already installed.
