import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { parseCsv, type ParsedReport } from './parseCsv'
import { Report } from './Report'

type Theme = 'light' | 'dark'
type PeriodMode = 'file' | 'month'
type StyleMode = 'full' | 'simple'

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Nepodařilo se načíst obrázek.'))
    reader.readAsDataURL(file)
  })
}

export default function App() {
  const [report, setReport] = useState<ParsedReport | null>(null)
  const [error, setError] = useState<string>('')
  const [dragOver, setDragOver] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')
  const [styleMode, setStyleMode] = useState<StyleMode>('full')
  const [logoUrl, setLogoUrl] = useState<string>('/logo.png')
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)

  // post-upload config
  const [showConfig, setShowConfig] = useState(false)
  const [periodMode, setPeriodMode] = useState<PeriodMode>('file')
  const [referenceNumber, setReferenceNumber] = useState<string>('')

  const inputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const sigInputRef = useRef<HTMLInputElement>(null)

  // When style is simple, force light theme
  const effectiveTheme = styleMode === 'simple' ? 'light' : theme

  // Set document title for PDF filename: {ref}-timespent
  useEffect(() => {
    if (report && !showConfig) {
      const ref = referenceNumber.trim()
      document.title = ref ? `${ref}-timespent` : 'timespent'
    } else {
      document.title = 'TimeSpent → PDF · tdvorak.dev'
    }
  }, [report, showConfig, referenceNumber])

  const handleFile = useCallback((file: File) => {
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parseCsv(String(reader.result ?? ''))
        if (parsed.entryCount === 0) {
          setError('V CSV nebyly nalezeny žádné platné záznamy.')
          setReport(null)
          return
        }
        setReport(parsed)
        setShowConfig(true)
      } catch (e) {
        setError(`Chyba při zpracování CSV: ${(e as Error).message}`)
        setReport(null)
      }
    }
    reader.onerror = () => {
      setError('Nepodařilo se načíst soubor.')
      setReport(null)
    }
    reader.readAsText(file)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const onLogoUpload = useCallback(async (file: File) => {
    try {
      setLogoUrl(await readImageAsDataUrl(file))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const onSignatureUpload = useCallback(async (file: File) => {
    try {
      setSignatureUrl(await readImageAsDataUrl(file))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const resetAll = useCallback(() => {
    setReport(null)
    setShowConfig(false)
    setReferenceNumber('')
    setPeriodMode('file')
    setStyleMode('full')
    setTheme('light')
  }, [])

  return (
    <div className="app" data-theme={effectiveTheme}>
      {!report && (
        <div className="dropzone-wrap">
          <div
            className={`dropzone ${dragOver ? 'is-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <img src="/logo.png" alt="TDvorak" className="dropzone-logo" />
            <h1>TimeSpent → PDF</h1>
            <p className="dropzone-sub">
              Nahrajte export z TimeSpent (CSV) a vygenerujte přehlednou sestavu času ve formátu
              faktury.
            </p>
            <div className="dropzone-cta">
              <span className="cta-btn">Vybrat CSV soubor</span>
            </div>
            <p className="dropzone-hint">
              Použité sloupce: Description, Task, Start, End, Duration, Tags
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />
          </div>
          {error && <div className="error">{error}</div>}
        </div>
      )}

      {report && showConfig && (
        <div className="config-overlay no-print">
          <div className="config-card">
            <img src="/logo.png" alt="TDvorak" className="config-logo" />
            <h2>Nastavení sestavy</h2>
            <p className="config-sub">
              Načteno {report.entryCount} záznamů, {report.dayCount} dní. Před generováním sestavy
              vyplňte:
            </p>

            <div className="config-field">
              <label className="config-label">Referenční číslo</label>
              <input
                type="text"
                className="config-input"
                placeholder="např. číslo faktury: 2026-0042"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                autoFocus
              />
              <span className="config-hint">
                Zobrazí se vlevo nahoře jako na faktuře. Volitelné. Použije se také jako název
                souboru PDF ({referenceNumber.trim() || 'ref'}-timespent.pdf).
              </span>
            </div>

            <div className="config-field">
              <label className="config-label">Období</label>
              <div className="config-radio-group">
                <label className={`config-radio ${periodMode === 'file' ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="period"
                    value="file"
                    checked={periodMode === 'file'}
                    onChange={() => setPeriodMode('file')}
                  />
                  <span className="config-radio-text">
                    <strong>Podle souboru</strong>
                    <small>Zobrazí přesný rozsah dat ze záznamů</small>
                  </span>
                </label>
                <label className={`config-radio ${periodMode === 'month' ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="period"
                    value="month"
                    checked={periodMode === 'month'}
                    onChange={() => setPeriodMode('month')}
                  />
                  <span className="config-radio-text">
                    <strong>Měsíční přehled</strong>
                    <small>Zvýrazní název měsíce v záhlaví (např. „Červen 2026“)</small>
                  </span>
                </label>
              </div>
            </div>

            <div className="config-field">
              <label className="config-label">Styl</label>
              <div className="config-radio-group">
                <label className={`config-radio ${styleMode === 'full' ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="style"
                    value="full"
                    checked={styleMode === 'full'}
                    onChange={() => setStyleMode('full')}
                  />
                  <span className="config-radio-text">
                    <strong>Plný</strong>
                    <small>Vizuální bary, barevné pill tagy, světelný/tmavý motiv</small>
                  </span>
                </label>
                <label className={`config-radio ${styleMode === 'simple' ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="style"
                    value="simple"
                    checked={styleMode === 'simple'}
                    onChange={() => setStyleMode('simple')}
                  />
                  <span className="config-radio-text">
                    <strong>Jednoduchý</strong>
                    <small>
                      Ink-saving, pouze bílý motiv, bez vizuálních barů, čistý fakturový styl
                    </small>
                  </span>
                </label>
              </div>
            </div>

            <div className="config-actions">
              <button className="btn-ghost" onClick={resetAll}>
                Zrušit
              </button>
              <button className="btn-primary" onClick={() => setShowConfig(false)}>
                Pokračovat
              </button>
            </div>
          </div>
        </div>
      )}

      {report && !showConfig && (
        <>
          <div className="toolbar no-print">
            <div className="toolbar-left">
              <span className="toolbar-ref" title={referenceNumber}>
                {referenceNumber || 'Bez ref.'}
              </span>
            </div>
            <div className="toolbar-right">
              {styleMode === 'full' && (
                <div className="theme-toggle" role="group" aria-label="Motiv">
                  <button
                    className={theme === 'light' ? 'is-active' : ''}
                    onClick={() => setTheme('light')}
                    title="Světlý motiv"
                  >
                    Světlý
                  </button>
                  <button
                    className={theme === 'dark' ? 'is-active' : ''}
                    onClick={() => setTheme('dark')}
                    title="Tmavý motiv"
                  >
                    Tmavý
                  </button>
                </div>
              )}
              <div className="style-toggle" role="group" aria-label="Styl">
                <button
                  className={styleMode === 'full' ? 'is-active' : ''}
                  onClick={() => setStyleMode('full')}
                  title="Plný vizuální styl"
                >
                  Plný
                </button>
                <button
                  className={styleMode === 'simple' ? 'is-active' : ''}
                  onClick={() => setStyleMode('simple')}
                  title="Jednoduchý ink-saving styl"
                >
                  Jednoduchý
                </button>
              </div>
              <button
                className="btn-ghost"
                onClick={() => logoInputRef.current?.click()}
                title="Nahrát vlastní logo"
              >
                Logo
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onLogoUpload(f)
                  e.target.value = ''
                }}
              />
              <button
                className="btn-ghost"
                onClick={() => sigInputRef.current?.click()}
                title="Nahrát podpis"
              >
                Podpis
              </button>
              <input
                ref={sigInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onSignatureUpload(f)
                  e.target.value = ''
                }}
              />
              <button className="btn-ghost" onClick={() => setShowConfig(true)}>
                Nastavení
              </button>
              <button className="btn-ghost" onClick={resetAll}>
                Nový soubor
              </button>
              <button className="btn-primary" onClick={() => window.print()}>
                Stáhnout PDF
              </button>
            </div>
          </div>
          <Report
            report={report}
            theme={effectiveTheme}
            logoUrl={logoUrl}
            signatureUrl={signatureUrl}
            referenceNumber={referenceNumber}
            periodMode={periodMode}
            styleMode={styleMode}
          />
        </>
      )}
    </div>
  )
}
