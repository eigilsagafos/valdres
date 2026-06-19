import { expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

// Regression: a dependency read MORE THAN ONCE in one evaluation must not mask a
// removed dependency. Before the fix, change-detection compared against the
// length of an array that counted duplicate reads, so `get(a) + get(a)` (length
// 2) looked unchanged vs a prior `get(a) + get(b)` (size 2) — leaving `b` as a
// stale reverse edge (and live-count). (Found by Codex.)
test("a dependency read twice does not mask a removed dependency", () => {
    const useB = atom(true, { name: "dep-dedup.use-b" })
    const a = atom(1, { name: "dep-dedup.a" })
    const b = atom(2, { name: "dep-dedup.b" })
    const root = selector(
        get => (get(useB) ? get(a) + get(b) : get(a) + get(a)),
        { name: "dep-dedup.root" },
    )

    const s = store("dep-dedup")
    s.sub(root, () => {}, false)
    s.set(useB, false)

    expect(s.data.stateDependencies.get(root)).not.toContain(b)
    expect(s.data.stateDependents.get(b) ?? new Set()).not.toContain(root)
    expect(s.data.liveDependentCount.get(b) ?? 0).toBe(0)
})
