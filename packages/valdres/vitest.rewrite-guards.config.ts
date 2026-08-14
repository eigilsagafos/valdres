import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        // This focused V8 lane intentionally omits the Bun/JSC-calibrated
        // collection assertions in test/memoryleaks.test.ts.
        include: [
            "test/oracle/**/*.test.ts",
            "test/invariants/**/*.test.ts",
            "src/lib/*Fuzz.test.ts",
        ],
        testTimeout: 30_000,
        pool: "forks",
        poolOptions: { forks: { singleFork: true } },
    },
})
