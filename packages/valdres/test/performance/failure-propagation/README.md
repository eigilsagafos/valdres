# Selector failure propagation

A focused harness for what one throwing selector costs when many subscribed
selectors depend on it. It is not part of any test or benchmark lane and makes
no timing assertions.

One or more root selectors (`--roots=N`, default 1) throw while an atom is
`true`: a new `Error`, a string or a plain object
(`--throw=error|primitive|object`). `layers` rows of `width` subscribed
dependents sit below them as independent chains (`chain`), fan-in-two diamonds
(`diamond`), two readers per node (`fanout`), or diamonds where every seventh
node catches the dependency error and falls back (`mixed`). Each failing
dependent gets its own `SelectorGetterError` wrapping a
`SelectorDependencyError`, so one throw produces about two library errors per
affected selector.

Both drivers import built `dist` directories, so a baseline and a candidate
build can run side by side.

```sh
# Build the candidate, and a baseline from another checkout or worktree.
(cd packages/valdres && bun run build && cp -R dist /tmp/candidate-dist)
(cd ../baseline/packages/valdres && bun run build && cp -R dist /tmp/base-dist)
cd packages/valdres/test/performance/failure-propagation

# Structural counts: wrappers created (counted as they are sealed, including
# ones a fallback caught and discarded), wrappers reachable from outcomes,
# wrappers with stack frames, stack materializations during the write, cause
# depth, retained heap and (V8 only, when no collection interrupts the write)
# bytes allocated.
bun count.mjs /tmp/base-dist mixed 100 20
node --max-semi-space-size=64 count.mjs /tmp/candidate-dist mixed 100 20

# Uninstrumented timing, lanes interleaved in one process. `jotai` adds a
# reference comparison on the same graph; Jotai rethrows the dependency's own
# error without wrappers, so it is not doing the same work.
bun time.mjs chain 100 20 30 --throw=primitive --roots=3 base=/tmp/base-dist candidate=/tmp/candidate-dist null=/tmp/base-dist-copy jotai > bun.json
node time.mjs chain 100 20 30 base=/tmp/base-dist candidate=/tmp/candidate-dist null=/tmp/base-dist-copy jotai > node.json
node summarize.mjs bun.json node.json
```

A `null` lane (a second copy of the baseline build) shows the noise floor. The
`count.mjs` interception of `Object.freeze`, `Object.preventExtensions` and
`Error.prepareStackTrace` is confined to each write and never runs during
timing.

Timed steps per round: a healthy write and read; the failing write; reading
every outcome; inspecting each error's library cause chain metadata; a relevant
input change while the fault persists; reading the stack of every library
wrapper (the worst-case consumer, which pays any deferred stack work); the
recovering write and read.
