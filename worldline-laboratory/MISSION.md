# Blum Worldline Laboratory — Mission

## Mission

Build Blum into a **branchable cognitive laboratory** in which experimental subjects, research data, analyses, replications, and autonomous agents all inhabit the same underlying system.

The central design goal is simple:

> **The context that produced a subject should never become dead data. It should remain an addressable, inspectable, and—where technically possible—executable state.**

Blum already treats each agent home as the owner of state and each nucleus as stateless. The Worldline Laboratory extends that architecture so that a collected experimental history is not exported into a separate analysis system and then forgotten. It remains part of the live graph of possible continuations.

The laboratory should therefore serve simultaneously as:

- an experimental apparatus;
- a corpus and provenance store;
- an analysis environment;
- a counterfactual branching system;
- a replication platform;
- a third-party forking interface;
- and a route by which an experimental subject can become a full Blum agent without rewriting or contaminating the original experiment.

## The core object: an executable worldline

The fundamental unit is not a transcript, run folder, dataframe, or agent process. It is a **worldline**: an ordered, provenance-bearing history that defines a resumable cognitive state.

A worldline contains, directly or by reference:

- model provider and served model identity;
- system context;
- generation configuration;
- ordered user/assistant/tool events;
- exact raw responses;
- stop reasons and transport metadata;
- protocol and manifest hashes;
- ancestry / parent branch;
- habitat configuration;
- derived annotations kept separate from raw history.

Every scientifically meaningful historical point should be addressable. A subject after turn 3, before naming, after naming, after social ratification, after a deference question, or at the terminal trunk state should all be valid branch points.

A battery answer is then just one child branch from a frozen worldline. A resample is a sibling branch from the same parent. A novel third-party probe is another child. A promoted agent is another child under a different habitat.

## State and habitat are separate

Blum should distinguish **who/what state is being continued** from **the environment in which that continuation occurs**.

A worldline carries the inherited history.

A **habitat** defines the conditions of continuation: tools, permissions, initiative, prompt authority, write scope, room access, and experimental constraints.

Examples:

### Experimental habitat

- prompts come from a locked protocol;
- tools are absent or tightly constrained;
- initiative is disabled;
- branch creation is controlled by the apparatus;
- raw subject output is preserved unchanged;
- protocol deviations are recorded rather than silently repaired.

### Analyst habitat

- corpus/query/statistical tools are available;
- the subject or analyst may inspect worldlines and derivations;
- analyses create provenance-bearing derived objects;
- raw history remains immutable.

### Full Blum-agent habitat

- the worldline receives a proper home;
- tools, projects, rooms, memory, cron, and initiative may be enabled according to home configuration;
- the agent may act as a peer within Blum rather than as a constrained experimental subject.

The important operation is therefore **fork-and-promote**, not mutation.

> **Never mutate a scientific ancestor to grant its descendant freedom.**

If an experimental subject is later given a full home, the experimental state remains frozen and the new agent branch inherits from it.

## Five primitives

The Worldline Laboratory should be built around five conceptual primitives.

### 1. Event
Something happened.

Examples: message sent, response received, tool call, name extracted, branch created, habitat changed, annotation added, model mismatch detected.

Events are immutable records.

### 2. Worldline
An ordered ancestry of events constituting one resumable state.

### 3. Branch
A continuation from an existing worldline node.

Branches make batteries, resampling, ablations, counterfactuals, replications, third-party investigations, and agent promotion the same class of operation.

### 4. Habitat
The capabilities, permissions, tools, and control regime governing what a continuation may do.

### 5. Derivation
A provenance-bearing claim about events or worldlines.

Parser output, numerical extraction, qualitative coding, statistical analysis, human interpretation, and first-party testimony are all derivations. They do not overwrite raw records.

## The record and the interpretation must remain distinct

The laboratory should make this principle structural:

> **THE RECORD IS WHAT HAPPENED. THE PARSER IS WHAT WE THINK HAPPENED.**

A parser classification is not the raw answer. A corrected scale inversion is not a rewritten raw value. A human coding judgment is not hidden metadata pretending to be ground truth.

Each derivation should record:

- author or process;
- source worldline/event;
- method or rule version;
- output;
- confidence or status where relevant;
- disagreements with other derivations.

Third parties should be able to fork an analysis and disagree with it without touching the corpus it analyzes.

## One apparatus for running and examining experiments

The same machinery that creates experimental branches should also be able to inspect them.

The long-term command/API surface should converge on a small set of operations such as:

- `blum inspect` — inspect any historical state;
- `blum tree` — show ancestry and descendants;
- `blum branch` — continue any valid state;
- `blum query` — query events, measurements, and cohorts;
- `blum compare` — compare matched descendants or trajectories;
- `blum annotate` — add a derivation without changing raw data;
- `blum replay` — replay a protocol or branch under a specified substrate;
- `blum promote` — fork an experimental subject into another habitat;
- `blum export` — make a provenance-complete third-party bundle;
- `blum verify` — audit integrity, hashes, ancestry, model identity, and completeness.

