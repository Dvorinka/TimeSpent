#!/usr/bin/env npx tsx
/**
 * Standalone TimeSpent server — no auth, no state.
 *
 * Usage:
 *   npx tsx server/standalone.ts [port]
 *
 * Endpoints:
 *   GET  /api/health           — { ok: true }
 *   POST /api/render           — JSON body { csv, json?, lang?, style?, docType?, ref? }
 *   POST /api/render-csv       — raw CSV body, query params for options
 *   GET  /                     — serves the SPA from dist/
 *
 * No auth. No session. No state. Pure function: input in, HTML out.
 */
import { createServer } from 'http'
import { readFile } from 'fs/promises'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { renderReport } from './render'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST_DIR = join(__dirname, '..', 'dist')
const PORT = parseInt(process.argv[2] ?? '3001', 10)

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

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

async function readBody(req: import('http').IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  // ── API routes ──
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (url.pathname === '/api/render' && req.method === 'POST') {
    try {
      const body: RenderBody = JSON.parse(await readBody(req))
      if (!body.csv) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
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
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        ...(result.warnings.length > 0
          ? { 'X-Warnings': result.warnings.join('; ') }
          : {}),
      })
      res.end(result.html)
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: (e as Error).message }))
    }
    return
  }

  if (url.pathname === '/api/render-csv' && req.method === 'POST') {
    try {
      const csv = await readBody(req)
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

      const result = renderReport({ csv, json, lang, theme, style, docType, referenceNumber: ref })
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        ...(result.warnings.length > 0
          ? { 'X-Warnings': result.warnings.join('; ') }
          : {}),
      })
      res.end(result.html)
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: (e as Error).message }))
    }
    return
  }

  // ── Static files from dist/ ──
  if (url.pathname === '/') url.pathname = '/index.html'
  const filePath = join(DIST_DIR, url.pathname)
  try {
    const content = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' })
    res.end(content)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  }
})

server.listen(PORT, () => {
  console.log(`TimeSpent server running at http://localhost:${PORT}`)
  console.log('  GET  /api/health')
  console.log('  POST /api/render        — JSON body { csv, json?, lang?, style?, docType? }')
  console.log('  POST /api/render-csv    — raw CSV, query params for options')
  console.log('  GET  /                  — SPA')
})
