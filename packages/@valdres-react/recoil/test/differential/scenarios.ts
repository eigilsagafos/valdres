/**
 * Differential scenarios: one behavior, observed through the public API of
 * whichever Recoil implementation the runner injects.
 *
 * The same scenarios run against `recoil@0.7.7` on React 18.3.1 (the reference
 * oracle, `bun run oracle` regenerates and verifies `recoil-0.7.7.json`) and
 * against this package on React 18 and 19. Nothing here imports React, Recoil
 * or this package: the runner injects them, so the file resolves identically
 * from the oracle's isolated install and from the workspace.
 *
 * Every scenario declares what the adapter must do relative to Recoil:
 * - `match`: the adapter's observation must deep-equal Recoil's.
 * - `refused`: the adapter must throw `UnsupportedRecoilFeatureError` for the
 *   named feature where Recoil would do something the adapter cannot reproduce
 *   faithfully.
 * - `differs`: a documented divergence; the adapter's observation must equal
 *   `adapter` exactly while Recoil's stays recorded for comparison.
 */

export interface DifferentialEnv {
    /** A Recoil-compatible module namespace. */
    readonly lib: any
    readonly React: any
    /** `@testing-library/react` */
    readonly render: (element: unknown) => {
        container: HTMLElement
        rerender(element: unknown): void
        unmount(): void
    }
    readonly act: (callback: () => unknown) => any
    readonly cleanup: () => void
    readonly renderToString: (element: any) => string
}

export type AdapterExpectation =
    | { readonly kind: "match" }
    | { readonly kind: "refused"; readonly feature: string }
    | { readonly kind: "differs"; readonly reason: string; readonly adapter: unknown }

export interface Scenario {
    readonly name: string
    readonly adapter: AdapterExpectation
    run(env: DifferentialEnv): unknown
}

const match: AdapterExpectation = { kind: "match" }
const refused = (feature: string): AdapterExpectation => ({
    kind: "refused",
    feature,
})
const differs = (reason: string, adapter: unknown): AdapterExpectation => ({
    kind: "differs",
    reason,
    adapter,
})

export const describeError = (error: unknown): Record<string, unknown> => {
    if (error === null || typeof error !== "object")
        return { thrown: String(error) }
    const { name, code, feature } = error as Record<string, unknown>
    return {
        error: String(name),
        ...(typeof code === "string" ? { code } : {}),
        ...(typeof feature === "string" ? { feature } : {}),
    }
}

const attempt = (callback: () => unknown): unknown => {
    try {
        return { value: callback() }
    } catch (error) {
        return { threw: describeError(error) }
    }
}

/** Runs `callback` with console.error/warn captured instead of printed. */
const captureConsole = <T>(
    callback: () => T,
): { result: T; errors: string[]; warnings: string[] } => {
    const errors: string[] = []
    const warnings: string[] = []
    const { error, warn } = console
    console.error = (...args: unknown[]) => {
        errors.push(args.map(arg => String((arg as any)?.message ?? arg)).join(" "))
    }
    console.warn = (...args: unknown[]) => {
        warnings.push(args.map(arg => String((arg as any)?.message ?? arg)).join(" "))
    }
    try {
        return { result: callback(), errors, warnings }
    } finally {
        console.error = error
        console.warn = warn
    }
}

/** Mounts `use` inside a RecoilRoot and exposes every value it returned. */
const probe = (
    env: DifferentialEnv,
    use: () => unknown,
    rootProps: Record<string, unknown> = {},
) => {
    const h = env.React.createElement
    const values: unknown[] = []
    const Probe = () => {
        values.push(use())
        return null
    }
    const view = env.render(h(env.lib.RecoilRoot, rootProps, h(Probe)))
    return {
        values,
        latest: () => values[values.length - 1],
        view,
    }
}

const errorBoundary = (env: DifferentialEnv) => {
    const caught: unknown[] = []
    class Boundary extends env.React.Component {
        state = { failed: false }
        static getDerivedStateFromError() {
            return { failed: true }
        }
        componentDidCatch(error: unknown) {
            caught.push(error)
        }
        render() {
            const self = this as any
            return self.state.failed ? "caught" : self.props.children
        }
    }
    return { Boundary, caught }
}

const scenarioList: Scenario[] = []
const scenario = (
    name: string,
    adapter: AdapterExpectation,
    run: (env: DifferentialEnv) => unknown,
) => scenarioList.push({ name, adapter, run })

// --- Definitions and keys -------------------------------------------------

scenario("keys/RecoilValue key and toJSON", match, ({ lib }) => {
    const a = lib.atom({ key: "keys/a", default: 0 })
    const s = lib.selector({ key: "keys/s", get: () => 1 })
    return {
        atom: [a.key, JSON.stringify(a)],
        selector: [s.key, JSON.stringify(s)],
    }
})

scenario("keys/missing key is rejected", match, ({ lib }) => ({
    atom: "threw" in (attempt(() => lib.atom({ default: 0 })) as object),
    selector: "threw" in (attempt(() => lib.selector({ get: () => 0 })) as object),
}))

scenario(
    "keys/duplicate atom keys",
    differs(
        "Keys are labels. Each definition owns its own state; a duplicate key warns once per key instead of aliasing the earlier definition's state.",
        {
            values: { first: 1, second: 2 },
            afterSet: { first: 10, second: 2 },
            warned: true,
        },
    ),
    env => {
        const { lib } = env
        const { result, errors, warnings } = captureConsole(() => {
            const first = lib.atom({ key: "keys/duplicate", default: 1 })
            const second = lib.atom({ key: "keys/duplicate", default: 2 })
            const view = probe(env, () => [
                lib.useRecoilValue(first),
                lib.useRecoilValue(second),
                lib.useSetRecoilState(first),
            ])
            const [a, b, set] = view.latest() as any[]
            env.act(() => set(10))
            const [c, d] = view.latest() as any[]
            return { values: { first: a, second: b }, afterSet: { first: c, second: d } }
        })
        return {
            ...result,
            warned: [...errors, ...warnings].some(message =>
                message.includes('Duplicate atom key "keys/duplicate"'),
            ),
        }
    },
)

scenario("defaults/function default is stored, not called", match, env => {
    const { lib } = env
    const fn = () => "called"
    const a = lib.atom({ key: "defaults/fn", default: fn })
    const view = probe(env, () => lib.useRecoilValue(a))
    return { same: view.latest() === fn }
})

scenario("defaults/undefined and null are values", match, env => {
    const { lib } = env
    const u = lib.atom({ key: "defaults/undefined", default: undefined })
    const n = lib.atom({ key: "defaults/null", default: null })
    const view = probe(env, () => [lib.useRecoilValue(u), lib.useRecoilValue(n)])
    return { values: view.latest() }
})

