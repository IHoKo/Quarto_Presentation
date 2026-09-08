# Ticker — a case study in AI-assisted development

A 15-minute reveal.js talk. Ticker — a live stock dashboard with a streaming
price feed, a FIFO portfolio ledger and an AI analyst — is the case study; the
subject is how it got built, and what that says about the economics of
software now.

15 slides plus an uncounted backup, a live demo of the running app at
<https://ticker-dash.fly.dev/>, four interactive Plotly charts, three Mermaid
diagrams, and a full spoken script in the speaker notes.

**Every number is measured from the Ticker repository**
(<https://github.com/IHoKo/Live-Trading-Dashboard>) or quoted from its own
planning documents — see *About the numbers* below.

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

## Sharing a link (GitHub Pages)

`.github/workflows/publish.yml` renders the deck on every push to `main` and
publishes it to GitHub Pages, so the link is always the current slides:

    https://ihoko.github.io/Quarto_Presentation/

One-time setup: **Settings -> Pages -> Build and deployment -> Source:
GitHub Actions**. After that, pushing to `main` republishes it; you can also
trigger a rebuild by hand from the Actions tab.

The published site is `ticker.html` renamed to `index.html`, plus
`ticker_files/`, `libs/` and `figs/` beside it (~15 MB, mostly the vendored plotly).
Anyone with the link can open it — no GitHub account needed. Note that Pages
sites on a public repo are public; the deck contains nothing private, and the
embedded app still asks viewers for its own passphrase.

## Presenting

- `S` — speaker view. **The notes are a full spoken script**, written to be
  read aloud almost word-for-word.
- **Presenter instructions are red, bold and in square brackets** —
  `[SWITCH TO BROWSER]`, `[PAUSE]`, `[CLICK THE 100 ms BUTTON]`. Everything in
  black is meant to be spoken. The two never look alike.
- Every slide opens with `[TARGET TIME: m:ss — TOTAL m:ss]`. **The deck totals
  exactly 15:00.**
- `B` — chalkboard; `M` — menu; `F` — fullscreen; `ESC` — slide overview.
- **Slide 4 is the live app** in an iframe, with step-by-step demo choreography
  in the notes. **Slides 5, 7, 11 and 12 have live chart controls** — click them.

### Before you present the live-demo slide

The app is passphrase-gated, and a session cookie set inside a cross-site
iframe is often blocked or partitioned (Safari, and Chrome's third-party
cookie rules). So:

1. Log in to <https://ticker-dash.fly.dev/> in another tab of the same browser
   first.
2. If the frame still shows only the gate, hit the gold **Open live demo ↗**
   button — it opens a real tab, and the deck stays open behind it.
3. If the network or the market is down, press `→` for the backup slide — a
   real screenshot of the dashboard (uncounted, so it does not shift the
   slide numbers).

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
figs/dashboard.png      screenshot shown on the backup slide
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

## About the numbers

The time and cost claims are the spine of this talk, so each one is traceable.

**Measured from the repository**

| Claim | Source |
|---|---|
| 21 commits | `git log` (dates deliberately not shown on the slides) |
| ~9 h hands-on (rounded down from 9.2) | inter-commit gaps over 45 min excluded, plus 30 min lead-in per session |
| 7,963 Python / 3,033 TS+TSX lines | line count by extension, `node_modules` excluded |
| 241 test functions in 15 files (291 collected, 13 `parametrize`) | `grep` over `backend/tests` |
| 1,064 lines of planning docs | `plan.md` 606 + `CLAUDE.md` 342 + `prompts.md` 116 |

**Quoted from the project's own spec, written before any code**

| Claim | Source |
|---|---|
| 8.5–11.5 developer-days | `plan.md` §10, summing the seven phase estimates |
| "The plan is 8–12 days of work" | `prompts.md`, opening paragraph |
| Per-discipline split on the skills slide | the same §10 estimates, mapped to the role that would own each phase |
| ~$3/mo running cost | `plan.md` §12, and the actual Fly.io invoice |

**Derived, and labelled as such on the slide**

- **≈9× faster / 89% less time** — the spec estimate (68–92 h at 8 h per
  developer-day) over the measured 9 h. The slide shows the 8×–10× range and
  draws the estimate's uncertainty as an error bar. The measured side is the
  conservative end, rounded down, so the ratio understates rather than flatters.
- **The cost chart** multiplies the spec's developer-days by a day-rate you
  choose from three buttons. No salary figure is asserted.
- **The rate-mismatch chart** is illustrative of the ratio described in the
  spec, captioned as such, and generated from a fixed seed (`20260907`).

Nothing on the slides is a number I could not point at a file for. If you
change the repository and re-render, the charts change with it.
