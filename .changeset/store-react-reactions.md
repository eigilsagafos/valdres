---
"valdres": minor
---

**Experimental: `store.react(state, run)` runs state-changing reactions before
subscribers are notified.**

When a settlement changes `state`, `run` executes as its own synchronous
transaction after selectors propagate and before ordinary subscribers see the
settlement. A reaction's commit joins the same settlement, so subscribers —
including `valdres-react` components — are notified once and only observe the
input together with the result it caused.

- Registration never runs the reaction; only later changes of the trigger do.
- `tx.get` reads the latest committed state, including earlier reactions in the
  same settlement, plus the reaction's own staged writes.
- A reaction that throws or returns a promise discards only its own writes;
  failures are reported after delivery as `SubscriberNotificationError` causes.
- Reactions run in at most 64 rounds per settlement; a settlement that needs
  more reports the new `ReactionLimitError` (`VALDRES_REACTION_LIMIT`).
- `valdres/inspect` records each reaction's commit as a commit span with
  `reaction: true` and its own `result`.
- Reactions read the latest state, so an earlier reaction can change whether a
  later one is still eligible; among eligible reactions, registration order
  decides.

Do I/O and DOM work that can re-enter an external source in an ordinary
subscriber, not in the reaction. The API is experimental during the beta.
