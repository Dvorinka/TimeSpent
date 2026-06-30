import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

// ─── Types ────────────────────────────────────────────────────────────────

export type Lang = 'en' | 'cs'

export type TranslationKey = keyof (typeof translations)['en']

type Params = Record<string, string | number>

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey, params?: Params) => string
}

// ─── Translations ─────────────────────────────────────────────────────────

export const translations = {
  en: {
    // Dropzone
    'dropzone.title':
      'TimeSpent → PDF',
    'dropzone.subtitle':
      'Upload any CSV time-tracking export and generate a clean invoice-style PDF report.',
    'dropzone.cta': 'Select CSV file',
    'dropzone.hint':
      'Used columns: Description, Task, Start, End, Duration, Tags (auto-detected)',
    'dropzone.example': 'Download example CSV',
    'dropzone.error.noEntries': 'No valid entries found in CSV.',
    'dropzone.error.parse': 'Error parsing CSV: {msg}',
    'dropzone.error.readFile': 'Failed to read file.',

    // Config overlay
    'config.title': 'Report settings',
    'config.subtitle':
      'Loaded {entries} entries, {days} days. Before generating the report, fill in:',
    'config.refNumber': 'Reference number',
    'config.refPlaceholder': 'e.g. invoice number: 2026-0042',
    'config.refHint':
      'Shown top-left like on an invoice. Optional. Also used as PDF filename ({ref}-timespent.pdf).',
    'config.period': 'Period',
    'config.period.file': 'By file',
    'config.period.fileDesc': 'Show exact date range from entries',
    'config.period.month': 'Monthly summary',
    'config.period.monthDesc':
      'Highlight month name in header (e.g. "June 2026")',
    'config.style': 'Style',
    'config.style.full': 'Full',
    'config.style.fullDesc':
      'Visual bars, colored pill tags, light/dark theme',
    'config.style.simple': 'Simple',
    'config.style.simpleDesc':
      'Ink-saving, white-only, no bars, clean invoice style',
    'config.cancel': 'Cancel',
    'config.continue': 'Continue',
    'config.columnMapping': 'Column mapping',
    'config.columnMappingHint':
      'Auto-detected. Adjust if needed — unmapped columns are ignored.',
    'config.preview': 'Preview (first 3 rows)',

    // Toolbar
    'toolbar.noRef': 'No ref.',
    'toolbar.theme': 'Theme',
    'toolbar.light': 'Light',
    'toolbar.dark': 'Dark',
    'toolbar.style': 'Style',
    'toolbar.full': 'Full',
    'toolbar.simple': 'Simple',
    'toolbar.logo': 'Logo',
    'toolbar.logoTitle': 'Upload custom logo',
    'toolbar.signature': 'Signature',
    'toolbar.signatureTitle': 'Upload signature',
    'toolbar.settings': 'Settings',
    'toolbar.newFile': 'New file',
    'toolbar.downloadPdf': 'Download PDF',

    // Report
    'report.title': 'Time worked report',
    'report.period': 'Period',
    'report.generated': 'Generated',
    'report.entriesDays': 'Entries / Days',
    'report.totalWorked': 'Total time worked',
    'report.summaryByTask': 'Summary by task',
    'report.detailedBreakdown': 'Detailed breakdown',
    'report.col.time': 'Time',
    'report.col.task': 'Task',
    'report.col.description': 'Description',
    'report.col.tag': 'Tag',
    'report.col.duration': 'Duration',
    'report.signature': '[ signature ]',

    // Column field labels (for mapping UI)
    'column.description': 'Description',
    'column.task': 'Task',
    'column.start': 'Start',
    'column.end': 'End',
    'column.duration': 'Duration',
    'column.tags': 'Tags',
    'column.none': '(not mapped)',
    'column.uncategorized': 'Uncategorized',
    'column.defaultTag': 'Remote',

    // Language toggle
    'lang.toggle': 'EN / CS',
  },

  cs: {
    // Dropzone
    'dropzone.title':
      'TimeSpent → PDF',
    'dropzone.subtitle':
      'Nahrajte jakýkoliv CSV export časového sledování a vygenerujte přehlednou sestavu ve formátu faktury.',
    'dropzone.cta': 'Vybrat CSV soubor',
    'dropzone.hint':
      'Použité sloupce: Description, Task, Start, End, Duration, Tags (auto-detekce)',
    'dropzone.example': 'Stáhnout ukázkové CSV',
    'dropzone.error.noEntries': 'V CSV nebyly nalezeny žádné platné záznamy.',
    'dropzone.error.parse': 'Chyba při zpracování CSV: {msg}',
    'dropzone.error.readFile': 'Nepodařilo se načíst soubor.',

    // Config overlay
    'config.title': 'Nastavení sestavy',
    'config.subtitle':
      'Načteno {entries} záznamů, {days} dní. Před generováním sestavy vyplňte:',
    'config.refNumber': 'Referenční číslo',
    'config.refPlaceholder': 'např. číslo faktury: 2026-0042',
    'config.refHint':
      'Zobrazí se vlevo nahoře jako na faktuře. Volitelné. Použije se také jako název souboru PDF ({ref}-timespent.pdf).',
    'config.period': 'Období',
    'config.period.file': 'Podle souboru',
    'config.period.fileDesc': 'Zobrazí přesný rozsah dat ze záznamů',
    'config.period.month': 'Měsíční přehled',
    'config.period.monthDesc':
      'Zvýrazní název měsíce v záhlaví (např. "Červen 2026")',
    'config.style': 'Styl',
    'config.style.full': 'Plný',
    'config.style.fullDesc':
      'Vizuální bary, barevné pill tagy, světelný/tmavý motiv',
    'config.style.simple': 'Jednoduchý',
    'config.style.simpleDesc':
      'Ink-saving, pouze bílý motiv, bez vizuálních barů, čistý fakturový styl',
    'config.cancel': 'Zrušit',
    'config.continue': 'Pokračovat',
    'config.columnMapping': 'Mapování sloupců',
    'config.columnMappingHint':
      'Auto-detekováno. Upravte pokud potřebujete — nemapované sloupce se ignorují.',
    'config.preview': 'Náhled (prvních 3 řádků)',

    // Toolbar
    'toolbar.noRef': 'Bez ref.',
    'toolbar.theme': 'Motiv',
    'toolbar.light': 'Světlý',
    'toolbar.dark': 'Tmavý',
    'toolbar.style': 'Styl',
    'toolbar.full': 'Plný',
    'toolbar.simple': 'Jednoduchý',
    'toolbar.logo': 'Logo',
    'toolbar.logoTitle': 'Nahrát vlastní logo',
    'toolbar.signature': 'Podpis',
    'toolbar.signatureTitle': 'Nahrát podpis',
    'toolbar.settings': 'Nastavení',
    'toolbar.newFile': 'Nový soubor',
    'toolbar.downloadPdf': 'Stáhnout PDF',

    // Report
    'report.title': 'Sestava odpracovaného času',
    'report.period': 'Období',
    'report.generated': 'Vygenerováno',
    'report.entriesDays': 'Záznamů / Dní',
    'report.totalWorked': 'Celkem odpracováno',
    'report.summaryByTask': 'Souhrn podle úkolu',
    'report.detailedBreakdown': 'Detailní přehled',
    'report.col.time': 'Čas',
    'report.col.task': 'Úkol',
    'report.col.description': 'Popis',
    'report.col.tag': 'Tag',
    'report.col.duration': 'Doba',
    'report.signature': '[ podpis ]',

    // Column field labels (for mapping UI)
    'column.description': 'Popis',
    'column.task': 'Úkol',
    'column.start': 'Začátek',
    'column.end': 'Konec',
    'column.duration': 'Doba',
    'column.tags': 'Tagy',
    'column.none': '(nenamapováno)',
    'column.uncategorized': 'Nezařazeno',
    'column.defaultTag': 'Remote',

    // Language toggle
    'lang.toggle': 'EN / CS',
  },
} as const

// ─── Standalone translate function ─────────────────────────────────────────

export function t(lang: Lang, key: TranslationKey, params?: Params): string {
  const raw: string = translations[lang][key] ?? translations.en[key] ?? key
  if (!params) return raw
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    raw,
  )
}

// ─── React context ─────────────────────────────────────────────────────────

export const LangContext = createContext<I18nContextValue | null>(null)

export function LangProvider({
  children,
  initialLang = 'en',
}: {
  children: ReactNode
  initialLang?: Lang
}) {
  const [lang, setLang] = useState<Lang>(initialLang)

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key, params) => t(lang, key, params),
    }),
    [lang],
  )

  return createElement(LangContext.Provider, { value }, children)
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) {
    throw new Error('useI18n must be used within a LangProvider')
  }
  return ctx
}
