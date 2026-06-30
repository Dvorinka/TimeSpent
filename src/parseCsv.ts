import Papa from 'papaparse'

export type Lang = 'en' | 'cs'

export type Tag = string

export interface TimeEntry {
  description: string
  task: string
  start: Date
  end: Date
  durationSec: number
  tag: Tag
}

export interface DayGroup {
  dateKey: string // YYYY-MM-DD
  dateLabel: string // locale-aware label
  entries: TimeEntry[]
  totalSec: number
}

export interface TaskGroup {
  task: string
  entries: TimeEntry[]
  days: DayGroup[]
  totalSec: number
}

export interface ColumnMapping {
  description: string | null
  task: string | null
  start: string | null
  end: string | null
  duration: string | null
  tags: string | null
}

export interface ParsedReport {
  tasks: TaskGroup[]
  days: DayGroup[]
  grandTotalSec: number
  onSiteSec: number
  remoteSec: number
  dayCount: number
  entryCount: number
  rangeStart: Date | null
  rangeEnd: Date | null
  columns: ColumnMapping
  hasTask: boolean
  hasTags: boolean
  hasDuration: boolean
}

export interface RawParseResult {
  headers: string[]
  rows: Record<string, string>[]
  detected: ColumnMapping
  sampleEntries: TimeEntry[]
}

const CZ_MONTHS = [
  'ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince',
]
const CZ_MONTHS_NOMINATIVE = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
]
const CZ_DAYS = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota']

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const ALIASES: Record<keyof ColumnMapping, string[]> = {
  description: ['description', 'desc', 'note', 'notes', 'activity', 'comment', 'comments', 'what', 'details'],
  task: ['task', 'task name', 'activity', 'category', 'project task', 'work item'],
  start: ['start', 'start time', 'begin', 'from', 'start date', 'clock in', 'check in'],
  end: ['end', 'end time', 'finish', 'to', 'end date', 'clock out', 'check out', 'stop'],
  duration: ['duration', 'elapsed', 'time spent', 'hours', 'total time', 'length', 'spent'],
  tags: ['tags', 'tag', 'label', 'labels', 'type', 'location', 'mode', 'category'],
}

const FIELD_ORDER: (keyof ColumnMapping)[] = ['description', 'task', 'start', 'end', 'duration', 'tags']

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    description: null,
    task: null,
    start: null,
    end: null,
    duration: null,
    tags: null,
  }
  const normalized = headers.map((h) => ({ raw: h, norm: norm(h) }))
  const claimed = new Set<number>()

  // Pass 1: exact matches (case-insensitive, trimmed)
  for (const field of FIELD_ORDER) {
    const aliases = ALIASES[field]
    for (let i = 0; i < normalized.length; i++) {
      if (claimed.has(i)) continue
      if (aliases.includes(normalized[i].norm)) {
        mapping[field] = normalized[i].raw
        claimed.add(i)
        break
      }
    }
  }

  // Pass 2: partial / contains matches
  for (const field of FIELD_ORDER) {
    if (mapping[field] !== null) continue
    const aliases = ALIASES[field]
    for (let i = 0; i < normalized.length; i++) {
      if (claimed.has(i)) continue
      const n = normalized[i].norm
      if (aliases.some((a) => n.includes(a) || a.includes(n))) {
        mapping[field] = normalized[i].raw
        claimed.add(i)
        break
      }
    }
  }

  return mapping
}

function parseDurationToSec(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) return 0
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map(Number)
    if (parts.some((n) => Number.isNaN(n))) return 0
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60
    return 0
  }
  const asNum = Number(trimmed)
  if (!Number.isNaN(asNum)) return Math.round(asNum * 3600)
  return 0
}

function parseDate(raw: string): Date | null {
  const s = raw.trim()
  if (!s) return null

  // YYYY-MM-DD HH:MM:SS or YYYY-MM-DDTHH:MM:SS
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]))
  }

  // YYYY-MM-DD HH:MM or YYYY-MM-DDTHH:MM
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
  }

  // MM/DD/YYYY HH:MM
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})/)
  if (m) {
    return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]), Number(m[4]), Number(m[5]))
  }

  // DD.MM.YYYY HH:MM
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})[ T](\d{1,2}):(\d{2})/)
  if (m) {
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]))
  }

  // DD/MM/YYYY HH:MM
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})/)
  if (m) {
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]))
  }

  // Fallback
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function buildEntry(
  row: Record<string, string>,
  mapping: ColumnMapping,
  defaults: { task: string; tag: string },
): TimeEntry | null {
  const startRaw = mapping.start ? (row[mapping.start] ?? '') : ''
  const endRaw = mapping.end ? (row[mapping.end] ?? '') : ''
  const start = parseDate(startRaw)
  const end = parseDate(endRaw)
  if (!start || !end) return null

  const description = mapping.description ? (row[mapping.description] ?? '').trim() : ''
  const task = mapping.task ? (row[mapping.task] ?? '').trim() || defaults.task : defaults.task
  const tag = mapping.tags ? (row[mapping.tags] ?? '').trim() || defaults.tag : defaults.tag

  let durationSec: number
  if (mapping.duration) {
    durationSec = parseDurationToSec(row[mapping.duration] ?? '')
  } else {
    durationSec = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000))
  }

  return { description, task, start, end, durationSec, tag }
}

