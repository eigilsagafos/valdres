import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        include: ["test/performance/*.bench.ts"],
        testTimeout: 60_000,
        pool: "forks",
        poolOptions: { forks: { singleFork: true } },
    },
})
