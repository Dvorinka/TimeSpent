import type { CSSProperties } from 'react'
import {
  formatDate,
  formatMonth,
  formatTime,
  type ParsedReport,
} from './parseCsv'
import { useI18n, type Lang } from './i18n'
import {
  formatNum,
  formatSigned,
  type MergedDay,
  type MergedReport,
} from './merge'
import type { EngineeringReport as EngReport, ReportMilestone } from './reportSchema'

type Theme = 'light' | 'dark'

/**
 * Derive a GitHub commit base URL from a repository string.
 * Accepts either a bare "owner/repo" or a decorated form like
 * "ELXTECH/MyBox_Ops (worktree: MyBox_Worktree)".
 * Returns "https://github.com/<owner>/<repo>/commit/" or null when the
 * input cannot be parsed.
 */
function repoToBaseUrl(repo: string | undefined): string | null {
  if (!repo) return null
  const match = repo.match(/^\s*([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)/)
  if (!match) return null
  return `https://github.com/${match[1]}/commit/`
}

/**
 * Build a lookup of repo key -> commit base URL from the report's
 * `repositories` map. Used to resolve per-commit `repo` overrides.
 */
function buildRepoBaseUrlMap(
  repositories: Record<string, string> | undefined,
): Map<string, string> {
  const map = new Map<string, string>()
  if (repositories) {
    for (const [key, repo] of Object.entries(repositories)) {
      const base = repoToBaseUrl(repo)
      if (base) map.set(key, base)
    }
  }
  return map
}

export function EngineeringReport({
  merged,
  csvReport,
  jsonReport,
  theme,
  styleMode,
  logoUrl,
  signatureUrl,
  referenceNumber,
  lang,
}: {
  merged: MergedReport
  csvReport: ParsedReport
  jsonReport: EngReport | null
  theme: Theme
  styleMode: 'full' | 'colored' | 'simple'
  logoUrl: string
  signatureUrl: string | null
  referenceNumber: string
  lang: Lang
}) {
  const { t } = useI18n()

  // All days: JSON days + CSV-only days, sorted chronologically
  const allDays = merged.days

  const periodDate = csvReport.rangeStart ?? (jsonReport ? new Date(jsonReport.period.start + 'T00:00:00') : new Date())
  const periodEndDate = csvReport.rangeEnd ?? (jsonReport ? new Date(jsonReport.period.end + 'T00:00:00') : periodDate)

  let periodLabel = ''
  if (periodDate.getTime() === periodEndDate.getTime()) {
    periodLabel = formatDate(periodDate, lang)
  } else {
    periodLabel = `${formatDate(periodDate, lang)} — ${formatDate(periodEndDate, lang)}`
  }
  const periodHeadline = formatMonth(periodDate, lang)

  const generatedAt = new Date()
  const generatedLabel = `${formatDate(generatedAt, lang)} · ${formatTime(generatedAt)}`

  const hasJson = jsonReport !== null
  const commitBaseUrl = repoToBaseUrl(jsonReport?.repository)
  const repoBaseUrlMap = buildRepoBaseUrlMap(jsonReport?.repositories)

  return (
    <div className="report eng-report" data-theme={theme} data-style={styleMode}>
      <div className="doc">
        {/* Header — same layout as invoice */}
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
            <div className="doc-title">{t('eng.title')}</div>
            <div className="doc-period-headline">{periodHeadline}</div>
            <div className="doc-meta">
              <div className="doc-meta-row">
                <span className="doc-meta-k">{t('eng.repository')}</span>
                <span className="doc-meta-v">{jsonReport?.repository ?? '—'}</span>
              </div>
              <div className="doc-meta-row">
                <span className="doc-meta-k">{t('report.period')}</span>
                <span className="doc-meta-v">{periodLabel}</span>
              </div>
              <div className="doc-meta-row">
                <span className="doc-meta-k">{t('report.generated')}</span>
                <span className="doc-meta-v">{generatedLabel}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="doc-rule" />

        {/* Optional comment / disclaimer */}
        {hasJson && jsonReport?.comment && (
          <section className="eng-comment">
            <p>{jsonReport.comment}</p>
          </section>
        )}

        {/* Summary tiles */}
        {hasJson && jsonReport ? (
          <section className="eng-summary-band">
            <div className="eng-summary-band-main">
              <div className="eng-summary-band-label">{t('eng.commits')}</div>
              <div className="eng-summary-band-value">{formatNum(jsonReport.summary.totalCommits)}</div>
            </div>
            <div className="eng-summary-band-split">
              <div className="eng-summary-split-item">
                <span className="eng-summary-split-label">{t('eng.filesTouched')}</span>
                <span className="eng-summary-split-dur">{formatNum(jsonReport.summary.filesTouched)}</span>
              </div>
              <div className="eng-summary-split-item">
                <span className="eng-summary-split-label">{t('eng.netLines')}</span>
                <span className="eng-summary-split-dur">{formatSigned(jsonReport.summary.netLines)}</span>
              </div>
              <div className="eng-summary-split-item">
                <span className="eng-summary-split-label">{t('eng.activeDays')}</span>
                <span className="eng-summary-split-dur">{formatNum(jsonReport.summary.activeDays)}</span>
              </div>
              <div className="eng-summary-split-item">
                <span className="eng-summary-split-label">{t('eng.tagsReleased')}</span>
                <span className="eng-summary-split-dur">{formatNum(jsonReport.summary.tagsReleased)}</span>
              </div>
            </div>
          </section>
        ) : (
          <section className="eng-empty-state">
            <p className="eng-empty-text">{t('eng.noJsonHint')}</p>
            <p className="eng-empty-sub">{t('eng.noJsonSub')}</p>
          </section>
        )}

        {/* Per-repo breakdown */}
        {hasJson && jsonReport && (
          <RepoBreakdown jsonReport={jsonReport} t={t} colored={styleMode === 'colored'} />
        )}

        {/* Milestone list */}
        {hasJson && jsonReport && jsonReport.milestones.length > 0 && (
          <section className="doc-section eng-milestones-section">
            <h2 className="section-title">{t('eng.milestones')}</h2>
            <ol className="eng-milestone-list">
              {jsonReport.milestones.map((m, i) => (
                <MilestoneRow key={m.id} index={i + 1} milestone={m} t={t} />
              ))}
            </ol>
          </section>
        )}

        {/* Daily breakdown — JSON days + CSV-only days */}
        {hasJson && allDays.length > 0 && (
          <section className="doc-section">
            <h2 className="section-title">
              {t('eng.dailyBreakdown')} ({allDays.length} {t('eng.days')})
            </h2>
            {allDays.map((day) => (
              <MergedDayBlock
                key={day.dateKey}
                day={day}
                t={t}
                commitBaseUrl={commitBaseUrl}
                repoBaseUrlMap={repoBaseUrlMap}
                jsonReport={jsonReport}
                colored={styleMode === 'colored'}
              />
            ))}
          </section>
        )}

        {/* Activity heatmap — at the bottom */}
        {hasJson && jsonReport && (
          <section className="doc-section eng-heatmap-section">
            <h2 className="section-title">{t('eng.activityHeatmap')}</h2>
            <ActivityHeatmap days={allDays} periodDate={periodDate} lang={lang} />
          </section>
        )}

        {/* Next month goals — compact, only when present */}
        {hasJson && jsonReport?.nextMonthGoals && (
          <section className="eng-next-goals">
            <h3 className="eng-next-goals-title">{t('eng.nextMonthGoals')}</h3>
            <p className="eng-next-goals-text">{jsonReport.nextMonthGoals}</p>
          </section>
        )}

        {/* Signature + footer */}
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

// ── Activity heatmap ────────────────────────────────────────────────────────

function ActivityHeatmap({
  days,
  periodDate,
  lang,
}: {
  days: MergedDay[]
  periodDate: Date
  lang: Lang
}) {
  const { t } = useI18n()

  // Build a map of date -> intensity (commit count from JSON; 0 for non-git days)
  const intensityMap = new Map<string, number>()
  let maxIntensity = 1

  for (const day of days) {
    const intensity = day.reportDay?.commitCount ?? 0
    intensityMap.set(day.dateKey, intensity)
    if (intensity > maxIntensity) maxIntensity = intensity
  }

  // Build calendar grid for the period month
  const year = periodDate.getFullYear()
  const month = periodDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Determine first day of month weekday (0=Sun)
  const firstWeekday = new Date(year, month, 1).getDay()

  const cells: { date: string | null; intensity: number; dayNum: number | null }[] = []
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ date: null, intensity: 0, dayNum: null })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const intensity = intensityMap.get(dateKey) ?? 0
    cells.push({ date: dateKey, intensity, dayNum: d })
  }

  const weekdayLabels = t('eng.heatWeekdays').split(' ')

  function intensityClass(intensity: number): string {
    if (intensity === 0) return 'eng-heat-cell-l0'
    const ratio = intensity / maxIntensity
    if (ratio > 0.75) return 'eng-heat-cell-l4'
    if (ratio > 0.5) return 'eng-heat-cell-l3'
    if (ratio > 0.25) return 'eng-heat-cell-l2'
    return 'eng-heat-cell-l1'
  }

  return (
    <div className="eng-heatmap" data-lang={lang}>
      <div className="eng-heatmap-weekdays">
        {weekdayLabels.map((w, i) => (
          <div key={i} className="eng-heatmap-weekday">{w}</div>
        ))}
      </div>
      <div className="eng-heatmap-grid">
        {cells.map((cell, i) => (
          <div
            key={i}
            className={`eng-heat-cell ${cell.date ? intensityClass(cell.intensity) : 'eng-heat-cell-empty'}`}
            title={cell.date ? `${cell.date}: ${cell.intensity > 0 ? cell.intensity.toFixed(0) : 'no activity'}` : ''}
          >
            {cell.dayNum && <span className="eng-heat-cell-num">{cell.dayNum}</span>}
          </div>
        ))}
      </div>
      <div className="eng-heatmap-legend">
        <span className="eng-heatmap-legend-label">{t('eng.heatLess')}</span>
        <div className="eng-heat-cell eng-heat-cell-l0 eng-heat-cell-sm" />
        <div className="eng-heat-cell eng-heat-cell-l1 eng-heat-cell-sm" />
        <div className="eng-heat-cell eng-heat-cell-l2 eng-heat-cell-sm" />
        <div className="eng-heat-cell eng-heat-cell-l3 eng-heat-cell-sm" />
        <div className="eng-heat-cell eng-heat-cell-l4 eng-heat-cell-sm" />
        <span className="eng-heatmap-legend-label">{t('eng.heatMore')}</span>
      </div>
    </div>
  )
}

