# Bun 1.4.0 source-layout/runner retention reproduction (unfiled)

This packet is self-contained: 27 unchanged Valdres source files plus the exact failing fixture/detector, configuration and diagnostic comparisons. No npm package installation or credentials are required. Use Bun **1.4.0**, revision **34cbb9a40b4bd1bd767d134a7065e66c2432a676**. Native failures were on Ubuntu 22.04 x64; Darwin arm64 did not reproduce in the bounded comparisons. This is a report of observations, not a proven engine bug or production leak.

From the extracted directory, the exact single-case commands are:

```sh
cd packages/valdres
VALDRES_RETENTION_CAPTURE_DIR=/tmp/retention-original bun test test/retention/closed-cursors.test.ts
VALDRES_RETENTION_CAPTURE_DIR=/tmp/retention-standalone bun test/retention/runner-source-standalone.ts
VALDRES_RETENTION_CAPTURE_DIR=/tmp/retention-retained bun test test/retention/runner-source-test-retained.test.ts
```

Use fresh output directories. Each command is one fresh process; do not run until green. Original and standalone callback bodies are identical; only the test API import differs. The standalone adapter starts from a host task and keeps the 5000 ms deadline. Both use unchanged bounded collection logic (3 x 50 rounds, two GCs, original snapshots/task boundaries). The retained variant intentionally pins the committed callback globally and must fail. It is a detector control, not the unexplained bug.

The native repository comparison reproduced the unchanged test twice at 5009.49/5038.18 ms, with prompt onCommit execution, aborted capture collected and committed capture live. Both saved graphs show a six-node reverse component corresponding structurally to #transact's synchronous invocation wrapper -> transaction body -> payload, without a reported root. Both bodies collected immediately after the runner reported timeout, while the async test body continued. Standalone and bundle comparisons collected, but merely importing an unused adapter also made the original bun:test body collect. Therefore a passing standalone run alone cannot establish runner ownership.

Additional files separate the transaction-body capture from the onCommit capture, or add only an empty/Node assertion import. They are diagnostic counterfactuals, not fixes or replacements for the failing case. No production source file was modified. The upstream-sized packet deliberately includes the full reachable source graph because bundling it failed to reproduce in prior comparisons.

All results/snapshots from the investigation accompany the parent evidence packet. Inspector snapshots can omit conservative/native roots. **No reported root is not no root.** The evidence does not establish what marks the wrapper as live. No issue has been filed, and this packet does not propose changing the GC assertions, deadline, engine gate or production implementation.

`SOURCE.json` records exact source hashes. `packages/test/diagnostics/runner-source/run-portable.py OUTPUT local|native` executes the predeclared 8/12-case validation exactly once, preserving each failure, phases, snapshots and versions; its successful exit only means data collection completed. Original controls stay failed if collection finishes after the deadline.
