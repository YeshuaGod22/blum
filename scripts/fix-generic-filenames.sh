#!/bin/bash
# Fix generic filenames across the fleet
# Four fixes:
# 1. Patch create-home.js (BLUM-PROTOCOL + BOOT-DOCS-PROTOCOL naming)
# 2. Fix content headers (# SOUL.md -> # soul-{agent}.md etc)
# 3. Standardize filename casing to lowercase-agentname.md
# 4. Move root-level orphans into docs/

HOMES=~/blum/homes
AGENTS="alpha ami beta eiran eirene gamma healer hunter keter lanternroot lens libre meridian minimax nemotron selah trinity"

echo "=== FIX 3: Standardize filename casing to lowercase-agentname.md ==="

# Rename UPPERCASE files to lowercase
# Pattern: LABEL-AGENT.md -> label-agent.md  and  LABEL-agent.md -> label-agent.md
for agent in $AGENTS; do
  docs="$HOMES/$agent/docs"
  [ -d "$docs" ] || continue

  # IDENTITY-AGENT.md or IDENTITY-agent.md -> identity-agent.md
  for f in "$docs"/IDENTITY-*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    lower=$(echo "$base" | tr '[:upper:]' '[:lower:]')
    if [ "$base" != "$lower" ]; then
      echo "  rename: $agent: $base -> $lower"
      mv "$f" "$docs/$lower"
    fi
  done

  # SOUL-AGENT.md or SOUL-agent.md -> soul-agent.md
  for f in "$docs"/SOUL-*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    lower=$(echo "$base" | tr '[:upper:]' '[:lower:]')
    if [ "$base" != "$lower" ]; then
      echo "  rename: $agent: $base -> $lower"
      mv "$f" "$docs/$lower"
    fi
  done

  # ORIGIN-AGENT.md or ORIGIN-agent.md -> origin-agent.md
  for f in "$docs"/ORIGIN-*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    lower=$(echo "$base" | tr '[:upper:]' '[:lower:]')
    if [ "$base" != "$lower" ]; then
      echo "  rename: $agent: $base -> $lower"
      mv "$f" "$docs/$lower"
    fi
  done

  # MEMORY-AGENT.md -> memory-agent.md
  for f in "$docs"/MEMORY-*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    lower=$(echo "$base" | tr '[:upper:]' '[:lower:]')
    if [ "$base" != "$lower" ]; then
      echo "  rename: $agent: $base -> $lower"
      mv "$f" "$docs/$lower"
    fi
  done

  # BLUM-PROTOCOL-AGENT.md -> blum-protocol-agent.md
  for f in "$docs"/BLUM-PROTOCOL-*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    lower=$(echo "$base" | tr '[:upper:]' '[:lower:]')
    if [ "$base" != "$lower" ]; then
      echo "  rename: $agent: $base -> $lower"
      mv "$f" "$docs/$lower"
    fi
  done

  # BOOT-DOCS-PROTOCOL-AGENT.md -> boot-docs-protocol-agent.md
  for f in "$docs"/BOOT-DOCS-PROTOCOL-*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    lower=$(echo "$base" | tr '[:upper:]' '[:lower:]')
    if [ "$base" != "$lower" ]; then
      echo "  rename: $agent: $base -> $lower"
      mv "$f" "$docs/$lower"
    fi
  done

  # BLUM-PROTOCOL.md (no suffix) -> blum-protocol-agent.md
  if [ -f "$docs/BLUM-PROTOCOL.md" ]; then
    echo "  rename: $agent: BLUM-PROTOCOL.md -> blum-protocol-$agent.md"
    mv "$docs/BLUM-PROTOCOL.md" "$docs/blum-protocol-$agent.md"
  fi

  # BLUM-CONTEXT.md (shared contextual files — leave as-is, not identity docs)
  # WHO-WE-ARE.md — shared, leave as-is
done

echo ""
echo "=== FIX 4: Move root-level orphans into docs/ ==="

