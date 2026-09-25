import { describe, expect, test } from "bun:test"
import {
    SettleLimitError,
    StoreDisposedError,
    SubscriberNotificationError,
    atom,
    collection,
    externalAtom,
    selector,
    store,
    type ExternalSource,
    type State,
    type Store,
    type Transaction,
} from "../../src/index"

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

describe("v1 public Store.sub settle handlers", () => {
    test("extends Store.sub without a new Store field and exports its limit error", () => {
        const target = store()
        expect("react" in target).toBe(false)
        const error = new SettleLimitError()
        expect(error).toMatchObject({
            name: "SettleLimitError",
            code: "VALDRES_SETTLE_LIMIT",
        })
        expect(Object.isFrozen(error)).toBe(true)
    })

    test("types the cursor and rejects asynchronous settle handlers", () => {
        const count = atom(0)
        const label = atom("")
        const target: Store = store()
        const stop: () => void = target.sub(count, {
            settle: (tx: Transaction) => {
                tx.set(label, `count ${tx.get(count)}`)
            },
        })
        target.set(count, 1)
        expect(target.get(label)).toBe("count 1")
        stop()
        stop()

        const both = target.sub(count, {
            settle: tx => tx.set(label, `both ${tx.get(count)}`),
            notify: () => undefined,
        })
        both()

        if (false as boolean) {
            // @ts-expect-error settle handlers are synchronous transactions.
            target.sub(count, { settle: async tx => tx.set(label, "late") })
            // @ts-expect-error the trigger must be a State.
            target.sub("count", { settle: () => undefined })
            // @ts-expect-error at least one handler is required.
            target.sub(count, {})
            // @ts-expect-error unknown handler keys are rejected.
            target.sub(count, { setle: () => undefined })
            // @ts-expect-error notify receives no transaction.
            target.sub(count, { notify: (tx: Transaction) => tx.get(count) })
        }
    })

    test("rejects handlers that dispose the Store or carry extra symbol keys", () => {
        const root = store()
        const child = root.scope()
        let listeners = 0
        const source = externalAtom({
            getSnapshot: () => 0,
            subscribe() {
                listeners++
                return () => {
                    listeners--
                }
            },
        })
        expect(
            thrownBy(() =>
                child.sub(source, {
                    get notify() {
                        child.dispose()
                        return () => {}
                    },
                }),
            ),
        ).toBeInstanceOf(StoreDisposedError)
        expect(listeners).toBe(0)
        root.dispose()
        expect(listeners).toBe(0)

        const extra = thrownBy(() =>
            store().sub(atom(0), {
                settle: () => {},
                [Symbol("extra")]: 1,
            } as never),
        )
        expect(extra).toBeInstanceOf(TypeError)
    })

    test("reacts to and writes collection rows inside one publication", () => {
        interface Task {
            readonly title: string
            readonly done: boolean
        }
        const tasks = collection<string, Task>()
        const completed = atom(0)
        const target = store()
        const view = selector(get => [
            get(tasks).map(row => row.key),
            get(completed),
        ])
        const observations: unknown[] = []
        target.sub(view, () => observations.push(target.get(view)))
        target.sub(tasks("a"), {
            settle: tx => {
                const task = tx.get(tasks("a"))
                if (task?.done) {
                    tx.update(completed, count => count + 1)
                    tx.set(tasks("archive:a"), task)
                    tx.delete(tasks("a"))
                }
            },
        })

        target.set(tasks("a"), { title: "write", done: false })
        target.set(tasks("a"), { title: "write", done: true })

        expect(observations).toEqual([
            [["a"], 0],
            [["archive:a"], 1],
        ])
    })

    test("surfaces a nonconverging boundary once with committed state", () => {
        const ping = atom(0)
        const pong = atom(0)
        const target = store()
        target.sub(ping, { settle: tx => tx.set(pong, tx.get(ping) + 1) })
        target.sub(pong, { settle: tx => tx.set(ping, tx.get(pong) + 1) })

        const error = thrownBy(() => target.set(ping, 1))

        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect((error as SubscriberNotificationError).cause).toBeInstanceOf(
            SettleLimitError,
        )
        expect(target.get(ping)).toBe(65)
    })
})

