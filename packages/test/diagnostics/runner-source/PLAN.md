# One bounded runner/source investigation pass
Declared before experimental execution. Baseline 348c943f4a3c73fca170de766776aed4b471c344. Preserve the earlier closed-cursor packet (manifest b86dc5c34530f15a92d114875695eae80002e406a9aab1f0904183c754eaf21a), all older evidence and failed PR #445. New isolated worktree/branch only. No release runs, merges, publication, production edits, deadline/assertion changes, budget/pin changes or upstream filing.

Hypothesis: the original synchronous transaction invocation wrapper survives the bun:test execution boundary. This is not established by rootless Inspector graphs. Separate runner ownership, source/module layout, and body/effect captures before considering a correction.

Phase A: 20 fresh cases per platform, local Darwin arm64 and native Ubuntu 22.04 x64, all pinned Bun 1.4.0:
- Original body: source and common unminified bundle, bun:test and standalone task entry, each twice = 8 cases.
- Each of these four has one deliberately retained onCommit callback control = 4 cases.
- Original bun:test/source body with the standalone adapter merely imported, twice = 2 cases. This controls adding the assertion/adapter module without changing runner execution.
- Body-only capture (no onCommit registration), bun:test/source and standalone/source, once each = 2 cases.
- Hook-only capture (separate registration helper clears its callback argument after txn returns), same runners, once each = 2 cases. No helper closure may point directly to payload.
- One body-only retained transaction-body control and one hook-only retained effect control, bun:test/source = 2 cases.

The first standalone fixture changes only the test API import; the original callback body, register closure, capture, expect expressions, original detector and GC/task sequence remain byte-identical. The adapter implements only this fixture's boolean/length assertions, starts from a host task, enforces 5000 ms, records failure and flushes existing captures. It retains the async test function/promise, never payloads/transaction callbacks. A timeout stays failed if the existing bounded body later resolves. A 20 s parent process cap is distinct; kill the entire child process group on cap, never leave an old worker running into another case.

Original bun:test source fixture stays an unchanged control. Added variants are diagnostic counterfactuals, not maintained test replacements. Same 3 x 50 rounds, existing two GCs/snapshot/task sequence. Preserve first/latest existing snapshots; analyze offline. Existing retained and premature-release control evidence stays intact.

Phase B reserve: at most 8 additional local and 12 additional native fresh cases, chosen and written down before execution from Phase A findings. At most two executions of any new comparison per platform. This includes standalone portable-packet validation and any discriminating follow-up. Do not repeat failures seeking green, expand into timing sweeps, or spend the reserve merely to reproduce a preferred outcome. Total ceiling 60 diagnostic test processes. Metadata commands/static checks are not collection experiments. Infrastructure defects must be recorded separately, not disguised as GC outcomes.

Return within this pass: (1) evidenced cause + justified test-only correction with controls, or (2) remaining tool/evidence limitations, portable upstream reproduction (not filed), and practical gate options with coverage risks. Do not end by asking to approve another tiny experiment. No production correction without a reproduction and proposed fix presented first.
