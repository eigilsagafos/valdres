import { expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

// The leak fix's PURPOSE is to release resources when a cyclic selector group
// loses its subscriber — i.e. fire onMount cleanups, not just zero a counter. The
// other liveness tests assert liveDependentCount; this one asserts the mount
// TRANSITION the reconcile drives: an onMount atom inside a cyclic region must be
// unmounted (its cleanup run) when the cycle is collected. A reconcile that got
// the count right but the mount transition wrong (e.g. wasLive vs the new live set
// diverging on a cyclic node) would leave a browser subscription running, and no
// count assertion would notice.
test("a cyclic region's onMount cleanup fires when its only subscriber leaves", () => {
    let mounts = 0
    let cleanups = 0
    const tracked = atom(0, {
        name: "cyc-mount.tracked",
        onMount: () => {
            mounts++
            return () => {
                cleanups++
            }
        },
    })
    const ax = atom(0, { name: "cyc-mount.ax" })
    const ay = atom(0, { name: "cyc-mount.ay" })

    let y: any
    // x always reads `tracked` (so tracked is live iff x is live) and, when ax is
    // even, reads y. y, when ay is odd, reads x — establishing the y→x edge while
    // x→y persists, so the dependency GRAPH has an x↔y cycle with no eval cycle
    // (values stay 0, so no propagation ping-pong).
    const x = selector(
        get => {
            get(tracked)
            return get(ax) % 2 === 0 ? get(y) : 0
        },
        { name: "cyc-mount.x" },
    )
    y = selector(get => (get(ay) % 2 === 0 ? 0 : get(x)), { name: "cyc-mount.y" })

    const s = store("cyc-mount")
    const unsub = s.sub(x, () => {}, false)

    // x live → reads tracked → tracked mounted.
    expect(mounts).toBe(1)
    expect(cleanups).toBe(0)
    expect(s.data.liveDependentCount.get(tracked) ?? 0).toBe(1)

    // Close the cycle: ay odd makes y read x while x still reads y.
    s.set(ay, 1)
    expect(s.data.stateDependencies.get(x)).toContain(y)
    expect(s.data.stateDependencies.get(y)).toContain(x)
    // tracked is still read by the (still-subscribed) x.
    expect(cleanups).toBe(0)

    // Unsubscribe the only anchor. propagateNotLive can't collect the x↔y cycle
    // (each keeps the other's count > 0), so the unsubscribe reconcile must mark
    // both non-live AND unmount `tracked`, firing its cleanup.
    unsub()
    expect(s.data.liveDependentCount.get(tracked) ?? 0).toBe(0)
    expect(s.data.liveDependentCount.get(x) ?? 0).toBe(0)
    expect(s.data.liveDependentCount.get(y) ?? 0).toBe(0)
    // The actual resource release: every mount was cleaned up — no leaked
    // subscription left running on the collected cyclic group.
    expect(cleanups).toBe(mounts)
})
