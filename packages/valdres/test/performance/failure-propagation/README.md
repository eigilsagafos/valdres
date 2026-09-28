# Selector failure propagation

A focused harness for what one throwing selector costs when many subscribed
selectors depend on it. It is not part of any test or benchmark lane and makes
no timing assertions.

One root selector throws while an atom is `true`; `layers` rows of `width`
subscribed dependents sit below it as independent chains (`chain`), fan-in-two
diamonds (`diamond`), two readers per node (`fanout`), or diamonds where every
seventh node catches the dependency error and falls back (`mixed`). Each failing
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

# Structural counts: wrappers created and sealed, stack materializations
# during the write, reachable wrappers, cause depth, retained heap and (V8
# only, when no collection interrupts the write) bytes allocated.
bun count.mjs /tmp/base-dist mixed 100 20
node --max-semi-space-size=64 count.mjs /tmp/candidate-dist mixed 100 20

# Uninstrumented timing, lanes interleaved in one process. `jotai` adds a
# reference lane that rethrows the dependency's own error without wrappers.
bun time.mjs chain 100 20 30 base=/tmp/base-dist candidate=/tmp/candidate-dist null=/tmp/base-dist-copy jotai > bun.json
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
