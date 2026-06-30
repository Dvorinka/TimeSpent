import {
  formatDateCzech,
  formatDuration,
  formatMonthCzech,
  formatTime,
  type DayGroup,
  type ParsedReport,
} from './parseCsv'

type Theme = 'light' | 'dark'
type PeriodMode = 'file' | 'month'
type StyleMode = 'full' | 'simple'

export function Report({
  report,
  theme,
  logoUrl,
  signatureUrl,
  referenceNumber,
  periodMode,
  styleMode,
}: {
  report: ParsedReport
  theme: Theme
  logoUrl: string
  signatureUrl: string | null
  referenceNumber: string
  periodMode: PeriodMode
  styleMode: StyleMode
}) {
  const { tasks, days, grandTotalSec, onSiteSec, remoteSec, dayCount, entryCount, rangeStart, rangeEnd } =
    report
  const isSimple = styleMode === 'simple'

  // Period label based on mode
  let periodLabel = ''
  let periodHeadline = ''
  if (periodMode === 'month' && rangeStart) {
    periodHeadline = formatMonthCzech(rangeStart)
    if (rangeStart.getTime() === rangeEnd?.getTime()) {
      periodLabel = formatDateCzech(rangeStart)
    } else {
      periodLabel = `${formatDateCzech(rangeStart)} — ${formatDateCzech(rangeEnd!)}`
    }
  } else {
    if (rangeStart && rangeEnd) {
      periodLabel =
        rangeStart.getTime() === rangeEnd.getTime()
          ? formatDateCzech(rangeStart)
          : `${formatDateCzech(rangeStart)} — ${formatDateCzech(rangeEnd)}`
    }
  }

  const generatedAt = new Date()
  const generatedLabel = `${formatDateCzech(generatedAt)} · ${formatTime(generatedAt)}`

  return (
    <div className="report" data-theme={theme} data-style={styleMode}>
      <div className="doc">
        {/* ===== Document header (invoice-style) ===== */}
        <header className="doc-header">
          <div className="doc-header-left">
            {referenceNumber ? (
              <div className="doc-ref-block">
                <div className="doc-ref-label">Ref.</div>
                <div className="doc-ref-number">{referenceNumber}</div>
                <div className="doc-ref-line" />
              </div>
            ) : (
              <img src={logoUrl} alt="Logo" className="doc-logo" />
            )}
          </div>
          <div className="doc-header-center">
            <img src={logoUrl} alt="Logo" className="doc-logo" />
          </div>
          <div className="doc-header-right">
            <div className="doc-title">Sestava odpracovaného času</div>
            {periodHeadline && <div className="doc-period-headline">{periodHeadline}</div>}
            <div className="doc-meta">
              <div className="doc-meta-row">
                <span className="doc-meta-k">Období</span>
                <span className="doc-meta-v">{periodLabel}</span>
              </div>
              <div className="doc-meta-row">
                <span className="doc-meta-k">Vygenerováno</span>
                <span className="doc-meta-v">{generatedLabel}</span>
              </div>
              <div className="doc-meta-row">
                <span className="doc-meta-k">Záznamů / Dní</span>
                <span className="doc-meta-v">
                  {entryCount} / {dayCount}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="doc-rule" />

        {/* ===== Totals band ===== */}
        <section className="totals-band">
          <div className="totals-band-main">
            <div className="totals-band-label">Celkem odpracováno</div>
            <div className="totals-band-value">{formatDuration(grandTotalSec)}</div>
          </div>
          <div className="totals-band-split">
            <div className="totals-split-item">
              {isSimple ? (
                <span className="totals-split-label">On-site</span>
              ) : (
                <span className="tag-pill tag-onsite">On-site</span>
              )}
              <span className="totals-split-dur">{formatDuration(onSiteSec)}</span>
            </div>
            <div className="totals-split-item">
              {isSimple ? (
                <span className="totals-split-label">Remote</span>
              ) : (
                <span className="tag-pill tag-remote">Remote</span>
              )}
              <span className="totals-split-dur">{formatDuration(remoteSec)}</span>
            </div>
          </div>
        </section>

        {/* ===== Summary by task ===== */}
        <section className="doc-section">
          <h2 className="section-title">Souhrn podle úkolu</h2>
          <div className="task-totals-list">
            {tasks.map((t) => (
              <div className="task-total-row" key={t.task}>
                <div className="task-total-name">{t.task}</div>
                {!isSimple && (
                  <div className="task-total-bar">
                    <div
                      className="task-total-bar-fill"
                      style={{ width: `${(t.totalSec / grandTotalSec) * 100}%` }}
                    />
                  </div>
                )}
                <div className="task-total-time">{formatDuration(t.totalSec)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== Detailed breakdown (grouped by day, across all tasks) ===== */}
        <section className="doc-section">
          <h2 className="section-title">Detailní přehled</h2>
          {days.map((day) => (
            <DayBlock key={day.dateKey} day={day} simple={isSimple} />
          ))}
        </section>

        {/* ===== Closing: signature only (no footer) ===== */}
        <section className="doc-closing">
          <div className="signature-block">
            <div className="signature-area">
              {signatureUrl ? (
                <img src={signatureUrl} alt="Podpis" className="signature-img" />
              ) : (
                <div className="signature-placeholder">[ podpis ]</div>
              )}
              <div className="signature-line" />
              <div className="signature-label">tdvorak.dev</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function DayBlock({ day, simple }: { day: DayGroup; simple: boolean }) {
  return (
    <div className="day-block">
      <div className="day-head">
        <span className="day-date">{day.dateLabel}</span>
      </div>
      <table className="entries-table">
        <thead>
          <tr>
            <th className="col-time">Čas</th>
            <th className="col-task">Úkol</th>
            <th className="col-desc">Popis</th>
            <th className="col-tag">Tag</th>
            <th className="col-dur">Doba</th>
          </tr>
        </thead>
        <tbody>
          {day.entries.map((e, i) => (
            <tr key={`${day.dateKey}-${i}`}>
              <td className="col-time">
                {formatTime(e.start)}–{formatTime(e.end)}
              </td>
              <td className="col-task">{e.task}</td>
              <td className="col-desc">{e.description}</td>
              <td className="col-tag">
                {simple ? (
                  <span className="tag-text">{e.tag}</span>
                ) : (
                  <span
                    className={`tag-pill ${e.tag.toLowerCase().includes('site') ? 'tag-onsite' : 'tag-remote'}`}
                  >
                    {e.tag}
                  </span>
                )}
              </td>
              <td className="col-dur">{formatDuration(e.durationSec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