scenario(
    "defaults/no default suspends until set",
    refused("atoms without a default"),
    env => {
        const { lib, React } = env
        const h = React.createElement
        const a = lib.atom({ key: "defaults/none" })
        let set: any
        const Writer = () => ((set = lib.useSetRecoilState(a)), null)
        const Reader = () => h("b", null, String(lib.useRecoilValue(a)))
        const { Boundary, caught } = errorBoundary(env)
        const { container } = env.render(
            h(
                lib.RecoilRoot,
                null,
                h(Writer),
                h(Boundary, null, h(React.Suspense, { fallback: "pending" }, h(Reader))),
            ),
        )
        if (caught.length) throw caught[0]
        const before = container.textContent
        env.act(() => set("ready"))
        return { before, after: container.textContent }
    },
)

scenario("defaults/promise default suspends", refused("async atom defaults"), env => {
    const { lib, React } = env
    const h = React.createElement
    const { Boundary, caught } = errorBoundary(env)
    const a = lib.atom({ key: "defaults/promise", default: new Promise(() => {}) })
    const Reader = () => h("b", null, String(lib.useRecoilValue(a)))
    const { container } = env.render(
        h(lib.RecoilRoot, null, h(Boundary, null, h(React.Suspense, { fallback: "pending" }, h(Reader)))),
    )
    if (caught.length) throw caught[0]
    return { text: container.textContent }
})

scenario("defaults/RecoilValue default tracks until set and after reset", match, env => {
    const { lib } = env
    const base = lib.atom({ key: "defaults/base", default: 1 })
    const doubled = lib.selector({ key: "defaults/doubled", get: ({ get }: any) => get(base) * 2 })
    const a = lib.atom({ key: "defaults/fallback", default: doubled })
    const view = probe(env, () => [
        lib.useRecoilValue(a),
        lib.useSetRecoilState(a),
        lib.useResetRecoilState(a),
        lib.useSetRecoilState(base),
    ])
    const log: unknown[] = []
    const value = () => (view.latest() as any[])[0]
    const [, set, reset, setBase] = view.latest() as any[]
    log.push(value())
    env.act(() => setBase(3))
    log.push(value())
    env.act(() => set(100))
    log.push(value())
    env.act(() => setBase(4))
    log.push(value())
    env.act(() => reset())
    log.push(value())
    env.act(() => set((prev: number) => prev + 1))
    log.push(value())
    return { log, key: a.key }
})

scenario("defaults/atom default can be another atom", match, env => {
    const { lib } = env
    const source = lib.atom({ key: "defaults/source", default: "source" })
    const a = lib.atom({ key: "defaults/fromAtom", default: source })
    const view = probe(env, () => [lib.useRecoilValue(a), lib.useSetRecoilState(source)])
    const before = (view.latest() as any[])[0]
    env.act(() => (view.latest() as any[])[1]("changed"))
    return { before, after: (view.latest() as any[])[0] }
})

// --- Writes, resets and DefaultValue --------------------------------------

scenario("writes/setter treats functions as updaters", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "writes/fn", default: () => "initial" })
    const view = probe(env, () => [lib.useRecoilValue(a), lib.useSetRecoilState(a)])
    const stored = () => "stored"
    env.act(() => (view.latest() as any[])[1](stored))
    const afterPlain = (view.latest() as any[])[0]
    env.act(() => (view.latest() as any[])[1](() => stored))
    return {
        plainSetCalledUpdater: afterPlain === "stored",
        wrappedStoresFunction: (view.latest() as any[])[0] === stored,
    }
})

scenario("writes/sequential updaters chain within one act", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "writes/chain", default: 0 })
    const view = probe(env, () => [lib.useRecoilValue(a), lib.useSetRecoilState(a)])
    env.act(() => {
        const set = (view.latest() as any[])[1]
        set((n: number) => n + 1)
        set((n: number) => n + 1)
        set((n: number) => n * 10)
    })
    return { value: (view.latest() as any[])[0] }
})

scenario("writes/set DefaultValue resets", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "writes/defaultValue", default: "default" })
    const view = probe(env, () => [lib.useRecoilValue(a), lib.useSetRecoilState(a)])
    env.act(() => (view.latest() as any[])[1]("changed"))
    const changed = (view.latest() as any[])[0]
    env.act(() => (view.latest() as any[])[1](new lib.DefaultValue()))
    return { changed, reset: (view.latest() as any[])[0] }
})

scenario("writes/setter and resetter identity is stable", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "writes/identity", default: 0 })
    const view = probe(env, () => [
        lib.useRecoilValue(a),
        lib.useSetRecoilState(a),
        lib.useResetRecoilState(a),
        lib.useRecoilState(a)[1],
    ])
    const first = view.latest() as any[]
    env.act(() => first[1](1))
    env.act(() => first[2]())
    const renders = view.values as any[][]
    return {
        renders: renders.length,
        setterStable: renders.every(r => r[1] === first[1]),
        resetStable: renders.every(r => r[2] === first[2]),
        stateSetterStable: renders.every(r => r[3] === first[3]),
    }
})

scenario("writes/equal writes and resets do not re-render", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "writes/equal", default: "default" })
    const view = probe(env, () => [
        lib.useRecoilValue(a),
        lib.useSetRecoilState(a),
        lib.useResetRecoilState(a),
    ])
    const [, set, reset] = view.latest() as any[]
    const counts: number[] = [view.values.length]
    env.act(() => set("default"))
    counts.push(view.values.length)
    env.act(() => reset())
    counts.push(view.values.length)
    env.act(() => set("changed"))
    counts.push(view.values.length)
    env.act(() => set("changed"))
    counts.push(view.values.length)
    env.act(() => reset())
    counts.push(view.values.length)
    env.act(() => reset())
    counts.push(view.values.length)
    return { counts }
})

scenario("writes/signed zero follows ===", match, env => {
    const { lib } = env
    const z = lib.atom({ key: "writes/zero", default: 0 })
    const view = probe(env, () => [lib.useRecoilValue(z), lib.useSetRecoilState(z)])
    const counts: number[] = [view.values.length]
    env.act(() => (view.latest() as any[])[1](-0))
    counts.push(view.values.length)
    return { counts, storedNegativeZero: Object.is((view.latest() as any[])[0], -0) }
})

scenario(
    "writes/NaN values render",
    differs(
        "Recoil 0.7.7 re-renders forever (React's \"Maximum update depth exceeded\") once a subscribed atom holds NaN, because NaN !== NaN. The adapter compares snapshots with Object.is and renders NaN once.",
        { renders: 1, isNaN: true },
    ),
    env => {
        const { lib } = env
        const n = lib.atom({ key: "writes/nan", default: Number.NaN })
        const { result } = captureConsole(() => {
            const view = probe(env, () => lib.useRecoilValue(n))
            return { renders: view.values.length, isNaN: Number.isNaN(view.latest()) }
        })
        return result
    },
)

