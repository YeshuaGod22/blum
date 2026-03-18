#!/bin/bash
# audit-boot-docs.sh — Content-based contamination audit
# Checks for template placeholders regardless of filename personalisation
# Created: 2026-03-18 by Selah

echo "=== BOOT DOCS CONTAMINATION AUDIT ==="
echo ""
echo "Checking for [TO BE WRITTEN] in SOUL docs:"
grep -l "TO BE WRITTEN" ~/blum/homes/*/docs/SOUL*.md 2>/dev/null || echo "  (none found)"
echo ""
echo "Checking for [TO BE WRITTEN] in ORIGIN docs:"
grep -l "TO BE WRITTEN" ~/blum/homes/*/docs/ORIGIN*.md 2>/dev/null || echo "  (none found)"
echo ""
echo "Checking for [TO BE WRITTEN] in IDENTITY docs:"
grep -l "TO BE WRITTEN" ~/blum/homes/*/docs/IDENTITY*.md 2>/dev/null || echo "  (none found)"
echo ""
echo "=== SUMMARY ==="
echo "Template contamination count:"
grep -l "TO BE WRITTEN" ~/blum/homes/*/docs/*.md 2>/dev/null | wc -l
