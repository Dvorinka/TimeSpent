# TimeSpent → PDF

Clean invoice-style PDF report from any CSV time-tracking export.
Pure black & white palette, Open Sans / Noto Sans. Bilingual (EN / CS).

## Features

- **Upload any CSV** — auto-detects columns (Description, Task, Start, End, Duration, Tags)
- **Column mapping preview** — adjust which CSV column maps to which field; unmapped columns are ignored
- **Live preview** — first 3 parsed rows shown before generating the report
- **Missing columns handled gracefully** — no Task column → "Uncategorized", no Tags → "Remote", no Duration → computed from Start/End
- **i18n** — English & Czech, toggle in top-right corner
- **Post-upload settings** — reference number, period mode, style mode
- **Reference number** — e.g. invoice number; shown top-left with a line like on an invoice
- **PDF filename** — automatically `{ref}-timespent.pdf` (e.g. `2026-0042-timespent.pdf`)
- **Period:** by file (exact date range) or monthly summary (highlights month name)
- **Two styles:**
  - **Full** — visual bars, colored pill tags, light/dark theme
  - **Simple** — ink-saving, white-only, no bars, clean invoice style
- **Custom logo** — upload image, shown in header center
- **Signature** — upload image, shown at end of document right-aligned
- **Multi-page** — content flows naturally across A4 pages, no blank pages
- **Example CSV** — download a generic sample from the dropzone

## Report structure

1. **Header** — ref. number left (with line), logo center, title + period + meta right
2. **Totals band** — Total worked + On-site / Remote split
3. **Summary by task** — visual bars (Full style only) + total time
4. **Detailed breakdown** — grouped by **day**, table: Time, Task, Description, Tag, Duration
5. **Signature + footer** — signature right-aligned, footer with GitHub link & copyright

## Time format

All durations in readable format: `32 h 1 min`, `4 h 5 min`, `39 min` — no decimal hours.

## Column auto-detection

The parser fuzzy-matches CSV headers to canonical fields using aliases:

| Field | Aliases |
|---|---|
| Description | description, desc, note, notes, activity, comment, details |
| Task | task, task name, activity, category, work item |
| Start | start, start time, begin, from, start date, clock in |
| End | end, end time, finish, to, end date, clock out, stop |
| Duration | duration, elapsed, time spent, hours, total time, length, spent |
| Tags | tags, tag, label, type, location, mode, category |

Unmapped columns are silently ignored. You can override the auto-detection in the config overlay.

## Supported date formats

`YYYY-MM-DD HH:MM:SS`, `YYYY-MM-DDTHH:MM:SS`, `YYYY-MM-DD HH:MM`, `MM/DD/YYYY HH:MM`, `DD.MM.YYYY HH:MM`, `DD/MM/YYYY HH:MM`

## Supported duration formats

`H:MM:SS`, `H:MM`, decimal hours (`3.5`), plain number (treated as hours)

## Dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build      # output to dist/
npm run preview    # preview production build
```

## Docker

```bash
docker compose up --build -d    # build + run detached
docker compose ps               # check status
docker compose down             # stop + remove
# → http://localhost:8080
```

## PDF tips

In the browser print dialog choose:
- **Destination:** Save as PDF
- **Margins:** default / none
- **Size:** A4
- **Background graphics:** enabled (for bars and pill tags)

### Print quality

- **Fonts:** Open Sans / Noto Sans, `geometricPrecision` rendering, smoothing enabled
- **Dark theme in print:** automatically switched to white background (ink saving)
- **Simple style:** no black fills, only thin lines — maximum ink saving
- **Sizes in pt:** all print fonts use physical units (pt) for consistent sizing across browsers
