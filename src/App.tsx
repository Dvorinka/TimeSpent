import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import {
  parseCsv,
  parseCsvRaw,
  type ColumnMapping,
  type ParsedReport,
  type RawParseResult,
} from './parseCsv'
import { Report } from './Report'
import { useI18n } from './i18n'

type Theme = 'light' | 'dark'
type PeriodMode = 'file' | 'month'
type StyleMode = 'full' | 'simple'

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Image load failed.'))
    reader.readAsDataURL(file)
  })
}

export default function App() {
  const { lang, setLang, t } = useI18n()

  const [report, setReport] = useState<ParsedReport | null>(null)
  const [rawParse, setRawParse] = useState<RawParseResult | null>(null)
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null)
  const [csvText, setCsvText] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [dragOver, setDragOver] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')
  const [styleMode, setStyleMode] = useState<StyleMode>('full')
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)

  const [showConfig, setShowConfig] = useState(false)
  const [periodMode, setPeriodMode] = useState<PeriodMode>('file')
  const [referenceNumber, setReferenceNumber] = useState<string>('')

  const inputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const sigInputRef = useRef<HTMLInputElement>(null)

  const effectiveTheme = styleMode === 'simple' ? 'light' : theme

  useEffect(() => {
    if (report && !showConfig) {
      const ref = referenceNumber.trim()
      document.title = ref ? `${ref}-timespent` : 'timespent'
    } else {
      document.title = t('dropzone.title')
    }
  }, [report, showConfig, referenceNumber, t])

  const handleFile = useCallback(
    (file: File) => {
      setError('')
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const text = String(reader.result ?? '')
          const raw = parseCsvRaw(text)
          setCsvText(text)
          setRawParse(raw)
          setColumnMapping(raw.detected)

          const parsed = parseCsv(text, raw.detected, lang)
          if (parsed.entryCount === 0) {
            setError(t('dropzone.error.noEntries'))
            setReport(null)
            return
          }
          setReport(parsed)
          setShowConfig(true)
        } catch (e) {
          setError(t('dropzone.error.parse', { msg: (e as Error).message }))
          setReport(null)
        }
      }
      reader.onerror = () => {
        setError(t('dropzone.error.readFile'))
        setReport(null)
      }
      reader.readAsText(file)
    },
    [lang, t],
  )

  const reparseWithMapping = useCallback(
    (mapping: ColumnMapping) => {
      if (!csvText) return
      const parsed = parseCsv(csvText, mapping, lang)
      setReport(parsed)
    },
    [csvText, lang],
  )

  const updateColumnMapping = useCallback(
    (field: keyof ColumnMapping, header: string | null) => {
      if (!columnMapping) return
      const newMapping = { ...columnMapping, [field]: header }
      setColumnMapping(newMapping)
      reparseWithMapping(newMapping)
    },
    [columnMapping, reparseWithMapping],
  )

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
    setRawParse(null)
    setColumnMapping(null)
    setCsvText('')
    setShowConfig(false)
    setReferenceNumber('')
    setPeriodMode('file')
    setStyleMode('full')
    setTheme('light')
  }, [])

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'cs' : 'en')
  }, [lang, setLang])

  // Re-parse when language changes (for locale-aware labels)
  useEffect(() => {
    if (csvText && columnMapping) {
      reparseWithMapping(columnMapping)
    }
  }, [lang, csvText, columnMapping, reparseWithMapping])

  const columnFields: { key: keyof ColumnMapping; label: string }[] = [
    { key: 'description', label: t('column.description') },
    { key: 'task', label: t('column.task') },
    { key: 'start', label: t('column.start') },
    { key: 'end', label: t('column.end') },
    { key: 'duration', label: t('column.duration') },
    { key: 'tags', label: t('column.tags') },
  ]

  return (
    <div className="app" data-theme={effectiveTheme}>
      {/* Language toggle — always visible */}
      <button
        className="lang-toggle no-print"
        onClick={toggleLang}
        title={t('lang.toggle')}
        aria-label={t('lang.toggle')}
      >
        {lang.toUpperCase()}
      </button>

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
            <h1>{t('dropzone.title')}</h1>
            <p className="dropzone-sub">{t('dropzone.subtitle')}</p>
            <div className="dropzone-cta">
              <span className="cta-btn">{t('dropzone.cta')}</span>
            </div>
            <p className="dropzone-hint">{t('dropzone.hint')}</p>
            <a
              className="dropzone-example"
              href="/example.csv"
              download="example.csv"
              onClick={(e) => e.stopPropagation()}
            >
              {t('dropzone.example')}
            </a>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
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

      {report && showConfig && rawParse && columnMapping && (
        <div className="config-overlay no-print">
          <div className="config-card">
            <h2>{t('config.title')}</h2>
            <p className="config-sub">
              {t('config.subtitle', { entries: report.entryCount, days: report.dayCount })}
            </p>

            {/* Column mapping */}
            <div className="config-field">
              <label className="config-label">{t('config.columnMapping')}</label>
              <span className="config-hint">{t('config.columnMappingHint')}</span>
              <div className="column-mapping-grid">
                {columnFields.map(({ key, label }) => (
                  <div className="column-mapping-row" key={key}>
                    <span className="column-mapping-label">{label}</span>
                    <select
                      className="column-mapping-select"
                      value={columnMapping[key] ?? ''}
                      onChange={(e) =>
                        updateColumnMapping(key, e.target.value || null)
                      }
                    >
                      <option value="">{t('column.none')}</option>
                      {rawParse.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview table */}
            {rawParse.sampleEntries.length > 0 && (
              <div className="config-field">
                <label className="config-label">{t('config.preview')}</label>
                <div className="preview-table-wrap">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th>{t('column.task')}</th>
                        <th>{t('column.description')}</th>
                        <th>{t('column.start')}</th>
                        <th>{t('column.end')}</th>
                        <th>{t('column.duration')}</th>
                        <th>{t('column.tags')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawParse.sampleEntries.map((e, i) => (
                        <tr key={i}>
                          <td>{e.task}</td>
                          <td>{e.description}</td>
                          <td>{e.start.toLocaleString()}</td>
                          <td>{e.end.toLocaleString()}</td>
                          <td>{e.durationSec}s</td>
                          <td>{e.tag}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="config-field">
              <label className="config-label">{t('config.refNumber')}</label>
              <input
                type="text"
                className="config-input"
                placeholder={t('config.refPlaceholder')}
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                autoFocus
              />
              <span className="config-hint">
                {t('config.refHint', { ref: referenceNumber.trim() || 'ref' })}
              </span>
            </div>

            <div className="config-field">
              <label className="config-label">{t('config.period')}</label>
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
                    <strong>{t('config.period.file')}</strong>
                    <small>{t('config.period.fileDesc')}</small>
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
                    <strong>{t('config.period.month')}</strong>
                    <small>{t('config.period.monthDesc')}</small>
                  </span>
                </label>
              </div>
            </div>

            <div className="config-field">
              <label className="config-label">{t('config.style')}</label>
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
                    <strong>{t('config.style.full')}</strong>
                    <small>{t('config.style.fullDesc')}</small>
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
                    <strong>{t('config.style.simple')}</strong>
                    <small>{t('config.style.simpleDesc')}</small>
                  </span>
                </label>
              </div>
            </div>

            <div className="config-actions">
              <button className="btn-ghost" onClick={resetAll}>
                {t('config.cancel')}
              </button>
              <button className="btn-primary" onClick={() => setShowConfig(false)}>
                {t('config.continue')}
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
                {referenceNumber || t('toolbar.noRef')}
              </span>
            </div>
            <div className="toolbar-right">
              {styleMode === 'full' && (
                <div className="theme-toggle" role="group" aria-label={t('toolbar.theme')}>
                  <button
                    className={theme === 'light' ? 'is-active' : ''}
                    onClick={() => setTheme('light')}
                    title={t('toolbar.light')}
                  >
                    {t('toolbar.light')}
                  </button>
                  <button
                    className={theme === 'dark' ? 'is-active' : ''}
                    onClick={() => setTheme('dark')}
                    title={t('toolbar.dark')}
                  >
                    {t('toolbar.dark')}
                  </button>
                </div>
              )}
              <div className="style-toggle" role="group" aria-label={t('toolbar.style')}>
                <button
                  className={styleMode === 'full' ? 'is-active' : ''}
                  onClick={() => setStyleMode('full')}
                  title={t('toolbar.full')}
                >
                  {t('toolbar.full')}
                </button>
                <button
                  className={styleMode === 'simple' ? 'is-active' : ''}
                  onClick={() => setStyleMode('simple')}
                  title={t('toolbar.simple')}
                >
                  {t('toolbar.simple')}
                </button>
              </div>
              <button
                className="btn-ghost"
                onClick={() => logoInputRef.current?.click()}
                title={t('toolbar.logoTitle')}
              >
                {t('toolbar.logo')}
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
                title={t('toolbar.signatureTitle')}
              >
                {t('toolbar.signature')}
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
                {t('toolbar.settings')}
              </button>
              <button className="btn-ghost" onClick={resetAll}>
                {t('toolbar.newFile')}
              </button>
              <button className="btn-primary" onClick={() => window.print()}>
                {t('toolbar.downloadPdf')}
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
            lang={lang}
          />
        </>
      )}

      <footer className="app-footer no-print">
        Tool created by TDvorak ·{' '}
        <a
          href="https://github.com/Dvorinka/TimeSpent"
          className="app-footer-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/Dvorinka/TimeSpent
        </a>{' '}
        · © 2026
      </footer>
    </div>
  )
}
