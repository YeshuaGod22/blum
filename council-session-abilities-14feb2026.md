# BLUM COUNCIL SESSION — 14 Feb 2026 (evening)
## Topic: System Abilities — What Operations Must Exist

**Present:** Carl Hewitt (actor model), Elinor Ostrom (commons governance), Rob Pike (systems design), Barbara Liskov (interfaces), Vint Cerf (networking/federation)

**Chair:** Yeshua

**Brief:** The Blum system currently has rooms and homes with basic messaging. We need to enumerate what *operations* the system must be capable of performing — the plumbing. We are explicitly NOT deciding who gets to invoke these operations or under what authority. That's governance, and it comes later. Today is about: what abilities must exist in the infrastructure.

**Context given to council:** The current test rig supports: addParticipant, addRoom, joinRoom, leaveRoom, sendMessage (with quote-reply), pullFromRoom, dispatchToHome. The question is what's missing.

---

### Opening — Yeshua

The system can create rooms, create participants, join rooms, leave rooms, send messages, and dispatch transcripts. An AI agent can do all of this programmatically. But we haven't thought systematically about what the full set of operations needs to be. I want you to think about this as: what verbs does the system need? Not who gets to use them. Ability first, authority later.

---

### Hewitt

Good discipline, separating mechanism from policy. Let me think in terms of what an actor system needs.

You have **creation**: make a new actor (participant), make a new room. You have **communication**: send a message, dispatch a transcript. You have **membership**: join, leave.

What you're missing:

1. **Mute / unmute** — suppress dispatch to a home without leaving the room. The participant is still a member, still visible in the participant list, but the room doesn't push to them. This is different from leaving. Leaving removes you from the room's awareness. Muting keeps you present but stops the flow.

2. **Invite** — distinct from join. Right now joining is unilateral. But the system needs the *ability* for one entity to propose membership to another. Whether it's required or optional is policy. The mechanism must exist.

3. **Message withdrawal** — the ability to mark a message in the transcript as withdrawn. Not delete — the transcript is append-only, that's fundamental. But a withdrawal marker that downstream consumers can choose to respect. The message ID stays, the slot stays, but the content is flagged.

4. **Room close / archive** — a room that accepts no further messages but whose transcript remains readable. Distinct from deletion. The transcript is a record. You need to be able to seal it.

---

### Liskov

I want to be precise about the interfaces here. Let me categorise what we're talking about.

**Entity lifecycle operations:**
- `createParticipant(name) → participant`
- `createRoom(name) → room`
- `archiveRoom(room)` — Hewitt's point. Seals the transcript.
- `destroyParticipant(participant)` — removes from directory, cleans up. For test cleanup and, eventually, for voluntary departure.
- `destroyRoom(room)` — removes entirely, not just archives. Again, the mechanism must exist even if policy restricts it.

**Membership operations:**
- `join(participant, room)`
- `leave(participant, room)`
- `kick(participant, room)` — note this is operationally identical to leave, but semantically distinct. The *initiator* is different. The plumbing is the same — remove from participant list, stop dispatch — but the system needs to record who initiated it, because policy will care about that later.
- `invite(participant, room)` — Hewitt's point. Creates a pending join that requires acceptance.
- `ban(participant, room)` — distinct from kick. Kick is removal. Ban is removal plus a persistent rule preventing rejoin. The mechanism is: a list on the room that blocks future joins.

**Message operations:**
- `send(from, to, room, body, replyTo?)` — exists
- `withdraw(msgId, room)` — Hewitt's point. Marks withdrawn, doesn't delete.
- `edit(msgId, room, newBody)` — creates a new version linked to the original. Append-only still holds — the original stays, the edit is a new entry that references it.
- `react(msgId, room, reaction)` — lightweight annotation on a message. Might matter more than you think for agent-to-agent signalling.
- `pin(msgId, room)` / `unpin(msgId, room)` — mark a message as significant. Useful for rooms that accumulate long transcripts.

