/**
 * Server-side rendering for TimeSpent reports.
 *
 * Accepts CSV text + optional JSON report, renders the same React components
 * the browser app uses, and returns a self-contained HTML document.
 *
 * No auth. No session. No state. Pure function: input in, HTML out.
 */
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { LangProvider } from '../src/i18n'
import { parseCsv, parseCsvRaw } from '../src/parseCsv'
import { parseReport, periodOverlapsCsv } from '../src/reportSchema'
import { mergeReports } from '../src/merge'
import { Report } from '../src/Report'
import { EngineeringReport } from '../src/EngineeringReport'

export interface RenderParams {
  csv: string
  json?: string
  lang?: 'en' | 'cs'
  theme?: 'light' | 'dark'
  style?: 'full' | 'colored' | 'simple'
  docType?: 'invoice' | 'engineering'
  referenceNumber?: string
  logoUrl?: string
  signatureUrl?: string
}

export interface RenderResult {
  html: string
  warnings: string[]
}

export function renderReport(params: RenderParams): RenderResult {
  const lang = params.lang ?? 'en'
  const theme = params.theme ?? 'light'
  const style = params.style ?? 'full'
  const docType = params.docType ?? 'invoice'
  const ref = params.referenceNumber ?? ''
  const warnings: string[] = []

  // Parse CSV
  const raw = parseCsvRaw(params.csv)
  const csvReport = parseCsv(params.csv, raw.detected, lang)
  if (csvReport.entryCount === 0) {
    throw new Error('No valid entries found in CSV.')
  }

  // Parse JSON if provided
  let jsonReport = null
  if (params.json) {
    jsonReport = parseReport(params.json)
    if (!periodOverlapsCsv(jsonReport, csvReport.rangeStart, csvReport.rangeEnd)) {
      warnings.push('JSON period does not overlap CSV date range.')
    }
  }

  // Merge
  const merged = mergeReports(csvReport, jsonReport, lang)

  // Determine which doc to render
  const effectiveTheme = style === 'simple' ? 'light' : theme

  const wrapped = (children: ReturnType<typeof createElement>) =>
    createElement(LangProvider, { initialLang: lang, children })

  let body: string
  if (docType === 'engineering' && jsonReport) {
    body = renderToString(
      wrapped(
        createElement(EngineeringReport, {
          merged,
          csvReport,
          jsonReport,
          theme: effectiveTheme,
          styleMode: style,
          logoUrl: params.logoUrl ?? '',
          signatureUrl: params.signatureUrl ?? null,
          referenceNumber: ref,
          lang,
        }),
      ),
    )
  } else {
    body = renderToString(
      wrapped(
        createElement(Report, {
          report: csvReport,
          theme: effectiveTheme,
          logoUrl: params.logoUrl ?? '',
          signatureUrl: params.signatureUrl ?? null,
          referenceNumber: ref,
          periodMode: 'file',
          styleMode: style,
          lang,
        }),
      ),
    )
  }

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ref || 'timespent'}-${docType === 'engineering' ? 'eng-report' : 'timespent'}</title>
<link rel="stylesheet" href="/src/index.css">
<link rel="stylesheet" href="/src/App.css">
</head>
<body data-theme="${effectiveTheme}">
${body}
</body>
</html>`

  return { html, warnings }
}
