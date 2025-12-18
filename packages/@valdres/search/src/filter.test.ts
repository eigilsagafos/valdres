import { describe, test, expect } from "bun:test"
import { createSearchIndex } from "./createSearchIndex"
import { atomFamily, store } from "valdres"

describe("Search Filters", () => {
    test("should filter by single field equals", async () => {
        const docs = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, docs, {
            fields: ["title", "content"],
        })

        defaultStore.set(docs("1"), {
            title: "JavaScript Guide",
            content: "Learn JavaScript",
            entity: "tutorial",
        })
        defaultStore.set(docs("2"), {
            title: "JavaScript API",
            content: "API documentation",
            entity: "api",
        })
        defaultStore.set(docs("3"), {
            title: "JavaScript Tutorial",
            content: "Advanced topics",
            entity: "tutorial",
        })

        // Search with filter
        const results = await index.search("javascript", {
            filter: {
                field: "entity",
                value: "tutorial",
                operator: "equals",
            },
        })

        expect(results.length).toBe(2)
        const entities = results.map(r => (defaultStore.get(r.atom) as any).entity)
        expect(entities.every(e => e === "tutorial")).toBe(true)
    })

    test("should support AND filter groups", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name", "description"],
        })

        defaultStore.set(products("1"), {
            name: "Blue Widget",
            description: "A useful tool",
            category: "tools",
            price: 10,
        })
        defaultStore.set(products("2"), {
            name: "Red Widget",
            description: "Another tool",
            category: "tools",
            price: 25,
        })
        defaultStore.set(products("3"), {
            name: "Blue Gadget",
            description: "Something else",
            category: "gadgets",
            price: 15,
        })

        // Search: widget AND category=tools AND price<=15
        const results = await index.search("widget", {
            filter: {
                operator: "AND",
                conditions: [
                    { field: "category", value: "tools" },
                    { field: "price", value: 15, operator: "lte" },
                ],
            },
        })

        expect(results.length).toBe(1)
        const product = defaultStore.get(results[0].atom) as any
        expect(product.name).toBe("Blue Widget")
        expect(product.price).toBe(10)
    })

    test("should support OR filter groups", async () => {
        const posts = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, posts, {
            fields: ["title", "content"],
        })

        defaultStore.set(posts("1"), {
            title: "TypeScript Post",
            content: "About TypeScript",
            status: "published",
        })
        defaultStore.set(posts("2"), {
            title: "JavaScript Post",
            content: "About JavaScript",
            status: "draft",
        })
        defaultStore.set(posts("3"), {
            title: "Python Post",
            content: "About Python",
            status: "archived",
        })

        // Search: status=published OR status=draft
        const results = await index.search("post", {
            filter: {
                operator: "OR",
                conditions: [
                    { field: "status", value: "published" },
                    { field: "status", value: "draft" },
                ],
            },
        })

        expect(results.length).toBe(2)
        const statuses = results.map(r => (defaultStore.get(r.atom) as any).status)
        expect(statuses).toContain("published")
        expect(statuses).toContain("draft")
        expect(statuses).not.toContain("archived")
    })

    test("should support nested filter groups", async () => {
        const articles = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, articles, {
            fields: ["title", "body"],
        })

        defaultStore.set(articles("1"), {
            title: "React Tutorial",
            body: "Learn React",
            category: "frontend",
            author: "alice",
            published: true,
        })
        defaultStore.set(articles("2"), {
            title: "Node Tutorial",
            body: "Learn Node",
            category: "backend",
            author: "bob",
            published: true,
        })
        defaultStore.set(articles("3"), {
            title: "React Guide",
            body: "Advanced React",
            category: "frontend",
            author: "alice",
            published: false,
        })
        defaultStore.set(articles("4"), {
            title: "Vue Tutorial",
            body: "Learn Vue",
            category: "frontend",
            author: "charlie",
            published: true,
        })

        // Complex: (category=frontend AND author=alice) OR category=backend
        const results = await index.search("tutorial", {
            filter: {
                operator: "OR",
                conditions: [
                    {
                        operator: "AND",
                        conditions: [
                            { field: "category", value: "frontend" },
                            { field: "author", value: "alice" },
                        ],
                    },
                    { field: "category", value: "backend" },
                ],
            },
        })

        expect(results.length).toBe(2)
        const titles = results.map(r => (defaultStore.get(r.atom) as any).title)
        expect(titles).toContain("React Tutorial")
        expect(titles).toContain("Node Tutorial")
    })

    test("should support contains operator for arrays", async () => {
        const posts = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, posts, {
            fields: ["title"],
        })

        defaultStore.set(posts("1"), {
            title: "JavaScript Post",
            tags: ["javascript", "programming"],
        })
        defaultStore.set(posts("2"), {
            title: "Python Post",
            tags: ["python", "programming"],
        })
        defaultStore.set(posts("3"), {
            title: "React Post",
            tags: ["react", "javascript", "frontend"],
        })

        // Filter by tag containing "javascript"
        const results = await index.search("post", {
            filter: {
                field: "tags",
                value: "javascript",
                operator: "contains",
            },
        })

        expect(results.length).toBe(2)
        const titles = results.map(r => (defaultStore.get(r.atom) as any).title)
        expect(titles).toContain("JavaScript Post")
        expect(titles).toContain("React Post")
    })

    test("should support contains operator for strings", async () => {
        const docs = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, docs, {
            fields: ["title"],
        })

        defaultStore.set(docs("1"), {
            title: "Guide to Programming",
            email: "alice@example.com",
        })
        defaultStore.set(docs("2"), {
            title: "Tutorial on Coding",
            email: "bob@test.com",
        })
        defaultStore.set(docs("3"), {
            title: "Programming Handbook",
            email: "charlie@example.com",
        })

        // Search for "programming" and filter by email domain
        const results = await index.search("programming", {
            filter: {
                field: "email",
                value: "example.com",
                operator: "contains",
            },
        })

        // Should match docs 1 and 3 (both have "programming" and "@example.com")
        expect(results.length).toBe(2)
        const emails = results.map(r => (defaultStore.get(r.atom) as any).email)
        expect(emails.every(e => e.includes("example.com"))).toBe(true)
    })

    test("should support comparison operators", async () => {
        const products = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, products, {
            fields: ["name"],
        })

        defaultStore.set(products("1"), {
            name: "Product A",
            price: 10,
            rating: 4.5,
        })
        defaultStore.set(products("2"), {
            name: "Product B",
            price: 25,
            rating: 3.5,
        })
        defaultStore.set(products("3"), {
            name: "Product C",
            price: 15,
            rating: 4.8,
        })

        // Price greater than 15
        const expensive = await index.search("product", {
            filter: { field: "price", value: 15, operator: "gt" },
        })
        expect(expensive.length).toBe(1)

        // Price less than or equal to 15
        const affordable = await index.search("product", {
            filter: { field: "price", value: 15, operator: "lte" },
        })
        expect(affordable.length).toBe(2)

        // Rating >= 4.5
        const highRated = await index.search("product", {
            filter: { field: "rating", value: 4.5, operator: "gte" },
        })
        expect(highRated.length).toBe(2)
    })

    test("should support in operator", async () => {
        const users = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, users, {
            fields: ["name"],
        })

        defaultStore.set(users("1"), {
            name: "Alice",
            role: "admin",
        })
        defaultStore.set(users("2"), {
            name: "Bob",
            role: "user",
        })
        defaultStore.set(users("3"), {
            name: "Charlie",
            role: "moderator",
        })

        // Filter by role in list
        const results = await index.search("", {
            filter: {
                field: "role",
                value: ["admin", "moderator"],
                operator: "in",
            },
        })

        expect(results.length).toBe(2)
        const roles = results.map(r => (defaultStore.get(r.atom) as any).role)
        expect(roles).toContain("admin")
        expect(roles).toContain("moderator")
    })

    test("should support startsWith and endsWith operators", async () => {
        const files = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, files, {
            fields: ["name"],
        })

        defaultStore.set(files("1"), { name: "document.pdf", type: "pdf" })
        defaultStore.set(files("2"), { name: "image.jpg", type: "image" })
        defaultStore.set(files("3"), { name: "document.docx", type: "doc" })

        // Files starting with "document"
        const docs = await index.search("", {
            filter: { field: "name", value: "document", operator: "startsWith" },
        })
        expect(docs.length).toBe(2)

        // Files ending with ".pdf"
        const pdfs = await index.search("", {
            filter: { field: "name", value: ".pdf", operator: "endsWith" },
        })
        expect(pdfs.length).toBe(1)
    })

    test("should work with searchSync", async () => {
        const docs = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, docs, {
            fields: ["title"],
        })

        defaultStore.set(docs("1"), {
            title: "JavaScript",
            category: "programming",
        })
        defaultStore.set(docs("2"), {
            title: "Python",
            category: "programming",
        })
        defaultStore.set(docs("3"), {
            title: "Math",
            category: "science",
        })

        await index.waitForReady()

        // Sync search with filter
        const results = index.searchSync("", {
            filter: { field: "category", value: "programming" },
        })

        expect(results.length).toBe(2)
    })

    test("should combine text search with filters", async () => {
        const posts = atomFamily()
        const defaultStore = store()

        const index = createSearchIndex(defaultStore, posts, {
            fields: ["title", "content"],
        })

        defaultStore.set(posts("1"), {
            title: "JavaScript Tutorial",
            content: "Learn JavaScript basics",
            status: "published",
            featured: true,
        })
        defaultStore.set(posts("2"), {
            title: "JavaScript Advanced",
            content: "Advanced JavaScript topics",
            status: "draft",
            featured: false,
        })
        defaultStore.set(posts("3"), {
            title: "Python Tutorial",
            content: "Learn Python basics",
            status: "published",
            featured: true,
        })

        // Search for "javascript" AND status=published
        const results = await index.search("javascript", {
            filter: {
                field: "status",
                value: "published",
            },
        })

        expect(results.length).toBe(1)
        const post = defaultStore.get(results[0].atom) as any
        expect(post.title).toBe("JavaScript Tutorial")
    })
})
