// Engineering report JSON schema — agent-emitted from a monthly Markdown report.
// Schema version 1.0. The app validates strictly on upload; invalid JSON is rejected.

export const SCHEMA_VERSION = '1.0'

export interface ReportRelease {
  tag: string
  date: string // YYYY-MM-DD
  milestone?: string
}

export interface ReportMilestone {
  id: string
  title: string
  dateRange: string
  objective: string
  status: 'achieved' | 'in-progress' | 'blocked' | 'skipped'
  summary: string
}

export interface ReportCommit {
  hash: string
  time?: string // HH:MM, optional
  subject: string
  files: number
  insertions: number
  deletions: number
  // Optional key into EngineeringReport.repositories. When set, the commit
  // hash links to the GitHub URL derived from that repo instead of the
  // top-level `repository` field.
  repo?: string
}

export interface ReportDay {
  date: string // YYYY-MM-DD
  title?: string
  narrative?: string
  // Optional human-readable date range, e.g. "July 19–20, 2026".
  // When set, Engineering Report uses this as the day header label.
  dateRange?: string
  commitCount: number
  filesTouched: number
  linesInserted: number
  linesDeleted: number
  tags?: string[]
  commits: ReportCommit[]
}

export interface ReportTechnologyArea {
  area: string
  files: number
  keyCommits: string
}

export interface ReportSummary {
  totalCommits: number
  filesTouched: number
  linesInserted: number
  linesDeleted: number
  netLines: number
  tagsReleased: number
  activeDays: number
}

export interface ReportPeriod {
  year: number
  month: number // 1-12
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
}

export interface EngineeringReport {
  schemaVersion: string
  type: 'engineering-report'
  repository: string
  // Optional map of short keys to "owner/repo" strings, allowing per-commit
  // repo overrides via ReportCommit.repo. When a commit sets `repo`, the URL
  // is derived from the matching entry here; otherwise the top-level
  // `repository` field is used as the default.
  repositories?: Record<string, string>
  period: ReportPeriod
  author: string
  excluded: string[]
  // Optional disclaimer/comment shown above the summary band
  comment?: string
  summary: ReportSummary
  releases: ReportRelease[]
  milestones: ReportMilestone[]
  days: ReportDay[]
  technologyAreas: ReportTechnologyArea[]
  // Optional goals for the next month, shown at the bottom
  nextMonthGoals?: string
}

export interface ReportValidationError {
  field: string
  message: string
}