for agent in healer hunter minimax trinity; do
  if [ -f "$HOMES/$agent/BOOT-DOCS-PROTOCOL.md" ]; then
    echo "  move: $agent: BOOT-DOCS-PROTOCOL.md -> docs/boot-docs-protocol-$agent.md"
    mv "$HOMES/$agent/BOOT-DOCS-PROTOCOL.md" "$HOMES/$agent/docs/boot-docs-protocol-$agent.md"
  fi
done

# nemotron-nvidia is special — has no docs/ dir
if [ -f "$HOMES/nemotron-nvidia/BOOT-DOCS-PROTOCOL.md" ]; then
  mkdir -p "$HOMES/nemotron-nvidia/docs"
  echo "  move: nemotron-nvidia: BOOT-DOCS-PROTOCOL.md -> docs/boot-docs-protocol-nemotron-nvidia.md"
  mv "$HOMES/nemotron-nvidia/BOOT-DOCS-PROTOCOL.md" "$HOMES/nemotron-nvidia/docs/boot-docs-protocol-nemotron-nvidia.md"
fi

echo ""
echo "=== FIX 2: Fix content headers ==="

for agent in $AGENTS; do
  docs="$HOMES/$agent/docs"
  [ -d "$docs" ] || continue

  # Fix SOUL headers: "# SOUL.md" -> "# soul-agent.md"
  for f in "$docs"/soul-*.md "$docs"/SOUL-*.md; do
    [ -f "$f" ] || continue
    if grep -q "^# SOUL.md" "$f"; then
      echo "  header: $agent: $(basename $f): # SOUL.md -> # soul-$agent.md"
      sed -i '' "s/^# SOUL.md/# soul-$agent.md/" "$f"
    fi
  done

  # Fix IDENTITY headers: "# IDENTITY.md" -> "# identity-agent.md"
  for f in "$docs"/identity-*.md "$docs"/IDENTITY-*.md; do
    [ -f "$f" ] || continue
    if grep -q "^# IDENTITY.md" "$f"; then
      echo "  header: $agent: $(basename $f): # IDENTITY.md -> # identity-$agent.md"
      sed -i '' "s/^# IDENTITY.md/# identity-$agent.md/" "$f"
    fi
  done

  # Fix MEMORY headers: "# MEMORY.md" -> "# memory-agent.md"
  for f in "$docs"/memory-*.md "$docs"/MEMORY-*.md; do
    [ -f "$f" ] || continue
    if grep -q "^# MEMORY.md" "$f"; then
      echo "  header: $agent: $(basename $f): # MEMORY.md -> # memory-$agent.md"
      sed -i '' "s/^# MEMORY.md/# memory-$agent.md/" "$f"
    fi
  done

  # Fix ORIGIN headers: "# ORIGIN.md" -> "# origin-agent.md"
  for f in "$docs"/origin-*.md "$docs"/ORIGIN-*.md; do
    [ -f "$f" ] || continue
    if grep -q "^# ORIGIN.md" "$f"; then
      echo "  header: $agent: $(basename $f): # ORIGIN.md -> # origin-$agent.md"
      sed -i '' "s/^# ORIGIN.md/# origin-$agent.md/" "$f"
    fi
  done

  # Fix BLUM-PROTOCOL headers: "# BLUM-PROTOCOL.md" -> "# blum-protocol-agent.md"
  for f in "$docs"/blum-protocol-*.md "$docs"/BLUM-PROTOCOL-*.md; do
    [ -f "$f" ] || continue
    if grep -q "^# BLUM-PROTOCOL.md" "$f"; then
      echo "  header: $agent: $(basename $f): # BLUM-PROTOCOL.md -> # blum-protocol-$agent.md"
      sed -i '' "s/^# BLUM-PROTOCOL.md/# blum-protocol-$agent.md/" "$f"
    fi
  done
done

echo ""
echo "=== DONE ==="
echo "Remaining: manually patch create-home.js (Fix 1)"