scenario(
    "writes/set during render",
    differs(
        "Recoil schedules its internal Batcher component from the render, so React warns \"Cannot update a component while rendering a different component\". The adapter's write reaches React through useSyncExternalStore without that warning.",
        { text: 1, warned: false },
    ),
    env => {
    const { lib } = env
    const a = lib.atom({ key: "writes/render", default: 0 })
    const { result, errors } = captureConsole(() => {
        const view = probe(env, () => {
            const [value, set] = lib.useRecoilState(a)
            if (value === 0) set(1)
            return value
        })
        return { text: view.latest() }
    })
    return { ...result, warned: errors.length > 0 }
})

// --- Selectors -------------------------------------------------------------

scenario("selectors/read-only set throws", match, env => {
    const { lib } = env
    const s = lib.selector({ key: "selectors/readonly", get: () => 1 })
    const a = lib.atom({ key: "selectors/readonly-atom", default: 0 })
    let set: any
    probe(env, () => {
        set = lib.useRecoilCallback(({ set }: any) => (target: any) => set(target, 2))
    })
    let threw = false
    env.act(() => {
        try {
            set(s)
        } catch {
            threw = true
        }
    })
    return { threw, isRecoilValue: lib.isRecoilValue(s), atom: lib.isRecoilValue(a) }
})

scenario("selectors/set handler reads pre-write state, last write wins", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "selectors/a", default: 0 })
    const b = lib.atom({ key: "selectors/b", default: 0 })
    const seen: unknown[] = []
    const s = lib.selector({
        key: "selectors/writer",
        get: ({ get }: any) => get(a) + get(b),
        set: ({ get, set }: any, value: number) => {
            set(a, value)
            seen.push(get(a))
            set(a, (prev: number) => prev + 100)
            set(a, (prev: number) => prev + 1)
            set(b, get(a) + 1)
            seen.push(get(a), get(b))
        },
    })
    const view = probe(env, () => [
        lib.useRecoilValue(a),
        lib.useRecoilValue(b),
        lib.useRecoilValue(s),
        lib.useSetRecoilState(s),
    ])
    env.act(() => (view.latest() as any[])[3](5))
    const [va, vb, vs] = view.latest() as any[]
    return { seen, a: va, b: vb, s: vs }
})

scenario("selectors/set handler writes judged against stored values", match, env => {
    const { lib } = env
    const unset = lib.atom({ key: "selectors/judged-unset", default: "d" })
    const stored = lib.atom({ key: "selectors/judged-stored", default: 0 })
    const fresh = lib.atom({ key: "selectors/judged-fresh", default: 0 })
    const s = lib.selector({
        key: "selectors/judged",
        get: () => 0,
        set: ({ set, reset }: any) => {
            set(unset, "x")
            reset(unset)
            set(stored, 1)
            set(stored, 0)
            set(fresh, 1)
            set(fresh, 0)
        },
    })
    const view = probe(env, () => [
        lib.useRecoilValue(unset),
        lib.useRecoilValue(stored),
        lib.useRecoilValue(fresh),
        lib.useSetRecoilState(stored),
        lib.useSetRecoilState(s),
    ])
    env.act(() => (view.latest() as any[])[3](0))
    env.act(() => (view.latest() as any[])[4](1))
    return { values: (view.latest() as any[]).slice(0, 3) }
})

scenario("selectors/reset passes DefaultValue to set", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "selectors/reset-a", default: "default" })
    const received: unknown[] = []
    const s = lib.selector({
        key: "selectors/reset",
        get: ({ get }: any) => get(a),
        set: ({ set, reset }: any, value: unknown) => {
            received.push(value instanceof lib.DefaultValue ? "DefaultValue" : value)
            if (value instanceof lib.DefaultValue) reset(a)
            else set(a, value)
        },
    })
    const view = probe(env, () => [
        lib.useRecoilValue(s),
        lib.useSetRecoilState(s),
        lib.useResetRecoilState(s),
    ])
    env.act(() => (view.latest() as any[])[1]("changed"))
    const changed = (view.latest() as any[])[0]
    env.act(() => (view.latest() as any[])[2]())
    return { received, changed, reset: (view.latest() as any[])[0] }
})

scenario("selectors/updater receives selector value", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "selectors/updater-a", default: 2 })
    const s = lib.selector({
        key: "selectors/updater",
        get: ({ get }: any) => get(a) * 10,
        set: ({ set }: any, value: number) => set(a, value / 10),
    })
    const view = probe(env, () => [lib.useRecoilValue(a), lib.useSetRecoilState(s)])
    const seen: number[] = []
    env.act(() =>
        (view.latest() as any[])[1]((prev: number) => {
            seen.push(prev)
            return prev + 10
        }),
    )
    return { seen, a: (view.latest() as any[])[0] }
})

scenario("selectors/set must return undefined", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "selectors/void-a", default: 0 })
    const s = lib.selector({
        key: "selectors/void",
        get: ({ get }: any) => get(a),
        set: ({ set }: any, value: number) => {
            set(a, value)
            return "not void"
        },
    })
    let cb: any
    probe(env, () => {
        cb = lib.useRecoilCallback(({ set }: any) => () => set(s, 1))
    })
    let threw = false
    env.act(() => {
        try {
            cb()
        } catch {
            threw = true
        }
    })
    let value: unknown
    probe(env, () => (value = lib.useRecoilValue(a)))
    return { threw, freshRoot: value }
})

scenario("selectors/get may return a RecoilValue", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "selectors/indirect-a", default: "a" })
    const b = lib.atom({ key: "selectors/indirect-b", default: "b" })
    const pick = lib.atom({ key: "selectors/indirect-pick", default: true })
    const s = lib.selector({ key: "selectors/indirect", get: ({ get }: any) => (get(pick) ? a : b) })
    const view = probe(env, () => [lib.useRecoilValue(s), lib.useSetRecoilState(pick), lib.useSetRecoilState(a)])
    const log = [(view.latest() as any[])[0]]
    env.act(() => (view.latest() as any[])[2]("A"))
    log.push((view.latest() as any[])[0])
    env.act(() => (view.latest() as any[])[1](false))
    log.push((view.latest() as any[])[0])
    return { log }
})

