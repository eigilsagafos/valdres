import { bench, group, run } from "mitata"
import { create, insert, search as oramaSearch } from "@orama/orama"
import { atomFamily, store } from "valdres"
import { createSearchIndex } from "./createSearchIndex"

// Generate realistic test data
const generatePosts = (count: number) => {
    const titles = [
        "JavaScript Tutorial",
        "TypeScript Guide",
        "React Patterns",
        "Node.js Best Practices",
        "Python Programming",
        "Machine Learning Basics",
        "Web Performance",
        "Database Design",
        "API Development",
        "Testing Strategies",
    ]

    const words = [
        "learn",
        "advanced",
        "introduction",
        "complete",
        "comprehensive",
        "guide",
        "tutorial",
        "examples",
        "documentation",
        "reference",
    ]

    const posts = []
    for (let i = 0; i < count; i++) {
        const title = titles[i % titles.length]
        const content = Array.from(
            { length: 20 },
            () => words[Math.floor(Math.random() * words.length)],
        ).join(" ")

        posts.push({
            id: String(i),
            title: `${title} ${i}`,
            content,
        })
    }
    return posts
}

// Regex-based search implementation (baseline)
const createRegexSearch = (posts: any[]) => {
    return {
        search: (query: string) => {
            const regex = new RegExp(query, "i")
            return posts.filter(
                post => regex.test(post.title) || regex.test(post.content),
            )
        },
    }
}

// Setup for different dataset sizes
const setupBenchmarks = async (datasetSize: number) => {
    const posts = generatePosts(datasetSize)

    // 1. Regex baseline
    const regexSearch = createRegexSearch(posts)

    // 2. Orama setup
    const oramaDB = await create({
        schema: {
            id: "string",
            title: "string",
            content: "string",
        },
    })

    for (const post of posts) {
        await insert(oramaDB, post)
    }

    // 3. Valdres search index setup
    const postFamily = atomFamily()
    const valdresStore = store()
    const valdresSearch = createSearchIndex(valdresStore, postFamily, {
        fields: ["title", "content"],
        tolerance: 1,
    })

    for (const post of posts) {
        valdresStore.set(postFamily(post.id), post)
    }

    return { regexSearch, oramaDB, valdresSearch, valdresStore, postFamily }
}

// Benchmark suite
const runBenchmarks = async () => {
    console.log("\n🔥 Search Performance Benchmarks\n")

    // Small dataset (100 documents)
    console.log("📊 Dataset: 100 documents\n")
    const small = await setupBenchmarks(100)

    group("Small Dataset (100 docs) - Exact Match", () => {
        bench("Regex", () => {
            small.regexSearch.search("javascript")
        })

        bench("Orama", async () => {
            await oramaSearch(small.oramaDB, {
                term: "javascript",
            })
        })

        bench("Valdres (Trigram+Levenshtein)", () => {
            small.valdresSearch.search("javascript")
        })
    })

    group("Small Dataset (100 docs) - Fuzzy (1 typo)", () => {
        bench("Regex (no fuzzy)", () => {
            small.regexSearch.search("javascrpt")
        })

        bench("Orama (fuzzy)", async () => {
            await oramaSearch(small.oramaDB, {
                term: "javascrpt",
                tolerance: 1,
            })
        })

        bench("Valdres (fuzzy)", () => {
            small.valdresSearch.search("javascrpt", { tolerance: 1 })
        })
    })

    // Medium dataset (1,000 documents)
    console.log("\n📊 Dataset: 1,000 documents\n")
    const medium = await setupBenchmarks(1000)

    group("Medium Dataset (1k docs) - Exact Match", () => {
        bench("Regex", () => {
            medium.regexSearch.search("javascript")
        })

        bench("Orama", async () => {
            await oramaSearch(medium.oramaDB, {
                term: "javascript",
            })
        })

        bench("Valdres (Trigram+Levenshtein)", () => {
            medium.valdresSearch.search("javascript")
        })
    })

    group("Medium Dataset (1k docs) - Fuzzy (1 typo)", () => {
        bench("Regex (no fuzzy)", () => {
            medium.regexSearch.search("javascrpt")
        })

        bench("Orama (fuzzy)", async () => {
            await oramaSearch(medium.oramaDB, {
                term: "javascrpt",
                tolerance: 1,
            })
        })

        bench("Valdres (fuzzy)", () => {
            medium.valdresSearch.search("javascrpt", { tolerance: 1 })
        })
    })

    // Large dataset (10,000 documents)
    console.log("\n📊 Dataset: 10,000 documents\n")
    const large = await setupBenchmarks(10000)

    group("Large Dataset (10k docs) - Exact Match", () => {
        bench("Regex", () => {
            large.regexSearch.search("javascript")
        })

        bench("Orama", async () => {
            await oramaSearch(large.oramaDB, {
                term: "javascript",
            })
        })

        bench("Valdres (Trigram+Levenshtein)", () => {
            large.valdresSearch.search("javascript")
        })
    })

    group("Large Dataset (10k docs) - Fuzzy (1 typo)", () => {
        bench("Regex (no fuzzy)", () => {
            large.regexSearch.search("javascrpt")
        })

        bench("Orama (fuzzy)", async () => {
            await oramaSearch(large.oramaDB, {
                term: "javascrpt",
                tolerance: 1,
            })
        })

        bench("Valdres (fuzzy)", () => {
            large.valdresSearch.search("javascrpt", { tolerance: 1 })
        })
    })

    // Multi-word queries
    console.log("\n📊 Multi-word queries (1k docs)\n")
    group("Multi-word Query", () => {
        bench("Regex", () => {
            medium.regexSearch.search("javascript tutorial")
        })

        bench("Orama", async () => {
            await oramaSearch(medium.oramaDB, {
                term: "javascript tutorial",
            })
        })

        bench("Valdres", () => {
            medium.valdresSearch.search("javascript tutorial")
        })
    })

    // Index update performance
    console.log("\n📊 Index Update Performance (1k docs)\n")
    group("Add New Document", () => {
        let counter = 10000

        bench("Orama insert", async () => {
            await insert(medium.oramaDB, {
                id: String(counter++),
                title: "New Post",
                content: "New content",
            })
        })

        bench("Valdres insert", () => {
            medium.valdresStore.set(medium.postFamily(String(counter++)), {
                title: "New Post",
                content: "New content",
            })
        })
    })

    group("Update Existing Document", () => {
        bench("Valdres update", () => {
            medium.valdresStore.set(medium.postFamily("1"), {
                title: "Updated Post",
                content: "Updated content",
            })
        })
    })

    await run({
        colors: true,
        format: "mitata",
    })
}

// Run the benchmarks
runBenchmarks().catch(console.error)
