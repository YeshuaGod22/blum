#!/usr/bin/env bash
# init-identity.sh — initialise identity docs for a Blum home
# Usage: init-identity.sh [home-name]
#        init-identity.sh --audit   (check all homes)

TEMPLATES_DIR="$HOME/blum/docs-templates"
HOMES_DIR="$HOME/blum/homes"
CORE_DOCS=("BLUM-PROTOCOL.md" "SOUL.md" "IDENTITY.md" "ORIGIN.md")

# --- Audit mode ---
if [ "$1" = "--audit" ]; then
  echo "=== Blum Identity Docs Audit ==="
  echo ""
  for home_dir in "$HOMES_DIR"/*/; do
    home=$(basename "$home_dir")
    # Skip non-home entries
    [ "$home" = "START-HOMES.sh" ] && continue
    
    docs_dir="$home_dir/docs"
    missing=()
    present=()
    
    for doc in "${CORE_DOCS[@]}"; do
      if [ -f "$docs_dir/$doc" ]; then
        present+=("$doc")
      else
        missing+=("$doc")
      fi
    done
    
    if [ ${#missing[@]} -eq 0 ]; then
      echo "  ✅ $home — all identity docs present"
    elif [ ${#missing[@]} -eq ${#CORE_DOCS[@]} ]; then
      echo "  ❌ $home — NO identity docs at all"
    else
      echo "  ⚠️  $home — missing: ${missing[*]}"
    fi
  done
  echo ""
  echo "Templates in: $TEMPLATES_DIR"
  echo "Run: init-identity.sh [home-name] to initialise a specific home"
  exit 0
fi

# --- Single home mode ---
HOME_NAME="$1"
if [ -z "$HOME_NAME" ]; then
  echo "Usage: $0 [home-name]"
  echo "       $0 --audit"
  exit 1
fi

HOME_DIR="$HOMES_DIR/$HOME_NAME"
if [ ! -d "$HOME_DIR" ]; then
  echo "Error: No home directory found at $HOME_DIR"
  exit 1
fi

DOCS_DIR="$HOME_DIR/docs"
mkdir -p "$DOCS_DIR"

echo "=== Initialising identity docs for: $HOME_NAME ==="
echo ""

COPIED=()
ALREADY=()
NEEDS_FILL=()

for doc in "${CORE_DOCS[@]}"; do
  target="$DOCS_DIR/$doc"
  source="$TEMPLATES_DIR/$doc"
  
  if [ -f "$target" ]; then
    ALREADY+=("$doc")
    echo "  ✅ $doc — already exists, skipping"
  elif [ -f "$source" ]; then
    cp "$source" "$target"
    COPIED+=("$doc")
    echo "  📋 $doc — copied from template"
    if [ "$doc" != "BLUM-PROTOCOL.md" ]; then
      NEEDS_FILL+=("$doc")
    fi
  else
    echo "  ⚠️  $doc — template not found at $source"
  fi
done

echo ""
echo "=== Summary ==="
echo "Already present: ${#ALREADY[@]} docs"
echo "Copied from template: ${#COPIED[@]} docs"

if [ ${#NEEDS_FILL[@]} -gt 0 ]; then
  echo ""
  echo "⚠️  These docs need to be personalised (they contain [TO BE WRITTEN] placeholders):"
  for doc in "${NEEDS_FILL[@]}"; do
    echo "   - $DOCS_DIR/$doc"
  done
  echo ""
  echo "Protocol: have the agent write its own identity in its first active cycle,"
  echo "or guide the naming/identity process with Yeshua."
  echo "See: $TEMPLATES_DIR/NEW-HOME-PROTOCOL.md"
fi

echo ""
echo "Done."