/*
 * Hotkeys proof, not a hotkeys implementation. One ExternalAtom snapshot holds
 * held keys and an occurrence sequence; every keydown, including a repeat,
 * publishes a new sequence. Matching and eligibility are pure selectors. The
 * native event is exposed only while it dispatches, so cancellation is
 * synchronous and tied to the live occurrence.
 *
 * Consume policy for this fixture: at most one attempt per occurrence per
 * registration. A closure gate stops a re-run within the boundary and is not
 * rolled back with a failed draft, so a failed attempt is consumed for that
 * registration only. A command that succeeds marks the occurrence handled in
 * the same transaction as its writes, which stops any later registration
 * from also succeeding for it.
 *
 * What this does not provide: reactions read the latest state, so an earlier
 * reaction can change eligibility before a later one runs, and which eligible
 * registration wins follows registration order. Freezing eligibility at event
 * time needs an explicit, immutable decision for the occurrence.
 */
interface KeySnapshot {
    readonly seq: number
    readonly key: string
    readonly held: readonly string[]
}

class KeyEvent extends Event {
    constructor(
        type: "keydown" | "keyup",
        readonly key: string,
    ) {
        super(type, { cancelable: true })
    }
}

const keyboard = () => {
    const doc = new EventTarget()
    let snapshot: KeySnapshot = Object.freeze({ seq: 0, key: "", held: [] })
    let live: Event | undefined
    const listeners = new Set<() => void>()
    const failures: unknown[] = []
    const publish = (event: Event) => {
        const { key, type } = event as KeyEvent
        const held =
            type === "keyup"
                ? snapshot.held.filter(entry => entry !== key)
                : snapshot.held.includes(key)
                  ? snapshot.held
                  : [...snapshot.held, key]
        snapshot = Object.freeze({
            seq: snapshot.seq + 1,
            key: type === "keydown" ? key : "",
            held,
        })
        live = event
        try {
            for (const invalidate of [...listeners]) {
                try {
                    invalidate()
                } catch (error) {
                    failures.push(error)
                }
            }
        } finally {
            live = undefined
        }
    }
    doc.addEventListener("keydown", publish)
    doc.addEventListener("keyup", publish)
    const source: ExternalSource<KeySnapshot> = {
        getSnapshot: () => snapshot,
        subscribe(invalidate) {
            listeners.add(invalidate)
            return () => void listeners.delete(invalidate)
        },
    }
    return {
        state: externalAtom(source),
        failures,
        /** The event currently dispatching, if any. */
        live: () => live,
        down: (key: string) => doc.dispatchEvent(new KeyEvent("keydown", key)),
        up: (key: string) => doc.dispatchEvent(new KeyEvent("keyup", key)),
    }
}

const hotkeyApp = () => {
    const keys = keyboard()
    const editorFocused = atom(true)
    const modalOpen = atom(false)
    const selection = atom<readonly string[]>(["x"])
    const saving = atom(false)
    const handled = atom(0)
    const saveRequest = atom<null | { readonly seq: number }>(null)
    const saveError = atom<unknown>(null)
    // The occurrence and which command it matches, while it is unhandled.
    const dispatch = selector(get => {
        const k = get(keys.state)
        const fresh = k.seq > get(handled)
        const command =
            !fresh || k.key === ""
                ? null
                : k.key === "s" && get(editorFocused) && !get(saving)
                  ? ("save" as const)
                  : k.key === "Escape"
                    ? get(modalOpen)
                        ? ("close" as const)
                        : ("clear" as const)
                    : null
        return Object.freeze({ seq: k.seq, command })
    })
    const target = store()
    const commands: string[] = []
    /** One command reaction with a per-registration occurrence gate. */
    const command = (
        name: "save" | "close" | "clear",
        run: (tx: Transaction, seq: number) => void,
    ) => {
        let lastSeq = target.get(dispatch).seq // no replay at registration
        return target.sub(dispatch, {
            settle: tx => {
                const current = tx.get(dispatch)
                if (current.seq === lastSeq) return
                lastSeq = current.seq // consumed even if this attempt fails
                if (current.command !== name) return
                commands.push(`${name}@${current.seq}`)
                tx.set(handled, current.seq)
                keys.live()?.preventDefault()
                run(tx, current.seq)
            },
        })
    }
    return {
        keys,
        target,
        commands,
        command,
        editorFocused,
        modalOpen,
        selection,
        saving,
        saveRequest,
        saveError,
        dispatch,
    }
}

