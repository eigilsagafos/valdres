import { describe, test, expect } from "bun:test"

import { createSearchIndex } from "./createSearchIndex"
import { atomFamily, store } from "valdres"

describe("createSearchIndex", () => {
    test("should index and search atom family", async () => {
        const people = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, people, {
            fields: ["name"],
        })

        defaultStore.set(people("1"), { name: "Foo Bar" })
        defaultStore.set(people("2"), { name: "Bar Baz" })
        defaultStore.set(people("3"), { name: "Qux" })

        // Search for "bar" - should match person 1 and 2
        const results = await index.search("bar")
        expect(results.length).toBe(2)

        const values = results.map(r => defaultStore.get(r.atom))
        expect(values).toContainEqual({ name: "Foo Bar" })
        expect(values).toContainEqual({ name: "Bar Baz" })

        // Check scores
        expect(results[0].score).toBe(1) // Perfect match
        expect(results[0].matches).toContain("bar")
    })

    test("should handle fuzzy search with typos", async () => {
        const posts = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, posts, {
            fields: ["title", "content"],
            tolerance: 1, // Allow 1 character difference
        })

        defaultStore.set(posts("1"), {
            title: "JavaScript Tutorial",
            content: "Learn JavaScript basics",
        })
        defaultStore.set(posts("2"), {
            title: "Java Programming",
            content: "Introduction to Java",
        })
        defaultStore.set(posts("3"), {
            title: "Python Guide",
            content: "Getting started with Python",
        })

        // Search with typo: "javascrpt" (missing 'i')
        const results = await index.search("javascrpt")
        expect(results.length).toBeGreaterThan(0)

        const titles = results.map(r => (defaultStore.get(r.atom) as any).title)
        expect(titles).toContain("JavaScript Tutorial")
    })

    test("should update index when atom changes", async () => {
        const people = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, people, {
            fields: ["name"],
        })

        defaultStore.set(people("1"), { name: "Initial Name" })

        await index.waitForReady()

        let results = await index.search("initial")
        expect(results.length).toBe(1)

        // Update the atom
        defaultStore.set(people("1"), { name: "Updated Name" })

        results = await index.search("initial")
        expect(results.length).toBe(0)

        results = await index.search("updated")
        expect(results.length).toBe(1)
    })

    test("should support multi-word queries", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name", "description"],
        })

        defaultStore.set(products("1"), {
            name: "Blue Widget",
            description: "A useful gadget",
        })
        defaultStore.set(products("2"), {
            name: "Red Widget",
            description: "Another gadget",
        })
        defaultStore.set(products("3"), {
            name: "Blue Sprocket",
            description: "A different tool",
        })

        // Search for "blue widget" - should match product 1
        const results = await index.search("blue widget")
        expect(results.length).toBeGreaterThan(0)

        const firstResult = defaultStore.get(results[0].atom) as any
        expect(firstResult.name).toBe("Blue Widget")

        // Should contain both matched words
        expect(results[0].matches).toContain("blue")
        expect(results[0].matches).toContain("widget")
    })

    test("should support custom extract function", async () => {
        const users = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, users, {
            extract: user => `${user.firstName} ${user.lastName} ${user.email}`,
        })

        defaultStore.set(users("1"), {
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
        })
        defaultStore.set(users("2"), {
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
        })

        const results = await index.search("john")
        expect(results.length).toBe(1)

        const user = defaultStore.get(results[0].atom) as any
        expect(user.firstName).toBe("John")
    })

    test("should support limit option", async () => {
        const items = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, items, {
            fields: ["name"],
        })

        defaultStore.set(items("1"), { name: "Test Item One" })
        defaultStore.set(items("2"), { name: "Test Item Two" })
        defaultStore.set(items("3"), { name: "Test Item Three" })

        const results = await index.search("test", { limit: 2 })
        expect(results.length).toBe(2)
    })

    test("should support custom tolerance per query", async () => {
        const words = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, words, {
            fields: ["text"],
            tolerance: 1, // Default tolerance
        })

        defaultStore.set(words("1"), { text: "hello" })
        defaultStore.set(words("2"), { text: "world" })

        // With tolerance 0, typo should not match
        let results = await index.search("helo", { tolerance: 0 })
        expect(results.length).toBe(0)

        // With tolerance 1, typo should match
        results = await index.search("helo", { tolerance: 1 })
        expect(results.length).toBe(1)
        expect((defaultStore.get(results[0].atom) as any).text).toBe("hello")

        // With tolerance 2, more typos should match
        results = await index.search("hlo", { tolerance: 2 })
        expect(results.length).toBe(1)
    })

    test("should provide debug stats", async () => {
        const items = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, items, {
            fields: ["name"],
        })

        defaultStore.set(items("1"), { name: "Apple Banana" })
        defaultStore.set(items("2"), { name: "Cherry Date" })

        await index.waitForReady()

        const stats = index._getStats()

        expect(stats.indexedAtoms).toBe(2)
        expect(stats.indexedWords).toBeGreaterThan(0) // Should have indexed words
        expect(stats.trigramCount).toBeGreaterThan(0) // Should have trigrams
    })

    test("should handle special characters and punctuation", async () => {
        const docs = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, docs, {
            fields: ["content"],
        })

        defaultStore.set(docs("1"), {
            content: "Hello, world! This is a test.",
        })
        defaultStore.set(docs("2"), {
            content: "Another test-case with hyphens",
        })

        // Punctuation should be stripped
        const results = await index.search("test")
        expect(results.length).toBe(2)
    })

    test("should be case insensitive", async () => {
        const items = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, items, {
            fields: ["name"],
        })

        defaultStore.set(items("1"), { name: "JavaScript" })

        // Different cases should all match
        expect((await index.search("javascript")).length).toBe(1)
        expect((await index.search("JAVASCRIPT")).length).toBe(1)
        expect((await index.search("JaVaScRiPt")).length).toBe(1)
    })

    test("should handle large initial dataset asynchronously", async () => {
        const items = atomFamily()
        const defaultStore = store()

        // Create large dataset BEFORE creating index
        for (let i = 0; i < 1000; i++) {
            defaultStore.set(items(String(i)), {
                name: `Item ${i}`,
                description: `Description for item ${i}`,
            })
        }

        const index = createSearchIndex(defaultStore, items, {
            fields: ["name", "description"],
            batchSize: 50,
            yieldInterval: 1, // Yield more frequently to test async behavior
        })

        // Check status
        const statusBefore = index.getStatus()
        expect(statusBefore.total).toBe(1000)

        // Wait for indexing to complete
        await index.waitForReady()

        const statusAfter = index.getStatus()
        expect(statusAfter.ready).toBe(true)
        expect(statusAfter.indexed).toBe(1000)
        expect(statusAfter.progress).toBe(1)

        // Now search should work
        const results = await index.search("500")
        expect(results.length).toBeGreaterThan(0)
    })

    test("should support synchronous search when index is ready", async () => {
        const items = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, items, {
            fields: ["name"],
        })

        defaultStore.set(items("1"), { name: "Test" })

        // Wait for index
        await index.waitForReady()

        // Now sync search works
        const syncResults = index.searchSync("test")
        expect(syncResults.length).toBe(1)

        // Async search also works
        const asyncResults = await index.search("test")
        expect(asyncResults.length).toBe(1)
    })

    test("should handle dynamic atoms during initialization", async () => {
        const items = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, items, {
            fields: ["name"],
            batchSize: 10,
        })

        // Create dataset after index is created
        for (let i = 0; i < 100; i++) {
            defaultStore.set(items(String(i)), { name: `Item ${i}` })
        }

        // Wait for completion
        await index.waitForReady()

        const finalStatus = index.getStatus()
        expect(finalStatus.ready).toBe(true)

        // Verify search works with all items
        const results = await index.search("item")
        expect(results.length).toBe(100)
    })

    test("should handle short queries (1-2 characters) with prefix matching", async () => {
        const words = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, words, {
            fields: ["text"],
        })

        defaultStore.set(words("1"), { text: "apple" })
        defaultStore.set(words("2"), { text: "apricot" })
        defaultStore.set(words("3"), { text: "banana" })
        defaultStore.set(words("4"), { text: "application" })

        await index.waitForReady()

        // 1-character search
        const results1 = await index.search("a")
        expect(results1.length).toBe(3) // apple, apricot, application

        // 2-character search
        const results2 = await index.search("ap")
        expect(results2.length).toBe(3) // apple, apricot, application

        // 3-character search (uses trigrams)
        const results3 = await index.search("app")
        expect(results3.length).toBe(2) // apple, application

        // Single character that doesn't match
        const results4 = await index.search("z")
        expect(results4.length).toBe(0)
    })

    test("should handle short queries with searchSync", async () => {
        const words = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, words, {
            fields: ["text"],
        })

        defaultStore.set(words("1"), { text: "cat" })
        defaultStore.set(words("2"), { text: "car" })
        defaultStore.set(words("3"), { text: "dog" })

        await index.waitForReady()

        // 1-character search with sync
        const results1 = index.searchSync("c")
        expect(results1.length).toBe(2) // cat, car

        // 2-character search with sync
        const results2 = index.searchSync("ca")
        expect(results2.length).toBe(2) // cat, car
    })
})
