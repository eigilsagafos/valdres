import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        include: [
            "test/v1-public-candidate/collection-index.test.ts",
            "test/v1-public-candidate/collection-index-types.test.ts",
            "test/performance/collection-index.performance.test.ts",
        ],
        testTimeout: 30_000,
        pool: "forks",
        poolOptions: { forks: { singleFork: true } },
    },
})
