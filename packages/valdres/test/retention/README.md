# Mandatory retention checks

Ordinary StoreTree tests assert transaction outcomes, closed-cursor rejection,
scope cancellation, inherited values and exact route removal without requiring
collection. This directory preserves the seven original GC assertions from the
two affected suites. `bun run test:retention` runs each fixture in its own Bun
process, then all seven in a fresh process with `accumulated.ts` preloaded.
Both `test` and `test:ci` require this command. The runner fails on any child
failure or incomplete JUnit report; each case must execute with zero skipped
checks. Individual test deadlines (5000/15000 ms) and detector rounds, GC calls,
snapshot calls and task gaps are unchanged. There are no retries.

The accumulated process checks 64 prior commit/reset/dispose and abort cycles,
active root/sibling ownership, 129 retained closed cursors and 2200 callback
starts across scheduler budget generations. Its invariants are checked before,
after each case, and at the end. Scheduler setup has its own 5000 ms failure bound, cleared before GC cases start.
The collection fixtures additionally retain
closed writers, cold routes, held microtask closures and old/duplicate/reversed
refill callbacks during GC. Thus isolation does not discard those relevant
lifetime and shared-scheduler conditions. Existing deterministic family-cache,
F1/F2 scheduling and ordinary lifecycle suites remain mandatory too.

This is a test-reliability mitigation, not proof of the historical timeout's
cause. It exchanges arbitrary whole-suite heap/JIT/runner history for explicit,
bounded state. It cannot cover every possible prior-test interaction or prove
that a production leak is impossible. The other existing GC suites are outside
this narrow change. The ownership and eventual-release checks here both remain
real GC assertions; deterministic checks alone are not proof of collection.

Capture retains existing first/latest snapshots, scalar target/phase metadata,
commands, exit status, runtime and JUnit evidence. CI's existing always-upload
step preserves failure output. No reported root is not no root: conservative
edges may be absent. Instrumentation itself can change timing and heap shape.

The existing negative-control script now copies these fixtures. It deliberately
retains callbacks/Present/Absent/scope rows or releases their owners prematurely;
it must fail the original assertion. The manual control workflow continues to
prove that failed tests upload the known callback retaining path. Neither a
passing control nor a passing normal run resolves the open timeout follow-ups.
