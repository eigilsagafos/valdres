---
"valdres": patch
---

**Selector failures now recover through their dependency edges.**

- A query whose first index materialization fails (an extractor throws or
  returns an invalid key for an existing row) now serves that error as its
  outcome. A selector reading it fails with a `SelectorDependencyError` on the
  query instead of caching an edge-less getter error, and the next committed
  change to that collection in that scope retries materialization and updates
  those selectors. Previously such a selector stayed failed until one of its
  other inputs changed, even after the row was repaired.
- A failure that escapes a selector's re-evaluation during any write, external
  source update, or external read now becomes that selector's error outcome, as
  it already did inside `settle` handlers. Its dependents settle against it and
  are notified, so no cached value computed before the write is served as
  current. The applied write is kept, and the failure is thrown afterwards,
  exactly as it escaped when it is the only error, or as a cause of a
  `SubscriberNotificationError` alongside other failures.
- A selector that reads a dependency whose first evaluation escaped now records
  that dependency, including when it catches the read error and returns a
  fallback, and recovers when that dependency does.
