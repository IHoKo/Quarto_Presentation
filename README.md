# Ticker — engineering talk

A 15-minute reveal.js talk built from `Ticker-Engineering-Guide.pdf`, with
interactive Plotly charts, the guide's three figures rebuilt as Mermaid
diagrams, and a slide that embeds the running app at
<https://ticker-dash.fly.dev/>.

The deck is themed with the live app's own design tokens (`--brass #c9a227`,
`--gain #2f7d6e`, `--loss #a8442f`, Bricolage Grotesque / Instrument Sans /
IBM Plex Mono), so the slides and the product read as one system. Brass is
also the colour the guide uses for "the gold path" — the pushed live-price
route — which is the deck's visual spine: **gold is pushed, everything else
is requested.**

## Build

```bash
pip install -r requirements.txt   # plotly, pandas, numpy, ipykernel
./build.sh                        # everything, in the right order
```

Or individually:

```bash
quarto render ticker.qmd                    # ticker.html  (+ ticker_files/)
quarto render ticker.qmd --profile share    # dist/ticker.html, single file
python3 export-pdf.py ticker.html ticker.pdf
```

> **Order matters.** Quarto deletes `ticker_files/` after any self-contained
> render, even one written to `dist/`. Build the standalone *first* and the
> normal deck *last*, or `ticker.html` is left pointing at assets that no
> longer exist. `build.sh` does this for you.

## Outputs

| File | Use |
|---|---|
| `ticker.html` | Present from this. Needs `ticker_files/` and `libs/` beside it. Has the chalkboard plugin (press `b` to annotate). |
| `dist/ticker.html` | One 12 MB file — email it, or drop it on any static host. No chalkboard (the plugin cannot be embedded). |
| `ticker.pdf` | Flat backup, 16:9, one page per slide. No interactivity. |

## Presenting

- `S` — speaker view, with notes and a timer. Every slide has notes.
- `B` — chalkboard; `M` — menu; `F` — fullscreen; `ESC` — slide overview.
- **Slide 6 (rate mismatch)** and **slide 8 (FIFO lots)** have live controls.
  Click them; they are the two slides worth slowing down on.
- **Slide 17 is the live app** in an iframe.

### Before you present the live-demo slide

The app is passphrase-gated, and a session cookie set inside a cross-site
iframe is often blocked or partitioned (Safari, and Chrome's third-party
cookie rules). So:

1. Log in to <https://ticker-dash.fly.dev/> in another tab of the same browser
   first.
2. If the frame still shows only the gate, hit the gold **Open live demo ↗**
   button — it opens a real tab, and the deck stays open behind it.
3. If the network or the market is down, press `→` for the annotated backup
   slide (it is uncounted, so it does not shift the slide numbers).

The deck itself needs no network: plotly.js is served from `libs/`, and only
the webfonts and the demo iframe are remote.

## Layout

```
ticker.qmd              the deck — content + the four chart cells
theme/ticker.scss       reveal theme built from the app's design tokens
theme/reveal-fixes.js   Plotly resize + Mermaid re-render + iframe overlay
theme/plotly-head.html  loads libs/plotly.min.js from <head>
libs/plotly.min.js      plotly.js, vendored so the deck works offline
_quarto.yml             chalkboard (here so the share profile can disable it)
_quarto-share.yml       the single-file profile
export-pdf.py           PDF export at the deck's real aspect ratio
figs/                   drop dashboard.png here to replace the mock poster
```

### Regenerating the vendored plotly

```bash
python3 -c "import plotly.offline,pathlib; \
  pathlib.Path('libs/plotly.min.js').write_text(plotly.offline.get_plotlyjs())"
```

## Things that will bite you if you edit this

Four non-obvious failure modes are already worked around; keep them in mind.

- **Mermaid is measured in a hidden slide.** Quarto renders diagrams into the
  `<pre>` while its reveal section is still `display:none`, so every label is
  measured at the wrong width and clipped mid-word. `theme/reveal-fixes.js`
  stashes the sources at parse time and re-renders each diagram with no
  container, which makes mermaid measure in the visible body instead.
- **Plotly is sized in a hidden slide too**, and comes out as a sliver. The
  same file re-runs `Plotly.Plots.resize()` on `slidechanged`.
- **A heading inside a fenced div** makes pandoc promote the div to a
  `<section>`, which reveal then treats as a *vertical slide*. That is why the
  cards use `[Title]{.h4}` spans rather than `#### Title`.
- **Two inline spans in one paragraph are one grid cell.** `[a]{.n}[b]{.t}`
  is a single `<p>`, so a CSS grid squeezes the whole thing into the first
  column. `.stage` uses a hanging indent instead.

Also: don't set chart font sizes in `em` inside an already-shrunk wrapper —
they compound. Captions are sized in `px` for that reason.

## About the data

The guide contains no datasets, only stated figures. So:

- **Real, from the guide** — 291 tests, one machine, ≤ 4 flushes/second per
  symbol, the 250 ms coalescing window, the cost breakdown, the free-tier
  limits, the four defect-discovery channels.
- **Illustrative** — the trade-print scatter, the FIFO lots, and the
  value-over-time series. Each is captioned as such on its slide, and each is
  generated from a fixed seed (`20260907`) so it is identical on every render.
