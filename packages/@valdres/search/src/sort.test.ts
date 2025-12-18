import { describe, test, expect } from "bun:test"
import { createSearchIndex } from "./createSearchIndex"
import { atomFamily, store } from "valdres"

describe("Sorting", () => {
    test("should sort results by numeric field ascending", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), { name: "Widget A", price: 30 })
        defaultStore.set(products("2"), { name: "Widget B", price: 10 })
        defaultStore.set(products("3"), { name: "Widget C", price: 20 })

        await index.waitForReady()

        const results = await index.search("widget", {
            sort: { field: "price", order: "asc" },
        })

        expect(results.length).toBe(3)
        const prices = results.map(r => (defaultStore.get(r.atom) as any).price)
        expect(prices).toEqual([10, 20, 30])
    })

    test("should sort results by numeric field descending", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), { name: "Widget A", price: 30 })
        defaultStore.set(products("2"), { name: "Widget B", price: 10 })
        defaultStore.set(products("3"), { name: "Widget C", price: 20 })

        await index.waitForReady()

        const results = await index.search("widget", {
            sort: { field: "price", order: "desc" },
        })

        expect(results.length).toBe(3)
        const prices = results.map(r => (defaultStore.get(r.atom) as any).price)
        expect(prices).toEqual([30, 20, 10])
    })

    test("should sort results by string field ascending", async () => {
        const people = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, people, {
            fields: ["name", "type"],
        })

        defaultStore.set(people("1"), { name: "Charlie", type: "person" })
        defaultStore.set(people("2"), { name: "Alice", type: "person" })
        defaultStore.set(people("3"), { name: "Bob", type: "person" })

        await index.waitForReady()

        const results = await index.search("person", {
            sort: { field: "name", order: "asc" },
        })

        expect(results.length).toBe(3)
        const names = results.map(r => (defaultStore.get(r.atom) as any).name)
        expect(names).toEqual(["Alice", "Bob", "Charlie"])
    })

    test("should sort results by string field descending", async () => {
        const people = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, people, {
            fields: ["name", "type"],
        })

        defaultStore.set(people("1"), { name: "Charlie", type: "person" })
        defaultStore.set(people("2"), { name: "Alice", type: "person" })
        defaultStore.set(people("3"), { name: "Bob", type: "person" })

        await index.waitForReady()

        const results = await index.search("person", {
            sort: { field: "name", order: "desc" },
        })

        expect(results.length).toBe(3)
        const names = results.map(r => (defaultStore.get(r.atom) as any).name)
        expect(names).toEqual(["Charlie", "Bob", "Alice"])
    })

    test("should sort by multiple fields", async () => {
        const items = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, items, {
            fields: ["name"],
        })

        defaultStore.set(items("1"), { name: "Item", category: "A", price: 30 })
        defaultStore.set(items("2"), { name: "Item", category: "B", price: 10 })
        defaultStore.set(items("3"), { name: "Item", category: "A", price: 20 })
        defaultStore.set(items("4"), { name: "Item", category: "B", price: 15 })

        await index.waitForReady()

        const results = await index.search("item", {
            sort: [
                { field: "category", order: "asc" },
                { field: "price", order: "desc" },
            ],
        })

        expect(results.length).toBe(4)
        const values = results.map(r => {
            const data = defaultStore.get(r.atom) as any
            return { category: data.category, price: data.price }
        })

        // Should be sorted by category (A, A, B, B), then by price desc within each category
        expect(values).toEqual([
            { category: "A", price: 30 },
            { category: "A", price: 20 },
            { category: "B", price: 15 },
            { category: "B", price: 10 },
        ])
    })

    test("should handle null/undefined values in sorting", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), { name: "Widget A", price: 30 })
        defaultStore.set(products("2"), { name: "Widget B" }) // No price
        defaultStore.set(products("3"), { name: "Widget C", price: 10 })

        await index.waitForReady()

        const results = await index.search("widget", {
            sort: { field: "price", order: "asc" },
        })

        expect(results.length).toBe(3)
        const prices = results.map(r => (defaultStore.get(r.atom) as any).price)

        // null/undefined should be at the end
        expect(prices[0]).toBe(10)
        expect(prices[1]).toBe(30)
        expect(prices[2]).toBeUndefined()
    })

    test("should sort with searchSync", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), { name: "Widget A", price: 30 })
        defaultStore.set(products("2"), { name: "Widget B", price: 10 })
        defaultStore.set(products("3"), { name: "Widget C", price: 20 })

        await index.waitForReady()

        const results = index.searchSync("widget", {
            sort: { field: "price", order: "asc" },
        })

        expect(results.length).toBe(3)
        const prices = results.map(r => (defaultStore.get(r.atom) as any).price)
        expect(prices).toEqual([10, 20, 30])
    })

    test("should default to ascending order when not specified", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), { name: "Widget A", price: 30 })
        defaultStore.set(products("2"), { name: "Widget B", price: 10 })
        defaultStore.set(products("3"), { name: "Widget C", price: 20 })

        await index.waitForReady()

        const results = await index.search("widget", {
            sort: { field: "price" }, // No order specified
        })

        expect(results.length).toBe(3)
        const prices = results.map(r => (defaultStore.get(r.atom) as any).price)
        expect(prices).toEqual([10, 20, 30])
    })

    test("should combine filtering and sorting", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), { name: "Widget A", price: 30, inStock: true })
        defaultStore.set(products("2"), { name: "Widget B", price: 10, inStock: false })
        defaultStore.set(products("3"), { name: "Widget C", price: 20, inStock: true })
        defaultStore.set(products("4"), { name: "Widget D", price: 5, inStock: false })

        await index.waitForReady()

        const results = await index.search("widget", {
            filter: { field: "inStock", value: true },
            sort: { field: "price", order: "asc" },
        })

        expect(results.length).toBe(2)
        const prices = results.map(r => (defaultStore.get(r.atom) as any).price)
        expect(prices).toEqual([20, 30])
    })

    test("should sort boolean fields", async () => {
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
            sort: { field: "featured", order: "desc" },
        })

        expect(results.length).toBe(4)
        const featured = results.map(r => (defaultStore.get(r.atom) as any).featured)

        // true values should come first when sorting desc
        expect(featured[0]).toBe(true)
        expect(featured[1]).toBe(true)
        expect(featured[2]).toBe(false)
        expect(featured[3]).toBe(false)
    })
})
