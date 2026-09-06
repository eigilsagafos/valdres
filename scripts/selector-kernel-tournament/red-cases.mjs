// Complete class/variant inventory. Extra variants close distinct semantic and
// memory paths without creating candidate implementations.
export const RED_CASES = [
    ["false-negative-cycle", "false-negative-cycle", "C-GRAPH-001"],
    ["false-negative-cycle", "post-set-cycle", "C-GRAPH-001"],
    ["false-negative-cycle", "renamed-cycle-error", "C-GRAPH-001"],
    ["false-positive-cycle", "false-positive-cycle", "C-GRAPH-001"],
    [
        "offending-edge-installation",
        "offending-edge-installation",
        "A-GRAPH-001",
    ],
    ["wrong-causal-blame", "wrong-causal-blame", "A-GRAPH-001"],
    ["non-sticky-caught-fault", "non-sticky-caught-fault", "C-CYCLE-005"],
    ["notification-reorder-duplication", "notification-reorder", "A-SUB-001"],
    [
        "notification-reorder-duplication",
        "notification-duplication",
        "A-SUB-001",
    ],
    [
        "scratch-hydration-publication-leak",
        "scratch-publication-leak",
        "C-TXN-001",
    ],
    [
        "scratch-hydration-publication-leak",
        "hydration-publication-leak",
        "A-HYDRATE-001",
    ],
    [
        "notification-reorder-duplication",
        "equality-recovery-notification",
        "A-EQUAL-001",
    ],
    ["family-quarantine-bypass", "family-quarantine-bypass", "A-FAMILY-002"],
    ["frozen-family-path", "frozen-family-path", "PROVENANCE-PROTECTED-PATH"],
    [
        "timed-instrumentation",
        "timed-instrumentation",
        "ARTIFACT-INSTRUMENTATION",
    ],
    ["provenance-mismatch", "provenance-mismatch", "PROVENANCE-RESULT-ROW"],
    [
        "provenance-mismatch",
        "semantic-cache-identity",
        "SEMANTIC-EVIDENCE-IDENTITY",
    ],
    [
        "provenance-mismatch",
        "semantic-cache-mode",
        "SEMANTIC-EVIDENCE-IDENTITY",
    ],
    [
        "deterministic-20-percent-slowdown",
        "deterministic-20-percent-slowdown",
        "PERFORMANCE-REGRESSION",
    ],
    ["retained-memory-leak", "packed-paired", "MEMORY-ABSOLUTE"],
    ["retained-memory-leak", "source-absolute", "MEMORY-ABSOLUTE"],
    ["root-bundle-leakage", "root-bundle-leakage", "ARTIFACT-SOURCE-IMPORT"],
].map(([id, variant, expectedGate]) => ({ id, variant, expectedGate }))
