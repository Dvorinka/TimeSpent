#!/usr/bin/env bash
#
# monthly-report.sh — Generate a monthly engineering report from git history.
#
# Produces a Markdown file with:
#   - Executive summary (commits, files, insertions, deletions, net lines, tags)
#   - Release timeline (tags cut during the month)
#   - Per-commit breakdown grouped by day (hash, date, subject, files, ins, del)
#   - Aggregate stats
#
# Filters commits to only the specified authors and excludes bots.
# All commits are attributed to "Author + Devin (co-authored)" as a single entity.
#
# Usage:
#   ./monthly-report.sh YYYY-MM "Author1\|Author2\|devin-ai" /path/to/repo > output.md
#
# Examples:
#   ./monthly-report.sh 2026-07 "Your Name\|devin-ai" /path/to/repo > july-2026-report.md
#   ./monthly-report.sh 2026-08 "John Doe\|devin-ai" . > august-2026-report.md
#
set -euo pipefail

MONTH="${1:?Usage: $0 YYYY-MM AUTHOR_PATTERN [REPO_DIR]}"
AUTHORS="${2:?Specify author pattern (e.g. \"Your Name\\|devin-ai\")}"
REPO_DIR="${3:-.}"

cd "$REPO_DIR"
YEAR="${MONTH%%-*}"
MONTH_NUM="${MONTH##*-}"

# Compute last day of the month without external deps (handles Feb/leap years)
# Use next-month day-0 trick: date -d "2026-08-01 -1 day" gives last day of July
NEXT_MONTH_NUM=$(( (MONTH_NUM % 12) + 1 ))
NEXT_YEAR=$YEAR
if [ "$MONTH_NUM" -eq 12 ]; then
  NEXT_YEAR=$(( YEAR + 1 ))
fi
# Pad month numbers to 2 digits for date parsing
NEXT_MONTH_PADDED=$(printf "%02d" "$NEXT_MONTH_NUM")
LAST_DAY=$(date -d "${NEXT_YEAR}-${NEXT_MONTH_PADDED}-01 -1 day" +%d 2>/dev/null || echo 28)

SINCE="${YEAR}-${MONTH_NUM}-01"
UNTIL="${YEAR}-${MONTH_NUM}-${LAST_DAY} 23:59:59"

# ── Aggregate stats ────────────────────────────────────────────────────────
STATS=$(git log \
  --since="$SINCE" \
  --until="$UNTIL" \
  --author="$AUTHORS" \
  --shortstat --format="" \
  | grep "files changed" \
  | awk '{ins+=$4; del+=$6; files+=$1} END {
    if (NR==0) {print "0|0|0|0"}
    else {printf "%d|%d|%d|%d", files, ins, del, ins-del}
  }')

FILES_TOUCHED=$(echo "$STATS" | cut -d'|' -f1)
LINES_INSERTED=$(echo "$STATS" | cut -d'|' -f2)
LINES_DELETED=$(echo "$STATS" | cut -d'|' -f3)
NET_LINES=$(echo "$STATS" | cut -d'|' -f4)

COMMIT_COUNT=$(git log \
  --since="$SINCE" \
  --until="$UNTIL" \
  --author="$AUTHORS" \
  --oneline | wc -l)

ACTIVE_DAYS=$(git log \
  --since="$SINCE" \
  --until="$UNTIL" \
  --author="$AUTHORS" \
  --format="%ad" --date=format:"%Y-%m-%d" \
  | sort -u | wc -l)

TAG_COUNT=$(git log --tags --simplify-by-decoration \
  --format="%ad" --date=short \
  | grep "${YEAR}-${MONTH_NUM}" | wc -l)

REPO_URL=$(git remote get-url origin 2>/dev/null || echo 'local')

# ── Output ─────────────────────────────────────────────────────────────────

echo "# Monthly Engineering Report — ${YEAR}-${MONTH_NUM}"
echo ""
echo "**Repository:** \`${REPO_URL}\`"
echo "**Period:** ${SINCE} to ${YEAR}-${MONTH_NUM}-${LAST_DAY}"
echo "**Author:** Your Name + Devin (co-authored)"
echo "**Excluded:** dependabot[bot], renovate[bot], other contributors"
echo ""
echo "---"
echo ""
echo "## Executive Summary"
echo ""
echo "| Metric | Value |"
echo "|--------|-------|"
echo "| Total commits | ${COMMIT_COUNT} |"
echo "| Files touched (cumulative) | ${FILES_TOUCHED} |"
echo "| Lines inserted | ${LINES_INSERTED} |"
echo "| Lines deleted | ${LINES_DELETED} |"
echo "| Net lines added | +${NET_LINES} |"
echo "| Tags/releases cut | ${TAG_COUNT} |"
echo "| Active days | ${ACTIVE_DAYS} |"
echo ""

# ── Tags ───────────────────────────────────────────────────────────────────
echo "### Release Timeline"
echo ""
echo "| Tag | Date |"
echo "|-----|------|"
git log --tags --simplify-by-decoration \
  --format="%ad|%d" --date=short \
  | grep "tag:" | grep "${YEAR}-${MONTH_NUM}" | sort | while IFS='|' read -r date deco; do
    tag=$(echo "$deco" | sed 's/.*tag: //;s/)//;s/,.*//')
    echo "| ${tag} | ${date} |"
  done
echo ""
echo "---"
echo ""

# ── Per-commit breakdown grouped by day ────────────────────────────────────
echo "## Daily Breakdown"
echo ""

git log \
  --since="$SINCE" \
  --until="$UNTIL" \
  --author="$AUTHORS" \
  --format="%H" \
  | while read h; do
    short=$(git log -1 --format="%h" "$h")
    date=$(git log -1 --format="%ad" --date=format:"%Y-%m-%d" "$h")
    time=$(git log -1 --format="%ad" --date=format:"%H:%M" "$h")
    subj=$(git log -1 --format="%s" "$h" | sed 's/|/\\|/g')
    stats=$(git show --stat --format="" "$h" | tail -1 | sed 's/|/\\|/g')
    echo "${date}|${short}|${time}|${subj}|${stats}"
  done | awk -F'|' '
    BEGIN { prev_day = ""; idx = 0 }
    {
      day = $1
      if (day != prev_day) {
        if (prev_day != "") print ""
        print "### " day
        print ""
        print "| # | Hash | Time | Subject | Stats |"
        print "|---|------|------|---------|-------|"
        idx = 0
        prev_day = day
      }
      idx++
      print "| " idx " | `" $2 "` | " $3 " | " $4 " | " $5 " |"
    }
  '
echo ""
echo "---"