export function parseCsvRaw(text: string, mapping?: ColumnMapping): RawParseResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })

  const rows = result.data.filter((r): r is Record<string, string> => !!r && typeof r === 'object')
  const headers = result.meta.fields ?? []
  const detected = mapping ?? detectColumns(headers)

  const sampleEntries: TimeEntry[] = []
  for (const row of rows) {
    if (sampleEntries.length >= 3) break
    const entry = buildEntry(row, detected, { task: 'Uncategorized', tag: 'Remote' })
    if (entry) sampleEntries.push(entry)
  }

  return { headers, rows, detected, sampleEntries }
}

export function parseCsv(text: string, mapping?: ColumnMapping, lang: Lang = 'cs'): ParsedReport {
  const raw = parseCsvRaw(text, mapping)
  const { rows, detected } = raw

  const hasTask = detected.task !== null
  const hasTags = detected.tags !== null
  const hasDuration = detected.duration !== null

  const defaultTask = lang === 'cs' ? 'Nezařazeno' : 'Uncategorized'
  const defaultTag = 'Remote'

  const entries: TimeEntry[] = []
  for (const row of rows) {
    const entry = buildEntry(row, detected, { task: defaultTask, tag: defaultTag })
    if (entry) entries.push(entry)
  }

  entries.sort((a, b) => a.start.getTime() - b.start.getTime())

  const taskMap = new Map<string, TimeEntry[]>()
  for (const e of entries) {
    const arr = taskMap.get(e.task) ?? []
    arr.push(e)
    taskMap.set(e.task, arr)
  }

  const tasks: TaskGroup[] = []
  let grandTotalSec = 0
  let onSiteSec = 0
  let remoteSec = 0

  for (const [task, taskEntries] of taskMap) {
    const dayMap = new Map<string, TimeEntry[]>()
    for (const e of taskEntries) {
      const key = dateKey(e.start)
      const arr = dayMap.get(key) ?? []
      arr.push(e)
      dayMap.set(key, arr)
    }
    const days: DayGroup[] = []
    let taskTotal = 0
    for (const [key, dayEntries] of dayMap) {
      const dayTotal = dayEntries.reduce((s, e) => s + e.durationSec, 0)
      days.push({
        dateKey: key,
        dateLabel: formatDateLong(dayEntries[0].start, lang),
        entries: dayEntries,
        totalSec: dayTotal,
      })
      taskTotal += dayTotal
    }
    days.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    tasks.push({ task, entries: taskEntries, days, totalSec: taskTotal })
    grandTotalSec += taskTotal
    for (const e of taskEntries) {
      if (e.tag.toLowerCase().includes('site')) onSiteSec += e.durationSec
      else remoteSec += e.durationSec
    }
  }

  tasks.sort((a, b) => b.totalSec - a.totalSec)

  const dayKeys = new Set<string>()
  for (const e of entries) dayKeys.add(dateKey(e.start))

  const allDayMap = new Map<string, TimeEntry[]>()
  for (const e of entries) {
    const key = dateKey(e.start)
    const arr = allDayMap.get(key) ?? []
    arr.push(e)
    allDayMap.set(key, arr)
  }
  const days: DayGroup[] = []
  for (const [key, dayEntries] of allDayMap) {
    const dayTotal = dayEntries.reduce((s, e) => s + e.durationSec, 0)
    days.push({
      dateKey: key,
      dateLabel: formatDateLong(dayEntries[0].start, lang),
      entries: dayEntries,
      totalSec: dayTotal,
    })
  }
  days.sort((a, b) => a.dateKey.localeCompare(b.dateKey))

  return {
    tasks,
    days,
    grandTotalSec,
    onSiteSec,
    remoteSec,
    dayCount: dayKeys.size,
    entryCount: entries.length,
    rangeStart: entries.length ? entries[0].start : null,
    rangeEnd: entries.length ? entries[entries.length - 1].start : null,
    columns: detected,
    hasTask,
    hasTags,
    hasDuration,
  }
}

export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

export function formatDurationShort(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const mm = m.toString().padStart(2, '0')
  return `${h}:${mm}`
}

export function formatHoursDecimal(totalSec: number): string {
  return (totalSec / 3600).toFixed(2).replace('.', ',')
}

export function formatTime(d: Date): string {
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}

export function formatDate(d: Date, lang: Lang): string {
  if (lang === 'cs') return `${d.getDate()}. ${CZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`
  return `${EN_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function formatDateLong(d: Date, lang: Lang): string {
  if (lang === 'cs') return `${CZ_DAYS[d.getDay()]} · ${formatDate(d, lang)}`
  return `${EN_DAYS[d.getDay()]} · ${formatDate(d, lang)}`
}

export function formatMonth(d: Date, lang: Lang): string {
  if (lang === 'cs') return `${CZ_MONTHS_NOMINATIVE[d.getMonth()]} ${d.getFullYear()}`
  return `${EN_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d
    .getDate()
    .toString()
    .padStart(2, '0')}`
}

// Backward-compatible wrappers (kept so existing consumers compile)
export function formatDateCzech(d: Date): string {
  return formatDate(d, 'cs')
}
export function formatDateCzechLong(d: Date): string {
  return formatDateLong(d, 'cs')
}
export function formatMonthCzech(d: Date): string {
  return formatMonth(d, 'cs')
}
