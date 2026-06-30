import Papa from 'papaparse'

export type Tag = 'On-site' | 'Remote' | string

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
  dateLabel: string // Czech label
  entries: TimeEntry[]
  totalSec: number
}

export interface TaskGroup {
  task: string
  entries: TimeEntry[]
  days: DayGroup[]
  totalSec: number
}

export interface ParsedReport {
  tasks: TaskGroup[]
  days: DayGroup[] // all entries grouped by day (across all tasks)
  grandTotalSec: number
  onSiteSec: number
  remoteSec: number
  dayCount: number
  entryCount: number
  rangeStart: Date | null
  rangeEnd: Date | null
}

const CZ_MONTHS = [
  'ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince',
]
const CZ_DAYS = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota']

function parseDurationToSec(raw: string): number {
  // formats: "H:MM:SS" or "MM:SS" or decimal hours "123.45"
  const trimmed = raw.trim()
  if (!trimmed) return 0
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map(Number)
    if (parts.some((n) => Number.isNaN(n))) return 0
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    return 0
  }
  const asNum = Number(trimmed)
  if (!Number.isNaN(asNum)) return Math.round(asNum * 3600)
  return 0
}

function parseDate(raw: string): Date | null {
  const s = raw.trim()
  if (!s) return null
  // "2026-06-30 08:20:00"
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (m) {
    return new Date(
      Number(m[1]), Number(m[2]) - 1, Number(m[3]),
      Number(m[4]), Number(m[5]), Number(m[6]),
    )
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
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

export function formatDateCzech(d: Date): string {
  return `${d.getDate()}. ${CZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function formatDateCzechLong(d: Date): string {
  return `${CZ_DAYS[d.getDay()]} · ${formatDateCzech(d)}`
}

export function formatMonthCzech(d: Date): string {
  const czMonthNominative = [
    'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
    'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
  ]
  return `${czMonthNominative[d.getMonth()]} ${d.getFullYear()}`
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d
    .getDate()
    .toString()
    .padStart(2, '0')}`
}

export function parseCsv(text: string): ParsedReport {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })

  const entries: TimeEntry[] = []
  for (const row of result.data) {
    if (!row || !row.Description) continue
    const start = parseDate(row.Start ?? '')
    const end = parseDate(row.End ?? '')
    if (!start || !end) continue

    entries.push({
      description: (row.Description ?? '').trim(),
      task: (row.Task ?? 'Nezařazeno').trim() || 'Nezařazeno',
      start,
      end,
      durationSec: parseDurationToSec(row.Duration ?? ''),
      tag: (row.Tags ?? '').trim() || 'Remote',
    })
  }

  // sort entries by start ascending
  entries.sort((a, b) => a.start.getTime() - b.start.getTime())

  // group by task
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
    // group task entries by day
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
        dateLabel: formatDateCzechLong(dayEntries[0].start),
        entries: dayEntries,
        totalSec: dayTotal,
      })
      taskTotal += dayTotal
    }
    days.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    tasks.push({ task, entries: taskEntries, days, totalSec: taskTotal })
    grandTotalSec += taskTotal
    for (const e of taskEntries) {
      if (e.tag.toLowerCase() === 'on-site') onSiteSec += e.durationSec
      else remoteSec += e.durationSec
    }
  }

  // sort tasks by total desc
  tasks.sort((a, b) => b.totalSec - a.totalSec)

  const dayKeys = new Set<string>()
  for (const e of entries) dayKeys.add(dateKey(e.start))

  // also build day-based grouping across ALL tasks (for the detailed overview)
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
      dateLabel: formatDateCzechLong(dayEntries[0].start),
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
  }
}