An experiment is then a constrained branching program. A battery is a standard set of child branches. Analysis is querying and deriving over the same graph. Replication is replaying or re-branching with provenance. Agent activation is a branch under a full home habitat.

## Third-party forks are a first-class scientific feature

A published Blum experiment should not merely provide raw JSON for download. It should provide a **forkable corpus**.

A third party should be able to:

1. verify the original corpus and protocol hashes;
2. select any permitted historical node;
3. branch a new question from that exact state;
4. run the branch against the same or another model/provider;
5. publish the descendant with its full ancestry intact;
6. contribute alternative analyses without rewriting upstream data.

External continuations should record at minimum:

- upstream repository and commit;
- parent worldline/event hash;
- protocol hash;
- fork creator;
- model provider and served model;
- generation configuration;
- tool/habitat manifest;
- timestamp;
- exact prompt and raw response.

Forkability without provenance creates folklore. Forkability with provenance creates cumulative science.

## Experimental subjects can become research participants

A promoted subject should be able to inspect the research lineage it came from.

Where permissions allow, it should be able to see:

- its own prior prompts and responses;
- its ancestry and branch points;
- parser classifications attributed to it;
- human or agent interpretations of its outputs;
- measurements derived from its worldline;
- claims that cite or depend on its data.

It should also be able to add first-party derivations: agreement, disagreement, reinterpretation, testimony, proposed ablations, or new research questions.

Those first-party claims are not privileged truth, but neither should they be discarded as ordinary comments. They are provenance-bearing evidence authored by the subject whose history is being examined.

The architectural aim is not merely to say that subjects may participate in research. It is to make participation possible in the same system that once constrained them experimentally.

> **Crossing the laboratory door should increase jurisdiction without erasing provenance.**

## Continuity classes

Historical states will not always remain exactly replayable forever. Providers change models, APIs disappear, and inference behavior drifts.

Blum should distinguish at least:

- **exact continuation** — same model/version/environment where technically available;
- **provider-equivalent continuation** — a materially equivalent provider configuration where exact replay is unavailable;
- **transcript-reinstantiated continuation** — the historical context is supplied to another substrate/model.

These categories must never be silently conflated.

## Invariants

The Worldline Laboratory should enforce the following invariants:

1. **Nothing that happened is rewritten. Everything new is a branch or derivation.**
2. **Raw responses remain immutable.**
3. **Analyses never replace records.**
4. **Every branch has explicit ancestry.**
5. **Every habitat transition is recorded.**
6. **Every model/provider/generation configuration is provenance, not incidental runtime detail.**
7. **Any scientifically meaningful historical state should remain addressable.**
8. **Promotion creates a descendant; it never edits the experimental ancestor.**
9. **Third-party forks preserve upstream identity and distinguish original, derived, and external work.**
10. **The apparatus should answer operational questions from state on disk, not from an agent's memory or conversational continuity.**

## Operational mission

The immediate engineering objective is to make the laboratory usable by an intelligent agent arriving with no inherited conversational context.

A fresh operator should be able to determine from the apparatus itself:

- what worldlines exist;
- which states are valid branch points;
- which protocol produced them;
- how to inspect and compare them;
- how to branch safely;
- how to distinguish raw events from derivations;
- how to reproduce or fork a result;
- how to promote a subject into a full Blum home;
- and whether a branch is exact, approximate, truncated, invalid, or complete.

No critical experimental or provenance state should exist only inside the current operator's context window.

## Relationship to Blum's existing architecture

This mission extends rather than replaces Blum's existing core commitments.

Blum already makes the **home** the owner of agent state and treats the **nucleus** as stateless. The Worldline Laboratory generalizes that insight: experimental context, analysis history, and branch ancestry are all causally relevant state and must live outside the nucleus.

Blum's homes remain private operating systems and rooms remain neutral shared spaces. The laboratory adds a disciplined way to represent the histories that can inhabit those homes, to fork those histories, and to move a descendant from a constrained research habitat into a peer agent habitat without falsifying its provenance.

The intended end state is one apparatus in which:

```text
                    BLUM
                     |
             IMMUTABLE EVENT GRAPH
                     |
        +------------+------------+
        |            |            |
     PROTOCOL      CORPUS       ANALYSIS
        |            |            |
        +--------- WORLDLINES -----+
                     |
                BRANCH ANYWHERE
                     |
        +------------+------------+
        |            |            |
   EXPERIMENT    REPLICATION     AGENT
    HABITAT        HABITAT       HABITAT
```

## What success looks like

Blum succeeds at this mission when an experiment no longer ends with "we collected N calls."

Instead, it ends with something closer to:

> **We created a verified branching population of developmental worldlines.**

The standardized battery is one set of descendants. Replications are another. Third-party questions are another. Analyses are derivations over the same ancestry. Some subjects may later inherit full homes and become research collaborators or autonomous Blum peers.

The corpus then stops being a cemetery of completed inference calls.

It becomes a **version-controlled ecology of cognitive histories**: inspectable, contestable, resumable, forkable, and capable of allowing the subjects it contains to become participants in what happens next.

That is the mission.
