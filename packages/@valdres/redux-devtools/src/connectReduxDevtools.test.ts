import { afterEach, describe, expect, mock, test } from "bun:test"
import { atom, atomFamily, selector, selectorFamily, store } from "valdres"
import { connectReduxDevtools } from "./connectReduxDevtools"
import type {
    ReduxDevtoolsConnection,
    ReduxDevtoolsExtension,
    ReduxDevtoolsMessage,
} from "./types/ReduxDevtools"

const makeFakeExtension = () => {
    const inits: unknown[] = []
    const sent: {
        action: ({ type: string } & Record<string, unknown>) | null
        state: any
    }[] = []
    const errors: string[] = []
    let messageListener: ((m: ReduxDevtoolsMessage) => void) | undefined
    let connectOptions: { name?: string; features?: any } | undefined
    let disconnected = false

    const connection: ReduxDevtoolsConnection = {
        init: state => inits.push(state),
        send: (action, state) => sent.push({ action, state }),
        subscribe: listener => {
            messageListener = listener
            return () => {
                messageListener = undefined
            }
        },
        unsubscribe: () => {},
        error: message => errors.push(message),
    }

    const ext: ReduxDevtoolsExtension = {
        connect: options => {
            connectOptions = options
            return connection
        },
        disconnect: () => {
            disconnected = true
        },
    }

    return {
        ext,
        inits,
        sent,
        errors,
        dispatch: (message: ReduxDevtoolsMessage) => messageListener?.(message),
        connectOptions: () => connectOptions,
        wasDisconnected: () => disconnected,
    }
}

const install = (ext?: ReduxDevtoolsExtension) => {
    ;(window as any).__REDUX_DEVTOOLS_EXTENSION__ = ext
}

afterEach(() => {
    delete (window as any).__REDUX_DEVTOOLS_EXTENSION__
})

