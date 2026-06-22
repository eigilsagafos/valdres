import { expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

// `mountTransitiveDeps` / `unmountOrphanedDeps` short-circuit on a cached
// `data.mountInClosure` marker so a mount-free subtree (the common case) is
// never walked. These tests pin the marker's load-bearing invariant — NO FALSE
// NEGATIVES: a mount hook reachable below a chain of mount-free selectors must
// still mount/unmount, including when the dependency path is established
// dynamically (dep churn) rather than at first read, and including through a
// dependency cycle. They also pin the stale-true self-clearing.

test("onMount fires through a deep chain of mount-free selectors", () => {
    let mounts = 0
    let cleanups = 0
    const tracked = atom(0, {
        name: "mic.deep.tracked",
        onMount: () => {
            mounts++
            return () => {
                cleanups++
            }
        },
    })
    // 40 plain (mount-free) selectors; only the leaf reads `tracked`.
    let node: any = selector(get => get(tracked), { name: "mic.deep.0" })
    for (let i = 1; i < 40; i++) {
        const inner = node
        node = selector(get => get(inner), { name: `mic.deep.${i}` })
    }

    const s = store("mic.deep")
    // Subscribing the top selector cold-reads the whole chain (wiring every
    // edge, marking the closure mount-relevant on the way up) then mounts.
    const unsub = s.sub(node, () => {}, false)
    expect(mounts).toBe(1)
    expect(cleanups).toBe(0)
    // The marker reached the top across all 40 hops — no false negative.
    expect(s.data.mountInClosure.has(node)).toBe(true)

    unsub()
    expect(cleanups).toBe(1)
})

test("onMount mounts when a live selector dynamically gains the dep during propagation", () => {
    let mounts = 0
    let cleanups = 0
    const toggle = atom(false, { name: "mic.churn.toggle" })
    const tracked = atom(0, {
        name: "mic.churn.tracked",
        onMount: () => {
            mounts++
            return () => {
                cleanups++
            }
        },
    })
    // `sel` reads `tracked` only while toggle is true → starts mount-free.
    const sel = selector(get => (get(toggle) ? get(tracked) : 0), {
        name: "mic.churn.sel",
    })

    const s = store("mic.churn")
    const unsub = s.sub(sel, () => {}, false)
    // No mountable node in the closure yet, so no marker and nothing mounted.
    expect(mounts).toBe(0)
    expect(s.data.mountInClosure.has(sel)).toBe(false)

    // Propagation re-evaluates `sel`, adds the sel→tracked edge, and must mark
    // + mount through it (noteDependencyAdded armed the marker; the loop walks).
    s.set(toggle, true)
    expect(mounts).toBe(1)
    expect(cleanups).toBe(0)
    expect(s.data.mountInClosure.has(sel)).toBe(true)

    // Dropping the edge unmounts `tracked` (no longer live). The marker is
    // allowed to stay stale-true here — that only risks a redundant walk.
    s.set(toggle, false)
    expect(cleanups).toBe(1)

    // Unsubscribe walks `sel`'s now mount-free closure with a fresh visited set,
    // which recomputes and CLEARS the stale marker.
    unsub()
    expect(s.data.mountInClosure.has(sel)).toBe(false)
})

test("marker stays correct (no false negative) across churn in a cyclic region", () => {
    let mounts = 0
    let cleanups = 0
    const tracked = atom(0, {
        name: "mic.cyc.tracked",
        onMount: () => {
            mounts++
            return () => {
                cleanups++
            }
        },
    })
    const ax = atom(0, { name: "mic.cyc.ax" })
    const ay = atom(0, { name: "mic.cyc.ay" })

    let y: any
    // x always reads `tracked`; the x↔y graph cycle is opened/closed via ay,
    // re-pointing edges around the loop while `tracked` stays reachable from x.
    const x = selector(
        get => {
            get(tracked)
            return get(ax) % 2 === 0 ? get(y) : 0
        },
        { name: "mic.cyc.x" },
    )
    y = selector(get => (get(ay) % 2 === 0 ? 0 : get(x)), { name: "mic.cyc.y" })

    const s = store("mic.cyc")
    const unsub = s.sub(x, () => {}, false)
    expect(mounts).toBe(1)
    expect(s.data.mountInClosure.has(x)).toBe(true)

    // Close the cycle (y now reads x) — y gains a mount-relevant dep.
    s.set(ay, 1)
    expect(s.data.mountInClosure.has(y)).toBe(true)
    // Churn the other edge a few times; the mount must never drop while x lives.
    s.set(ax, 1)
    s.set(ax, 2)
    s.set(ay, 0)
    expect(cleanups).toBe(0)
    expect(s.data.liveDependentCount.get(tracked) ?? 0).toBe(1)

    // Only when x's subscriber leaves does `tracked` unmount.
    unsub()
    expect(cleanups).toBe(1)
})

// The `AtomOnMount` contract: a hook must be set before the state is first used
// in a store, but it need NOT be passed at creation — assigning it afterward,
// before first use, is fully supported (this is how the Jotai adapter works:
// `atom()` then `.onMount = fn`, before any subscribe). The marker is populated
// when the dependency edge forms (first use), by which point the hook exists, so
// it mounts correctly.
test("onMount assigned after atom() but before first store use still mounts", () => {
    let mounts = 0
    let cleanups = 0
    const tracked: any = atom(0, { name: "mic.late.tracked" }) // created without onMount

    // Hook attached by property assignment, before `tracked` is ever read.
    tracked.onMount = () => {
        mounts++
        return () => {
            cleanups++
        }
    }

    // First use is the subscribe below: it wires sel→tracked (marking the
    // closure, since tracked's hook is already present) and mounts.
    const sel = selector(get => get(tracked), { name: "mic.late.sel" })
    const s = store("mic.late")
    const unsub = s.sub(sel, () => {}, false)
    expect(mounts).toBe(1)
    expect(cleanups).toBe(0)
    expect(s.data.mountInClosure.has(sel)).toBe(true)

    unsub()
    expect(cleanups).toBe(1)
})
