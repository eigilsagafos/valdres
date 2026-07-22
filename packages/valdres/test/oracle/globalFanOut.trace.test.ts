/** Trace oracle · global atom fan-out.
 *
 *  Setting a global atom in one store fans the value out to every peer store
 *  that has touched it, as ONE logical commit. The historical contract "peer
 *  stores report before the origin store" is locked here (the one cross-store
 *  ordering the engine intentionally guarantees); order AMONG peers is
 *  incidental. Also covers getSelf/setSelf and a scope shadow of a global. */
import { describe, expect, test } from "bun:test"
import { store } from "../../src/store"
import {
    assertTrace,
    createRecorder,
    traceChange,
    traceCommitEnd,
    traceSub,
    tracedGlobalAtom,
} from "./traceRecorder"

describe("trace oracle · global fan-out", () => {
    test("global set fans out to a peer; peer reports before the origin", () => {
        const rec = createRecorder()
        const origin = store()
        const peer = store()
        const g = tracedGlobalAtom<number>(rec, "g", 0)

        // Register both stores as peers of the global atom.
        origin.get(g)
        peer.get(g)
        origin.sub(g, () => rec.push("sub:origin"))
        peer.sub(g, () => rec.push("sub:peer"))
        traceChange(rec, origin, "origin")
        traceChange(rec, peer, "peer")
        traceCommitEnd(rec, origin, "origin")
        traceCommitEnd(rec, peer, "peer")

        rec.clear()
        origin.set(g, 1)

        // Locked to observed behavior: origin's onSet runs in its write phase,
        // then within the subscriber and onChange phases the PEER reports before
        // the ORIGIN (the one intentional cross-store ordering contract). The
        // two trees' commitEnd boundaries close in the other order and are not
        // contractual, so they are an order-free bag.
        assertTrace(rec.events, [
            "onSet:g",
            "sub:peer",
            "sub:origin",
            "onChange:peer",
            "onChange:origin",
            ["commitEnd:origin", "commitEnd:peer"],
        ])
        expect(origin.get(g)).toBe(1)
        expect(peer.get(g)).toBe(1) // fanned out
    })

    test("setSelf / getSelf synchronize the global across stores", () => {
        const rec = createRecorder()
        const s1 = store()
        const s2 = store()
        const g = tracedGlobalAtom<number>(rec, "g", 0)
        s1.get(g)
        s2.get(g)

        g.setSelf(9)

        expect(g.getSelf()).toBe(9)
        expect(s1.get(g)).toBe(9)
        expect(s2.get(g)).toBe(9)
    })

    test("a global is tree-wide — a scope-level write fans out to the root", () => {
        const rec = createRecorder()
        const root = store()
        const g = tracedGlobalAtom<number>(rec, "g", 0)
        root.set(g, 1)
        const child = root.scope("global-shadow")

        child.set(g, 99)

        // Observed contract: unlike an ordinary atom (which a scope shadows
        // locally), a global atom is tree-wide, so the scope write propagates to
        // the root too — both stores observe 99.
        expect(child.get(g)).toBe(99)
        expect(root.get(g)).toBe(99)
        // The explicit scope write is now a registered global shadow. A later
        // root write must update it rather than strand the old scoped value.
        root.set(g, 100)
        expect(child.get(g)).toBe(100)
        child.detach()
    })

    test("async global settlement preserves peer-before-origin observers", async () => {
        const rec = createRecorder()
        const origin = store()
        const peer = store()
        const g = tracedGlobalAtom<number>(rec, "async-g", 0)
        origin.get(g)
        peer.get(g)
        traceSub(rec, origin, g, "origin")
        traceSub(rec, peer, g, "peer")
        traceChange(rec, origin, "origin")
        traceChange(rec, peer, "peer")

        let resolve!: (value: number) => void
        const pending = new Promise<number>(done => {
            resolve = done
        })
        origin.set(g, pending)
        rec.clear()
        resolve(7)
        await pending
        await Promise.resolve()

        assertTrace(rec.events, [
            "onSet:async-g",
            "sub:peer",
            "sub:origin",
            "onChange:peer",
            "onChange:origin",
        ])
    })

    test("global reset keeps peer reports ahead of the origin reset report", () => {
        const rec = createRecorder()
        const origin = store()
        const peer = store()
        const g = tracedGlobalAtom<number>(rec, "reset-g", 0)
        origin.set(g, 3)
        peer.get(g)
        traceSub(rec, origin, g, "origin")
        traceSub(rec, peer, g, "peer")
        traceChange(rec, origin, "origin")
        traceChange(rec, peer, "peer")

        rec.clear()
        origin.reset(g)

        assertTrace(rec.events, [
            "onSet:reset-g",
            "sub:peer",
            "sub:origin",
            "onChange:peer",
            "onChange:origin",
        ])
    })

    test("resetSelf brackets one settlement with cleanup and remount", () => {
        const rec = createRecorder()
        const first = store()
        const second = store()
        const g = tracedGlobalAtom<number>(rec, "restart-g", 0, {
            onMount: () => {
                rec.push("mount")
                return () => rec.push("cleanup")
            },
        })
        traceSub(rec, first, g, "first")
        traceSub(rec, second, g, "second")
        traceCommitEnd(rec, first, "first")
        traceCommitEnd(rec, second, "second")

        rec.clear()
        g.resetSelf()

        assertTrace(rec.events, [
            "cleanup",
            ["sub:first", "sub:second"],
            ["commitEnd:first", "commitEnd:second"],
            "mount",
        ])
    })
})
