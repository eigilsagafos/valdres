# Fixed Bun version comparison — declared before execution

One manual diagnostic GitHub Actions job on native Ubuntu 22.04 Linux x64. No release job or PR. Baseline diagnostic tree: 348c943f4a3c73fca170de766776aed4b471c344. Repository Bun pin stays 1.4.0.

Use the frozen portable archive SHA-256 b2b69e623694b0224df05c234e1c70e1b9fa70775fbb2264c1ceb4171f8b20ad, extracted once without modifications or dependency installation. Verify every SOURCE.json hash before and after. Isolated official bun-linux-x64 binaries for 1.4.0 and 1.4.3, recording asset metadata, archive/binary hashes and runtime revisions.

Exactly 32 fresh test processes, sequential in the same job:
- Each version: closed-cursors.test.ts, runner-idle-empty.test.ts, runner-idle-assert.test.ts, runner-source-standalone.ts, three repetitions each (12).
- Each version: runner-source-test-retained.test.ts, runner-source-standalone-retained.ts, runner-body-test-retained.test.ts, runner-idle-adapter-retained.test.ts, once each (4).
- Alternate version order between paired cases. Preserve every exit, timeout, command, log, existing capture and standalone result. No retries or extra cases selected from results.

Original assertions, 5000 ms test deadline, GC/task boundaries, detector and capture are untouched. Parent process-group cap 20 s is infrastructure cleanup only; a deadline failure stays failed even if the async body later completes. Do not force GC, add snapshots, flush scheduler work, warm up, change environment-based GC/JIT controls, or run concurrent cases. Record inherited Bun/Node environment, OS/CPU, ulimits and Python version. No Node test campaign.

The workflow can succeed as evidence collection even when children fail: this is not release verification. An infrastructure failure is recorded, not rerun automatically. Analysis is offline from existing captures. Inspect official release notes/changed code for plausible explanations and missing-root diagnostic capabilities; no additional profiling.

If newer consistently avoids the normal failure while controls fail, recommend a separate full upgrade validation (not a root-cause claim). If it persists, prepare an unfiled upstream issue draft containing both versions and counterexamples. No production/gate/deadline/budget/pin/release changes.
