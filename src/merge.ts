// Merge logic: union CSV time entries with JSON engineering report days.
// Hours always come from CSV. JSON supplies work detail (narrative, commits, tags).
// Days in CSV but not in JSON render as plain time-entry rows.
// Days in JSON but not in CSV render with commit detail only (no hours).

import {
  formatDuration,
  type DayGroup,
  type ParsedReport,
} from './parseCsv'
import type { EngineeringReport, ReportDay } from './reportSchema'

export interface MergedDay {
  dateKey: string
  dateLabel: string
  // CSV time entries for this day (may be empty if JSON-only day)
  csvDay: DayGroup | null
  // JSON report day (may be null if CSV-only day)
  reportDay: ReportDay | null
  // Time total from CSV (0 if no CSV entries)
  totalSec: number
  // On-site/remote split from CSV
  onSiteSec: number
  remoteSec: number
  // Whether this day has rich JSON detail
  hasJsonDetail: boolean
}

export interface MergedReport {
  days: MergedDay[]
  // Original CSV report for totals
  csvReport: ParsedReport
  // Original JSON report (null if not uploaded)
  jsonReport: EngineeringReport | null
  // Union day count
  dayCount: number
  // Days with JSON detail
  jsonDayCount: number
  // Days with CSV time only
  csvOnlyDayCount: number
  // Days with JSON only (no CSV time)
  jsonOnlyDayCount: number
}

export function mergeReports(
  csvReport: ParsedReport,
  jsonReport: EngineeringReport | null,
  lang: 'en' | 'cs' = 'en',
): MergedReport {
  const csvDayMap = new Map<string, DayGroup>()
  for (const day of csvReport.days) {
    csvDayMap.set(day.dateKey, day)
  }

  const jsonDayMap = new Map<string, ReportDay>()
  if (jsonReport) {
    for (const day of jsonReport.days) {
      jsonDayMap.set(day.date, day)
    }
  }

  // Union of all dates
  const allDates = new Set<string>([...csvDayMap.keys(), ...jsonDayMap.keys()])
  const sortedDates = [...allDates].sort()

  const days: MergedDay[] = []
  let jsonDayCount = 0
  let csvOnlyDayCount = 0
  let jsonOnlyDayCount = 0

  for (const date of sortedDates) {
    const csvDay = csvDayMap.get(date) ?? null
    const reportDay = jsonDayMap.get(date) ?? null

    let totalSec = 0
    let onSiteSec = 0
    let remoteSec = 0
    let dateLabel = date

    if (csvDay) {
      totalSec = csvDay.totalSec
      dateLabel = csvDay.dateLabel
      for (const e of csvDay.entries) {
        if (e.tag.toLowerCase().includes('site')) onSiteSec += e.durationSec
        else remoteSec += e.durationSec
      }
    }

    if (reportDay?.dateRange) {
      dateLabel = reportDay.dateRange
    } else if (reportDay) {
      const d = new Date(date + 'T00:00:00')
      const locale = lang === 'cs' ? 'cs-CZ' : 'en-US'
      dateLabel = d.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }

    const hasJsonDetail = reportDay !== null && reportDay.commitCount > 0

    if (hasJsonDetail) jsonDayCount++
    else if (csvDay) csvOnlyDayCount++
    else if (reportDay) jsonOnlyDayCount++

    days.push({
      dateKey: date,
      dateLabel,
      csvDay,
      reportDay,
      totalSec,
      onSiteSec,
      remoteSec,
      hasJsonDetail,
    })
  }

  return {
    days,
    csvReport,
    jsonReport,
    dayCount: days.length,
    jsonDayCount,
    csvOnlyDayCount,
    jsonOnlyDayCount,
  }
}

// Format a number with thousands separators
export function formatNum(n: number): string {
  return n.toLocaleString('en-US')
}

// Format a signed number (e.g. +153,212)
export function formatSigned(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return sign + formatNum(n)
}

// Format duration for the engineering report (short form: "8h 30m")
export function formatDurationShort(totalSec: number): string {
  return formatDuration(totalSec)
}
