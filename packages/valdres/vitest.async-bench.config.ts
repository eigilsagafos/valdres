import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        include: ["test/performance/asyncSettlement.timing.ts"],
        testTimeout: 60_000,
        pool: "forks",
        poolOptions: { forks: { singleFork: true } },
    },
})