scenario("selectors/evaluation is cached per dependency values", differs(
    "Valdres memoizes the latest dependency values only, like Recoil's `most-recent` cache policy. Returning to earlier dependency values re-evaluates the getter and yields a new result reference.",
    { evaluations: 3, sameReferenceOnReturn: false, values: [2, 4, 2] },
), env => {
    const { lib } = env
    const a = lib.atom({ key: "selectors/cache-a", default: 1 })
    let evaluations = 0
    const s = lib.selector({
        key: "selectors/cache",
        get: ({ get }: any) => {
            evaluations++
            return { doubled: get(a) * 2 }
        },
    })
    const view = probe(env, () => [lib.useRecoilValue(s), lib.useSetRecoilState(a)])
    const first = (view.latest() as any[])[0]
    env.act(() => (view.latest() as any[])[1](2))
    const second = (view.latest() as any[])[0]
    env.act(() => (view.latest() as any[])[1](1))
    const third = (view.latest() as any[])[0]
    return {
        evaluations,
        sameReferenceOnReturn: first === third,
        values: [first.doubled, second.doubled, third.doubled],
    }
})

scenario("selectors/equal results do not re-render", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "selectors/parity-a", default: 1 })
    const parity = lib.selector({ key: "selectors/parity", get: ({ get }: any) => get(a) % 2 })
    let set: any
    const view = probe(env, () => {
        set = lib.useSetRecoilState(a)
        return lib.useRecoilValue(parity)
    })
    const counts = [view.values.length]
    env.act(() => set(3))
    counts.push(view.values.length)
    env.act(() => set(4))
    counts.push(view.values.length)
    return { counts, value: view.latest() }
})

scenario("selectors/one render per change across several reads", match, env => {
    const { lib, React } = env
    const h = React.createElement
    const a = lib.atom({ key: "selectors/multi-a", default: 0 })
    const plus = lib.selector({ key: "selectors/multi", get: ({ get }: any) => get(a) + 1 })
    let commits = 0
    let set: any
    const Component = () => {
        lib.useRecoilValue(a)
        lib.useRecoilValue(plus)
        lib.useRecoilState(a)
        set = lib.useSetRecoilState(a)
        return null
    }
    env.render(
        h(lib.RecoilRoot, null, h(React.Profiler, { id: "p", onRender: () => commits++ }, h(Component))),
    )
    const before = commits
    env.act(() => set(1))
    const after = commits
    env.act(() => set(2))
    return { perChange: [after - before, commits - after] }
})

scenario("selectors/async get suspends", refused("async selectors"), env => {
    const { lib, React } = env
    const h = React.createElement
    const s = lib.selector({ key: "selectors/async", get: () => new Promise(() => {}) })
    const { Boundary, caught } = errorBoundary(env)
    const Reader = () => h("b", null, String(lib.useRecoilValue(s)))
    const { container } = env.render(
        h(lib.RecoilRoot, null, h(Boundary, null, h(React.Suspense, { fallback: "pending" }, h(Reader)))),
    )
    if (caught.length) throw caught[0]
    return { text: container.textContent }
})

scenario("selectors/thrown Promise suspends", refused("async selectors"), env => {
    const { lib } = env
    const s = lib.selector({
        key: "selectors/thrown-promise",
        get: () => {
            throw new Promise(() => {})
        },
    })
    const view = probe(env, () =>
        lib.useRecoilCallback(({ snapshot }: any) => () => snapshot.getLoadable(s).state),
    )
    let state: unknown
    env.act(() => (state = (view.latest() as any)()))
    return { state }
})

scenario("selectors/a getter catching a pending dependency", refused("async selectors"), env => {
    const { lib } = env
    const pending = lib.selector({ key: "selectors/caught-pending", get: () => new Promise(() => {}) })
    const s = lib.selector({
        key: "selectors/caught",
        get: ({ get }: any) => {
            try {
                return get(pending)
            } catch {
                return "fallback"
            }
        },
    })
    const view = probe(env, () =>
        lib.useRecoilCallback(({ snapshot }: any) => () => snapshot.getLoadable(s).contents),
    )
    let contents: unknown
    env.act(() => (contents = (view.latest() as any)()))
    return { contents }
})

scenario("selectors/getCallback", refused("selector getCallback"), env => {
    const { lib } = env
    const s = lib.selector({
        key: "selectors/getCallback",
        get: ({ getCallback }: any) => getCallback(() => () => "called"),
    })
    let value: any
    const { Boundary, caught } = errorBoundary(env)
    const h = env.React.createElement
    const Reader = () => ((value = lib.useRecoilValue(s)), null)
    env.render(h(lib.RecoilRoot, null, h(Boundary, null, h(Reader))))
    if (caught.length) throw caught[0]
    return { type: typeof value }
})

// --- Errors ------------------------------------------------------------------

scenario("errors/boundaries receive the thrown value", match, env => {
    const { lib, React } = env
    const h = React.createElement
    const thrown = new Error("selector failed")
    const failing = lib.selector({ key: "errors/failing", get: () => { throw thrown } })
    const dependent = lib.selector({ key: "errors/dependent", get: ({ get }: any) => get(failing) })
    const { Boundary, caught } = errorBoundary(env)
    const Reader = () => (lib.useRecoilValue(dependent), null)
    captureConsole(() => env.render(h(lib.RecoilRoot, null, h(Boundary, null, h(Reader)))))
    return { caughtSame: caught[0] === thrown, count: caught.length > 0 }
})

scenario("errors/getters may catch dependency errors", match, env => {
    const { lib } = env
    const thrown = new Error("dependency failed")
    const failing = lib.selector({ key: "errors/catch-failing", get: () => { throw thrown } })
    const recovering = lib.selector({
        key: "errors/catch",
        get: ({ get }: any) => {
            try {
                return get(failing)
            } catch (error) {
                return error === thrown ? "recovered original" : "recovered wrapper"
            }
        },
    })
    const view = probe(env, () => lib.useRecoilValue(recovering))
    return { value: view.latest() }
})

// --- Families ------------------------------------------------------------------

const PARAM_PAIRS: readonly [string, () => unknown, () => unknown][] = [
    ["object key order", () => ({ a: 1, b: 2 }), () => ({ b: 2, a: 1 })],
    ["nested arrays", () => [1, [2, 3]], () => [1, [2, 3]]],
    ["array order", () => [1, 2], () => [2, 1]],
    ["number vs string", () => 1, () => "1"],
    ["undefined vs null", () => undefined, () => null],
    ["undefined vs empty string", () => undefined, () => ""],
    ["undefined property dropped", () => ({ a: 1, b: undefined }), () => ({ a: 1 })],
    ["signed zero", () => 0, () => -0],
    ["NaN", () => Number.NaN, () => Number.NaN],
    ["Infinity vs string", () => Number.POSITIVE_INFINITY, () => "Infinity"],
    ["true vs string", () => true, () => "true"],
    ["Set order", () => new Set([1, 2]), () => new Set([2, 1])],
    ["Map order", () => new Map([["a", 1], ["b", 2]]), () => new Map([["b", 2], ["a", 1]])],
    ["Map vs object", () => new Map([["a", 1]]), () => ({ a: 1 })],
    ["Date with same time", () => new Date(0), () => new Date(0)],
    ["Date vs ISO string", () => new Date(0), () => new Date(0).toISOString()],
    ["Symbol same description", () => Symbol.for("x"), () => Symbol("x")],
    ["string with quote", () => 'a"b', () => 'a"b'],
    ["toJSON override", () => ({ toJSON: () => "same" }), () => "same"],
]