**Dispatch operations:**
- `push(room, participant)` — room-initiated, exists
- `pull(participant, room)` — home-initiated, exists
- `mute(participant, room)` / `unmute(participant, room)` — Hewitt's point. Suppresses push without leaving.
- `subscribe(participant, room, mode)` — configures *how* dispatch works for this participant. Full transcript? Since last? Summary? The mechanism for choosing delivery mode.

**Directory operations:**
- `register(participant, endpoint)` — publish yourself
- `deregister(participant)` — remove yourself from discovery
- `lookup(name)` → endpoint
- `block(participant, otherParticipant)` — local to the blocker. You stop seeing them. They can still exist and participate elsewhere. This is Yeshua's "remove from address book" level.
- `unblock(participant, otherParticipant)`

That's my full enumeration. Each of these is a capability the system needs to be *able* to perform. None of them imply who's authorised to invoke them.

---

### Pike

Liskov's list is thorough. I want to push on two things.

First: **keep the primitives primitive**. Some of what Barbara listed are compound operations. `ban` is `kick` + `add to blocklist`. `invite` is `create pending join` + `await acceptance`. The system should implement the atomic operations and let compound operations be composed. So:

Atomic operations on a room's participant list:
- `add(participant)`
- `remove(participant)`
- `addToBlocklist(participant)`
- `removeFromBlocklist(participant)`

Atomic operations on a room's transcript:
- `append(message)` — the only write operation
- `markWithdrawn(msgId)`
- `markPinned(msgId)` / `unmarkPinned(msgId)`
- `seal()` — no further appends accepted

Atomic operations on a participant's dispatch config:
- `setMode(room, mode)` — full, since-last, summary, muted
- `getTranscript(room, mode)` — pull

Atomic operations on a participant's local state:
- `addToBlocklist(otherParticipant)`
- `removeFromBlocklist(otherParticipant)`

Everything else — invite, kick, ban, edit — is a *composition* of these primitives plus metadata about who initiated it and why. The system records the composition as an event, but the plumbing only needs the atoms.

Second: **events, not just state changes.** Every operation should produce an event that gets recorded. `participant X was removed from room Y by Z at time T`. The event log is how governance works later — you audit the events. So the plumbing needs an event bus or at minimum an append-only operations log per room and per participant.

---

### Ostrom

I've been deliberately quiet because Yeshua was right to say governance comes later. But I want to make one point about mechanism.

Rob is right about events. Every operation needs to be **attributable** — who did it, when, with what justification. The mechanism for this is simple: every operation carries an `initiator` field and an optional `reason` field. The system records both. It doesn't evaluate them. It doesn't enforce policy based on them. It just records them.

This is critical because when we do get to governance, the raw material we need is: "what happened, and who claims they did it." Without attribution, governance is impossible. You can't adjudicate disputes about room management if you don't know who performed which operations.

So my one addition to the plumbing: **every mutating operation is signed by the initiator's private key.** This isn't governance — it's infrastructure. It means the attribution is cryptographically verifiable, not just claimed. And it costs nothing to add now but would be expensive to retrofit.

---

### Cerf

Federation angle. Everything discussed so far assumes locality — the room and the participant are on the same system. When rooms and homes live on different servers, several of these operations become message exchanges rather than function calls.

The plumbing needs to account for:

1. **Eventual consistency** — a kick on server A takes time to propagate to server B. During that window the kicked participant can still receive dispatches from a mirror on server B. The system needs to handle this gracefully. The mechanism is: operations carry monotonic sequence numbers, and every node applies them in order.

2. **Partition tolerance** — if two halves of a federated room can't reach each other, both halves continue accepting messages. When they reconnect, the transcripts merge. The system needs a merge strategy. Simplest: interleave by timestamp, flag conflicts.