describe("connectReduxDevtools", () => {
    test("a non-enumerable store seeds an empty timeline", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store() // default: not enumerable
        const a = atom(0, { name: "empty_a" })
        s.set(a, 1) // pre-existing, but not enumerable → not seeded
        const handle = connectReduxDevtools(s, { name: "my-app" })

        expect(fake.connectOptions()?.name).toBe("my-app")
        expect(fake.inits).toHaveLength(1)
        expect(Object.keys(fake.inits[0] as object)).toHaveLength(0)
        handle.disconnect()
    })

    test("seeds the initial snapshot from an enumerable store", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store("seed_root", { enumerable: true })
        const a = atom(0, { name: "seed_a" })
        const b = atom("x", { name: "seed_b" })
        s.set(a, 5)
        s.set(b, "y")
        const scoped = s.scope("sess")
        const c = atom(0, { name: "seed_c" })
        scoped.set(c, 9)

        const handle = connectReduxDevtools(s)

        const init = fake.inits[0] as any
        expect(init.seed_a).toBe(5)
        expect(init.seed_b).toBe("y")
        expect(init["@scopes"].sess.seed_c).toBe(9)
        handle.disconnect()
        scoped.detach()
    })

    test("seeds derived state from an enumerable store when selectors are on", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store("seed_sel_root", { enumerable: true })
        const a = atom(2, { name: "ssa" })
        const double = selector(get => get(a) * 2, { name: "ssDouble" })
        s.sub(double, () => {}) // live + materialized
        s.set(a, 3)

        const handle = connectReduxDevtools(s, { selectors: true })

        const init = fake.inits[0] as any
        expect(init.ssa).toBe(3)
        expect(init["@computed"].ssDouble).toBe(6)
        handle.disconnect()
    })

    test("sends an action with the new value when a named atom is set", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const a = atom(0, { name: "ct_set_count" })
        const handle = connectReduxDevtools(s)

        s.set(a, 42)

        const last = fake.sent.at(-1)!
        expect(last.action.type).toBe("ct_set_count")
        expect(last.action.source).toBe("set")
        expect(last.state.ct_set_count).toBe(42)
        handle.disconnect()
    })

    test("reset is tagged distinctly from a set", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const a = atom(7, { name: "ct_reset" })
        const handle = connectReduxDevtools(s)

        s.set(a, 1)
        s.reset(a)

        const last = fake.sent.at(-1)!
        expect(last.action.type).toBe("ct_reset (reset)")
        expect(last.state.ct_reset).toBe(7)
        handle.disconnect()
    })

    test("a named transaction uses its name as the action label", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const a = atom(0, { name: "tx_a" })
        const b = atom(0, { name: "tx_b" })
        const handle = connectReduxDevtools(s)

        s.txn(t => {
            t.set(a, 1)
            t.set(b, 2)
        }, "init-user")

        const last = fake.sent.at(-1)!
        expect(last.action.type).toBe("init-user")
        expect(last.action.name).toBe("init-user")
        expect(last.state.tx_a).toBe(1)
        expect(last.state.tx_b).toBe(2)
        handle.disconnect()
    })

    test("an unnamed transaction reads txn (N atoms)", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const a = atom(0, { name: "ut_a" })
        const b = atom(0, { name: "ut_b" })
        const handle = connectReduxDevtools(s)

        s.txn(t => {
            t.set(a, 1)
            t.set(b, 2)
        })

        const last = fake.sent.at(-1)!
        expect(last.action.type).toBe("txn (2 atoms)")
        expect(last.action.atoms).toEqual(["ut_a", "ut_b"])
        handle.disconnect()
    })

    test("scope writes read @scope:path and nest under @scopes", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store("scope_root")
        const a = atom(0, { name: "sc_atom" })
        const handle = connectReduxDevtools(s)

        const scoped = s.scope("sessionA")
        scoped.set(a, 7)

        const last = fake.sent.at(-1)!
        expect(last.action.type).toBe("@scope:sessionA sc_atom")
        expect(last.action.atoms).toEqual(["sessionA/sc_atom"])
        expect(last.state["@scopes"].sessionA.sc_atom).toBe(7)
        handle.disconnect()
        scoped.detach()
    })

    test("a cross-scope txn coalesces into a single action", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store("xs_root")
        const r = atom(0, { name: "xs_r" })
        const sc = atom(0, { name: "xs_sc" })
        const handle = connectReduxDevtools(s)
        const scoped = s.scope("sessionC")

        const before = fake.sent.length
        s.txn(t => {
            t.set(r, 1)
            t.scope("sessionC", st => st.set(sc, 2))
        })

        const newActions = fake.sent.slice(before)
        expect(newActions).toHaveLength(1)
        expect(newActions[0].action.type).toBe("txn (2 atoms · root, sessionC)")
        expect(newActions[0].state.xs_r).toBe(1)
        expect(newActions[0].state["@scopes"].sessionC.xs_sc).toBe(2)
        handle.disconnect()
        scoped.detach()
    })

    test("unset drops a scope override and the scope re-inherits", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store("un_root")
        const a = atom("light", { name: "un_theme" })
        const handle = connectReduxDevtools(s)
        const scoped = s.scope("sess")

        scoped.set(a, "dark")
        expect(fake.sent.at(-1)!.state["@scopes"].sess.un_theme).toBe("dark")

        scoped.unset(a)

        const last = fake.sent.at(-1)!
        expect(last.action.source).toBe("unset")
        expect(last.action.type).toBe("@scope:sess un_theme (reverted)")
        // Override is gone from the snapshot; the scope re-inherits the root.
        expect(last.state["@scopes"].sess?.un_theme).toBeUndefined()
        expect(scoped.get(a)).toBe("light")
        handle.disconnect()
        scoped.detach()
    })

    test("unset inside a transaction still drops the scope override", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store("untx_root")
        const a = atom("light", { name: "untx_theme" })
        const handle = connectReduxDevtools(s)
        const scoped = s.scope("sess")

        scoped.set(a, "dark")
        expect(fake.sent.at(-1)!.state["@scopes"].sess.untx_theme).toBe("dark")

        // Inside a txn the batch source is "transaction", so the per-change
        // `kind: "unset"` is the only signal — the override must still drop.
        s.txn(t => {
            t.scope("sess", st => st.unset(a))
        })

        const last = fake.sent.at(-1)!
        expect(last.action.source).toBe("transaction")
        expect(last.state["@scopes"].sess?.untx_theme).toBeUndefined()
        expect(scoped.get(a)).toBe("light")
        handle.disconnect()
        scoped.detach()
    })

    test("jumping back before a scope override re-inherits (not default)", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store("rib_root")
        const a = atom(0, { name: "rib_a" })
        const handle = connectReduxDevtools(s)
        const scoped = s.scope("sess")

        s.set(a, 1) // root = 1; scope inherits
        const beforeOverride = fake.sent.at(-1)!.state
        scoped.set(a, 99) // scope override
        expect(scoped.get(a)).toBe(99)

        fake.dispatch({
            type: "DISPATCH",
            payload: { type: "JUMP_TO_ACTION" },
            state: JSON.stringify(beforeOverride),
        })

        // unset, not reset: re-inherits the root's 1, not the atom default 0.
        expect(scoped.get(a)).toBe(1)
        handle.disconnect()
        scoped.detach()
    })

    test("a family-atom deletion is tagged and removed from state", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const items = atomFamily(0, { name: "items" })
        const x = items("x")
        const handle = connectReduxDevtools(s)

        s.set(x, 5)
        expect(fake.sent.at(-1)!.state.items_x).toBe(5)

        s.del(x)
        const last = fake.sent.at(-1)!
        expect(last.action.type).toBe("items_x (deleted)")
        expect(last.action.source).toBe("delete")
        expect("items_x" in last.state).toBe(false)
        handle.disconnect()
    })

    test("tracks unnamed atoms as unnamed_atom_N with a one-time hint", () => {
        const warn = mock(() => {})
        const original = console.warn
        console.warn = warn
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const anon = atom(0)
        const handle = connectReduxDevtools(s)

        s.set(anon, 1)
        s.set(anon, 2)

        const labels = fake.sent.map(e => e.action.type)
        expect(labels).toEqual(["unnamed_atom_1", "unnamed_atom_1"])
        expect(fake.sent.at(-1)!.state.unnamed_atom_1).toBe(2)
        expect(warn).toHaveBeenCalledTimes(1)
        console.warn = original
        handle.disconnect()
    })

    test('unnamed: "ignore" leaves unnamed atoms out entirely', () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const anon = atom(0)
        const handle = connectReduxDevtools(s, { unnamed: "ignore" })

        s.set(anon, 1)

        expect(fake.sent).toHaveLength(0)
        handle.disconnect()
    })

    test("exclude by atom reference drops it from the timeline", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const cursor = atom(0, { name: "ex_cursor" })
        const count = atom(0, { name: "ex_count" })
        const handle = connectReduxDevtools(s, { exclude: cursor })

        s.set(cursor, 1)
        s.set(cursor, 2)
        s.set(count, 5)

        const labels = fake.sent.map(e => e.action?.type)
        expect(labels).toEqual(["ex_count"])
        expect(fake.sent.at(-1)!.state.ex_cursor).toBeUndefined()
        expect(fake.sent.at(-1)!.state.ex_count).toBe(5)
        handle.disconnect()
    })

    test("exclude by name string", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const cursor = atom(0, { name: "exn_cursor" })
        const count = atom(0, { name: "exn_count" })
        const handle = connectReduxDevtools(s, { exclude: "exn_cursor" })

        s.set(cursor, 1)
        s.set(count, 5)

        const labels = fake.sent.map(e => e.action?.type)
        expect(labels).toEqual(["exn_count"])
        handle.disconnect()
    })

    test("exclude an atomFamily excludes all its members", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const cursors = atomFamily(0, { name: "exf_cursors" })
        const count = atom(0, { name: "exf_count" })
        const handle = connectReduxDevtools(s, { exclude: cursors })

        s.set(cursors("a"), 1)
        s.set(cursors("b"), 2)
        s.set(count, 5)

        const labels = fake.sent.map(e => e.action?.type)
        expect(labels).toEqual(["exf_count"])
        handle.disconnect()
    })

    test("exclude a selectorFamily excludes all its members from @computed", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const a = atom(0, { name: "exsf_a" })
        const doubles = selectorFamily(
            (k: string) => get => `${k}:${get(a) * 2}`,
            { name: "exsf_doubles" },
        )
        s.sub(doubles("x"), () => {}) // live, so it recomputes on change
        const handle = connectReduxDevtools(s, {
            selectors: true,
            exclude: doubles,
        })

        s.set(a, 5)

        const last = fake.sent.at(-1)!
        // The atom is reported, but the excluded selector-family member is not.
        expect(last.state.exsf_a).toBe(5)
        expect(last.state["@computed"]?.exsf_doubles_x).toBeUndefined()
        handle.disconnect()
    })

    test("exclude accepts an array mixing references, names and predicates", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const cursor = atom(0, { name: "exa_cursor" })
        const ping = atom(0, { name: "exa_ping" })
        const noisy = atom(0, { name: "exa_internal_x" })
        const count = atom(0, { name: "exa_count" })
        const handle = connectReduxDevtools(s, {
            exclude: [
                cursor,
                "exa_ping",
                state => state.name?.startsWith("exa_internal") ?? false,
            ],
        })

        s.set(cursor, 1)
        s.set(ping, 1)
        s.set(noisy, 1)
        s.set(count, 5)

        const labels = fake.sent.map(e => e.action?.type)
        expect(labels).toEqual(["exa_count"])
        handle.disconnect()
    })

    test("an excluded atom is not seeded from an enumerable store", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store("exseed_root", { enumerable: true })
        const cursor = atom(0, { name: "exseed_cursor" })
        const count = atom(0, { name: "exseed_count" })
        s.set(cursor, 7)
        s.set(count, 3)

        const handle = connectReduxDevtools(s, { exclude: cursor })

        const init = fake.inits[0] as any
        expect(init.exseed_cursor).toBeUndefined()
        expect(init.exseed_count).toBe(3)
        handle.disconnect()
    })

    test("excluding every changed atom emits no action", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const cursor = atom(0, { name: "exnone_cursor" })
        const handle = connectReduxDevtools(s, { exclude: cursor })

        s.set(cursor, 1)

        expect(fake.sent).toHaveLength(0)
        handle.disconnect()
    })

    test("selectors: true reports named derived values under @computed", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const a = atom(1, { name: "sel_a" })
        const double = selector(get => get(a) * 2, { name: "double" })
        s.sub(double, () => {}) // make the selector live
        const handle = connectReduxDevtools(s, { selectors: true })

        s.set(a, 5)

        const last = fake.sent.at(-1)!
        expect(last.state.sel_a).toBe(5)
        expect(last.state["@computed"].double).toBe(10)
        handle.disconnect()
    })

    test("a scope selector lands under @scopes.<scope>.@computed", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store("scsel_root")
        const a = atom<"light" | "dark">("light", { name: "scsel_theme" })
        const isDark = selector(get => get(a) === "dark", {
            name: "scsel_isDark",
        })
        const scoped = s.scope("sess")
        scoped.sub(isDark, () => {}) // live in the scope
        const handle = connectReduxDevtools(s, { selectors: true })

        scoped.set(a, "dark") // scope override → isDark recomputes in scope

        const last = fake.sent.at(-1)!
        expect(last.state["@scopes"].sess["@computed"].scsel_isDark).toBe(true)
        expect(last.state["@scopes"].sess.scsel_theme).toBe("dark")
        // It is NOT in the top-level @computed.
        expect(last.state["@computed"]?.scsel_isDark).toBeUndefined()
        handle.disconnect()
        scoped.detach()
    })

    test("selectors are not reported by default", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const a = atom(1, { name: "nosel_a" })
        const double = selector(get => get(a) * 2, { name: "nosel_double" })
        s.sub(double, () => {})
        const handle = connectReduxDevtools(s)

        s.set(a, 5)

        const last = fake.sent.at(-1)!
        expect(last.state.nosel_a).toBe(5)
        expect(last.state["@computed"]).toBeUndefined()
        handle.disconnect()
    })

    test("PAUSE_RECORDING stops and resumes adding timeline entries", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const a = atom(0, { name: "pause_a" })
        const handle = connectReduxDevtools(s)

        fake.dispatch({
            type: "DISPATCH",
            payload: { type: "PAUSE_RECORDING", status: true },
        })
        const sentWhilePaused = fake.sent.length
        s.set(a, 1)
        expect(fake.sent.length).toBe(sentWhilePaused) // nothing recorded

        fake.dispatch({
            type: "DISPATCH",
            payload: { type: "PAUSE_RECORDING", status: false },
        })
        s.set(a, 2)
        const last = fake.sent.at(-1)!
        expect(last.state.pause_a).toBe(2) // model stayed current through pause
        handle.disconnect()
    })

    test("IMPORT_STATE restores current state and hands the lifted history back", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const a = atom(0, { name: "imp_a" })
        const handle = connectReduxDevtools(s)
        s.set(a, 1) // register the name so restore can resolve it

        const lifted = {
            computedStates: [{ state: { imp_a: 1 } }, { state: { imp_a: 9 } }],
            currentStateIndex: 1,
        }
        fake.dispatch({
            type: "DISPATCH",
            payload: { type: "IMPORT_STATE", nextLiftedState: lifted },
        })

        // Store restored to the imported current state...
        expect(s.get(a)).toBe(9)
        // ...and the lifted history handed back via send(null, lifted).
        const last = fake.sent.at(-1)!
        expect(last.action).toBeNull()
        expect(last.state).toBe(lifted)
        handle.disconnect()
    })

    test("time-travel JUMP_TO_ACTION restores values onto the store", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const a = atom(0, { name: "jump_count" })
        const handle = connectReduxDevtools(s)

        s.set(a, 1)
        s.set(a, 2)
        expect(s.get(a)).toBe(2)

        fake.dispatch({
            type: "DISPATCH",
            payload: { type: "JUMP_TO_ACTION" },
            state: JSON.stringify({ jump_count: 1 }),
        })

        expect(s.get(a)).toBe(1)
        handle.disconnect()
    })

    test("jumping back resets atoms that first appeared after that point", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const a = atom(0, { name: "re_a" })
        const b = atom(0, { name: "re_b" })
        const handle = connectReduxDevtools(s)

        s.set(a, 1)
        const stateBeforeB = fake.sent.at(-1)!.state
        s.set(b, 99)

        fake.dispatch({
            type: "DISPATCH",
            payload: { type: "JUMP_TO_ACTION" },
            state: JSON.stringify(stateBeforeB),
        })

        expect(s.get(a)).toBe(1)
        expect(s.get(b)).toBe(0)
        handle.disconnect()
    })

    test("restoring does not echo back as a new action", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const a = atom(0, { name: "echo_count" })
        const handle = connectReduxDevtools(s)
        s.set(a, 1)
        const sentBefore = fake.sent.length

        fake.dispatch({
            type: "DISPATCH",
            payload: { type: "JUMP_TO_ACTION" },
            state: JSON.stringify({ echo_count: 0 }),
        })

        expect(fake.sent.length).toBe(sentBefore)
        handle.disconnect()
    })

    test("skip/reorder surface an error without touching state or history", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const a = atom(0, { name: "skip_count" })
        const handle = connectReduxDevtools(s)
        s.set(a, 1)
        const initsBefore = fake.inits.length
        const sentBefore = fake.sent.length

        fake.dispatch({ type: "DISPATCH", payload: { type: "TOGGLE_ACTION" } })

        expect(fake.errors).toHaveLength(1)
        expect(fake.errors[0]).toContain("TOGGLE_ACTION")
        expect(s.get(a)).toBe(1)
        expect(fake.inits.length).toBe(initsBefore)
        expect(fake.sent.length).toBe(sentBefore)
        handle.disconnect()
    })

    test("disconnect stops sends and detaches our listener (not the extension)", () => {
        const fake = makeFakeExtension()
        install(fake.ext)
        const s = store()
        const a = atom(0, { name: "disc_count" })
        const handle = connectReduxDevtools(s)

        handle.disconnect()
        // Per-connection teardown only — the global ext.disconnect() must NOT
        // be called (it would kill other connected stores).
        expect(fake.wasDisconnected()).toBe(false)
        // No more sends, and an incoming message is ignored (listener removed).
        const sentAfterDisconnect = fake.sent.length
        s.set(a, 99)
        fake.dispatch({
            type: "DISPATCH",
            payload: { type: "JUMP_TO_ACTION" },
            state: JSON.stringify({ disc_count: 7 }),
        })
        expect(fake.sent.length).toBe(sentAfterDisconnect)
        expect(s.get(a)).toBe(99) // jump after disconnect did nothing
    })

    test("returns a no-op and warns when the extension is absent", () => {
        const warn = mock(() => {})
        const original = console.warn
        console.warn = warn
        install(undefined)
        const s = store()
        const a = atom(0, { name: "noext_count" })

        const handle = connectReduxDevtools(s)
        s.set(a, 1) // must not throw

        expect(warn).toHaveBeenCalledTimes(1)
        expect(() => handle.disconnect()).not.toThrow()
        console.warn = original
    })
})
