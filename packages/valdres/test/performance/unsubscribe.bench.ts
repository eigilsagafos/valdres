import { describe, test } from "./test-compat"
import { createStore as jotaiCreateStore, atom as jotaiAtom } from "jotai"
import { atom as valdresAtom } from "../../src/atom"
import { selector as valdresSelector } from "../../src/selector"
import { store as valdresCreateStore } from "../../src/store"
import { compare } from "./bench-utils"

// Teardown-path guard: a React commit unmounting a subtree fires a burst of
// synchronous unsubscribes on one frame, each of which must NOT re-walk the
// dependency closure shared with its siblings (the beta.14 regression made a
// burst O(unsubs × shared closure)). The graph models that shape: many small
// selector chains all reading one shared depth-20 selector spine, subscribed
// and then torn down in a single synchronous burst. Each iteration re-subscribes
// the same states, so it also covers re-init after a full teardown.

const CHAINS = 50

const buildValdres = () => {
    const root = valdresAtom(0)
    let spine = valdresSelector(get => get(root) + 1)
    for (let d = 1; d < 20; d++) {
        const inner = spine
        spine = valdresSelector(get => get(inner) + 1)
    }
    const subs: (() => () => void)[] = []
    const store = valdresCreateStore()
    const noop = () => {}
    for (let i = 0; i < CHAINS; i++) {
        const base = valdresAtom(i)
        const leafA = valdresSelector(get => get(base) + get(spine))
        const leafB = valdresSelector(get => get(leafA) + 1)
        const leafC = valdresSelector(get => get(leafB) + 1)
        subs.push(() => store.sub(leafB, noop))
        subs.push(() => store.sub(leafC, noop))
    }
    return subs
}

const buildJotai = () => {
    const root = jotaiAtom(0)
    let spine = jotaiAtom(get => get(root) + 1)
    for (let d = 1; d < 20; d++) {
        const inner = spine
        spine = jotaiAtom(get => get(inner) + 1)
    }
    const subs: (() => () => void)[] = []
    const store = jotaiCreateStore()
    const noop = () => {}
    for (let i = 0; i < CHAINS; i++) {
        const base = jotaiAtom(i)
        const leafA = jotaiAtom(get => get(base) + get(spine))
        const leafB = jotaiAtom(get => get(leafA) + 1)
        const leafC = jotaiAtom(get => get(leafB) + 1)
        subs.push(() => store.sub(leafB, noop))
        subs.push(() => store.sub(leafC, noop))
    }
    return subs
}

describe("unsubscribe", () => {
    test("sub + unsub burst over shared spine", async () => {
        const vSubs = buildValdres()
        const jSubs = buildJotai()
        await compare(
            `sub+unsub burst ${CHAINS * 2} subs (shared spine)`,
            () => {
                const unsubs = vSubs.map(sub => sub())
                for (let i = 0; i < unsubs.length; i++) unsubs[i]()
            },
            () => {
                const unsubs = jSubs.map(sub => sub())
                for (let i = 0; i < unsubs.length; i++) unsubs[i]()
            },
        )
    })
})