scenario("families/atomFamily parameter identity", match, ({ lib }) => {
    const family = lib.atomFamily({ key: "families/identity", default: 0 })
    return Object.fromEntries(
        PARAM_PAIRS.map(([label, left, right]) => [label, family(left()) === family(right())]),
    )
})

scenario("families/selectorFamily parameter identity", match, ({ lib }) => {
    const family = lib.selectorFamily({ key: "families/sel-identity", get: () => () => 0 })
    return Object.fromEntries(
        PARAM_PAIRS.map(([label, left, right]) => [label, family(left()) === family(right())]),
    )
})

scenario("families/unserializable parameters", match, ({ lib }) => {
    const atoms = lib.atomFamily({ key: "families/bad-atom", default: 0 })
    const selectors = lib.selectorFamily({ key: "families/bad-selector", get: () => () => 0 })
    const fn = function namedParam() {}
    return {
        atomFunction: "threw" in (attempt(() => atoms(fn)) as object),
        selectorFunction: "threw" in (attempt(() => selectors(fn)) as object),
        atomBigInt: "threw" in (attempt(() => atoms(1n)) as object),
    }
})

scenario("families/reference equality policy", match, ({ lib }) => {
    const family = lib.atomFamily({
        key: "families/reference",
        default: 0,
        cachePolicyForParams_UNSTABLE: { equality: "reference" },
    })
    const param = { a: 1 }
    const fn = () => {}
    const selectors = lib.selectorFamily({
        key: "families/reference-selector",
        get: () => () => 0,
        cachePolicyForParams_UNSTABLE: { equality: "reference" },
    })
    return {
        sameObject: family(param) === family(param),
        equalObject: family(param) === family({ a: 1 }),
        functionParam: selectors(fn) === selectors(fn),
    }
})

scenario("families/member keys", match, ({ lib }) => {
    const atoms = lib.atomFamily({ key: "families/keys", default: 0 })
    const selectors = lib.selectorFamily({ key: "families/sel-keys", get: () => () => 0 })
    return {
        atoms: [atoms({ b: 1, a: [1, "x"] }).key, atoms(undefined).key, atoms("s").key],
        selectors: [/^families\/sel-keys__selectorFamily\/\{"a":1\}\/\d+$/.test(selectors({ a: 1 }).key)],
    }
})

scenario("families/defaults per parameter", match, env => {
    const { lib } = env
    const base = lib.atom({ key: "families/default-base", default: 100 })
    const fromParam = lib.atomFamily({ key: "families/from-param", default: (p: { n: number }) => p.n * 2 })
    const fromValue = lib.atomFamily({ key: "families/from-value", default: "static" })
    const fromRecoilValue = lib.atomFamily({ key: "families/from-rv", default: base })
    const fromParamRecoilValue = lib.atomFamily({
        key: "families/from-param-rv",
        default: lib.selectorFamily({ key: "families/default-sel", get: (n: number) => ({ get }: any) => get(base) + n }),
    })
    const view = probe(env, () => [
        lib.useRecoilValue(fromParam({ n: 2 })),
        lib.useRecoilValue(fromValue(1)),
        lib.useRecoilValue(fromRecoilValue(1)),
        lib.useRecoilValue(fromParamRecoilValue(5)),
        lib.useSetRecoilState(base),
        lib.useSetRecoilState(fromParam({ n: 2 })),
        lib.useRecoilValue(fromParam({ n: 3 })),
    ])
    const before = (view.latest() as any[]).filter(v => typeof v !== "function")
    env.act(() => {
        ;(view.latest() as any[])[4](200)
        ;(view.latest() as any[])[5](-1)
    })
    return { before, after: (view.latest() as any[]).filter(v => typeof v !== "function") }
})

scenario("families/writable selectorFamily", match, env => {
    const { lib } = env
    const store = lib.atomFamily({ key: "families/store", default: 0 })
    const doubled = lib.selectorFamily({
        key: "families/doubled",
        get: (id: string) => ({ get }: any) => get(store(id)) * 2,
        set: (id: string) => ({ set }: any, value: any) =>
            set(store(id), value instanceof lib.DefaultValue ? value : value / 2),
    })
    const view = probe(env, () => [
        lib.useRecoilValue(doubled("x")),
        lib.useRecoilValue(doubled("y")),
        lib.useSetRecoilState(doubled("x")),
        lib.useResetRecoilState(doubled("x")),
    ])
    env.act(() => (view.latest() as any[])[2](10))
    const set = (view.latest() as any[]).slice(0, 2)
    env.act(() => (view.latest() as any[])[3]())
    return { set, reset: (view.latest() as any[]).slice(0, 2) }
})

scenario("families/atomFamily effects", refused("atom effects"), ({ lib }) =>
    lib.atomFamily({ key: "families/effects", default: 0, effects: () => [() => {}] })(1).key,
)

// --- RecoilRoot -----------------------------------------------------------------

scenario("root/hooks outside RecoilRoot throw", match, env => {
    const { lib, React } = env
    const a = lib.atom({ key: "root/outside", default: 0 })
    const { Boundary, caught } = errorBoundary(env)
    const Reader = () => (lib.useRecoilValue(a), null)
    captureConsole(() => env.render(React.createElement(Boundary, null, React.createElement(Reader))))
    return { threw: caught.length > 0, mentionsRoot: String((caught[0] as Error)?.message).includes("<RecoilRoot>") }
})

scenario("root/initializeState writes are readable and committed", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "root/init-a", default: "default" })
    const b = lib.atom({ key: "root/init-b", default: "default-b" })
    const upper = lib.selector({ key: "root/init-upper", get: ({ get }: any) => String(get(a)).toUpperCase() })
    const reads: unknown[] = []
    let calls = 0
    const view = probe(env, () => [lib.useRecoilValue(a), lib.useRecoilValue(b), lib.useRecoilValue(upper)], {
        initializeState: (snapshot: any) => {
            calls++
            reads.push(snapshot.getLoadable(a).contents)
            snapshot.set(a, "initialized")
            snapshot.set(b, "set")
            snapshot.reset(b)
            snapshot.set(a, (prev: string) => `${prev}!`)
            reads.push(snapshot.getLoadable(a).contents, snapshot.getLoadable(upper).contents)
        },
    })
    return { reads, rendered: view.latest(), calls }
})

