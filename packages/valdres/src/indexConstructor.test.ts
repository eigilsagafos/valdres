import { describe, expect, mock, test } from "bun:test"
import { index } from "./indexConstructor"
import { atomFamily } from "./atomFamily"
import { store } from "./store"

describe("index", () => {
    test("basic use", () => {
        const defaultStore = store()
        const post = atomFamily<
            string,
            { id: string; title: string; tags: string[] }
        >()
        defaultStore.set(post("1"), {
            id: "1",
            title: "Post 1",
            tags: ["foo"],
        })
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
        const indexCallback = mock((doc, term) => doc.tags.includes(term))
        const postsByTag = index(post, indexCallback)
        expect(indexCallback).toHaveBeenCalledTimes(0)
        expect(defaultStore.get(postsByTag("foo"))).toStrictEqual(["1", "3"])
        expect(indexCallback).toHaveBeenCalledTimes(3)
        expect(defaultStore.get(postsByTag("bar"))).toStrictEqual(["2", "3"])
        expect(indexCallback).toHaveBeenCalledTimes(6)
        defaultStore.set(post("3"), {
            id: "3",
            title: "Post 3",
            tags: [],
        })
        expect(indexCallback).toHaveBeenCalledTimes(6)
        expect(defaultStore.get(postsByTag("foo"))).toStrictEqual(["1"])
        expect(indexCallback).toHaveBeenCalledTimes(7)
        expect(defaultStore.get(postsByTag("bar"))).toStrictEqual(["2"])
        expect(indexCallback).toHaveBeenCalledTimes(8)
    })
})
