import { describe, test, expect } from "bun:test"
import { createSearchIndex } from "./createSearchIndex"
import { createLiveSearch, createDynamicLiveSearch, createDynamicLiveSearchAsync, createFamilyLiveSearch } from "./createLiveSearch"
import { atomFamily, atom, store } from "valdres"

describe("Reactive Search", () => {
    test("createLiveSearch should return results reactively", async () => {
        const posts = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, posts, {
            fields: ["title", "content"],
        })

        defaultStore.set(posts("1"), {
            title: "JavaScript Tutorial",
            content: "Learn JavaScript",
            status: "published",
        })
        defaultStore.set(posts("2"), {
            title: "Python Guide",
            content: "Learn Python",
            status: "draft",
        })

        await index.waitForReady()

        // Create live search with static query
        const searchResults = createLiveSearch(index, {
            query: "javascript",
        })

        // Get initial results
        const results1 = await defaultStore.get(searchResults)
        expect(results1.length).toBe(1)

        // Add new matching document
        defaultStore.set(posts("3"), {
            title: "Advanced JavaScript",
            content: "Advanced topics",
            status: "published",
        })

        // Results should update
        const results2 = await defaultStore.get(searchResults)
        expect(results2.length).toBe(2)
    })

    test("createLiveSearch with filter should filter results", async () => {
        const posts = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, posts, {
            fields: ["title"],
        })

        defaultStore.set(posts("1"), {
            title: "JavaScript Tutorial",
            status: "published",
        })
        defaultStore.set(posts("2"), {
            title: "JavaScript Guide",
            status: "draft",
        })

        await index.waitForReady()

        const searchResults = createLiveSearch(index, {
            query: "javascript",
            options: {
                filter: {
                    field: "status",
                    value: "published",
                },
            },
        })

        const results = await defaultStore.get(searchResults)
        expect(results.length).toBe(1)
        const post = defaultStore.get(results[0].atom) as any
        expect(post.status).toBe("published")
    })

    test("createDynamicLiveSearch should update when dependency atoms change", async () => {
        const posts = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, posts, {
            fields: ["title", "content"],
        })

        defaultStore.set(posts("1"), {
            title: "JavaScript Tutorial",
            content: "Learn JS",
            status: "published",
        })
        defaultStore.set(posts("2"), {
            title: "JavaScript Guide",
            content: "JS Guide",
            status: "draft",
        })
        defaultStore.set(posts("3"), {
            title: "Python Tutorial",
            content: "Learn Python",
            status: "published",
        })

        await index.waitForReady()

        // Create atoms for query and filter
        const searchQueryAtom = atom("")
        const filterStatusAtom = atom<string | null>(null)

        defaultStore.set(searchQueryAtom, "javascript")
        defaultStore.set(filterStatusAtom, null)

        // Create dynamic live search
        const searchResults = createDynamicLiveSearch(index, (get) => {
            const query = get(searchQueryAtom)
            const status = get(filterStatusAtom)

            return {
                query,
                options: status
                    ? {
                          filter: { field: "status", value: status },
                      }
                    : undefined,
            }
        })

        // Initial search: "javascript" with no filter
        let results = await defaultStore.get(searchResults)
        expect(results.length).toBe(2)

        // Change filter to "published"
        defaultStore.set(filterStatusAtom, "published")
        results = await defaultStore.get(searchResults)
        expect(results.length).toBe(1)
        expect((defaultStore.get(results[0].atom) as any).status).toBe("published")

        // Change query to "python"
        defaultStore.set(searchQueryAtom, "python")
        results = await defaultStore.get(searchResults)
        expect(results.length).toBe(1)
        expect((defaultStore.get(results[0].atom) as any).title).toBe("Python Tutorial")

        // Remove filter
        defaultStore.set(filterStatusAtom, null)
        results = await defaultStore.get(searchResults)
        expect(results.length).toBe(1)
    })

    test("createDynamicLiveSearch with empty query should return empty results", async () => {
        const posts = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, posts, {
            fields: ["title"],
        })

        defaultStore.set(posts("1"), { title: "Test Post" })

        await index.waitForReady()

        const searchQueryAtom = atom("")
        defaultStore.set(searchQueryAtom, "")

        const searchResults = createDynamicLiveSearch(index, (get) => ({
            query: get(searchQueryAtom),
        }))

        const results = await defaultStore.get(searchResults)
        expect(results.length).toBe(0)
    })

    test("createFamilyLiveSearch should track atom changes", async () => {
        const posts = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, posts, {
            fields: ["title"],
        })

        defaultStore.set(posts("1"), {
            title: "JavaScript Tutorial",
            views: 100,
        })
        defaultStore.set(posts("2"), {
            title: "Python Tutorial",
            views: 200,
        })

        await index.waitForReady()

        const searchResults = createFamilyLiveSearch(defaultStore, index, posts, {
            query: "tutorial",
        })

        // Initial results
        let results = await defaultStore.get(searchResults)
        expect(results.length).toBe(2)

        // Update an atom (change views)
        defaultStore.set(posts("1"), {
            title: "JavaScript Tutorial",
            views: 150,
        })

        // Should re-run search (results should still be 2)
        results = await defaultStore.get(searchResults)
        expect(results.length).toBe(2)

        // Add new matching atom
        defaultStore.set(posts("3"), {
            title: "Ruby Tutorial",
            views: 50,
        })

        // Should include new atom
        results = await defaultStore.get(searchResults)
        expect(results.length).toBe(3)
    })

    test("createFamilyLiveSearch with filter should track and filter", async () => {
        const articles = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, articles, {
            fields: ["title"],
        })

        defaultStore.set(articles("1"), {
            title: "React Tutorial",
            featured: true,
        })
        defaultStore.set(articles("2"), {
            title: "Vue Tutorial",
            featured: false,
        })

        await index.waitForReady()

        const searchResults = createFamilyLiveSearch(defaultStore, index, articles, {
            query: "tutorial",
            options: {
                filter: {
                    field: "featured",
                    value: true,
                },
            },
        })

        let results = await defaultStore.get(searchResults)
        expect(results.length).toBe(1)
        expect((defaultStore.get(results[0].atom) as any).title).toBe("React Tutorial")

        // Update atom to match filter
        defaultStore.set(articles("2"), {
            title: "Vue Tutorial",
            featured: true,
        })

        results = await defaultStore.get(searchResults)
        expect(results.length).toBe(2)
    })

    test("createLiveSearch should work with large dataset async indexing", async () => {
        const posts = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, posts, {
            fields: ["title", "content"],
            batchSize: 50,
        })

        // Create large dataset AFTER index is created
        for (let i = 0; i < 1000; i++) {
            defaultStore.set(posts(String(i)), {
                title: `Post ${i}`,
                content: `Content ${i}`,
            })
        }

        // Wait for indexing to complete
        await index.waitForReady()

        // Now create search selector and verify it works
        const searchResults = createLiveSearch(index, {
            query: "500",
        })

        const results = await defaultStore.get(searchResults)
        expect(results.length).toBeGreaterThan(0)

        // The selector will automatically update when atoms change due to version atom
    })

    test("createDynamicLiveSearch should work with complex filters", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), {
            name: "Blue Widget",
            category: "tools",
            price: 10,
            inStock: true,
        })
        defaultStore.set(products("2"), {
            name: "Red Widget",
            category: "tools",
            price: 25,
            inStock: false,
        })
        defaultStore.set(products("3"), {
            name: "Blue Gadget",
            category: "gadgets",
            price: 15,
            inStock: true,
        })

        await index.waitForReady()

        const maxPriceAtom = atom(20)
        const categoryAtom = atom("tools")

        defaultStore.set(maxPriceAtom, 20)
        defaultStore.set(categoryAtom, "tools")

        const searchResults = createDynamicLiveSearch(index, (get) => {
            const maxPrice = get(maxPriceAtom)
            const category = get(categoryAtom)

            return {
                query: "widget",
                options: {
                    filter: {
                        operator: "AND",
                        conditions: [
                            { field: "category", value: category },
                            { field: "price", value: maxPrice, operator: "lte" },
                            { field: "inStock", value: true },
                        ],
                    },
                },
            }
        })

        // Should match product 1: Blue Widget (tools, price 10, inStock)
        let results = await defaultStore.get(searchResults)
        expect(results.length).toBe(1)
        expect((defaultStore.get(results[0].atom) as any).name).toBe("Blue Widget")

        // Change max price to 5 (should match nothing)
        defaultStore.set(maxPriceAtom, 5)
        results = await defaultStore.get(searchResults)
        expect(results.length).toBe(0)

        // Change category to "gadgets" (should still match nothing with price 5)
        defaultStore.set(categoryAtom, "gadgets")
        results = await defaultStore.get(searchResults)
        expect(results.length).toBe(0)

        // Increase max price to 20 (should match Blue Gadget now)
        defaultStore.set(maxPriceAtom, 20)
        results = await defaultStore.get(searchResults)
        expect(results.length).toBe(0) // Blue Gadget doesn't match "widget" query
    })

    test("createLiveSearch with function-based query and options", async () => {
        const docs = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, docs, {
            fields: ["title"],
        })

        defaultStore.set(docs("1"), { title: "JavaScript Guide", status: "published" })
        defaultStore.set(docs("2"), { title: "JavaScript Tutorial", status: "draft" })

        await index.waitForReady()

        // NOTE: Function-based queries are NOT reactive - they just evaluate once
        // For reactive queries, use createDynamicLiveSearch with atoms instead
        let currentQuery = "javascript"
        let currentStatus = "published"

        const searchResults = createLiveSearch(index, {
            query: () => currentQuery,
            options: () => ({
                filter: { field: "status", value: currentStatus },
            }),
        })

        let results = await defaultStore.get(searchResults)
        expect(results.length).toBe(1)
        expect((defaultStore.get(results[0].atom) as any).status).toBe("published")

        // Function-based queries don't automatically re-evaluate when variables change
        // You would need to create a new selector or use createDynamicLiveSearch
        // This test just confirms the function is called and works
    })

    test("createDynamicLiveSearchAsync should update without Suspense", async () => {
        const posts = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, posts, {
            fields: ["title", "content"],
        })

        defaultStore.set(posts("1"), {
            title: "JavaScript Tutorial",
            content: "Learn JS",
            status: "published",
        })
        defaultStore.set(posts("2"), {
            title: "JavaScript Guide",
            content: "JS Guide",
            status: "draft",
        })
        defaultStore.set(posts("3"), {
            title: "Python Tutorial",
            content: "Learn Python",
            status: "published",
        })

        await index.waitForReady()

        // Create atoms for query and filter
        const searchQueryAtom = atom("")
        const filterStatusAtom = atom<string | null>(null)

        defaultStore.set(searchQueryAtom, "javascript")
        defaultStore.set(filterStatusAtom, null)

        // Create async live search
        const { resultsAtom, isLoadingAtom } = createDynamicLiveSearchAsync(
            defaultStore,
            index,
            (get) => {
                const query = get(searchQueryAtom)
                const status = get(filterStatusAtom)

                return {
                    query,
                    options: status
                        ? {
                              filter: { field: "status", value: status },
                          }
                        : undefined,
                }
            }
        )

        // Wait a bit for initial search to complete
        await new Promise(resolve => setTimeout(resolve, 50))

        // Check initial results
        let results = defaultStore.get(resultsAtom)
        expect(results.length).toBe(2) // Both JavaScript posts

        // Change filter to "published"
        defaultStore.set(filterStatusAtom, "published")

        // Wait for search to complete
        await new Promise(resolve => setTimeout(resolve, 50))

        results = defaultStore.get(resultsAtom)
        expect(results.length).toBe(1)
        expect((defaultStore.get(results[0].atom) as any).status).toBe("published")

        // Change query to "python"
        defaultStore.set(searchQueryAtom, "python")

        // Wait for search to complete
        await new Promise(resolve => setTimeout(resolve, 50))

        results = defaultStore.get(resultsAtom)
        expect(results.length).toBe(1)
        expect((defaultStore.get(results[0].atom) as any).title).toBe("Python Tutorial")
    })

    test("createDynamicLiveSearchAsync should track loading state", async () => {
        const posts = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, posts, {
            fields: ["title"],
        })

        defaultStore.set(posts("1"), { title: "Test Post" })

        await index.waitForReady()

        const searchQueryAtom = atom("test")
        defaultStore.set(searchQueryAtom, "test")

        const { resultsAtom, isLoadingAtom } = createDynamicLiveSearchAsync(
            defaultStore,
            index,
            (get) => ({
                query: get(searchQueryAtom),
            })
        )

        // Should initially be loading
        let isLoading = defaultStore.get(isLoadingAtom)
        expect(isLoading).toBe(true)

        // Wait for search to complete
        await new Promise(resolve => setTimeout(resolve, 50))

        isLoading = defaultStore.get(isLoadingAtom)
        expect(isLoading).toBe(false)

        const results = defaultStore.get(resultsAtom)
        expect(results.length).toBe(1)
    })
})
