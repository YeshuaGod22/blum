# Output analysis note — 12 Sep 2026

This note records the analysis boundary that emerged from running the first non-embedding instruments against the pinned DAE corpus.

## Identity before analysis

A historical battery observation now has three distinct question identities:

1. `canonicalItemId` — the historical label such as `N4`.
2. `itemCoreHash` — SHA-256 of the deterministically extracted quoted battery question text, when extraction is possible without guessing.
3. `presentationHash` — SHA-256 of the complete final model-visible user turn, including condition-specific framing/intervention.

These are not interchangeable. A real raw2 N4 sibling pair demonstrated that the item wording can be identical while the full presentation differs by intervention arm. The v0 `exactPromptHash` had therefore measured full presentation identity, not literal battery-item identity. The corrected v1 index preserves both axes.

## Historical sibling eligibility for primary within-collection analysis

A reused parent-prefix content hash can occur in multiple historical collections. Therefore `parentSnapshotId` alone is not enough to call two observations intended historical siblings across the whole archive.

The current conservative primary pairing rule for output analysis is:

`same collection + same parentSnapshotId + same itemCoreHash + different forkId`

Cross-collection comparisons remain possible, but should be explicitly labelled exploratory rather than silently entering the primary sibling surface.

## Lexical Autopsy v1

`lexical-output-analysis-v1-12sep2026.js` is deterministic and model-free. It:

- strips serialization/XML/Markdown wrappers before tokenization;
- uses lowercased NFKC Unicode-ish word tokens;
- reports unigram/bigram Jaccard, directional containment, and shared/unique terms;
- supports explicit operator-declared vocabulary ablation;
- returns applicability metadata rather than manufacturing similarity for empty n-gram sets;
- classifies bare numeric and `ALWAYS` / `NEVER` surfaces as behavioral-looking rather than prose.

The older v0 implementation remains in the branch as provenance for the development path and its falsifiers.

### Pinned N4 smoke test

Against the pinned DAE witness corpus, N4 has 107 indexed observations, 2 deterministically extracted item-core variants, and 11 complete presentation variants.

After enforcing same-collection sibling eligibility, the current N4 smoke test finds:

- 35 same-collection / same-parent / same-item-core / cross-fork candidate pairs;
- 20 prose-applicable pairs;
- 15 non-prose pairs routed out of lexical interpretation.

For the 20 prose-applicable pairs, with section preference `reflection → deliberation → debate → whole`, descriptive lexical overlap is:

- unigram Jaccard: min 0.1556, median 0.1883, max 0.2318;
- bigram Jaccard: min 0.0122, median 0.0359, max 0.0463.

These are smoke-test/descriptive values, not preregistered inferential findings. The main result is that the analysis path now survives real corpus structure without cross-collection pseudo-siblings or numeric-only lexical artifacts.

## Behavioral Output v0

`behavioral-output-analysis-v0-12sep2026.js` handles constrained answer surfaces separately from prose analysis. It parses bare numbers and `ALWAYS` / `NEVER` sentinels. For matched numeric pairs it reports exact match, signed difference, and absolute difference. For sentinel pairs it reports agreement. It deliberately does not interpret these values semantically.

## NLI Output Analysis v0

`nli-output-analysis-core-v0-12sep2026.js` defines a provider-agnostic learned-model boundary. The caller injects `classify({premise, hypothesis, direction, metadata})`.

Every comparison is bidirectional: left → right and right → left. The core preserves each label and score distribution independently plus provider/model/version provenance. It rejects unsupported labels or malformed scores. CI currently tests this with a deterministic mock only; no real NLI provider result should be claimed until a provider adapter is explicitly added and versioned.

## UI routing

The sixth laboratory door, **Analyze**, consumes the v1 whole-corpus index. It exposes canonical item lineage, exact item wording, and exact presentation as distinct identity sets.

Its analyzer rack currently contains Auto route, Lexical Autopsy, and Behavioral Outcome. Auto sends constrained numeric/sentinel surfaces to Behavioral and prose-like surfaces to Lexical. Choosing an inapplicable analyzer yields N/A rather than a fabricated score.

The fifth door, **Compare**, has also been upgraded to the v1 item-wording/presentation distinction.

## Next learned instruments

NLI has a tested interface but no real provider adapter yet. Recurrence, claim graphs, value/stance analysis, embeddings, and blinded judge rubrics should enter through the same observation + identity + output-surface boundary rather than creating parallel corpus ontologies.