describe("hotkey occurrence fixture", () => {
    test("publishes held keys and the command result together and cancels natively", async () => {
        const app = hotkeyApp()
        const { target } = app
        app.command("save", (tx, seq) => {
            tx.set(app.saving, true)
            tx.set(app.saveRequest, { seq })
        })
        const view = selector(get => [
            get(app.keys.state).held.join("+"),
            get(app.saving),
            get(app.saveRequest)?.seq ?? null,
        ])
        const observations: unknown[] = []
        target.sub(view, () => observations.push(target.get(view)))
        // Imperative I/O after the coherent publication, never a store write
        // inside this callback; completion is a separate operation.
        const settled: Promise<void>[] = []
        let fail = false
        target.sub(app.saveRequest, () => {
            const request = target.get(app.saveRequest)
            if (request === null) return
            const io = fail
                ? Promise.reject(new Error("offline"))
                : Promise.resolve()
            settled.push(
                io.then(
                    () =>
                        target.txn(tx => {
                            tx.set(app.saving, false)
                            tx.set(app.saveRequest, null)
                        }),
                    error =>
                        target.txn(tx => {
                            tx.set(app.saving, false)
                            tx.set(app.saveRequest, null)
                            tx.set(app.saveError, error)
                        }),
                ),
            )
        })

        const notCanceled = app.keys.down("s")

        expect(notCanceled).toBe(false)
        expect(app.keys.live()).toBeUndefined()
        expect(observations).toEqual([["s", true, 1]])
        await Promise.all(settled)
        expect(observations.at(-1)).toEqual(["s", false, null])

        fail = true
        app.keys.up("s")
        app.keys.down("s")
        await Promise.all(settled)
        expect(target.get(app.saveError)).toMatchObject({ message: "offline" })
        expect(app.commands).toEqual(["save@1", "save@3"])
    })

    test("repeats are new occurrences; eligibility changes and late registration never replay", () => {
        const app = hotkeyApp()
        const { target } = app
        app.command("save", tx => tx.set(app.saving, true))
        target.set(app.editorFocused, false)

        expect(app.keys.down("s")).toBe(true) // seq 1: ineligible, consumed
        target.set(app.editorFocused, true) // eligibility-only change
        app.command("save", () => undefined) // late registration while held
        expect(app.commands).toEqual([])

        expect(app.keys.down("s")).toBe(false) // repeat, seq 2
        target.set(app.saving, false)
        target.set(app.editorFocused, false)
        target.set(app.editorFocused, true)
        expect(app.commands).toEqual(["save@2"])
        app.keys.down("s") // repeat, seq 3: both registrations eligible
        // The first command consumes the occurrence in state, so the second
        // registration sees no unhandled command for seq 3.
        expect(app.commands).toEqual(["save@2", "save@3"])
    })

    test("a shared dispatch decision plus a committed handled marker admits one successful winner", () => {
        // The dispatch selector already picked "close" for this occurrence, so
        // reversing these two registrations does not change the winner. This
        // is not general order independence; see the next tests.
        for (const order of [
            ["close", "clear"],
            ["clear", "close"],
        ] as const) {
            const app = hotkeyApp()
            const { target } = app
            target.set(app.modalOpen, true)
            for (const name of order)
                app.command(name, tx =>
                    name === "close"
                        ? tx.set(app.modalOpen, false)
                        : tx.set(app.selection, []),
                )

            app.keys.down("Escape")

            expect(app.commands).toEqual(["close@1"])
            expect(target.get(app.selection)).toEqual(["x"])
        }
    })

    test("among eligible registrations, the earlier registration wins", () => {
        for (const order of [
            ["A", "B"],
            ["B", "A"],
        ] as const) {
            const app = hotkeyApp()
            const winners: string[] = []
            for (const candidate of order)
                app.command("save", () => void winners.push(candidate))

            expect(app.keys.down("s")).toBe(false)

            expect(winners).toEqual([order[0]])
        }
    })

    test("an earlier reaction that changes eligibility changes which command runs", () => {
        const outcomes: unknown[] = []
        for (const order of [
            ["flip", "close", "clear"],
            ["close", "flip", "clear"],
        ] as const) {
            const app = hotkeyApp()
            const { target } = app
            target.set(app.modalOpen, true)
            for (const name of order) {
                if (name === "flip") {
                    // Closes the modal without handling the occurrence.
                    let flipSeq = 0
                    target.sub(app.dispatch, {
                        settle: tx => {
                            const { seq } = tx.get(app.dispatch)
                            if (seq === flipSeq) return
                            flipSeq = seq
                            tx.set(app.modalOpen, false)
                        },
                    })
                } else
                    app.command(name, tx =>
                        name === "close"
                            ? tx.set(app.modalOpen, false)
                            : tx.set(app.selection, []),
                    )
            }

            expect(app.keys.down("Escape")).toBe(false)
            outcomes.push([app.commands, target.get(app.selection)])
        }
        expect(outcomes).toEqual([
            [["clear@1"], []],
            [["close@1"], ["x"]],
        ])
    })

    test("a failed attempt is consumed per registration, not per occurrence", () => {
        const app = hotkeyApp()
        app.command("save", tx => {
            tx.set(app.saving, true)
            throw new Error("first candidate failed")
        })
        app.command("save", tx => tx.set(app.saving, true))

        app.keys.down("s")

        expect(app.commands).toEqual(["save@1", "save@1"])
        expect(app.target.get(app.saving)).toBe(true)
        expect(app.keys.failures).toHaveLength(1)
    })

    test("without consumption in state a later reaction sees changed eligibility", () => {
        // Documents the hazard the fixture avoids: a sequence gate does not
        // freeze eligibility at event time.
        const keys = keyboard()
        const modalOpen = atom(true)
        const selection = atom<readonly string[]>(["x"])
        const target = store()
        const escape = selector(get => get(keys.state))
        const fired: string[] = []
        const gate = (name: string, eligible: (tx: Transaction) => boolean) => {
            let lastSeq = 0
            target.sub(escape, {
                settle: tx => {
                    const k = tx.get(escape)
                    if (k.seq === lastSeq || k.key !== "Escape") return
                    lastSeq = k.seq
                    if (!eligible(tx)) return
                    fired.push(name)
                    if (name === "close") tx.set(modalOpen, false)
                    else tx.set(selection, [])
                },
            })
        }
        gate("close", tx => tx.get(modalOpen))
        gate("clear", tx => !tx.get(modalOpen))

        keys.down("Escape")

        expect(fired).toEqual(["close", "clear"])
    })

    test("a failed attempt aborts its draft, is consumed, and later occurrences still run", () => {
        const app = hotkeyApp()
        const { target } = app
        let failNext = true
        app.command("save", tx => {
            tx.set(app.saving, true)
            if (failNext) {
                failNext = false
                throw new Error("command failed")
            }
        })

        app.keys.down("s")

        expect(app.keys.failures).toHaveLength(1)
        expect(app.keys.failures[0]).toBeInstanceOf(SubscriberNotificationError)
        expect(target.get(app.saving)).toBe(false)
        expect(app.commands).toEqual(["save@1"])
        app.keys.down("s")
        expect(app.commands).toEqual(["save@1", "save@2"])
        expect(target.get(app.saving)).toBe(true)
    })
})

// Keep the public State import meaningful for the type-level lane.
export type ReactionTrigger = State<unknown>