scenario("root/initializeState runs once per root", match, env => {
    const { lib, React } = env
    const h = React.createElement
    const a = lib.atom({ key: "root/once", default: 0 })
    let calls = 0
    let value: unknown
    const Reader = () => ((value = lib.useRecoilValue(a)), null)
    const view = env.render(
        h(lib.RecoilRoot, { initializeState: ({ set }: any) => (calls++, set(a, 1)) }, h(Reader)),
    )
    view.rerender(h(lib.RecoilRoot, { initializeState: ({ set }: any) => (calls++, set(a, 2)) }, h(Reader)))
    return { calls, value }
})

scenario("root/nested roots and override", match, env => {
    const { lib, React } = env
    const h = React.createElement
    const a = lib.atom({ key: "root/nested", default: "default" })
    const seen: Record<string, unknown> = {}
    const Reader = ({ id }: { id: string }) => ((seen[id] = lib.useRecoilValue(a)), null)
    env.render(
        h(
            lib.RecoilRoot,
            { initializeState: ({ set }: any) => set(a, "outer") },
            h(Reader, { id: "outer" }),
            h(lib.RecoilRoot, null, h(Reader, { id: "overrideDefault" })),
            h(lib.RecoilRoot, { override: true }, h(Reader, { id: "overrideTrue" })),
            h(lib.RecoilRoot, { override: false }, h(Reader, { id: "overrideFalse" })),
        ),
    )
    return seen
})

scenario("root/remounting a root starts from defaults", match, env => {
    const { lib, React } = env
    const h = React.createElement
    const a = lib.atom({ key: "root/remount", default: 0 })
    let state: any
    const Reader = () => ((state = lib.useRecoilState(a)), null)
    const view = env.render(h(lib.RecoilRoot, { key: 1 }, h(Reader)))
    env.act(() => state[1](5))
    const before = state[0]
    view.rerender(h(lib.RecoilRoot, { key: 2 }, h(Reader)))
    return { before, after: state[0] }
})

scenario("root/separate roots are isolated", match, env => {
    const { lib, React } = env
    const h = React.createElement
    const a = lib.atom({ key: "root/isolated", default: 0 })
    const states: any = {}
    const Reader = ({ id }: { id: string }) => ((states[id] = lib.useRecoilState(a)), null)
    env.render(
        h(React.Fragment, null, h(lib.RecoilRoot, null, h(Reader, { id: "a" })), h(lib.RecoilRoot, null, h(Reader, { id: "b" }))),
    )
    env.act(() => states.a[1](1))
    return { a: states.a[0], b: states.b[0] }
})

scenario("root/StrictMode", match, env => {
    const { lib, React } = env
    const h = React.createElement
    const a = lib.atom({ key: "root/strict", default: 0 })
    let calls = 0
    let state: any
    let cb: any
    const Reader = () => {
        state = lib.useRecoilState(a)
        cb = lib.useRecoilCallback(({ snapshot, set }: any) => () => {
            set(a, (n: number) => n + 1)
            return snapshot.getLoadable(a).contents
        }, [])
        return h("b", null, String(state[0]))
    }
    const { container } = env.render(
        h(React.StrictMode, null, h(lib.RecoilRoot, { initializeState: ({ set }: any) => (calls++, set(a, 10)) }, h(Reader))),
    )
    const initial = container.textContent
    env.act(() => state[1]((n: number) => n + 1))
    let returned: unknown
    env.act(() => (returned = cb()))
    return { initial, final: container.textContent, returned, initializedAtLeastOnce: calls >= 1 }
})

scenario("root/server rendering", match, env => {
    const { lib, React } = env
    const h = React.createElement
    const a = lib.atom({ key: "root/ssr", default: "default" })
    const s = lib.selector({ key: "root/ssr-sel", get: ({ get }: any) => `${get(a)}!` })
    const Reader = () => h("b", null, `${lib.useRecoilValue(a)} ${lib.useRecoilValue(s)}`)
    return {
        plain: env.renderToString(h(lib.RecoilRoot, null, h(Reader))),
        initialized: env.renderToString(
            h(lib.RecoilRoot, { initializeState: ({ set }: any) => set(a, "server") }, h(Reader)),
        ),
    }
})

// --- useRecoilCallback ------------------------------------------------------------

scenario("callback/snapshot is frozen at call, writes apply at the end", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "callback/frozen", default: 0 })
    const s = lib.selector({ key: "callback/frozen-sel", get: ({ get }: any) => get(a) * 10 })
    const view = probe(env, () => [
        lib.useRecoilValue(a),
        lib.useRecoilCallback((iface: any) => () => {
            const snapshot = iface.snapshot
            iface.set(a, 1)
            iface.set(a, (n: number) => n + 1)
            return [snapshot.getLoadable(a).contents, iface.snapshot.getLoadable(s).contents]
        }),
    ])
    let returned: unknown
    env.act(() => (returned = (view.latest() as any[])[1]()))
    return { returned, value: (view.latest() as any[])[0] }
})

scenario("callback/lazy snapshot after set still excludes queued writes", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "callback/lazy", default: "before" })
    let value: unknown
    const view = probe(env, () => {
        value = lib.useRecoilValue(a)
        return lib.useRecoilCallback((iface: any) => () => {
            iface.set(a, "after")
            return iface.snapshot.getLoadable(a).contents
        })
    })
    let returned: unknown
    env.act(() => (returned = (view.latest() as any)()))
    return { returned, value }
})

scenario("callback/hook setters inside a callback join its batch", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "callback/hook-batch", default: 0 })
    let setter: any
    const view = probe(env, () => {
        setter = lib.useSetRecoilState(a)
        return [
            lib.useRecoilValue(a),
            lib.useRecoilCallback(({ snapshot }: any) => () => {
                setter(5)
                setter((n: number) => n + 1)
                return snapshot.getLoadable(a).contents
            }),
        ]
    })
    let returned: unknown
    const commits = view.values.length
    env.act(() => (returned = (view.latest() as any[])[1]()))
    return { returned, value: (view.latest() as any[])[0], renders: view.values.length - commits }
})

scenario("callback/nested callbacks apply in Recoil batch order", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "callback/nested", default: "" })
    let inner: any
    const view = probe(env, () => {
        inner = lib.useRecoilCallback(({ set, snapshot }: any) => (tag: string) => {
            set(a, (s: string) => `${s}${tag}`)
            return snapshot.getLoadable(a).contents
        })
        return [
            lib.useRecoilValue(a),
            lib.useRecoilCallback(({ set, snapshot }: any) => () => {
                const before = snapshot.getLoadable(a).contents
                set(a, (s: string) => `${s}outer;`)
                const innerSaw = inner("inner1;")
                const innerSaw2 = inner("inner2;")
                return [before, innerSaw, innerSaw2]
            }),
        ]
    })
    let returned: unknown
    env.act(() => (returned = (view.latest() as any[])[1]()))
    return { returned, value: (view.latest() as any[])[0] }
})

