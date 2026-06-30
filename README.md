# TimeSpent → PDF

Přehledná sestava odpracovaného času z CSV exportu (TimeSpent) do branded PDF
ve formátu faktury. Branding: **tdvorak.dev** — čistá černobílá škála, Open Sans / Noto Sans.

## Funkce

- **Drag & drop** CSV exportu z TimeSpent
- **Nastavení po nahrání** — referenční číslo, volba období, volba stylu
- **Referenční číslo** — např. číslo faktury; zobrazí se vlevo nahoře s linkou jako na faktuře
- **Název PDF souboru** — automaticky `{ref}-timespent.pdf` (např. `2026-0042-timespent.pdf`)
- **Období:** podle souboru (přesný rozsah dat) nebo měsíční přehled (zvýrazní název měsíce)
- **Dva styly:**
  - **Plný** — vizuální bary, barevné pill tagy, světelný/tmavý motiv
  - **Jednoduchý** — ink-saving, pouze bílý motiv, bez barů, čistý fakturový styl
- **Vlastní logo** — nahrání obrázku, zobrazeno ve středu hlavičky
- **Podpis** — nahrání obrázku, zobrazeno na konci dokumentu vpravo
- **Multi-page** — obsah se přirozeně rozkládá přes více stran A4, bez prázdných stran

## Struktura sestavy

1. **Hlavička** — ref. číslo vlevo (s linkou), logo uprostřed, název + období + meta vpravo
2. **Souhrnný panel** — Celkem odpracováno + rozpad On-site / Remote
3. **Souhrn podle úkolu** — vizuální bary (pouze Plný styl) + celkový čas
4. **Detailní přehled** — seskupeno podle **dne**, tabulka: Čas, Úkol, Popis, Tag, Doba
5. **Podpis** — na konci dokumentu vpravo

## Formát času

Vše v přehledném formátu: `32 h 1 min`, `4 h 5 min`, `39 min` — žádné desetinné hodiny.

## Použité / ignorované sloupce

- **Použité:** `Description`, `Task`, `Start`, `End`, `Duration`, `Tags`
- **Ignorované:** `Project`, `Client`, `User`, `Duration (decimal)`, `Billable`

## Spuštění (dev)

```bash
npm install
npm run dev
```

## Build

```bash
npm run build      # výstup do dist/
npm run preview    # náhled produkčního buildu
```

## Docker

```bash
docker build -t timespent-pdf .
docker run -p 8080:80 timespent-pdf
# → http://localhost:8080
```

## Tipy pro PDF

V tiskovém dialogu prohlížeče zvol:
- **Cíl:** Uložit jako PDF
- **Okraje:** výchozí / žádné
- **Velikost:** A4
- **Grafika pozadí:** zapnuto (pro správné bary a pill tagy)

### Kvalita tisku

- **Písma:** Open Sans / Noto Sans, vykreslení `geometricPrecision`, vyhlazování zapnuto
- **Logo:** 1890×337 px PNG — při výšce 14 mm v tisku ≈ 340 DPI (ostré)
- **Tmavý motiv v tisku:** automaticky přepnut na bílý podklad (šetření inkoustu)
- **Jednoduchý styl:** bez černých výplní, pouze tenké linky — maximální ink-saving
- **Velikosti v pt:** všechny fonty v tisku používají fyzické jednotky (pt) pro konzistentní velikost napříč prohlížeči
