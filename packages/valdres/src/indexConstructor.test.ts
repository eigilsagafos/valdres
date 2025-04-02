import { describe, expect, mock, test } from "bun:test"
import { index } from "./indexConstructor"
import { atomFamily } from "./atomFamily"
import { store } from "./store"

describe("index", () => {
    test("crud", () => {
        const defaultStore = store()
        const post = atomFamily<{ title: string; tags: string[] }, [string]>(
            null,
            {
                name: "posts",
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

        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(1)

        expect(indexCallback).toHaveBeenCalledTimes(1)

        // When updating to same value nothing happens
        defaultStore.set(post("1"), {
            title: "Initial",
            tags: ["foo"],
        })
        expect(indexCallback).toHaveBeenCalledTimes(1)
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(1)

        // When updating to a new value callback is triggered
        defaultStore.set(post("1"), {
            title: "Updated",
            tags: ["foo"],
        })
        expect(indexCallback).toHaveBeenCalledTimes(2)
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(1)

        // Delete works
        defaultStore.del(post("1"))
        expect(indexCallback).toHaveBeenCalledTimes(3)
    })

    test("basic use", () => {
        const defaultStore = store()
        const post = atomFamily<
            { id: string; title: string; tags: string[] },
            [string]
        >(null, { name: "posts" })
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
                .map(atom => atom.familyArgsStringified),
        ).toStrictEqual(["1", "3"])
        expect(indexCallback).toHaveBeenCalledTimes(3)
        expect(
            defaultStore
                .get(postsByTag("bar"))
                .map(atom => atom.familyArgsStringified),
        ).toStrictEqual(["2", "3"])
        expect(indexCallback).toHaveBeenCalledTimes(6)
        defaultStore.set(post("3"), {
            id: "3",
            title: "Post 3",
            tags: [],
        })

        expect(indexCallback).toHaveBeenCalledTimes(8) // TOOD: This was 6 with the old sub/dep logic. Could we get back to this not triggering until we actually get the value?
        expect(
            defaultStore
                .get(postsByTag("foo"))
                .map(atom => atom.familyArgsStringified),
        ).toStrictEqual(["1"])
        expect(indexCallback).toHaveBeenCalledTimes(8)
        expect(
            defaultStore
                .get(postsByTag("bar"))
                .map(atom => atom.familyArgsStringified),
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
