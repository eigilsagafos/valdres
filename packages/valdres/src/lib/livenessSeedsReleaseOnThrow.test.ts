import { expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

// Regression: a throwing onMount inside a selector-update pass must still release
// the pass-scoped liveness collector (`data.livenessSeeds`). The pass owns it via
// `ownsLivenessSeeds = !data.livenessSeeds`, and the loop runs user onMount/cleanup
// through mountTransitiveDeps/unmountOrphanedDeps — which throw for this library's
// whole premise (browser-API atoms bootstrap in onMount and throw when the API is
// unavailable). If the release weren't in a `finally`, the throw would strand
// `livenessSeeds` non-undefined forever: every later pass would see
// `ownsLivenessSeeds === false`, so the reconcile would silently never run again
// (the freeze/leak it fixes would return) and the Set would retain strong refs to
// every churned selector. The owned region is wrapped in try/finally.
test("a throwing onMount during propagation releases the liveness collector", () => {
    const flag = atom(false, { name: "release:flag" })
    const boom = atom(0, {
        name: "release:boom",
        onMount: () => {
            throw new Error("boom")
        },
    })
    const s = selector(get => (get(flag) ? get(boom) : 0), { name: "release:s" })
    const st = store("release-test")
    st.sub(s, () => {}, false)

    // Flipping `flag` switches `s` onto `boom`, which mounts it → onMount throws,
    // and the throw unwinds through the selector-update pass.
    expect(() => st.set(flag, true)).toThrow("boom")

    // The collector MUST be released despite the throw — otherwise liveness
    // tracking is permanently disabled for this store.
    expect(st.data.livenessSeeds).toBeUndefined()

    // And the store stays usable: a later pass can own the collector again and
    // settle liveness (switching back off `boom` is a clean, non-throwing churn).
    expect(() => st.set(flag, false)).not.toThrow()
    expect(st.data.livenessSeeds).toBeUndefined()
})
