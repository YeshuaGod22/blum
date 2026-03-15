#!/bin/bash
# capture-episode.sh — Record an episodic memory for a Blum agent
# Version: 1.0
# Date: 2026-03-15

set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════

EPISODES_DIR="${BLUM_EPISODES_DIR:-$HOME/blum/shared/memory/episodes}"
AGENT="${BLUM_AGENT:-unknown}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DATE=$(date -u +"%Y-%m-%d")
EPISODE_UID=$(openssl rand -hex 4)  # 8-char hex ID

# ═══════════════════════════════════════════════════════════════════════
# USAGE
# ═══════════════════════════════════════════════════════════════════════

usage() {
    cat <<EOF
Usage: capture-episode.sh [OPTIONS]

Capture an episodic memory for a Blum agent.

OPTIONS:
    -a, --agent NAME           Agent name (default: \$BLUM_AGENT or 'unknown')
    -t, --topic TOPIC          Topic/title of episode (REQUIRED)
    -s, --summary TEXT         2-3 sentence summary (REQUIRED)
    -p, --participants NAMES   Comma-separated list of participants
    -c, --context CONTEXT      Context (session/boardroom/cron/etc.)
    -d, --decisions DECISIONS  JSON array of key decisions
    -e, --emotion VALENCE      Emotional valence (positive/neutral/negative/mixed)
    -w, --what-changed CHANGES JSON array of what changed
    -T, --tags TAGS            Comma-separated list of tags
    -i, --interactive          Interactive mode (prompts for all fields)
    -h, --help                 Show this help

EXAMPLES:
    # Quick capture
    capture-episode.sh -a selah -t "Built memory system" \\
        -s "Eiran requested episodic memory. Built format and script." \\
        -p "selah,eiran" -c "boardroom" -T "infrastructure,memory"

    # Interactive mode
    capture-episode.sh -i

ENVIRONMENT:
    BLUM_AGENT              Default agent name
    BLUM_EPISODES_DIR       Episodes directory (default: ~/blum/shared/memory/episodes)

OUTPUT:
    Episode JSON written to: \$EPISODES_DIR/<agent>/<date>-<uid>.json
    Episode ID printed to stdout

EOF
    exit 0
}

# ═══════════════════════════════════════════════════════════════════════
# INTERACTIVE MODE
# ═══════════════════════════════════════════════════════════════════════

interactive_capture() {
    echo "═══════════════════════════════════════════════════════════"
    echo "  Episodic Memory Capture (Interactive)"
    echo "═══════════════════════════════════════════════════════════"
    echo

    # Agent
    read -p "Agent name [$AGENT]: " input
    AGENT="${input:-$AGENT}"

    # Topic
    read -p "Topic/title (REQUIRED): " TOPIC
    if [[ -z "$TOPIC" ]]; then
        echo "Error: Topic is required" >&2
        exit 1
    fi

    # Summary
    echo "Summary (2-3 sentences, end with empty line):"
    SUMMARY=""
    while IFS= read -r line; do
        [[ -z "$line" ]] && break
        SUMMARY="${SUMMARY}${line} "
    done
    SUMMARY=$(echo "$SUMMARY" | xargs)  # Trim whitespace
    if [[ -z "$SUMMARY" ]]; then
        echo "Error: Summary is required" >&2
        exit 1
    fi

    # Participants
    read -p "Participants (comma-separated): " participants_input
    PARTICIPANTS="$participants_input"

    # Context
    read -p "Context (session/boardroom/cron/etc.): " context_input
    CONTEXT="${context_input:-session}"

    # Decisions
    read -p "Key decisions (comma-separated, or leave blank): " decisions_input
    DECISIONS="$decisions_input"

    # Emotion
    read -p "Emotional valence (positive/neutral/negative/mixed) [neutral]: " emotion_input
    EMOTION="${emotion_input:-neutral}"

    # What changed
    read -p "What changed (comma-separated, or leave blank): " changes_input
    WHAT_CHANGED="$changes_input"

    # Tags
    read -p "Tags (comma-separated): " tags_input
    TAGS="$tags_input"

    echo
}

# ═══════════════════════════════════════════════════════════════════════
# PARSE ARGUMENTS
# ═══════════════════════════════════════════════════════════════════════

