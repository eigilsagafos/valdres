import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        include: ["test/performance/*.memory.ts"],
        testTimeout: 120_000,
        pool: "forks",
        poolOptions: { forks: { singleFork: true } },
    },
})