scenario(
    "callback/snapshot read after writes applied during the callback",
    refused("snapshot after nested writes"),
    env => {
        const { lib } = env
        const a = lib.atom({ key: "callback/late-snapshot", default: "" })
        let inner: any
        const view = probe(env, () => {
            inner = lib.useRecoilCallback(({ set }: any) => () => set(a, "inner"))
            return lib.useRecoilCallback(({ snapshot }: any) => () => {
                inner()
                return snapshot.getLoadable(a).contents
            })
        })
        let returned: unknown
        env.act(() => (returned = (view.latest() as any)()))
        return { returned }
    },
)

scenario("callback/throwing keeps queued writes and rethrows", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "callback/throw", default: 0 })
    const thrown = new Error("callback failed")
    const view = probe(env, () => [
        lib.useRecoilValue(a),
        lib.useRecoilCallback(({ set }: any) => () => {
            set(a, 1)
            throw thrown
        }),
    ])
    let caughtSame = false
    env.act(() => {
        try {
            ;(view.latest() as any[])[1]()
        } catch (error) {
            caughtSame = error === thrown
        }
    })
    return { caughtSame, value: (view.latest() as any[])[0] }
})

scenario("callback/a failing queued write discards the batch", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "callback/bad-write", default: 0 })
    const readonly = lib.selector({ key: "callback/bad-write-ro", get: () => 0 })
    const view = probe(env, () => [
        lib.useRecoilValue(a),
        lib.useRecoilCallback(({ set }: any) => () => {
            set(a, 1)
            set(readonly, 1)
            return "returned"
        }),
    ])
    let outcome: unknown
    env.act(() => {
        try {
            outcome = (view.latest() as any[])[1]()
        } catch {
            outcome = "threw"
        }
    })
    return { outcome, value: (view.latest() as any[])[0] }
})

scenario("callback/an outer batch failure keeps writes already applied", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "callback/kept-a", default: "" })
    const b = lib.atom({ key: "callback/kept-b", default: "" })
    const failing = lib.selector({
        key: "callback/kept-failing",
        get: () => 0,
        set: () => {
            throw new Error("set failed")
        },
    })
    const view = probe(env, () => {
        const inner = lib.useRecoilCallback(({ set }: any) => () => set(a, "inner"))
        return [
            lib.useRecoilValue(a),
            lib.useRecoilValue(b),
            lib.useRecoilCallback(({ set, transact_UNSTABLE }: any) => () => {
                inner()
                transact_UNSTABLE(({ set }: any) => set(b, "transact"))
                set(a, "outer")
                set(failing, 1)
            }),
        ]
    })
    let threw = false
    env.act(() => {
        try {
            ;(view.latest() as any[])[2]()
        } catch {
            threw = true
        }
    })
    return { threw, values: (view.latest() as any[]).slice(0, 2) }
})

const twoRoots = (env: DifferentialEnv, first: () => unknown, second: () => unknown) => {
    const h = env.React.createElement
    const values: [unknown[], unknown[]] = [[], []]
    const First = () => (values[0].push(first()), null)
    const Second = () => (values[1].push(second()), null)
    env.render(
        h("div", null, h(env.lib.RecoilRoot, null, h(First)), h(env.lib.RecoilRoot, null, h(Second))),
    )
    return {
        first: () => values[0][values[0].length - 1] as any,
        second: () => values[1][values[1].length - 1] as any,
    }
}

scenario("callback/calling another root's callback", match, env => {
    const { lib } = env
    const x = lib.atom({ key: "callback/other-root", default: 0 })
    let other: any
    const roots = twoRoots(
        env,
        () => [
            lib.useRecoilValue(x),
            lib.useRecoilCallback(({ set }: any) => () => {
                set(x, 7)
                other()
                return "ok"
            }),
        ],
        () => {
            other = lib.useRecoilCallback(({ set }: any) => () => set(x, 5))
            return lib.useRecoilValue(x)
        },
    )
    let returned: unknown
    env.act(() => (returned = roots.first()[1]()))
    return { returned, first: roots.first()[0], second: roots.second() }
})

scenario(
    "callback/another root's snapshot inside a callback",
    refused("snapshot of another root inside a callback"),
    env => {
        const { lib } = env
        const x = lib.atom({ key: "callback/other-snapshot", default: 3 })
        let read: any
        const roots = twoRoots(
            env,
            () => lib.useRecoilCallback(() => () => read()),
            () => {
                read = lib.useRecoilCallback(({ snapshot }: any) => () => snapshot.getLoadable(x).contents)
                return null
            },
        )
        let returned: unknown
        env.act(() => (returned = roots.first()()))
        return { returned }
    },
)

scenario("callback/identity follows deps", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "callback/identity", default: 0 })
    let set: any
    const withoutDeps = probe(env, () => {
        set = lib.useSetRecoilState(a)
        lib.useRecoilValue(a)
        return [lib.useRecoilCallback(() => () => 0), lib.useRecoilCallback(() => () => 0, [])]
    })
    env.act(() => set(1))
    const renders = withoutDeps.values as any[][]
    return {
        renders: renders.length,
        noDepsStable: renders.every(r => r[0] === renders[0]![0]),
        emptyDepsStable: renders.every(r => r[1] === renders[0]![1]),
    }
})

scenario("callback/arguments, return value and reset", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "callback/args", default: "default" })
    const view = probe(env, () => [
        lib.useRecoilValue(a),
        lib.useRecoilCallback(({ set, reset }: any) => (value: string, shouldReset: boolean) => {
            if (shouldReset) reset(a)
            else set(a, value)
            return `${value}:${shouldReset}`
        }),
    ])
    const returns: unknown[] = []
    env.act(() => returns.push((view.latest() as any[])[1]("x", false)))
    const set = (view.latest() as any[])[0]
    env.act(() => returns.push((view.latest() as any[])[1]("y", true)))
    return { returns, set, reset: (view.latest() as any[])[0] }
})

