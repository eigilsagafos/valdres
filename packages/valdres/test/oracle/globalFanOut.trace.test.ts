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
        child.detach()
    })
})
