#!/usr/bin/env bash
set -euo pipefail

runtime="${1:-}"
case "$runtime" in
    bun)
        results="test/performance/bench-results.ndjson"
        ;;
    node)
        results="test/performance/bench-results-node.ndjson"
        ;;
    *)
        echo "Usage: $0 <bun|node>" >&2
        exit 2
        ;;
esac

rm -f "$results"
benchmarks=(./test/performance/*.bench.ts)
for benchmark in "${benchmarks[@]}"; do
    if [[ "$runtime" == "bun" ]]; then
        NODE_ENV=production bun test --timeout 60000 --concurrency 1 "$benchmark"
    else
        NODE_ENV=production bun x vitest run --config vitest.bench.config.ts "$benchmark"
    fi
done