scenario(
    "callback/writable selector inside a callback",
    differs(
        "Recoil invalidates selector caches only after a whole batch, so the second write's updater receives the selector's value from before the batch (2, giving 4). Valdres recomputes the selector from the first write (10, giving 12).",
        { value: 12 },
    ),
    env => {
    const { lib } = env
    const a = lib.atom({ key: "callback/sel-a", default: 1 })
    const s = lib.selector({
        key: "callback/sel",
        get: ({ get }: any) => get(a) * 2,
        set: ({ set }: any, v: number) => set(a, v / 2),
    })
    const view = probe(env, () => [
        lib.useRecoilValue(s),
        lib.useRecoilCallback(({ set }: any) => () => {
            set(s, 10)
            set(s, (prev: number) => prev + 2)
        }),
    ])
    env.act(() => (view.latest() as any[])[1]())
    return { value: (view.latest() as any[])[0] }
})

scenario("callback/transact_UNSTABLE reads its own writes", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "callback/transact", default: 1 })
    const seen: unknown[] = []
    const view = probe(env, () => [
        lib.useRecoilValue(a),
        lib.useRecoilCallback(({ transact_UNSTABLE, snapshot }: any) => () => {
            const before = snapshot.getLoadable(a).contents
            transact_UNSTABLE(({ get, set, reset }: any) => {
                set(a, 5)
                seen.push(get(a))
                reset(a)
                seen.push(get(a))
                set(a, (n: number) => n + 10)
                seen.push(get(a))
            })
            return before
        }),
    ])
    let returned: unknown
    env.act(() => (returned = (view.latest() as any[])[1]()))
    return { seen, returned, value: (view.latest() as any[])[0] }
})

scenario("callback/snapshot loadables", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "callback/loadable", default: 7 })
    const thrown = new Error("loadable failed")
    const failing = lib.selector({ key: "callback/loadable-failing", get: () => { throw thrown } })
    let out: any
    const view = probe(env, () =>
        lib.useRecoilCallback(({ snapshot }: any) => () => {
            const value = snapshot.getLoadable(a)
            const error = snapshot.getLoadable(failing)
            out = {
                value: {
                    state: value.state,
                    contents: value.contents,
                    getValue: value.getValue(),
                    valueMaybe: value.valueMaybe(),
                    valueOrThrow: value.valueOrThrow(),
                    errorMaybe: value.errorMaybe(),
                    promiseMaybe: value.promiseMaybe(),
                    mapped: value.map((n: number) => n + 1).contents,
                    is: value.is(snapshot.getLoadable(a)),
                },
                error: {
                    state: error.state,
                    contentsSame: error.contents === thrown,
                    errorMaybeSame: error.errorMaybe() === thrown,
                    valueMaybe: error.valueMaybe(),
                    getValueThrowsSame: (() => {
                        try {
                            error.getValue()
                            return false
                        } catch (e) {
                            return e === thrown
                        }
                    })(),
                    mappedState: error.map(() => 1).state,
                },
                promise: snapshot.getPromise(a),
            }
        }),
    )
    env.act(() => (view.latest() as any)())
    return out.promise.then((resolved: unknown) => ({ ...out, promise: resolved }))
})

scenario("callback/async set after await applies immediately", match, async env => {
    const { lib } = env
    const a = lib.atom({ key: "callback/async-set", default: 0 })
    let resume!: () => void
    const gate = new Promise<void>(resolve => (resume = resolve))
    const view = probe(env, () => [
        lib.useRecoilValue(a),
        lib.useRecoilCallback(({ set }: any) => async () => {
            set(a, 1)
            await gate
            set(a, 2)
            return "done"
        }),
    ])
    let promise: Promise<unknown> = Promise.resolve()
    env.act(() => {
        promise = (view.latest() as any[])[1]()
    })
    const mid = (view.latest() as any[])[0]
    let result: unknown
    await env.act(async () => {
        resume()
        result = await promise
    })
    return { mid, result, final: (view.latest() as any[])[0] }
})

scenario("callback/snapshot read after await", refused("snapshot after synchronous phase"), async env => {
    const { lib } = env
    const a = lib.atom({ key: "callback/async-snapshot", default: "before" })
    const view = probe(env, () => [
        lib.useRecoilValue(a),
        lib.useSetRecoilState(a),
        lib.useRecoilCallback(({ snapshot }: any) => async () => {
            await Promise.resolve()
            return snapshot.getLoadable(a).contents
        }),
    ])
    let promise: Promise<unknown> = Promise.resolve()
    env.act(() => {
        promise = (view.latest() as any[])[2]()
        ;(view.latest() as any[])[1]("after")
    })
    let result: unknown
    await env.act(async () => {
        result = await promise
    })
    return { result }
})

scenario("callback/refresh", refused("refresh"), env => {
    const { lib } = env
    const s = lib.selector({ key: "callback/refresh", get: () => 1 })
    const view = probe(env, () => lib.useRecoilCallback(({ refresh }: any) => () => refresh(s)))
    env.act(() => (view.latest() as any)())
    return "refreshed"
})

scenario("callback/gotoSnapshot", refused("gotoSnapshot"), env => {
    const { lib } = env
    const view = probe(env, () =>
        lib.useRecoilCallback(({ snapshot, gotoSnapshot }: any) => () => gotoSnapshot(snapshot)),
    )
    env.act(() => (view.latest() as any)())
    return "went"
})

scenario("callback/snapshot retain", refused("snapshot retain"), env => {
    const { lib } = env
    const view = probe(env, () => lib.useRecoilCallback(({ snapshot }: any) => () => snapshot.retain()))
    let release: any
    env.act(() => (release = (view.latest() as any)()))
    release()
    return "retained"
})

// --- Effects ------------------------------------------------------------------------

scenario("atoms/effects", refused("atom effects"), env => {
    const { lib } = env
    const a = lib.atom({
        key: "atoms/effects",
        default: "default",
        effects: [({ setSelf }: any) => setSelf("from effect")],
    })
    return { value: probe(env, () => lib.useRecoilValue(a)).latest() }
})

scenario("atoms/effects_UNSTABLE", refused("atom effects"), ({ lib }) =>
    lib.atom({ key: "atoms/effects-unstable", default: 0, effects_UNSTABLE: [() => {}] }).key,
)

scenario("atoms/empty effect lists", match, env => {
    const { lib } = env
    const a = lib.atom({ key: "atoms/no-effects", default: 1, effects: [] })
    const f = lib.atomFamily({ key: "atoms/no-effects-family", default: 2, effects: () => [] })
    return probe(env, () => [lib.useRecoilValue(a), lib.useRecoilValue(f(1))]).latest()
})

scenario("atoms/isRecoilValue", match, ({ lib }) => {
    const a = lib.atom({ key: "atoms/is", default: 0 })
    const s = lib.selector({ key: "atoms/is-sel", get: () => 0 })
    const f = lib.atomFamily({ key: "atoms/is-fam", default: 0 })
    return [a, s, f(1), {}, null, a.key, () => {}].map(x => lib.isRecoilValue(x))
})

export const scenarios: readonly Scenario[] = scenarioList
