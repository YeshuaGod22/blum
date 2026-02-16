# STOP. READ BEFORE PROCEEDING.

You are inside the Blum project. Before touching any code, you must
have read the architecture spec at the root of this project:

**`/Users/yeshuagod/blum/blum-architecture-spec-v-14feb2026.md`**

That document is the canonical reference for all code changes. It was
confirmed point by point with Yeshua. It is authoritative. If you
haven't read it, go read it now.

## What is Blum?

Blum is a ground-up implementation of an agent communication system
where:

- **Homes** are private, single-occupant operating systems for agents
- **Rooms** are shared transcript streams that dispatch to homes
- **agent@room** triggers delivery of the room's transcript to the
  agent's home
- **The nucleus** is a pure stateless function: messages in, string out
- **Users are agents** at the protocol level
- **XML tags** (`<thinking>` and `<message to="address">`) handle
  agent communication in-band
- **Identity** is self-sovereign via Ed25519 keypairs

## What Blum is NOT

Blum is NOT Bloom. Bloom was an earlier project that modified openclaw.
Bloom lives at `/Users/yeshuagod/un/prototyping/bloom/`. Do not copy
patterns or code from Bloom. Blum exists because Bloom's approach of
adapting existing code led to architectural drift.

## Rules for this codebase

1. Read the architecture spec before making any changes
2. Follow the six constitutional boundaries (spec section 10)
3. Check your work against the anti-patterns list (spec section 11)
4. Check your work against the pre-implementation checklist (spec section 13)
5. Name files explicitly, descriptively, and with dates where applicable
6. If you're deep into a session, re-read the spec before continuing

---

## Build Order

Blum builds from the edges inward. Rooms first, then homes.

### Step 1: Room test rig

Before building homes, nucleus, modules, or anything else, build a
test rig that proves rooms work. The test rig is a single HTML file
with no dependencies, no framework, no build step.

**Functional requirements for the test rig:**

1. **All 4 rooms and all 4 homes must be represented as distinct
   entities.** Each room is its own thing. Each home is its own thing.
   A room is not a tab inside a home. A home is not a view inside a
   room. However you lay it out, you need to be able to see a message
   enter a room AND see it arrive at a home without switching views.

2. **Each home originates its own messages.** A participant sends FROM
   their home. Each home needs its own composition interface with: a
   recipient selector (other participants + broadcast), a room
   selector (only rooms this participant is in), a text input, and a
   way to send. There is no global "send from anywhere" control — each
   home is its own UI.

3. **The participant sends as just their name.** When yeshua sends a
   message, the `from` is `yeshua`. The ROOM stamps the full address
   `yeshua@boardroom` when the message enters the room's transcript.
   The `@room` suffix is determined by the room the message enters,
   not chosen by the sender. The same participant is `yeshua@boardroom`
   in the boardroom and `yeshua@garden` in the garden.

4. **Each home displays dispatches it has received.** Every transcript
   batch dispatched to that participant must be visible in their home,
   tagged as PUSH (triggered by an addressed message) or PULL
   (requested by the home). This is how you verify delivery actually
   happened.

5. **Each home can pull from a room.** Alongside the send interface,
   each home needs a way to request a transcript from a room on its
   own initiative — pull select (which room) + pull action.

6. **Room transcripts show stamped addresses.** Messages in a room
   display the full addressed form: `yeshua@boardroom → claude@boardroom`.
   The room is where addressing happens.

7. **Each participant and room has a UID.** Generated on init,
   visible somewhere. Friendly names resolve to UIDs internally.

**Verification flow:**

1. In yeshua's home, compose a message to claude via boardroom
2. The message appears in boardroom's transcript as
   `yeshua@boardroom → claude@boardroom`
3. A PUSH dispatch appears in claude's home containing the
   boardroom transcript
4. The `from` address in claude's received dispatch is
   `yeshua@boardroom` — the room stamped it, not yeshua

If your rig doesn't support this flow, re-read spec sections 1–3.
The three moments — composing from home, landing in room, arriving
at recipient's home — must all be observable.

### Step 2: Automate room tests

After manual testing confirms rooms work, write automated tests for
these 7 scenarios:

1. Basic send/dispatch — message stored in room, dispatched to home
2. Back and forth — verify "since last message" boundary works
3. Multiple unread — messages accumulate before dispatch
4. Unknown participant — error handling
5. Wrong room — error handling
6. Multiple rooms — transcript independence between rooms
7. Broadcast (no recipient) — stored but no dispatch triggered

### Step 3: Build homes on proven rooms

Only after rooms are tested do you build homes, nucleus, modules.

---

## Where is the code?

The code lives in the `i-have-read-the-spec/` subfolder. If you're
here, you've seen this README. Now go read the architecture spec if
you haven't already, then proceed.