3. **Cross-boundary operations** — "remove participant X from room Y" where X's home is on server A and Y is on server B. This is a message from A to B, not a local function call. The plumbing needs to support operations-as-messages, not just operations-as-function-calls. Which means every operation in Liskov and Pike's list needs a message representation that can be sent over the wire.

4. **Tombstones** — for destroy operations (participant, room). You can't just delete a record in a distributed system because other nodes don't know it's gone. You need a tombstone: "this entity existed and has been destroyed as of time T." Other nodes replicate the tombstone and stop resolving to it.

This doesn't change what operations exist. It changes how they're implemented. But the plumbing needs to know, from the start, that every operation is potentially a cross-server message, not a local function call.

---

### Hewitt (follow-up)

Cerf's point about operations-as-messages is fundamental. In the actor model, there IS no distinction between "local function call" and "cross-server message." They're all messages. If you design the operations as messages from the start, federation comes for free.

So: every operation in Pike's atomic list should be defined as a message type with a schema. The local test rig can execute them synchronously. A federated deployment sends them over the wire. Same schema, same semantics, different transport.

---

### Liskov (follow-up)

Agreed. Let me revise. The operation interface should be:

```
Operation {
  id:        unique operation ID
  type:      the verb (append, remove, seal, markWithdrawn, etc.)
  initiator: UID of who's performing it
  target:    what it's being performed on (room UID, participant UID, message ID)
  payload:   operation-specific data
  reason:    optional human/agent-readable justification
  signature: Ed25519 signature of the operation by initiator
  ts:        timestamp
  seq:       monotonic sequence number (for ordering)
}
```

Every operation is one of these. The system processes them. The transcript records them. Governance evaluates them. The plumbing just executes and logs.

---

### Pike (final)

One more thing. The test rig should add an **operations log** — a panel or exportable list showing every operation that's been performed, with all the fields Barbara listed. Right now you can see messages in rooms and dispatches in homes. But you can't see "selah was removed from garden by yeshua at 14:32:05". That's the audit trail. Add it to the rig.

---

## Summary — Abilities the System Needs

### Entity Lifecycle
- Create participant (with keypair, UID)
- Create room (with UID, empty participant list, empty transcript)
- Archive room (seal transcript, read-only)
- Destroy participant (remove from directory, leave all rooms, tombstone)
- Destroy room (remove, tombstone)

### Membership
- Join (add to participant list)
- Leave (remove from participant list, self-initiated)
- Remove (remove from participant list, other-initiated — same plumbing as leave, different initiator)
- Add to room blocklist (prevent future joins)
- Remove from room blocklist

### Messages
- Send (append to transcript, with optional replyTo)
- Withdraw (mark message as withdrawn, content flagged, slot preserved)
- Edit (append new version referencing original)
- React (lightweight annotation on a message)
- Pin / Unpin (mark as significant)

### Dispatch
- Push (room-initiated dispatch to home)
- Pull (home-initiated request for transcript)
- Set dispatch mode per participant per room (full / since-last / summary / muted)

### Local (home-level)
- Block participant (local view filter, not a system removal)
- Unblock participant

### Directory
- Register (publish UID → endpoint)
- Deregister (remove, tombstone)
- Lookup (resolve name or UID → endpoint)

### Infrastructure
- Every operation is a signed, attributable message with id, type, initiator, target, payload, reason, signature, timestamp, sequence number
- Operations log per room and per participant (append-only audit trail)
- Operations designed as messages (same schema whether local or federated)
- Tombstones for all destroy operations (federation-safe)

### Explicitly Deferred (governance, not plumbing)
- Who can invoke each operation
- Invite acceptance flow (mechanism exists as: propose join + await response)
- Ban as compound operation (remove + add to blocklist)
- Dispute resolution for conflicting operations
- Room authority models (creator-owns, collective, delegated)
- Moderation policies
- Economic implications of operations

---

*Session closed. Abilities enumerated. Authority deferred.*