// ── Milestone card ──────────────────────────────────────────────────────────

function MilestoneRow({
  index,
  milestone,
  t,
}: {
  index: number
  milestone: ReportMilestone
  t: ReturnType<typeof useI18n>['t']
}) {
  const statusLabel = t(`eng.status.${milestone.status}` as Parameters<typeof t>[0])
  const achieved = milestone.status === 'achieved'
  return (
    <li className="eng-milestone-row">
      <div className="eng-milestone-index">{index}</div>
      <div className="eng-milestone-body">
        <div className="eng-milestone-row-header">
          <span className="eng-milestone-row-title">{milestone.title}</span>
          <span
            className={`eng-milestone-badge ${achieved ? 'eng-milestone-badge-on' : 'eng-milestone-badge-off'}`}
            title={statusLabel}
          >
            {achieved ? '✓' : '✕'}
          </span>
        </div>
        <div className="eng-milestone-row-statusline">{statusLabel}</div>
        <div className="eng-milestone-row-meta">{milestone.dateRange}</div>
        <div className="eng-milestone-row-objective">{milestone.objective}</div>
        <div className="eng-milestone-row-summary">{milestone.summary}</div>
      </div>
    </li>
  )
}

// ── Repo breakdown ──────────────────────────────────────────────────────────

function RepoBreakdown({
  jsonReport,
  t,
  colored,
}: {
  jsonReport: EngReport
  t: ReturnType<typeof useI18n>['t']
  colored: boolean
}) {
  // Compute per-repo stats from all commits across all days
  const repoStats = new Map<string, { commits: number; files: number; ins: number; del: number }>()

  for (const day of jsonReport.days) {
    for (const c of day.commits) {
      const repoKey = c.repo ?? '__primary__'
      const entry = repoStats.get(repoKey) ?? { commits: 0, files: 0, ins: 0, del: 0 }
      entry.commits++
      entry.files += c.files
      entry.ins += c.insertions
      entry.del += c.deletions
      repoStats.set(repoKey, entry)
    }
  }

  // Resolve repo display names
  const repoName = (key: string): string => {
    if (key === '__primary__') {
      const match = jsonReport.repository.match(/^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)/)
      return match ? match[2] : jsonReport.repository
    }
    const full = jsonReport.repositories?.[key]
    if (full) {
      const match = full.match(/^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)/)
      return match ? match[2] : full
    }
    return key
  }

  // Sort by commit count descending
  const sorted = [...repoStats.entries()].sort((a, b) => b[1].commits - a[1].commits)

  if (sorted.length <= 1) return null

  return (
    <section className="doc-section eng-repo-breakdown-section">
      <h2 className="section-title">{t('eng.repoBreakdown')}</h2>
      <div className="eng-repo-grid">
        {sorted.map(([key, stats], i) => {
          const name = repoName(key)
          const color = colored ? REPO_COLORS[i % REPO_COLORS.length] : '#666666'
          return (
            <div key={key} className="eng-repo-card" style={{ '--repo-color': color } as CSSProperties}>
              <div className="eng-repo-card-header">
                <span className="eng-repo-dot" style={{ background: color }} />
                <span className="eng-repo-name">{name}</span>
              </div>
              <div className="eng-repo-card-stats">
                <div className="eng-repo-stat">
                  <span className="eng-repo-stat-value">{formatNum(stats.commits)}</span>
                  <span className="eng-repo-stat-label">{t('eng.commits')}</span>
                </div>
                <div className="eng-repo-stat">
                  <span className="eng-repo-stat-value">{formatNum(stats.files)}</span>
                  <span className="eng-repo-stat-label">{t('eng.filesTouched')}</span>
                </div>
                <div className="eng-repo-stat">
                  <span className="eng-repo-stat-value eng-repo-diff">
                    <span className="eng-diff-sign eng-diff-ins">+</span>{formatNum(stats.ins)}
                  </span>
                  <span className="eng-repo-stat-label">{t('eng.col.ins')}</span>
                </div>
                <div className="eng-repo-stat">
                  <span className="eng-repo-stat-value eng-repo-diff">
                    <span className="eng-diff-sign eng-diff-del">-</span>{formatNum(stats.del)}
                  </span>
                  <span className="eng-repo-stat-label">{t('eng.col.del')}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Merged day block: git days + time-only days in the same visual style ─────

// Stable color palette for repo badges. Indexed by repo key hash.
const REPO_COLORS = [
  '#2563eb', '#7c3aed', '#059669', '#d97706',
  '#dc2626', '#0891b2', '#db2777', '#65a30d',
]

function repoColor(key: string, colored: boolean): string {
  if (!colored) return '#666666'
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  }
  return REPO_COLORS[Math.abs(hash) % REPO_COLORS.length]
}

function resolveRepoLabel(
  repoKey: string | undefined,
  jsonReport: EngReport | null,
): string {
  if (!repoKey || repoKey === '__primary__') {
    if (!jsonReport) return ''
    // Extract "owner/repo" from the start of the string, then take the repo part
    const match = jsonReport.repository.match(/^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)/)
    return match ? match[2] : jsonReport.repository
  }
  const full = jsonReport?.repositories?.[repoKey]
  if (full) {
    const match = full.match(/^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)/)
    return match ? match[2] : full
  }
  return repoKey
}

function MergedDayBlock({
  day,
  t,
  commitBaseUrl,
  repoBaseUrlMap,
  jsonReport,
  colored,
}: {
  day: MergedDay
  t: ReturnType<typeof useI18n>['t']
  commitBaseUrl: string | null
  repoBaseUrlMap: Map<string, string>
  jsonReport: EngReport | null
  colored: boolean
}) {
  const hasJson = day.reportDay !== null

  if (hasJson) {
    const report = day.reportDay!
    const hasCommits = report.commitCount > 0

    // Group commits by repo key
    const repoGroups = new Map<string, typeof report.commits>()
    for (const c of report.commits) {
      const key = c.repo ?? '__primary__'
      const group = repoGroups.get(key) ?? []
      group.push(c)
      repoGroups.set(key, group)
    }
    const sortedRepoKeys = [...repoGroups.keys()].sort((a, b) => {
      // Primary repo first, then alphabetical
      if (a === '__primary__') return -1
      if (b === '__primary__') return 1
      return a.localeCompare(b)
    })

    return (
      <div className="eng-day-block">
        <div className="eng-day-head">
          <span className="eng-day-date">{day.dateLabel}</span>
          {report.title && <span className="eng-day-title">{report.title}</span>}
          {report.tags && report.tags.length > 0 && (
            <span className="eng-day-tags">
              {report.tags.map((tag) => (
                <span key={tag} className="eng-day-tag">{tag}</span>
              ))}
            </span>
          )}
        </div>

        {report.narrative && <p className="eng-day-narrative">{report.narrative}</p>}

        {hasCommits && sortedRepoKeys.map((repoKey) => {
          const commits = repoGroups.get(repoKey)!
          const label = resolveRepoLabel(repoKey, jsonReport)
          const color = repoColor(repoKey, colored)
          const base = (repoKey !== '__primary__' && repoBaseUrlMap.get(repoKey)) || commitBaseUrl

          return (
            <div key={repoKey} className="eng-repo-group" style={{ '--repo-color': color } as CSSProperties}>
              <div className="eng-repo-group-header">
                <span className="eng-repo-dot" style={{ background: color }} />
                <span className="eng-repo-group-name">{label}</span>
                <span className="eng-repo-group-count">{commits.length}</span>
              </div>
              <table className="eng-commits-table">
                <thead>
                  <tr>
                    <th className="eng-col-hash">{t('eng.col.hash')}</th>
                    <th className="eng-col-subject">{t('eng.col.subject')}</th>
                    <th className="eng-col-files">{t('eng.col.files')}</th>
                    <th className="eng-col-ins">{t('eng.col.ins')}</th>
                    <th className="eng-col-del">{t('eng.col.del')}</th>
                  </tr>
                </thead>
                <tbody>
                  {commits.map((c, i) => {
                    const commitUrl = base ? base + c.hash : null
                    return (
                      <tr key={`${day.dateKey}-${repoKey}-${i}`}>
                        <td className="eng-col-hash">
                          {commitUrl ? (
                            <a href={commitUrl} target="_blank" rel="noopener noreferrer" className="eng-commit-link">
                              <code>{c.hash}</code>
                            </a>
                          ) : (
                            <code>{c.hash}</code>
                          )}
                        </td>
                        <td className="eng-col-subject">{c.subject}</td>
                        <td className="eng-col-files">{formatNum(c.files)}</td>
                        <td className="eng-col-ins"><span className="eng-diff-sign">+</span>{formatNum(c.insertions)}</td>
                        <td className="eng-col-del"><span className="eng-diff-sign">−</span>{formatNum(c.deletions)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}

        {report.commitCount > 0 && (
          <div className="eng-day-stats">
            <span className="eng-day-stat">
              <strong>{report.commitCount}</strong> {t('eng.commits')}
            </span>
            <span className="eng-day-stat">
              <strong>{formatNum(report.filesTouched)}</strong> {t('eng.filesTouched')}
            </span>
            <span className="eng-day-stat">
              <strong>+{formatNum(report.linesInserted)}</strong> /{' '}
              <strong>-{formatNum(report.linesDeleted)}</strong> {t('eng.linesChanged')}
            </span>
          </div>
        )}

        {!hasCommits && (
          <div className="eng-day-no-activity">{t('eng.noCommitsTagOnly')}</div>
        )}
      </div>
    )
  }

  // CSV-only day: same visual container as JSON days, table without time columns
  if (day.csvDay) {
    const csv = day.csvDay!

    return (
      <div className="eng-day-block">
        <div className="eng-day-head">
          <span className="eng-day-date">{day.dateLabel}</span>
        </div>

        <table className="eng-commits-table">
          <thead>
            <tr>
              <th className="eng-col-subject">{t('report.col.task')}</th>
              <th className="eng-col-subject">{t('report.col.description')}</th>
              <th className="eng-col-files">{t('report.col.tag')}</th>
            </tr>
          </thead>
          <tbody>
            {csv.entries.map((e, i) => (
              <tr key={`${day.dateKey}-${i}`}>
                <td className="eng-col-subject">{e.task}</td>
                <td className="eng-col-subject">{e.description}</td>
                <td className="eng-col-files">{e.tag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return null
}
