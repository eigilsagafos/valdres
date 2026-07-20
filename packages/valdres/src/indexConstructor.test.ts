import { describe, expect, mock, test } from "bun:test"
import { index } from "./indexConstructor"
import { atomFamily } from "./atomFamily"
import { store } from "./store"

describe("index", () => {
    test("uses collision-safe structural term identity", () => {
        const family = atomFamily<{ kind?: string }, [string]>(null)
        const byTerm = index<unknown, { kind?: string }, [string]>(
            family,
            () => false,
        )

        expect(byTerm(undefined)).not.toBe(byTerm(""))
        expect(byTerm({})).not.toBe(byTerm({ missing: undefined }))
        expect(byTerm({ b: 2, a: 1 })).toBe(byTerm({ a: 1, b: 2 }))
    })

    test("keyOf defines term selector identity", () => {
        type Query = { id: string; owner?: Query }
        const family = atomFamily<{ id: string }, [string]>(null)
        const byQuery = index<Query, { id: string }, [string]>(
            family,
            (value, query) => value.id === query.id,
            { keyOf: query => query.id },
        )

        const first: Query = { id: "same" }
        first.owner = first
        expect(byQuery(first)).toBe(byQuery({ id: "same" }))
        expect(byQuery(first)).not.toBe(byQuery({ id: "other" }))
    })

    test("unsupported terms require keyOf", () => {
        const family = atomFamily<null, [string]>(null)
        const byTerm = index(family, () => false)

        expect(() => byTerm(Symbol("query"))).toThrow(TypeError)
        expect(() => byTerm(() => "query")).toThrow(TypeError)
    })

    test("crud", () => {
        const defaultStore = store()
        const post = atomFamily<{ title: string; tags: string[] }, [string]>(
            null,
            {
                name: "idx-crud-posts",
            },
        )
        const indexCallback = mock((doc, term) => {
            return doc.tags.includes(term)
        })
        const postsByTag = index(post, indexCallback, { name: "postsByTag" })
        expect(indexCallback).toHaveBeenCalledTimes(0)
        defaultStore.set(post("1"), {
            title: "Initial",
            tags: ["foo"],
        })

        const initialResult = defaultStore.get(postsByTag("foo"))
        expect(initialResult).toHaveLength(1)

        expect(indexCallback).toHaveBeenCalledTimes(1)

        // When updating to same value nothing happens
        defaultStore.set(post("1"), {
            title: "Initial",
            tags: ["foo"],
        })
        expect(indexCallback).toHaveBeenCalledTimes(1)
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(1)

        // A new value is reflected lazily on the next index read.
        defaultStore.set(post("1"), {
            title: "Updated",
            tags: ["foo"],
        })
        // The index is cold: the write records a new member revision without
        // eagerly running predicate selectors.
        expect(indexCallback).toHaveBeenCalledTimes(1)
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(1)
        expect(defaultStore.get(postsByTag("foo"))).toBe(initialResult)
        expect(indexCallback).toHaveBeenCalledTimes(2)

        // Delete works
        defaultStore.del(post("1"))
        expect(indexCallback).toHaveBeenCalledTimes(2)
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(0)
        expect(indexCallback).toHaveBeenCalledTimes(2)
    })

    test("basic use", () => {
        const defaultStore = store()
        const post = atomFamily<
            { id: string; title: string; tags: string[] },
            [string]
        >(null, { name: "idx-basic-posts" })
        const indexCallback = mock((doc, term) => {
            return doc.tags.includes(term)
        })
        const postsByTag = index(post, indexCallback, { name: "postsByTag" })
        expect(indexCallback).toHaveBeenCalledTimes(0)
        defaultStore.set(post("1"), {
            id: "1",
            title: "Post 1",
            tags: ["foo"],
        })
        expect(indexCallback).toHaveBeenCalledTimes(0)
        defaultStore.set(post("2"), {
            id: "2",
            title: "Post 2",
            tags: ["bar"],
        })
        defaultStore.set(post("3"), {
            id: "3",
            title: "Post 3",
            tags: ["foo", "bar"],
        })
        expect(
            defaultStore
                .get(postsByTag("foo"))
                .map(atom => atom.familyArgs[0]),
        ).toStrictEqual(["1", "3"])
        expect(indexCallback).toHaveBeenCalledTimes(3)
        expect(
            defaultStore
                .get(postsByTag("bar"))
                .map(atom => atom.familyArgs[0]),
        ).toStrictEqual(["2", "3"])
        expect(indexCallback).toHaveBeenCalledTimes(6)
        defaultStore.set(post("3"), {
            id: "3",
            title: "Post 3",
            tags: [],
        })

        expect(indexCallback).toHaveBeenCalledTimes(6)
        expect(
            defaultStore
                .get(postsByTag("foo"))
                .map(atom => atom.familyArgs[0]),
        ).toStrictEqual(["1"])
        expect(indexCallback).toHaveBeenCalledTimes(7)
        expect(
            defaultStore
                .get(postsByTag("bar"))
                .map(atom => atom.familyArgs[0]),
        ).toStrictEqual(["2"])
        expect(indexCallback).toHaveBeenCalledTimes(8)
        process.debug1 = true
        defaultStore.del(post("3"))
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(1)
        expect(defaultStore.get(postsByTag("bar"))).toHaveLength(1)
        defaultStore.del(post("1"))
        defaultStore.del(post("2"))
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(0)
        expect(defaultStore.get(postsByTag("bar"))).toHaveLength(0)
    })

    test("selector using index", () => {
        const defaultStore = store()
        const entityAtom = atomFamily<{ id: string; kind: string }, [string]>(
            null,
        )
        // defaultStore.set(entityAtom("1"), {})
        const entitesByKind = index(
            entityAtom,
            (doc, term) => {
                return doc.kind === term
            },
            { name: "entitiesByKindIndex" },
        )
        expect(defaultStore.get(entitesByKind("User"))).toHaveLength(0)
    })
})
