# Phase B: import discrimination + portable upstream packet
Declared after Phase A, before these executions; uses the entire remaining ceiling (8 local / 12 native), no further pass.

Native Phase A: original source/bun:test failed 2/2 at 5009.49 and 5038.18 ms, both with the same six-node root-unreported component and collection in the first post-timeout round. Standalone original body collected 2/2; source bun:test merely importing the unused standalone adapter also collected 2/2. Bundle cases collected. Body-only and hook-only layouts collected, with deliberate-retention counterparts failing. Thus runner ownership alone is not established; module loading/layout is a confound that needs explicit controls.

Build a self-contained portable tree preserving exact source, fixture/detector files, package and TS configuration boundaries. Include only the recursively reachable relative source imports (27 files, no external dependencies), original capture support, diagnostic fixtures/adapter, original MIT license and fixed version/commit manifest. Run it from its own extracted directory with no node_modules. This is also validation that an upstream recipient can execute it without this workspace or credentials. No issue will be filed.

Exact portable cases:
- Original source/bun:test: once local, twice native.
- Original source/standalone: once local, twice native.
- Original source/bun:test deliberate effect retention: once each.
- Original source/bun:test with only an empty module imported: once local, twice native.
- Original source/bun:test with only node:assert/strict imported: once local, twice native.
- Original source/bun:test with idle standalone adapter import plus deliberate effect retention: once each.
- Body-only and hook-only source/bun:test fixtures: once each per platform.

Totals: 8 local / 12 native. Same assertions, 5000 ms bound, detector, snapshots, GC and task sequence. No repeat after a result. This is a separate read-only diagnostic workflow, not a retry of Phase A or a release workflow. If the portable original fails, it is the upstream reproduction; if not, preserve that counterexample and include the exact-repository execution recipe and known failing snapshots. No import/layout workaround is a correction without an identified retaining cause. Conclude with evidence/tool limits and release-gate coverage options if cause remains unestablished.
