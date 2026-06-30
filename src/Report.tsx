import {
  formatDate,
  formatDuration,
  formatMonth,
  formatTime,
  type DayGroup,
  type ParsedReport,
} from './parseCsv'
import { useI18n, type Lang } from './i18n'

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
  lang,
}: {
  report: ParsedReport
  theme: Theme
  logoUrl: string
  signatureUrl: string | null
  referenceNumber: string
  periodMode: PeriodMode
  styleMode: StyleMode
  lang: Lang
}) {
  const { t } = useI18n()
  const { tasks, days, grandTotalSec, onSiteSec, remoteSec, dayCount, entryCount, rangeStart, rangeEnd } =
    report
  const isSimple = styleMode === 'simple'

  let periodLabel = ''
  let periodHeadline = ''
  if (periodMode === 'month' && rangeStart) {
    periodHeadline = formatMonth(rangeStart, lang)
    if (rangeStart.getTime() === rangeEnd?.getTime()) {
      periodLabel = formatDate(rangeStart, lang)
    } else {
      periodLabel = `${formatDate(rangeStart, lang)} — ${formatDate(rangeEnd!, lang)}`
    }
  } else {
    if (rangeStart && rangeEnd) {
      periodLabel =
        rangeStart.getTime() === rangeEnd.getTime()
          ? formatDate(rangeStart, lang)
          : `${formatDate(rangeStart, lang)} — ${formatDate(rangeEnd, lang)}`
    }
  }

  const generatedAt = new Date()
  const generatedLabel = `${formatDate(generatedAt, lang)} · ${formatTime(generatedAt)}`

  return (
    <div className="report" data-theme={theme} data-style={styleMode}>
      <div className="doc">
        <header className="doc-header">
          <div className="doc-header-left">
            {referenceNumber && (
              <div className="doc-ref-block">
                <div className="doc-ref-label">Ref.</div>
                <div className="doc-ref-number">{referenceNumber}</div>
                <div className="doc-ref-line" />
              </div>
            )}
          </div>
          <div className="doc-header-center">
            {logoUrl && <img src={logoUrl} alt="Logo" className="doc-logo" />}
          </div>
          <div className="doc-header-right">
            <div className="doc-title">{t('report.title')}</div>
            {periodHeadline && <div className="doc-period-headline">{periodHeadline}</div>}
            <div className="doc-meta">
              <div className="doc-meta-row">
                <span className="doc-meta-k">{t('report.period')}</span>
                <span className="doc-meta-v">{periodLabel}</span>
              </div>
              <div className="doc-meta-row">
                <span className="doc-meta-k">{t('report.generated')}</span>
                <span className="doc-meta-v">{generatedLabel}</span>
              </div>
              <div className="doc-meta-row">
                <span className="doc-meta-k">{t('report.entriesDays')}</span>
                <span className="doc-meta-v">
                  {entryCount} / {dayCount}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="doc-rule" />

        <section className="totals-band">
          <div className="totals-band-main">
            <div className="totals-band-label">{t('report.totalWorked')}</div>
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

        {report.hasTask && (
          <section className="doc-section">
            <h2 className="section-title">{t('report.summaryByTask')}</h2>
            <div className="task-totals-list">
              {tasks.map((task) => (
                <div className="task-total-row" key={task.task}>
                  <div className="task-total-name">{task.task}</div>
                  {!isSimple && (
                    <div className="task-total-bar">
                      <div
                        className="task-total-bar-fill"
                        style={{ width: `${(task.totalSec / grandTotalSec) * 100}%` }}
                      />
                    </div>
                  )}
                  <div className="task-total-time">{formatDuration(task.totalSec)}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="doc-section">
          <h2 className="section-title">{t('report.detailedBreakdown')}</h2>
          {days.map((day) => (
            <DayBlock key={day.dateKey} day={day} simple={isSimple} t={t} />
          ))}
        </section>

        <section className="doc-closing">
          <div className="signature-block">
            <div className="signature-area">
              {signatureUrl ? (
                <img src={signatureUrl} alt="Signature" className="signature-img" />
              ) : (
                <div className="signature-placeholder">{t('report.signature')}</div>
              )}
              <div className="signature-line" />
            </div>
          </div>
          <footer className="doc-footer">
            Tool created by TDvorak ·{' '}
            <a href="https://github.com/Dvorinka/TimeSpent" className="doc-footer-link">
              github.com/Dvorinka/TimeSpent
            </a>{' '}
            · © 2026
          </footer>
        </section>
      </div>
    </div>
  )
}

function DayBlock({
  day,
  simple,
  t,
}: {
  day: DayGroup
  simple: boolean
  t: ReturnType<typeof useI18n>['t']
}) {
  return (
    <div className="day-block">
      <div className="day-head">
        <span className="day-date">{day.dateLabel}</span>
      </div>
      <table className="entries-table">
        <thead>
          <tr>
            <th className="col-time">{t('report.col.time')}</th>
            <th className="col-task">{t('report.col.task')}</th>
            <th className="col-desc">{t('report.col.description')}</th>
            <th className="col-tag">{t('report.col.tag')}</th>
            <th className="col-dur">{t('report.col.duration')}</th>
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
