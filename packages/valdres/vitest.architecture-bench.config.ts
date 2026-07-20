import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        include: ["test/performance/architecture.timing.ts"],
        testTimeout: 60_000,
        pool: "forks",
        poolOptions: { forks: { singleFork: true } },
    },
})