export interface ReportValidationResult {
  ok: boolean
  errors: ReportValidationError[]
  report: EngineeringReport | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

function isStrOrEmpty(v: unknown): v is string {
  return typeof v === 'string'
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

function isInt(v: unknown): v is number {
  return isNum(v) && Number.isInteger(v)
}

function isDate(v: unknown): boolean {
  return isStr(v) && DATE_RE.test(v)
}

function isTime(v: unknown): boolean {
  return isStr(v) && TIME_RE.test(v)
}

export function validateReport(input: unknown): ReportValidationResult {
  const errors: ReportValidationError[] = []

  if (!isObj(input)) {
    return { ok: false, errors: [{ field: 'root', message: 'Root must be an object.' }], report: null }
  }

  const root = input as Record<string, unknown>

  // schemaVersion
  if (!isStr(root.schemaVersion) || root.schemaVersion !== SCHEMA_VERSION) {
    errors.push({
      field: 'schemaVersion',
      message: `Must be "${SCHEMA_VERSION}".`,
    })
  }

  // type
  if (root.type !== 'engineering-report') {
    errors.push({ field: 'type', message: 'Must be "engineering-report".' })
  }

  // repository
  if (!isStr(root.repository)) {
    errors.push({ field: 'repository', message: 'Required non-empty string.' })
  }

  // repositories (optional map of key -> "owner/repo")
  if (root.repositories !== undefined) {
    if (!isObj(root.repositories)) {
      errors.push({ field: 'repositories', message: 'Optional object of key -> "owner/repo" string.' })
    } else {
      for (const [k, v] of Object.entries(root.repositories as Record<string, unknown>)) {
        if (!isStr(v)) {
          errors.push({ field: `repositories.${k}`, message: 'Must be a "owner/repo" string.' })
        }
      }
    }
  }

  // author
  if (!isStr(root.author)) {
    errors.push({ field: 'author', message: 'Required non-empty string.' })
  }

  // excluded
  if (!Array.isArray(root.excluded) || !root.excluded.every(isStr)) {
    errors.push({ field: 'excluded', message: 'Required array of strings.' })
  }

  // comment (optional)
  if (root.comment !== undefined && !isStrOrEmpty(root.comment)) {
    errors.push({ field: 'comment', message: 'Optional string.' })
  }

  // nextMonthGoals (optional)
  if (root.nextMonthGoals !== undefined && !isStrOrEmpty(root.nextMonthGoals)) {
    errors.push({ field: 'nextMonthGoals', message: 'Optional string.' })
  }

  // period
  const periodErrors = validatePeriod(root.period)
  errors.push(...periodErrors)

  // summary
  const summaryErrors = validateSummary(root.summary)
  errors.push(...summaryErrors)

  // releases
  const releasesErrors = validateReleases(root.releases)
  errors.push(...releasesErrors)

  // milestones
  const milestonesErrors = validateMilestones(root.milestones)
  errors.push(...milestonesErrors)

  // days
  const daysErrors = validateDays(root.days)
  errors.push(...daysErrors)

  // technologyAreas
  const techErrors = validateTechAreas(root.technologyAreas)
  errors.push(...techErrors)

  if (errors.length > 0) {
    return { ok: false, errors, report: null }
  }

  return { ok: true, errors: [], report: root as unknown as EngineeringReport }
}

function validatePeriod(v: unknown): ReportValidationError[] {
  const errors: ReportValidationError[] = []
  if (!isObj(v)) {
    errors.push({ field: 'period', message: 'Required object.' })
    return errors
  }
  const p = v as Record<string, unknown>
  if (!isInt(p.year) || p.year < 2000 || p.year > 2100) {
    errors.push({ field: 'period.year', message: 'Required integer year 2000-2100.' })
  }
  if (!isInt(p.month) || p.month < 1 || p.month > 12) {
    errors.push({ field: 'period.month', message: 'Required integer month 1-12.' })
  }
  if (!isDate(p.start)) {
    errors.push({ field: 'period.start', message: 'Required YYYY-MM-DD.' })
  }
  if (!isDate(p.end)) {
    errors.push({ field: 'period.end', message: 'Required YYYY-MM-DD.' })
  }
  return errors
}

function validateSummary(v: unknown): ReportValidationError[] {
  const errors: ReportValidationError[] = []
  if (!isObj(v)) {
    errors.push({ field: 'summary', message: 'Required object.' })
    return errors
  }
  const s = v as Record<string, unknown>
  const fields: (keyof ReportSummary)[] = [
    'totalCommits',
    'filesTouched',
    'linesInserted',
    'linesDeleted',
    'netLines',
    'tagsReleased',
    'activeDays',
  ]
  for (const f of fields) {
    if (!isInt(s[f])) {
      errors.push({ field: `summary.${f}`, message: 'Required non-negative integer.' })
    }
  }
  return errors
}

function validateReleases(v: unknown): ReportValidationError[] {
  const errors: ReportValidationError[] = []
  if (!Array.isArray(v)) {
    errors.push({ field: 'releases', message: 'Required array.' })
    return errors
  }
  v.forEach((r, i) => {
    if (!isObj(r)) {
      errors.push({ field: `releases[${i}]`, message: 'Must be an object.' })
      return
    }
    const rel = r as Record<string, unknown>
    if (!isStr(rel.tag)) {
      errors.push({ field: `releases[${i}].tag`, message: 'Required string.' })
    }
    if (!isDate(rel.date)) {
      errors.push({ field: `releases[${i}].date`, message: 'Required YYYY-MM-DD.' })
    }
    if (rel.milestone !== undefined && !isStr(rel.milestone)) {
      errors.push({ field: `releases[${i}].milestone`, message: 'Optional string.' })
    }
  })
  return errors
}

function validateMilestones(v: unknown): ReportValidationError[] {
  const errors: ReportValidationError[] = []
  if (!Array.isArray(v)) {
    errors.push({ field: 'milestones', message: 'Required array.' })
    return errors
  }
  const validStatuses: ReportMilestone['status'][] = ['achieved', 'in-progress', 'blocked', 'skipped']
  v.forEach((m, i) => {
    if (!isObj(m)) {
      errors.push({ field: `milestones[${i}]`, message: 'Must be an object.' })
      return
    }
    const ms = m as Record<string, unknown>
    if (!isStr(ms.id)) errors.push({ field: `milestones[${i}].id`, message: 'Required string.' })
    if (!isStr(ms.title)) errors.push({ field: `milestones[${i}].title`, message: 'Required string.' })
    if (!isStr(ms.dateRange)) errors.push({ field: `milestones[${i}].dateRange`, message: 'Required string.' })
    if (!isStr(ms.objective)) errors.push({ field: `milestones[${i}].objective`, message: 'Required string.' })
    if (!isStr(ms.summary)) errors.push({ field: `milestones[${i}].summary`, message: 'Required string.' })
    if (!isStr(ms.status) || !validStatuses.includes(ms.status as ReportMilestone['status'])) {
      errors.push({ field: `milestones[${i}].status`, message: 'Required: achieved | in-progress | blocked | skipped.' })
    }
  })
  return errors
}

function validateDays(v: unknown): ReportValidationError[] {
  const errors: ReportValidationError[] = []
  if (!Array.isArray(v)) {
    errors.push({ field: 'days', message: 'Required array.' })
    return errors
  }
  v.forEach((d, i) => {
    if (!isObj(d)) {
      errors.push({ field: `days[${i}]`, message: 'Must be an object.' })
      return
    }
    const day = d as Record<string, unknown>
    if (!isDate(day.date)) errors.push({ field: `days[${i}].date`, message: 'Required YYYY-MM-DD.' })
    if (day.title !== undefined && !isStrOrEmpty(day.title)) {
      errors.push({ field: `days[${i}].title`, message: 'Optional string.' })
    }
    if (day.narrative !== undefined && !isStrOrEmpty(day.narrative)) {
      errors.push({ field: `days[${i}].narrative`, message: 'Optional string.' })
    }
    if (day.dateRange !== undefined && !isStrOrEmpty(day.dateRange)) {
      errors.push({ field: `days[${i}].dateRange`, message: 'Optional string.' })
    }
    if (!isInt(day.commitCount)) errors.push({ field: `days[${i}].commitCount`, message: 'Required integer.' })
    if (!isInt(day.filesTouched)) errors.push({ field: `days[${i}].filesTouched`, message: 'Required integer.' })
    if (!isInt(day.linesInserted)) errors.push({ field: `days[${i}].linesInserted`, message: 'Required integer.' })
    if (!isInt(day.linesDeleted)) errors.push({ field: `days[${i}].linesDeleted`, message: 'Required integer.' })
    if (day.tags !== undefined && (!Array.isArray(day.tags) || !day.tags.every(isStr))) {
      errors.push({ field: `days[${i}].tags`, message: 'Optional array of strings.' })
    }
    if (!Array.isArray(day.commits)) {
      errors.push({ field: `days[${i}].commits`, message: 'Required array.' })
    } else {
      day.commits.forEach((c, j) => {
        if (!isObj(c)) {
          errors.push({ field: `days[${i}].commits[${j}]`, message: 'Must be an object.' })
          return
        }
        const cm = c as Record<string, unknown>
        if (!isStr(cm.hash)) errors.push({ field: `days[${i}].commits[${j}].hash`, message: 'Required string.' })
        if (cm.time !== undefined && !isTime(cm.time)) errors.push({ field: `days[${i}].commits[${j}].time`, message: 'Optional HH:MM.' })
        if (!isStr(cm.subject)) errors.push({ field: `days[${i}].commits[${j}].subject`, message: 'Required string.' })
        if (!isInt(cm.files)) errors.push({ field: `days[${i}].commits[${j}].files`, message: 'Required integer.' })
        if (!isInt(cm.insertions)) errors.push({ field: `days[${i}].commits[${j}].insertions`, message: 'Required integer.' })
        if (!isInt(cm.deletions)) errors.push({ field: `days[${i}].commits[${j}].deletions`, message: 'Required integer.' })
        if (cm.repo !== undefined && !isStr(cm.repo)) errors.push({ field: `days[${i}].commits[${j}].repo`, message: 'Optional string key into repositories.' })
      })
    }
  })
  return errors
}

function validateTechAreas(v: unknown): ReportValidationError[] {
  const errors: ReportValidationError[] = []
  if (!Array.isArray(v)) {
    errors.push({ field: 'technologyAreas', message: 'Required array.' })
    return errors
  }
  v.forEach((a, i) => {
    if (!isObj(a)) {
      errors.push({ field: `technologyAreas[${i}]`, message: 'Must be an object.' })
      return
    }
    const area = a as Record<string, unknown>
    if (!isStr(area.area)) errors.push({ field: `technologyAreas[${i}].area`, message: 'Required string.' })
    if (!isInt(area.files)) errors.push({ field: `technologyAreas[${i}].files`, message: 'Required integer.' })
    if (!isStr(area.keyCommits)) errors.push({ field: `technologyAreas[${i}].keyCommits`, message: 'Required string.' })
  })
  return errors
}

// Parse + validate in one step. Throws on invalid input.
export function parseReport(text: string): EngineeringReport {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`)
  }
  const result = validateReport(json)
  if (!result.ok) {
    const lines = result.errors.map((e) => `  - ${e.field}: ${e.message}`)
    throw new Error(`Report validation failed:\n${lines.join('\n')}`)
  }
  return result.report!
}

// Check whether the report's period overlaps a given CSV date range.
// Returns true if any day in [csvStart, csvEnd] falls within [report.start, report.end].
export function periodOverlapsCsv(
  report: EngineeringReport,
  csvStart: Date | null,
  csvEnd: Date | null,
): boolean {
  if (!csvStart || !csvEnd) return false
  const rStart = new Date(report.period.start + 'T00:00:00')
  const rEnd = new Date(report.period.end + 'T23:59:59')
  // overlap iff csvStart <= rEnd AND csvEnd >= rStart
  return csvStart.getTime() <= rEnd.getTime() && csvEnd.getTime() >= rStart.getTime()
}

// Build a date -> ReportDay map for quick lookup during merge.
export function indexDaysByDate(report: EngineeringReport): Map<string, ReportDay> {
  const map = new Map<string, ReportDay>()
  for (const d of report.days) {
    map.set(d.date, d)
  }
  return map
}
