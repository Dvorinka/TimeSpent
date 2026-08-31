/**
 * Vite plugin that adds API routes for server-side report rendering.
 *
 * POST /api/render
 *   Content-Type: application/json
 *   Body: { csv: string, json?: string, lang?, theme?, style?, docType?, referenceNumber? }
 *   Returns: HTML document (text/html)
 *
 * POST /api/render-raw
 *   Content-Type: text/csv (body = CSV)
 *   Query params: ?json=<url-encoded-json>&lang=cs&style=colored&docType=engineering
 *   Returns: HTML document (text/html)
 *
 * GET /api/health
 *   Returns: { ok: true }
 *
 * No auth. No session. No state.
 */
import type { Plugin } from 'vite'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { renderReport } from './render'

interface RenderBody {
  csv?: string
  json?: string
  lang?: 'en' | 'cs'
  theme?: 'light' | 'dark'
  style?: 'full' | 'colored' | 'simple'
  docType?: 'invoice' | 'engineering'
  referenceNumber?: string
  logoUrl?: string
  signatureUrl?: string
}

function jsonReply(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function htmlReply(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export function timespentApiPlugin(): Plugin {
  return {
    name: 'timespent-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)

        // Health check
        if (url.pathname === '/api/health') {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
          return
        }

        // POST /api/render — JSON body with csv + optional json
        if (url.pathname === '/api/render' && req.method === 'POST') {
          try {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk as Buffer)
            }
            const body: RenderBody = JSON.parse(Buffer.concat(chunks).toString('utf-8'))

            if (!body.csv) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing "csv" field in request body.' }))
              return
            }

            const result = renderReport({
              csv: body.csv,
              json: body.json,
              lang: body.lang,
              theme: body.theme,
              style: body.style,
              docType: body.docType,
              referenceNumber: body.referenceNumber,
              logoUrl: body.logoUrl,
              signatureUrl: body.signatureUrl,
            })

            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            if (result.warnings.length > 0) {
              res.setHeader('X-Warnings', result.warnings.join('; '))
            }
            res.end(result.html)
          } catch (e) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: (e as Error).message }))
          }
          return
        }

        // POST /api/render-csv — raw CSV body, query params for options
        if (url.pathname === '/api/render-csv' && req.method === 'POST') {
          try {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk as Buffer)
            }
            const csv = Buffer.concat(chunks).toString('utf-8')

            const lang = (url.searchParams.get('lang') as 'en' | 'cs') ?? 'en'
            const theme = (url.searchParams.get('theme') as 'light' | 'dark') ?? 'light'
            const style = (url.searchParams.get('style') as 'full' | 'colored' | 'simple') ?? 'full'
            const docType = (url.searchParams.get('docType') as 'invoice' | 'engineering') ?? 'invoice'
            const ref = url.searchParams.get('ref') ?? ''
            const jsonUrl = url.searchParams.get('jsonUrl')

            let json: string | undefined
            if (jsonUrl) {
              const resp = await fetch(jsonUrl)
              json = await resp.text()
            }

            const result = renderReport({
              csv,
              json,
              lang,
              theme,
              style,
              docType,
              referenceNumber: ref,
            })

            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            if (result.warnings.length > 0) {
              res.setHeader('X-Warnings', result.warnings.join('; '))
            }
            res.end(result.html)
          } catch (e) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: (e as Error).message }))
          }
          return
        }

        // GET /view — renders report from files on disk with a nav toolbar
        if (url.pathname === '/view' && req.method === 'GET') {
          try {
            const docsDir = join(process.cwd(), 'docs')
            const csvPath = join(docsDir, 'time-entries-export-2026-08-31_15-45-48-36bbf33b-6f4a-405f-b021-1f14993c1942.csv')
            const jsonPath = join(docsDir, 'august-2026-engineering-report.json')

            const csv = await readFile(csvPath, 'utf-8')
            let json: string | undefined
            try {
              json = await readFile(jsonPath, 'utf-8')
            } catch { /* JSON optional */ }

            const lang = (url.searchParams.get('lang') as 'en' | 'cs') ?? 'cs'
            const theme = (url.searchParams.get('theme') as 'light' | 'dark') ?? 'light'
            const style = (url.searchParams.get('style') as 'full' | 'colored' | 'simple') ?? 'full'
            const docType = (url.searchParams.get('docType') as 'invoice' | 'engineering') ?? 'engineering'

            const result = renderReport({
              csv,
              json,
              lang,
              theme,
              style,
              docType,
              referenceNumber: '2026-008',
            })

            // Inject a small nav toolbar at the top of the body
            const styles = ['full', 'colored', 'simple']
            const docTypes = ['invoice', 'engineering']
            const themes = ['light', 'dark']
            const langs = ['cs', 'en']

            const styleLabels: Record<string, Record<string, string>> = {
              cs: { full: 'Plný', colored: 'Barevný', simple: 'Jednoduchý' },
              en: { full: 'Full', colored: 'Colored', simple: 'Simple' },
            }
            const docLabels: Record<string, Record<string, string>> = {
              cs: { invoice: 'Faktura', engineering: 'Inženýrská sestava' },
              en: { invoice: 'Invoice', engineering: 'Engineering Report' },
            }

            const navHtml = `<div class="ts-nav" data-theme="${theme}">
<a class="ts-nav-brand" href="/view?lang=${lang}&style=${style}&docType=${docType}&theme=${theme}">TimeSpent</a>
<div class="ts-nav-group">
${docTypes.map(dt => `<a class="ts-nav-btn ${dt === docType ? 'is-active' : ''}" href="/view?lang=${lang}&style=${style}&docType=${dt}&theme=${theme}">${docLabels[lang][dt]}</a>`).join('\n')}
</div>
<div class="ts-nav-group">
${styles.map(s => `<a class="ts-nav-btn ${s === style ? 'is-active' : ''}" href="/view?lang=${lang}&style=${s}&docType=${docType}&theme=${theme}">${styleLabels[lang][s]}</a>`).join('\n')}
</div>
<div class="ts-nav-spacer"></div>
<div class="ts-nav-group ts-nav-mini">
${langs.map(l => `<a class="ts-nav-btn ${l === lang ? 'is-active' : ''}" href="/view?lang=${l}&style=${style}&docType=${docType}&theme=${theme}">${l.toUpperCase()}</a>`).join('\n')}
</div>
<div class="ts-nav-group ts-nav-mini">
${themes.map(th => `<a class="ts-nav-btn ${th === theme ? 'is-active' : ''}" href="/view?lang=${lang}&style=${style}&docType=${docType}&theme=${th}">${th === 'light' ? '☀' : '☾'}</a>`).join('\n')}
</div>
<button class="ts-nav-btn ts-nav-pdf" onclick="window.print()">${lang === 'cs' ? 'PDF' : 'PDF'}</button>
</div>`

            const navCss = `<style>
.ts-nav { position: sticky; top: 0; z-index: 9999; display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: #fff; border-bottom: 1px solid #e0e0e0; font-family: system-ui, sans-serif; font-size: 12px; flex-wrap: nowrap; overflow-x: auto; white-space: nowrap; }
.ts-nav[data-theme='dark'] { background: #1a1a1a; border-bottom-color: #333; }
.ts-nav-brand { font-weight: 800; color: #111; text-decoration: none; font-size: 13px; flex-shrink: 0; }
.ts-nav[data-theme='dark'] .ts-nav-brand { color: #fff; }
.ts-nav-spacer { flex: 1 1 auto; }
.ts-nav-group { display: inline-flex; gap: 0; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; flex-shrink: 0; }
.ts-nav[data-theme='dark'] .ts-nav-group { border-color: #333; }
.ts-nav-mini { font-size: 11px; }
.ts-nav-btn { padding: 4px 10px; background: transparent; border: none; color: #555; text-decoration: none; font-size: 11px; font-weight: 600; cursor: pointer; border-radius: 0; white-space: nowrap; line-height: 1.4; }
.ts-nav[data-theme='dark'] .ts-nav-btn { color: #999; }
.ts-nav-btn.is-active { background: #111; color: #fff; }
.ts-nav[data-theme='dark'] .ts-nav-btn.is-active { background: #fff; color: #111; }
.ts-nav-btn:hover:not(.is-active) { background: #f0f0f0; }
.ts-nav[data-theme='dark'] .ts-nav-btn:hover:not(.is-active) { background: #2a2a2a; }
.ts-nav-pdf { border: 1px solid #ddd; border-radius: 5px; font-weight: 700; padding: 4px 12px; flex-shrink: 0; }
.ts-nav[data-theme='dark'] .ts-nav-pdf { border-color: #333; }
@media print { .ts-nav { display: none !important; } }
</style>`

            // Insert nav before the report body
            const fullHtml = result.html.replace('</head>', `${navCss}</head>`).replace('<body', `<body style="margin:0"${result.html.includes('<body') ? '' : ''}`).replace(/<body([^>]*)>/, `<body$1>${navHtml}`)

            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            res.end(fullHtml)
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'text/plain')
            res.end(`Server error: ${(e as Error).message}`)
          }
          return
        }

        next()
      })
    },
  }
}
