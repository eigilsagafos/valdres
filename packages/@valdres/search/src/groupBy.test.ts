import { describe, test, expect } from "bun:test"
import { createSearchIndex } from "./createSearchIndex"
import type { GroupedSearchResults } from "./createSearchIndex"
import { atomFamily, store } from "valdres"

describe("GroupBy", () => {
    test("should group results by string field", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), { name: "Widget A", category: "tools" })
        defaultStore.set(products("2"), { name: "Widget B", category: "gadgets" })
        defaultStore.set(products("3"), { name: "Widget C", category: "tools" })
        defaultStore.set(products("4"), { name: "Widget D", category: "gadgets" })

        await index.waitForReady()

        const results = await index.search("widget", {
            groupBy: "category",
        }) as GroupedSearchResults

        expect(Object.keys(results).length).toBe(2)
        expect(results["tools"]).toBeDefined()
        expect(results["gadgets"]).toBeDefined()
        expect(results["tools"].length).toBe(2)
        expect(results["gadgets"].length).toBe(2)
    })

    test("should group results with sorted groups (ascending)", async () => {
        const items = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, items, {
            fields: ["name"],
        })

        defaultStore.set(items("1"), { name: "Item A", priority: "high" })
        defaultStore.set(items("2"), { name: "Item B", priority: "low" })
        defaultStore.set(items("3"), { name: "Item C", priority: "medium" })
        defaultStore.set(items("4"), { name: "Item D", priority: "high" })

        await index.waitForReady()

        const results = await index.search("item", {
            groupBy: { field: "priority", sort: "asc" },
        }) as GroupedSearchResults

        const keys = Object.keys(results)
        expect(keys).toEqual(["high", "low", "medium"])
    })

    test("should group results with sorted groups (descending)", async () => {
        const items = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, items, {
            fields: ["name"],
        })

        defaultStore.set(items("1"), { name: "Item A", priority: "high" })
        defaultStore.set(items("2"), { name: "Item B", priority: "low" })
        defaultStore.set(items("3"), { name: "Item C", priority: "medium" })

        await index.waitForReady()

        const results = await index.search("item", {
            groupBy: { field: "priority", sort: "desc" },
        }) as GroupedSearchResults

        const keys = Object.keys(results)
        expect(keys).toEqual(["medium", "low", "high"])
    })

    test("should handle null/undefined values in grouping", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), { name: "Widget A", category: "tools" })
        defaultStore.set(products("2"), { name: "Widget B" }) // No category
        defaultStore.set(products("3"), { name: "Widget C", category: "tools" })

        await index.waitForReady()

        const results = await index.search("widget", {
            groupBy: "category",
        }) as GroupedSearchResults

        expect(results["tools"]).toBeDefined()
        expect(results["__null__"]).toBeDefined()
        expect(results["tools"].length).toBe(2)
        expect(results["__null__"].length).toBe(1)
    })

    test("should combine grouping with filtering", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), { name: "Widget A", category: "tools", inStock: true })
        defaultStore.set(products("2"), { name: "Widget B", category: "gadgets", inStock: false })
        defaultStore.set(products("3"), { name: "Widget C", category: "tools", inStock: true })
        defaultStore.set(products("4"), { name: "Widget D", category: "gadgets", inStock: true })

        await index.waitForReady()

        const results = await index.search("widget", {
            filter: { field: "inStock", value: true },
            groupBy: "category",
        }) as GroupedSearchResults

        expect(Object.keys(results).length).toBe(2)
        expect(results["tools"].length).toBe(2)
        expect(results["gadgets"].length).toBe(1)
    })

    test("should combine grouping with sorting", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), { name: "Widget A", category: "tools", price: 30 })
        defaultStore.set(products("2"), { name: "Widget B", category: "tools", price: 10 })
        defaultStore.set(products("3"), { name: "Widget C", category: "gadgets", price: 25 })
        defaultStore.set(products("4"), { name: "Widget D", category: "gadgets", price: 15 })

        await index.waitForReady()

        const results = await index.search("widget", {
            sort: { field: "price", order: "asc" },
            groupBy: "category",
        }) as GroupedSearchResults

        // Check that within each group, items are sorted by price
        const toolsPrices = results["tools"].map(r => (defaultStore.get(r.atom) as any).price)
        const gadgetsPrices = results["gadgets"].map(r => (defaultStore.get(r.atom) as any).price)

        expect(toolsPrices).toEqual([10, 30])
        expect(gadgetsPrices).toEqual([15, 25])
    })

    test("should group by numeric field", async () => {
        const items = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, items, {
            fields: ["name"],
        })

        defaultStore.set(items("1"), { name: "Item A", score: 5 })
        defaultStore.set(items("2"), { name: "Item B", score: 3 })
        defaultStore.set(items("3"), { name: "Item C", score: 5 })
        defaultStore.set(items("4"), { name: "Item D", score: 3 })

        await index.waitForReady()

        const results = await index.search("item", {
            groupBy: "score",
        }) as GroupedSearchResults

        expect(results["5"]).toBeDefined()
        expect(results["3"]).toBeDefined()
        expect(results["5"].length).toBe(2)
        expect(results["3"].length).toBe(2)
    })

    test("should work with searchSync", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), { name: "Widget A", category: "tools" })
        defaultStore.set(products("2"), { name: "Widget B", category: "gadgets" })
        defaultStore.set(products("3"), { name: "Widget C", category: "tools" })

        await index.waitForReady()

        const results = index.searchSync("widget", {
            groupBy: "category",
        }) as GroupedSearchResults

        expect(Object.keys(results).length).toBe(2)
        expect(results["tools"].length).toBe(2)
        expect(results["gadgets"].length).toBe(1)
    })

    test("should maintain individual result properties in groups", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), { name: "Widget A", category: "tools" })
        defaultStore.set(products("2"), { name: "Widget B", category: "tools" })

        await index.waitForReady()

        const results = await index.search("widget", {
            groupBy: "category",
        }) as GroupedSearchResults

        const toolsGroup = results["tools"]
        expect(toolsGroup.length).toBe(2)

        // Check that each result has atom, score, and matches
        toolsGroup.forEach(result => {
            expect(result.atom).toBeDefined()
            expect(typeof result.score).toBe("number")
            expect(Array.isArray(result.matches)).toBe(true)
        })
    })

    test("should group by boolean field", async () => {
        const items = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, items, {
            fields: ["name"],
        })

        defaultStore.set(items("1"), { name: "Item A", featured: true })
        defaultStore.set(items("2"), { name: "Item B", featured: false })
        defaultStore.set(items("3"), { name: "Item C", featured: true })
        defaultStore.set(items("4"), { name: "Item D", featured: false })

        await index.waitForReady()

        const results = await index.search("item", {
            groupBy: "featured",
        }) as GroupedSearchResults

        expect(results["true"]).toBeDefined()
        expect(results["false"]).toBeDefined()
        expect(results["true"].length).toBe(2)
        expect(results["false"].length).toBe(2)
    })

    test("should return ungrouped results when groupBy is not specified", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), { name: "Widget A", category: "tools" })
        defaultStore.set(products("2"), { name: "Widget B", category: "gadgets" })

        await index.waitForReady()

        const results = await index.search("widget")

        // Should be an array, not an object
        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBe(2)
    })

    test("should not apply limit when groupBy is specified", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), { name: "Widget A", category: "tools" })
        defaultStore.set(products("2"), { name: "Widget B", category: "gadgets" })
        defaultStore.set(products("3"), { name: "Widget C", category: "tools" })
        defaultStore.set(products("4"), { name: "Widget D", category: "gadgets" })

        await index.waitForReady()

        const results = await index.search("widget", {
            limit: 2,
            groupBy: "category",
        }) as GroupedSearchResults

        // All results should be included despite limit
        const totalResults = Object.values(results).flat().length
        expect(totalResults).toBe(4)
    })
})