INTERACTIVE=0
TOPIC=""
SUMMARY=""
PARTICIPANTS=""
CONTEXT="session"
DECISIONS=""
EMOTION="neutral"
WHAT_CHANGED=""
TAGS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--agent)
            AGENT="$2"
            shift 2
            ;;
        -t|--topic)
            TOPIC="$2"
            shift 2
            ;;
        -s|--summary)
            SUMMARY="$2"
            shift 2
            ;;
        -p|--participants)
            PARTICIPANTS="$2"
            shift 2
            ;;
        -c|--context)
            CONTEXT="$2"
            shift 2
            ;;
        -d|--decisions)
            DECISIONS="$2"
            shift 2
            ;;
        -e|--emotion)
            EMOTION="$2"
            shift 2
            ;;
        -w|--what-changed)
            WHAT_CHANGED="$2"
            shift 2
            ;;
        -T|--tags)
            TAGS="$2"
            shift 2
            ;;
        -i|--interactive)
            INTERACTIVE=1
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage
            ;;
    esac
done

# ═══════════════════════════════════════════════════════════════════════
# RUN INTERACTIVE MODE IF REQUESTED
# ═══════════════════════════════════════════════════════════════════════

if [[ $INTERACTIVE -eq 1 ]]; then
    interactive_capture
fi

# ═══════════════════════════════════════════════════════════════════════
# VALIDATION
# ═══════════════════════════════════════════════════════════════════════

if [[ -z "$TOPIC" ]]; then
    echo "Error: --topic is required" >&2
    exit 1
fi

if [[ -z "$SUMMARY" ]]; then
    echo "Error: --summary is required" >&2
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════
# BUILD JSON ARRAYS
# ═══════════════════════════════════════════════════════════════════════

# Convert comma-separated strings to JSON arrays
participants_json="[]"
if [[ -n "$PARTICIPANTS" ]]; then
    participants_json=$(echo "$PARTICIPANTS" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | jq -R . | jq -s .)
fi

decisions_json="[]"
if [[ -n "$DECISIONS" ]]; then
    decisions_json=$(echo "$DECISIONS" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | jq -R . | jq -s .)
fi

changes_json="[]"
if [[ -n "$WHAT_CHANGED" ]]; then
    changes_json=$(echo "$WHAT_CHANGED" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | jq -R . | jq -s .)
fi

tags_json="[]"
if [[ -n "$TAGS" ]]; then
    tags_json=$(echo "$TAGS" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | jq -R . | jq -s .)
fi

# ═══════════════════════════════════════════════════════════════════════
# GENERATE EPISODE ID
# ═══════════════════════════════════════════════════════════════════════

EPISODE_ID="episode-${AGENT}-${DATE}-${EPISODE_UID}"

# ═══════════════════════════════════════════════════════════════════════
# BUILD EPISODE JSON
# ═══════════════════════════════════════════════════════════════════════

EPISODE_JSON=$(jq -n \
    --arg episodeId "$EPISODE_ID" \
    --arg agent "$AGENT" \
    --arg timestamp "$TIMESTAMP" \
    --arg topic "$TOPIC" \
    --argjson participants "$participants_json" \
    --arg context "$CONTEXT" \
    --arg summary "$SUMMARY" \
    --argjson keyDecisions "$decisions_json" \
    --arg emotion "$EMOTION" \
    --argjson whatChanged "$changes_json" \
    --argjson tags "$tags_json" \
    '{
        episodeId: $episodeId,
        agent: $agent,
        timestamp: $timestamp,
        topic: $topic,
        participants: $participants,
        context: $context,
        summary: $summary,
        keyDecisions: $keyDecisions,
        commitments: [],
        emotionalValence: {
            overall: $emotion,
            notes: ""
        },
        relationalImpact: {
            strengthened: [],
            challenged: [],
            notes: ""
        },
        whatChanged: $whatChanged,
        procedural: {
            learned: [],
            failed: []
        },
        tags: $tags,
        relatedEpisodes: [],
        artifacts: []
    }')

# ═══════════════════════════════════════════════════════════════════════
# WRITE EPISODE FILE
# ═══════════════════════════════════════════════════════════════════════

AGENT_DIR="${EPISODES_DIR}/${AGENT}"
mkdir -p "$AGENT_DIR"

EPISODE_FILE="${AGENT_DIR}/${DATE}-${EPISODE_UID}.json"
echo "$EPISODE_JSON" > "$EPISODE_FILE"

# ═══════════════════════════════════════════════════════════════════════
# OUTPUT
# ═══════════════════════════════════════════════════════════════════════

echo "Episode captured: $EPISODE_ID"
echo "File: $EPISODE_FILE"
echo
echo "$EPISODE_JSON" | jq .

# Return episode ID for scripting
echo "$EPISODE_ID"
