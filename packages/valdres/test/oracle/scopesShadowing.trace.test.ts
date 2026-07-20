/** Trace oracle · scopes & shadowing.
 *
 *  A scope reads through to its parent until it pins its own value. An equal set
 *  still pins the shadow (otherwise a later parent write would leak in). Once
 *  shadowed, a parent write must not propagate into the scope; while unshadowed,
 *  a parent write is inherited and the scope's subscriber fires. */
import { describe, expect, test } from "bun:test"
import { store } from "../../src/store"
import {
    assertTrace,
    createRecorder,
    traceCommitEnd,
    tracedAtom,
    tracedSelector,
} from "./traceRecorder"

describe("trace oracle · scopes & shadowing", () => {
    test("root / child-inherited / shadowed reads", () => {
        const rec = createRecorder()
        const root = store()
        const a = tracedAtom(rec, "a", 1)
        root.set(a, 10)
        const child = root.scope("read-modes")

        expect(root.get(a)).toBe(10) // root's own value
        expect(child.get(a)).toBe(10) // inherited (unshadowed)

        child.set(a, 20) // shadow
        expect(child.get(a)).toBe(20) // shadowed value
        expect(root.get(a)).toBe(10) // root unaffected
        child.detach()
    })

    test("equal-set pins a shadow; a later parent write does not leak in", () => {
        const rec = createRecorder()
        const root = store()
        const a = tracedAtom(rec, "a", 1)
        root.get(a) // materialize on the root
        const child = root.scope("shadow-pin")

        let childFired = 0
        child.set(a, 1) // EQUAL to the inherited value, but still pins the shadow
        child.sub(a, () => childFired++)

        rec.clear()
        root.set(a, 2)

        expect(root.get(a)).toBe(2)
        expect(child.get(a)).toBe(1) // shadow held — the parent write did not leak
        expect(childFired).toBe(0) // and the scope subscriber was not notified
        child.detach()
    })

    test("an unshadowed scope inherits a parent write and its subscriber fires", () => {
        const rec = createRecorder()
        const root = store()
        const a = tracedAtom(rec, "a", 1)
        const child = root.scope("inherit")

        let childFired = 0
        child.sub(a, () => {
            rec.push("sub:child")
            childFired++
        })
        traceCommitEnd(rec, root, "root")

        rec.clear()
        root.set(a, 2)

        expect(child.get(a)).toBe(2) // inherited the parent write
        expect(childFired).toBe(1)
        // The delegated scope subscriber fires within the root's commit.
        assertTrace(rec.events, ["onSet:a", "sub:child", "commitEnd:root"])
        child.detach()
    })

    test("shadowing a dependency moves selector recompute into the scope", () => {
        const rec = createRecorder()
        const root = store()
        const a = tracedAtom(rec, "a", 1)
        const doubled = tracedSelector(rec, "doubled", get => (get(a) as number) * 2)
        const child = root.scope("shadow-dep")

        // Shadow the dependency in the scope, then subscribe to the selector there.
        child.set(a, 5)
        let childVal = 0
        child.sub(doubled, () => {
            rec.push("sub:doubled")
            childVal = child.get(doubled) as number
        })

        expect(child.get(doubled)).toBe(10) // 5 * 2, from the scope's shadow
        expect(root.get(doubled)).toBe(2) // 1 * 2, from the root

        rec.clear()
        child.set(a, 6) // recompute happens in the scope

        // Assert the trace BEFORE any read below can add a stray evaluation: the
        // selector recomputes EXACTLY ONCE, in the scope. A refactor that
        // recomputed it twice, or also recomputed the root's copy, would add a
        // second `eval:doubled` here and fail.
        assertTrace(rec.events, ["onSet:a", "eval:doubled", "sub:doubled"])

        expect(child.get(doubled)).toBe(12)
        expect(childVal).toBe(12)
        // The root's selector value is untouched by the scope write.
        expect(root.get(doubled)).toBe(2)
        child.detach()
    })
})
