import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { store } from "../store"
import { getStoreData } from "./getStoreData"
import { commitEndRegistry } from "./onCommitEnd"

describe("store tree runtime", () => {
    test("every scope in a tree shares one runtime object, and trees do not", () => {
        const root = store()
        const child = root.scope("tree-a")
        const grandchild = child.scope("tree-a-1")
        const other = store()

        const tree = getStoreData(root).tree
        expect(getStoreData(child).tree).toBe(tree)
        expect(getStoreData(grandchild).tree).toBe(tree)
        expect(tree.root).toBe(getStoreData(root))
        expect(getStoreData(other).tree).not.toBe(tree)

        grandchild.detach()
        child.detach()
    })

    test("the revision clock is tree-wide: a scope write advances the root's", () => {
        const root = store()
        const child = root.scope("tree-b")
        const a = atom(0)
        const tree = getStoreData(root).tree

        // Enable revision tracking the way a cold selector does.
        tree.revisionEnabled = true
        tree.trackedRevisions = new WeakSet([a])
        const before = tree.revision

        child.set(a, 1)
        expect(tree.revision).toBeGreaterThan(before)
        expect(getStoreData(child).tree.revision).toBe(tree.revision)

        child.detach()
    })

    describe("commit-end ownership", () => {
        test("detaching a scope leaves a live root's listeners and depth intact", () => {
            const root = store()
            const child = root.scope("tree-c")
            const a = atom(0)
            const fired = mock(() => {})
            const unsub = root.onCommitEnd(fired)
            const countWithListener = commitEndRegistry.count

            child.detach()

            // A scope's disposal must not tear down TREE state owned by a root
            // that is still very much alive.
            expect(getStoreData(root).tree.commitEndListeners?.size).toBe(1)
            expect(getStoreData(root).tree.commitDepth).toBe(0)
            expect(commitEndRegistry.count).toBe(countWithListener)

            root.set(a, 1)
            expect(fired).toHaveBeenCalledTimes(1)
            unsub()
        })

        test("a global fan-out fires only the trees that are listening", () => {
            const origin = store()
            const peer = store()
            const value = atom(0, { global: true })
            // Initialize before registering: the first read is itself a commit.
            origin.get(value)
            peer.get(value)

            const originOnly = mock(() => {})
            const unsubOrigin = origin.onCommitEnd(originOnly)
            origin.set(value, 1)
            expect(originOnly).toHaveBeenCalledTimes(1)
            unsubOrigin()

            // Listening peer, silent origin: the peer's own tree boundary must
            // still open and close even though the write started elsewhere.
            const peerOnly = mock(() => {})
            const unsubPeer = peer.onCommitEnd(peerOnly)
            origin.set(value, 2)
            expect(peerOnly).toHaveBeenCalledTimes(1)
            expect(getStoreData(peer).tree.commitDepth).toBe(0)
            expect(getStoreData(origin).tree.commitDepth).toBe(0)
            unsubPeer()
        })
    })
})
