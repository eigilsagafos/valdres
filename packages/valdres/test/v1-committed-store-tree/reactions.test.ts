import { describe, expect, test } from "bun:test"
import {
    CallbackCapabilityError,
    InvalidSynchronousAtomValueError,
    InvalidTransactionCallbackResultError,
    SettleLimitError,
    RuntimeMismatchError,
    SelectorCapabilityError,
    StoreDisposedError,
    SubscriberNotificationError,
    TransactionClosedError,
    TransactionPhaseError,
    createCommittedStoreTreeDomain,
    createInternalStoreTreeInstrumentation,
    type RootTransaction,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { createInternalExternalAtom } from "../../src/v1-internal/committed-store-tree/external-atom"
import {
    SelectorDependencyError,
    SelectorGetterError,
} from "../../src/v1-internal/selector-evaluator/errors"
import { evaluateSelector } from "../../src/v1-internal/selector-evaluator/evaluate"

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const fixture = () => {
    const counters = createInternalStoreTreeInstrumentation()
    const domain = createCommittedStoreTreeDomain(counters)
    const tree = domain.createStoreTree()
    const read = (name: string): number =>
        counters.read(name as Parameters<typeof counters.read>[0])
    return { domain, tree, read }
}

/** A synchronous source whose invalidators run only when `publish` is called. */
const source = <Value>(initial: Value) => {
    let value = initial
    const listeners = new Set<() => void>()
    let subscribes = 0
    let cleanups = 0
    return {
        definition: {
            getSnapshot: () => value,
            subscribe(invalidate: () => void) {
                subscribes++
                listeners.add(invalidate)
                return () => {
                    cleanups++
                    listeners.delete(invalidate)
                }
            },
        },
        publish(next: Value) {
            value = next
            for (const invalidate of [...listeners]) invalidate()
        },
        silently(next: Value) {
            value = next
        },
        get listeners() {
            return listeners.size
        },
        get subscribes() {
            return subscribes
        },
        get cleanups() {
            return cleanups
        },
    }
}

describe("Store settle handlers: registration and retention", () => {
    test("never runs on registration, including external admission catch-up", () => {
        const { domain, tree } = fixture()
        const count = domain.atom(0)
        const doubled = domain.selector(get => get(count) * 2)
        let value = 0
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => value,
            subscribe() {
                // A startup change produces admission catch-up.
                value = 10
                return () => {}
            },
        })
        const runs: string[] = []
        const ordinary: number[] = []
        tree.sub(count, { settle: () => void runs.push("atom") })
        tree.sub(doubled, { settle: () => void runs.push("selector") })
        tree.sub(external, { settle: () => void runs.push("external") })
        // An ordinary subscriber admitted the same way does get catch-up.
        const otherValue = { current: 0 }
        const other = createInternalExternalAtom(domain, {
            getSnapshot: () => otherValue.current,
            subscribe() {
                otherValue.current = 5
                return () => {}
            },
        })
        tree.sub(other, () => ordinary.push(tree.get(other)))

        expect(runs).toEqual([])
        expect(ordinary).toEqual([5])
        expect(tree.get(external)).toBe(10)
        tree.set(count, 1)
        expect(runs).toEqual(["atom", "selector"])
    })

    test("one registration runs settle inside the update and notify after it", () => {
        const { domain, tree, read } = fixture()
        const trigger = domain.atom(0)
        const result = domain.atom(0)
        const log: string[] = []
        tree.sub(result, () => log.push(`observer:${tree.get(result)}`))

        const before = read("activeSubscriptions")
        const stop = tree.sub(trigger, {
            settle: tx => {
                log.push(`settle:${tx.get(result)}`)
                tx.set(result, tx.get(trigger) * 10)
            },
            notify: () => log.push(`notify:${tree.get(result)}`),
        })
        expect(read("activeSubscriptions")).toBe(before + 1)
        tree.set(trigger, 1)
        // Ordinary delivery is target-reaching order; both see the settled write.
        expect(log).toEqual(["settle:0", "notify:10", "observer:10"])

        log.length = 0
        stop()
        stop()
        expect(read("activeSubscriptions")).toBe(before)
        tree.set(trigger, 2)
        expect(log).toEqual([])
        expect(tree.get(result)).toBe(10)
    })

    test("admission catch-up runs a notify handler but never settle", () => {
        const { domain, tree } = fixture()
        const runs: string[] = []
        const external = (label: string) => {
            let value = 0
            return createInternalExternalAtom(domain, {
                getSnapshot: () => value,
                subscribe() {
                    value = 1
                    runs.push(`startup:${label}`)
                    return () => {}
                },
            })
        }
        tree.sub(external("both"), {
            settle: () => void runs.push("settle:both"),
            notify: () => void runs.push("notify:both"),
        })
        tree.sub(external("notify"), {
            notify: () => void runs.push("notify:notify"),
        })
        expect(runs).toEqual([
            "startup:both",
            "notify:both",
            "startup:notify",
            "notify:notify",
        ])
    })

    test("reads each handler once, settle first, and keeps them", () => {
        const { domain, tree } = fixture()
        const trigger = domain.atom(0)
        const reads: string[] = []
        const runs: string[] = []
        const handlers = {
            get settle() {
                reads.push("settle")
                return () => void runs.push("settle")
            },
            get notify() {
                reads.push("notify")
                return () => void runs.push("notify")
            },
        }
        tree.sub(trigger, handlers)
        expect(reads).toEqual(["settle", "notify"])
        tree.set(trigger, 1)
        expect(reads).toEqual(["settle", "notify"])
        expect(runs).toEqual(["settle", "notify"])

        const failure = new Error("getter")
        const throwing = {
            get settle(): () => void {
                throw failure
            },
        }
        expect(thrownBy(() => tree.sub(trigger, throwing))).toBe(failure)
        tree.set(trigger, 2)
        expect(runs).toEqual(["settle", "notify", "settle", "notify"])
    })

    test("a handler getter that disposes the scope registers nothing", () => {
        for (const phase of ["settle", "notify"] as const) {
            for (const disposing of ["child", "root"] as const) {
                const { domain, tree, read } = fixture()
                const child = tree.scope("child")
                const keys = source(0)
                const external = createInternalExternalAtom(
                    domain,
                    keys.definition,
                )
                const before = read("activeSubscriptions")
                const handlers = {
                    get [phase]() {
                        ;(disposing === "child" ? child : tree).dispose()
                        return () => {}
                    },
                }
                expect(
                    thrownBy(() => child.sub(external, handlers as never)),
                ).toBeInstanceOf(StoreDisposedError)
                expect(read("activeSubscriptions")).toBe(before)
                expect(keys.subscribes).toBe(0)
                expect(keys.listeners).toBe(0)
                tree.dispose()
                expect(keys.listeners).toBe(0)
            }
        }
    })

    test("notify is not a continuation of settle: it runs after settle fails", () => {
        const { domain, tree } = fixture()
        const trigger = domain.atom(0)
        const written = domain.atom(0)
        const failure = new Error("settle failed")
        const seen: number[] = []
        tree.sub(trigger, {
            settle: tx => {
                tx.set(written, 1)
                throw failure
            },
            notify: () => void seen.push(tree.get(written)),
        })
        const error = thrownBy(() => tree.set(trigger, 1))
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect((error as SubscriberNotificationError).causes).toEqual([failure])
        // The aborted draft left nothing behind; notify still observed the
        // trigger's change.
        expect(seen).toEqual([0])
        expect(tree.get(written)).toBe(0)
    })

    test("retains an external closure without ordinary subscribers and releases it on removal", () => {
        const { domain, tree } = fixture()
        const keys = source(0)
        const external = createInternalExternalAtom(domain, keys.definition)
        const derived = domain.selector(get => get(external) + 1)
        const seen: number[] = []

        const stopReaction = tree.sub(derived, {
            settle: tx => {
                seen.push(tx.get(derived))
            },
        })
        expect(keys.subscribes).toBe(1)
        expect(keys.listeners).toBe(1)
        keys.publish(1)
        expect(seen).toEqual([2])

        const stopSubscriber = tree.sub(derived, () => undefined)
        stopReaction()
        stopReaction()
        expect(keys.cleanups).toBe(0)
        keys.publish(2)
        expect(seen).toEqual([2])
        stopSubscriber()
        expect(keys.cleanups).toBe(1)
        expect(keys.listeners).toBe(0)
    })

    test("binds the cursor to the registering scope and disposal drops reactions", () => {
        const { domain, tree } = fixture()
        const trigger = domain.atom(0)
        const result = domain.atom("root")
        const child = tree.scope("child")
        const runs: string[] = []

        child.sub(trigger, {
            settle: tx => {
                runs.push(`child:${tx.get(result)}`)
                tx.set(result, `child:${tx.get(trigger)}`)
            },
        })
        const stopRoot = tree.sub(trigger, {
            settle: tx => {
                runs.push(`root:${tx.get(result)}`)
            },
        })
        tree.set(trigger, 1)
        // The child inherits the root write, so both reactions run; each
        // cursor reads and writes its own registration scope.
        expect(runs).toEqual(["root:root", "child:root"])
        expect(child.get(result)).toBe("child:1")
        expect(tree.get(result)).toBe("root")

        runs.length = 0
        child.dispose()
        tree.set(trigger, 2)
        expect(runs).toEqual(["root:root"])
        stopRoot()
        tree.set(trigger, 3)
        expect(runs).toEqual(["root:root"])
    })

    test("validates handlers with Store.sub admission and precedence", () => {
        const { domain, tree, read } = fixture()
        const foreign = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const disposed = domain.createStoreTree()
        disposed.dispose()

        const invalid = thrownBy(() =>
            tree.sub(Object.freeze({ kind: "atom" }) as never, {
                settle: () => {},
            }),
        )
        expect(invalid).toBeInstanceOf(TypeError)
        expect((invalid as Error).message).toBe(
            "StoreTree.sub requires a valid State",
        )
        const noop = () => {}
        for (const handlers of [
            undefined,
            null,
            1,
            {},
            { settle: undefined },
            { settle: 1 },
            { notify: null },
            { settle: noop, notify: 1 },
            { settle: noop, notfy: noop },
            { setle: noop },
            { settle: noop, [Symbol("extra")]: 1 },
        ]) {
            const callback = thrownBy(() => tree.sub(count, handlers as never))
            expect(callback).toBeInstanceOf(TypeError)
            expect((callback as Error).message).toBe(
                "StoreTree.sub requires a callback or settle/notify handlers",
            )
        }
        expect(read("activeSubscriptions")).toBe(0)
        expect(
            thrownBy(() => tree.sub(foreign.atom(0), { settle: () => {} })),
        ).toBeInstanceOf(RuntimeMismatchError)
        expect(
            thrownBy(() => disposed.sub(count, { settle: () => {} })),
        ).toBeInstanceOf(StoreDisposedError)

        const errors: unknown[] = []
        const probeInput = domain.atom(0)
        const probe = domain.selector(get => {
            get(probeInput)
            errors.push(thrownBy(() => tree.sub(count, { settle: () => {} })))
            return 1
        })
        tree.get(probe)
        tree.txn(() => {
            errors.push(thrownBy(() => tree.sub(count, { settle: () => {} })))
        })
        const stop = tree.sub(count, () => {
            errors.push(thrownBy(() => tree.sub(count, { settle: () => {} })))
        })
        tree.sub(count, {
            settle: () => {
                errors.push(
                    thrownBy(() => tree.sub(count, { settle: () => {} })),
                )
            },
        })
        tree.set(count, 1)
        stop()
        expect(errors.map(error => (error as Error).name)).toEqual([
            "SelectorCapabilityError",
            "TransactionPhaseError",
            "TransactionPhaseError",
            "CallbackCapabilityError",
        ])
        expect(errors[0]).toBeInstanceOf(SelectorCapabilityError)
    })

    test("rolls back a failed admission without registering", () => {
        const { domain, tree, read } = fixture()
        const foreign = createCommittedStoreTreeDomain()
        const foreignCount = foreign.atom(0)
        const contaminated = domain.selector(get => {
            tree.get(foreignCount)
            return 1
        })
        const failing = createInternalExternalAtom(domain, {
            getSnapshot: () => 0,
            subscribe() {
                throw new Error("attach failed")
            },
        })
        const before = read("activeSubscriptions")
        let runs = 0

        expect(
            thrownBy(() =>
                tree.sub(contaminated, { settle: () => void runs++ }),
            ),
        ).toBeInstanceOf(RuntimeMismatchError)
        expect(read("activeSubscriptions")).toBe(before)
        expect(
            thrownBy(() => tree.sub(failing, { settle: () => void runs++ })),
        ).toBeDefined()
        expect(read("activeSubscriptions")).toBe(before)
        expect(runs).toBe(0)
    })
})

describe("Store settle handlers: one publication boundary", () => {
    const commandGraph = () => {
        const f = fixture()
        const keys = source<Readonly<{ key: string; seq: number }>>(
            Object.freeze({ key: "", seq: 0 }),
        )
        const keyboard = createInternalExternalAtom(f.domain, keys.definition)
        const saving = f.domain.atom(false)
        const saves = f.domain.atom(0)
        const key = f.domain.selector(get => get(keyboard).key)
        const combined = f.domain.selector(get =>
            Object.freeze([get(key), get(saving), get(saves)] as const),
        )
        const observations: unknown[] = []
        f.tree.sub(combined, () => observations.push(f.tree.get(combined)))
        return { ...f, keys, keyboard, saving, saves, observations }
    }

    test("an external trigger publishes input and command result together", () => {
        const g = commandGraph()
        let runs = 0
        g.tree.sub(g.keyboard, {
            settle: tx => {
                runs++
                if (tx.get(g.keyboard).key !== "s") return
                tx.set(g.saving, true)
                tx.update(g.saves, value => value + 1)
            },
        })
        const propagation = g.read("propagationSettlements")
        const snapshots = g.read("notificationSnapshots")
        const callbacks = g.read("subscriberCallbacksAttempted")

        g.keys.publish(Object.freeze({ key: "s", seq: 1 }))

        expect(g.observations).toEqual([["s", true, 1]])
        expect(runs).toBe(1)
        expect(g.read("propagationSettlements") - propagation).toBe(2)
        expect(g.read("notificationSnapshots") - snapshots).toBe(1)
        expect(g.read("subscriberCallbacksAttempted") - callbacks).toBe(1)
    })

    test("an owned trigger publishes input and command result together", () => {
        const { domain, tree, read } = fixture()
        const input = domain.atom(0)
        const result = domain.atom(0)
        const pair = domain.selector(get => [get(input), get(result)])
        const observations: unknown[] = []
        tree.sub(pair, () => observations.push(tree.get(pair)))
        tree.sub(input, { settle: tx => tx.set(result, tx.get(input) * 10) })
        const snapshots = read("notificationSnapshots")

        tree.set(input, 2)
        tree.txn(tx => tx.set(input, 3))

        expect(observations).toEqual([
            [2, 20],
            [3, 30],
        ])
        expect(read("notificationSnapshots") - snapshots).toBe(2)
    })

    test("a command changing its own eligibility converges; runs exceed commands", () => {
        const g = commandGraph()
        const eligible = g.domain.selector(get =>
            Object.freeze({
                seq: get(g.keyboard).seq,
                save: get(g.keyboard).key === "s" && !get(g.saving),
            }),
        )
        let lastSeq = g.tree.get(eligible).seq
        let runs = 0
        let commands = 0
        g.tree.sub(eligible, {
            settle: tx => {
                runs++
                const current = tx.get(eligible)
                if (current.seq === lastSeq) return
                lastSeq = current.seq
                if (!current.save) return
                commands++
                tx.set(g.saving, true)
                tx.update(g.saves, value => value + 1)
            },
        })

        g.keys.publish(Object.freeze({ key: "s", seq: 1 }))

        expect(g.observations).toEqual([["s", true, 1]])
        expect(commands).toBe(1)
        expect(runs).toBe(2)
    })

    test("runs pending reactions once on newer state and reschedules already-run ones", () => {
        const { domain, tree } = fixture()
        const trigger = domain.atom(0)
        const extra = domain.atom(0)
        const sum = domain.selector(get => get(trigger) + get(extra))
        const late1 = domain.selector(get => get(trigger))
        const late = domain.selector(get => get(late1))
        const log: string[] = []

        // Wave 1 reach order: trigger, sum, late.
        tree.sub(trigger, {
            settle: tx => {
                log.push(`t:${tx.get(sum)}`)
                if (tx.get(trigger) === 1) tx.set(extra, 10)
            },
        })
        tree.sub(sum, { settle: tx => void log.push(`sum:${tx.get(sum)}`) })
        tree.sub(late, {
            settle: tx => {
                log.push(`late:${tx.get(sum)}`)
                if (tx.get(extra) === 10) tx.set(extra, 20)
            },
        })

        tree.set(trigger, 1)
        // `sum` was pending when the trigger reaction changed it: it runs once,
        // reading 11. `late`'s write then changes `sum` again after sum ran, so
        // sum runs once more in wave 2.
        expect(log).toEqual(["t:1", "sum:11", "late:11", "sum:21"])
    })

    test("orders chained and conflicting writes by execution order", () => {
        const { domain, tree } = fixture()
        const a = domain.atom(0)
        const b = domain.atom(0)
        const c = domain.atom(0)
        const winner = domain.atom("none")
        const total = domain.atom(0)
        const all = domain.selector(get => [
            get(a),
            get(b),
            get(c),
            get(winner),
            get(total),
        ])
        const observations: unknown[] = []
        const log: string[] = []
        tree.sub(all, () => observations.push(tree.get(all)))
        tree.sub(a, {
            settle: tx => {
                log.push("a->b")
                tx.set(b, tx.get(a) + 1)
            },
        })
        tree.sub(b, {
            settle: tx => {
                log.push("b->c")
                tx.set(c, tx.get(b) + 1)
            },
        })
        tree.sub(a, {
            settle: tx => {
                log.push("first")
                tx.set(winner, "first")
                tx.update(total, value => value + 1)
            },
        })
        tree.sub(a, {
            settle: tx => {
                log.push(`second saw ${tx.get(winner)}`)
                tx.set(winner, "second")
                tx.update(total, value => value * 10)
            },
        })

        tree.set(a, 1)

        expect(log).toEqual(["a->b", "first", "second saw first", "b->c"])
        expect(observations).toEqual([[1, 2, 3, "second", 10]])
    })

    test("reads its own staged writes and derived values through the cursor", () => {
        const { domain, tree } = fixture()
        const trigger = domain.atom(0)
        const value = domain.atom(1)
        const doubled = domain.selector(get => get(value) * 2)
        const reads: number[] = []
        tree.sub(trigger, {
            settle: tx => {
                reads.push(tx.get(doubled))
                tx.set(value, 5)
                reads.push(tx.get(value), tx.get(doubled))
            },
        })
        tree.set(trigger, 1)
        expect(reads).toEqual([2, 5, 10])
        expect(tree.get(doubled)).toBe(10)
    })

    test("a diamond reaches its reaction and observer once per boundary", () => {
        const { domain, tree } = fixture()
        const root = domain.atom(1)
        const left = domain.selector(get => get(root) + 1)
        const right = domain.selector(get => get(root) * 2)
        const joined = domain.selector(get => `${get(left)}/${get(right)}`)
        const note = domain.atom("")
        const view = domain.selector(get => [get(joined), get(note)])
        const observations: unknown[] = []
        let runs = 0
        tree.sub(view, () => observations.push(tree.get(view)))
        tree.sub(joined, {
            settle: tx => {
                runs++
                tx.set(note, `seen ${tx.get(joined)}`)
            },
        })

        tree.set(root, 2)

        expect(runs).toBe(1)
        expect(observations).toEqual([["3/4", "seen 3/4"]])
    })

    test("keeps invalidation semantics when a reaction restores the value", () => {
        const { domain, tree } = fixture()
        const input = domain.atom(0)
        const observed: number[] = []
        tree.sub(input, () => observed.push(tree.get(input)))
        tree.sub(input, {
            settle: tx => {
                if (tx.get(input) !== 0) tx.set(input, 0)
            },
        })

        tree.set(input, 1)

        expect(observed).toEqual([0])
        expect(tree.get(input)).toBe(0)
    })

    test("a lifecycle catch-up in the same settlement runs the reaction once", () => {
        const { domain, tree } = fixture()
        const keys = source(0)
        const external = createInternalExternalAtom(domain, keys.definition)
        const useExternal = domain.atom(false)
        const branch = domain.selector(get =>
            get(useExternal) ? get(external) : -1,
        )
        const mirrored = domain.atom(-1)
        const view = domain.selector(get => [get(branch), get(mirrored)])
        const observations: unknown[] = []
        tree.sub(view, () => observations.push(tree.get(view)))
        let runs = 0
        tree.sub(branch, {
            settle: tx => {
                runs++
                tx.set(mirrored, tx.get(branch))
            },
        })
        expect(tree.get(external)).toBe(0)
        keys.silently(7)

        tree.set(useExternal, true)

        expect(runs).toBe(1)
        expect(observations).toEqual([[7, 7]])
        expect(keys.subscribes).toBe(1)
        keys.publish(8)
        expect(observations).toEqual([
            [7, 7],
            [8, 8],
        ])
    })

    test("an invalidation deferred by a subscriber is a later boundary", () => {
        const { domain, tree } = fixture()
        const trigger = domain.atom(0)
        const keys = source(0)
        const external = createInternalExternalAtom(domain, keys.definition)
        const mirrored = domain.atom(0)
        const view = domain.selector(get => [
            get(trigger),
            get(external),
            get(mirrored),
        ])
        const observations: unknown[] = []
        tree.sub(view, () => observations.push(tree.get(view)))
        tree.sub(external, { settle: tx => tx.set(mirrored, tx.get(external)) })
        tree.sub(trigger, () => keys.publish(tree.get(trigger) * 100))

        tree.set(trigger, 1)

        expect(observations).toEqual([
            [1, 0, 0],
            [1, 100, 100],
        ])
    })

    test("independent trees sharing a source settle independently", () => {
        const { domain } = fixture()
        const keys = source(0)
        const external = createInternalExternalAtom(domain, keys.definition)
        const result = domain.atom(0)
        const first = domain.createStoreTree()
        const second = domain.createStoreTree()
        const crossTree: unknown[] = []
        first.sub(external, {
            settle: tx => {
                tx.set(result, tx.get(external) + 1)
                crossTree.push(thrownBy(() => second.set(result, 99)))
            },
        })
        second.sub(external, {
            settle: tx => tx.set(result, tx.get(external) + 2),
        })

        keys.publish(10)

        expect(first.get(result)).toBe(11)
        expect(second.get(result)).toBe(12)
        expect(crossTree[0]).toBeInstanceOf(TransactionPhaseError)
    })
})

describe("Store settle handlers: failures and limits", () => {
    test("a throw aborts only that reaction's draft", () => {
        const { domain, tree } = fixture()
        const trigger = domain.atom(0)
        const a = domain.atom("a0")
        const b = domain.atom("b0")
        const view = domain.selector(get => [get(trigger), get(a), get(b)])
        const observations: unknown[] = []
        const cause = new Error("reaction failed")
        tree.sub(view, () => observations.push(tree.get(view)))
        tree.sub(trigger, {
            settle: tx => {
                tx.set(a, "a1")
                if (tx.get(trigger) === 1) throw cause
            },
        })
        tree.sub(trigger, { settle: tx => tx.set(b, "b1") })

        const error = thrownBy(() => tree.set(trigger, 1))

        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(error).toMatchObject({
            cause,
            causes: [cause],
            committed: true,
            source: "owned-mutation",
        })
        expect(observations).toEqual([[1, "a0", "b1"]])
        tree.set(trigger, 2)
        expect(tree.get(a)).toBe("a1")
    })

    test("an async reaction is rejected, aborted and cannot use its cursor later", async () => {
        const { domain, tree } = fixture()
        const trigger = domain.atom(0)
        const a = domain.atom(0)
        let later: unknown
        let unhandled = 0
        const onUnhandled = () => void unhandled++
        process.on("unhandledRejection", onUnhandled)
        tree.sub(trigger, {
            settle: (async (tx: RootTransaction) => {
                tx.set(a, 1)
                await Promise.resolve()
                later = thrownBy(() => tx.set(a, 2))
            }) as never,
        })

        const error = thrownBy(() => tree.set(trigger, 1))
        await new Promise(resolve => setTimeout(resolve, 0))
        process.off("unhandledRejection", onUnhandled)

        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect((error as SubscriberNotificationError).cause).toBeInstanceOf(
            InvalidTransactionCallbackResultError,
        )
        expect(tree.get(a)).toBe(0)
        expect(later).toBeInstanceOf(TransactionClosedError)
        expect(unhandled).toBe(0)
    })

    test("keeps a thrown thenable as the exact contained cause", () => {
        const { domain, tree } = fixture()
        const trigger = domain.atom(0)
        let containments = 0
        const thenable = Object.freeze({
            then(_resolve: unknown, _reject: unknown) {
                containments++
            },
        })
        tree.sub(trigger, {
            settle: () => {
                throw thenable
            },
        })

        const error = thrownBy(() => tree.set(trigger, 1))

        expect((error as SubscriberNotificationError).causes).toEqual([
            thenable,
        ])
        expect(containments).toBe(1)
    })

    test("a staging failure aborts the draft", () => {
        const { domain, tree } = fixture()
        const trigger = domain.atom(0)
        const a = domain.atom<unknown>(0)
        tree.sub(trigger, {
            settle: tx => {
                tx.set(a, 1)
                tx.set(a, Promise.resolve(2))
            },
        })

        const error = thrownBy(() => tree.set(trigger, 1))

        expect((error as SubscriberNotificationError).cause).toBeInstanceOf(
            InvalidSynchronousAtomValueError,
        )
        expect(tree.get(a)).toBe(0)
    })

    test("a comparator failure while staging aborts the draft", () => {
        const { domain, tree } = fixture()
        const trigger = domain.atom(0)
        const other = domain.atom(0)
        const failure = new Error("comparator")
        const strict = domain.atom(0, {
            equal: () => {
                throw failure
            },
        })
        tree.sub(trigger, {
            settle: tx => {
                tx.set(other, 1)
                tx.set(strict, 1)
            },
        })

        const error = thrownBy(() => tree.set(trigger, 1))

        expect((error as SubscriberNotificationError).cause).toBe(failure)
        expect(tree.get(other)).toBe(0)
        expect(tree.get(strict)).toBe(0)
    })

    test("a failure after apply propagates before the one publication and is reported", () => {
        const { domain } = fixture()
        const instrumentation = new Error("instrumentation failed after apply")
        let inReaction = false
        let failOnce = true
        const tree = domain.createStoreTree(
            undefined,
            Object.assign((code: number) => {
                if (code === 3) inReaction = true
                if (code === 4) inReaction = false
                if (code === 2 && inReaction && failOnce) {
                    failOnce = false
                    throw instrumentation
                }
            }, {}),
        )
        const trigger = domain.atom(0)
        const written = domain.atom(0)
        const later = domain.atom(0)
        const derived = domain.selector(get => get(written) * 10)
        const combined = domain.selector(get => [
            get(trigger),
            get(written),
            get(derived),
        ])
        const seen: unknown[] = []
        const calls = { written: 0, derived: 0 }
        tree.sub(trigger, () =>
            seen.push([
                tree.get(trigger),
                tree.get(written),
                tree.get(derived),
                tree.get(combined),
            ]),
        )
        tree.sub(written, () => void calls.written++)
        tree.sub(derived, () => void calls.derived++)
        tree.sub(trigger, { settle: tx => tx.set(written, tx.get(trigger)) })
        tree.sub(trigger, { settle: tx => tx.set(later, 1) })

        const error = thrownBy(() => tree.set(trigger, 1))

        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect((error as SubscriberNotificationError).causes).toEqual([
            instrumentation,
        ])
        // Applied writes stay, and their dependents propagated before the
        // ordinary callbacks read them.
        expect(seen).toEqual([[1, 1, 10, [1, 1, 10]]])
        expect(calls).toEqual({ written: 1, derived: 1 })
        expect(tree.get(later)).toBe(1)

        // An equal write and a changed write both stay coherent afterwards.
        tree.set(later, 0)
        tree.txn(tx => tx.set(written, 1))
        tree.set(trigger, 2)
        expect(seen.at(-1)).toEqual([2, 2, 20, [2, 2, 20]])
    })

    for (const shape of ["then getter", "callable then"] as const)
        test(`a thrown ${shape} is inspected under transaction-result guards`, () => {
            const { domain, tree } = fixture()
            const sibling = domain.createStoreTree()
            const trigger = domain.atom(0)
            const staged = domain.atom(0)
            const value = domain.atom(0)
            const keys = source(0)
            const external = createInternalExternalAtom(domain, keys.definition)
            tree.sub(external, () => undefined)
            const view = domain.selector(get => [
                get(trigger),
                get(staged),
                get(value),
                get(external),
            ])
            const observed: unknown[] = []
            tree.sub(view, () => observed.push(tree.get(view)))
            const attempts: Record<string, string> = {}
            let stopNeighbor = () => {}
            const hook = () => {
                const operations: Record<string, () => unknown> = {
                    read: () => tree.get(value),
                    write: () => tree.set(value, 10),
                    sibling: () => sibling.set(value, 20),
                    txn: () => tree.txn(tx => tx.set(value, 30)),
                    unsubscribe: () => stopNeighbor(),
                    invalidate: () => keys.publish(40),
                }
                for (const [name, operation] of Object.entries(operations))
                    attempts[name] = (thrownBy(operation) as Error).name
            }
            const thrown =
                shape === "then getter"
                    ? {
                          get then() {
                              hook()
                              return undefined
                          },
                      }
                    : {
                          then() {
                              hook()
                          },
                      }
            tree.sub(trigger, {
                settle: tx => {
                    tx.set(staged, 1)
                    throw thrown
                },
            })
            let neighborRuns = 0
            stopNeighbor = tree.sub(trigger, {
                settle: () => void neighborRuns++,
            })

            const error = thrownBy(() => tree.set(trigger, 1))

            expect(attempts).toEqual({
                read: "TransactionPhaseError",
                write: "TransactionPhaseError",
                sibling: "TransactionPhaseError",
                txn: "TransactionPhaseError",
                unsubscribe: "TransactionPhaseError",
                invalidate: "CallbackCapabilityError",
            })
            expect((error as SubscriberNotificationError).causes).toEqual([
                thrown,
            ])
            expect(neighborRuns).toBe(1)
            expect(observed).toEqual([[1, 0, 0, 0]])
            expect(sibling.get(value)).toBe(0)
            // The next operation recovers, and the neighbor stayed registered.
            tree.set(value, 5)
            expect(observed.at(-1)).toEqual([1, 0, 5, 0])
            thrownBy(() => tree.set(trigger, 2))
            expect(neighborRuns).toBe(2)
        })

    for (const code of [3, 4] as const)
        test(`an escaping trace hook (${code}) leaves later reactions runnable`, () => {
            const { domain } = fixture()
            let fail = true
            const tree = domain.createStoreTree(
                undefined,
                Object.assign((traceCode: number) => {
                    if (traceCode === code && fail) {
                        fail = false
                        throw new Error("trace hook fault")
                    }
                }, {}),
            )
            const input = domain.atom(0)
            const result = domain.atom(0)
            const runs = [0, 0]
            tree.sub(input, { settle: () => void runs[0]!++ })
            tree.sub(input, {
                settle: tx => {
                    runs[1]!++
                    tx.set(result, tx.get(input))
                },
            })

            expect(thrownBy(() => tree.set(input, 1))).toBeInstanceOf(
                SubscriberNotificationError,
            )
            expect(runs[1]).toBe(1)
            tree.set(input, 2)
            tree.set(input, 3)
            expect(runs).toEqual([code === 3 ? 2 : 3, 3])
            expect(tree.get(result)).toBe(3)
        })

    test("a post-apply control fault stays authoritative and the reaction's writes remain", () => {
        const { domain, tree } = fixture()
        const foreign = createCommittedStoreTreeDomain()
        const foreignCount = foreign.atom(0)
        const sibling = domain.createStoreTree()
        const trigger = domain.atom(0)
        const written = domain.atom(0)
        const contaminated = domain.selector(get => {
            const value = get(written)
            if (value !== 0) {
                try {
                    sibling.get(foreignCount)
                } catch {}
            }
            return value
        })
        const calls: string[] = []
        tree.sub(contaminated, () => calls.push("contaminated"))
        tree.sub(trigger, () => calls.push("trigger"))
        tree.sub(trigger, { settle: tx => tx.set(written, tx.get(trigger)) })

        const direct = thrownBy(() => tree.set(trigger, 1))
        expect(direct).toBeInstanceOf(RuntimeMismatchError)
        expect(calls).toEqual(["trigger", "contaminated"])
        expect(tree.get(written)).toBe(1)

        const subscriberFailure = new Error("subscriber failed")
        tree.sub(trigger, () => {
            throw subscriberFailure
        })
        const wrapped = thrownBy(() => tree.set(trigger, 2))
        expect(wrapped).toBeInstanceOf(SubscriberNotificationError)
        expect((wrapped as SubscriberNotificationError).cause).toBeInstanceOf(
            RuntimeMismatchError,
        )
        expect((wrapped as SubscriberNotificationError).causes[1]).toBe(
            subscriberFailure,
        )
    })

    test("orders reaction causes before subscriber causes and fires every subscriber", () => {
        const { domain, tree } = fixture()
        const trigger = domain.atom(0)
        const reactionFailure = new Error("reaction")
        const subscriberFailure = new Error("subscriber")
        const calls: string[] = []
        tree.sub(trigger, () => {
            calls.push("first")
            throw subscriberFailure
        })
        tree.sub(trigger, () => void calls.push("second"))
        tree.sub(trigger, {
            settle: () => {
                calls.push("reaction")
                throw reactionFailure
            },
        })

        const error = thrownBy(() => tree.set(trigger, 1))

        expect(calls).toEqual(["reaction", "first", "second"])
        expect((error as SubscriberNotificationError).causes).toEqual([
            reactionFailure,
            subscriberFailure,
        ])
    })

    test("converges on the final permitted wave", () => {
        const { domain, tree } = fixture()
        const counter = domain.atom(0)
        const observed: number[] = []
        tree.sub(counter, () => observed.push(tree.get(counter)))
        let runs = 0
        tree.sub(counter, {
            settle: tx => {
                runs++
                const value = tx.get(counter)
                if (value < 64) tx.set(counter, value + 1)
            },
        })

        tree.set(counter, 1)

        expect(runs).toBe(64)
        expect(observed).toEqual([64])
    })

    test("fails once when another wave remains, clears pending work, and later work proceeds", () => {
        const { domain, tree } = fixture()
        const ping = domain.atom(0)
        const pong = domain.atom(0)
        const unrelated = domain.atom(0)
        const observed: unknown[] = []
        const view = domain.selector(get => [get(ping), get(pong)])
        tree.sub(view, () => observed.push(tree.get(view)))
        let runs = 0
        tree.sub(ping, {
            settle: tx => {
                runs++
                tx.set(pong, tx.get(ping) + 1)
            },
        })
        tree.sub(pong, {
            settle: tx => {
                runs++
                tx.set(ping, tx.get(pong) + 1)
            },
        })

        const error = thrownBy(() => tree.set(ping, 1))

        expect(runs).toBe(64)
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect((error as SubscriberNotificationError).causes).toHaveLength(1)
        expect((error as SubscriberNotificationError).cause).toBeInstanceOf(
            SettleLimitError,
        )
        expect(error).toMatchObject({ committed: true })
        // Wave k writes k + 1; wave 64 wrote ping = 65 and wave 65 remained.
        expect(observed).toEqual([[65, 64]])
        const limit = (error as SubscriberNotificationError)
            .cause as SettleLimitError
        expect(limit).toMatchObject({
            name: "SettleLimitError",
            code: "VALDRES_SETTLE_LIMIT",
        })
        expect(Object.isFrozen(limit)).toBe(true)

        tree.set(unrelated, 1)
        expect(runs).toBe(64)
    })

    test("reports an external-source boundary failure through the invalidation", () => {
        const { domain, tree } = fixture()
        const keys = source(0)
        const external = createInternalExternalAtom(domain, keys.definition)
        const cause = new Error("reaction failed")
        tree.sub(external, {
            settle: () => {
                throw cause
            },
        })

        const error = thrownBy(() => keys.publish(1))

        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(error).toMatchObject({
            cause,
            source: "external-invalidation",
            committed: true,
        })
        expect(tree.get(external)).toBe(1)
    })
})

/*
 * An escaping recomputation failure inside a reaction's commit (injected
 * through the internal evaluation seam before the evaluator runs, or after it
 * returns but before its proposal is installed) becomes the failed selector's
 * error outcome. Its previous dependencies stay, its dependents settle against
 * it in the same boundary, and nothing computed before the write is served as
 * current. Like any selector error outcome, it stays current until one of the
 * selector's own inputs changes.
 */
type Fault =
    | "before evaluation"
    | "after evaluation"
    | "instrumentation"
    | "selector throw"

const recomputation = (external: boolean, fault: Fault) => {
    const domain = createCommittedStoreTreeDomain()
    const cause = new Error(fault)
    const observerFailure = new Error("ordinary observer")
    let inReaction = false
    let armed = false
    let injected = 0
    let derivedRuns = 0
    const finishes: boolean[] = []
    const tree = domain.createStoreTree(
        undefined,
        Object.assign(
            (code: number, detail?: unknown) => {
                if (code === 3) inReaction = true
                if (code === 4) {
                    inReaction = false
                    finishes.push(detail as boolean)
                }
                if (
                    code === 2 &&
                    inReaction &&
                    armed &&
                    fault === "instrumentation"
                ) {
                    armed = false
                    injected++
                    throw cause
                }
            },
            {
                evaluate: ((...args: Parameters<typeof evaluateSelector>) => {
                    if (
                        inReaction &&
                        armed &&
                        args[0].name === "derived" &&
                        (fault === "before evaluation" ||
                            fault === "after evaluation")
                    ) {
                        armed = false
                        injected++
                        if (fault === "after evaluation")
                            evaluateSelector(...args)
                        throw cause
                    }
                    return evaluateSelector(...args)
                }) as typeof evaluateSelector,
            },
        ),
    )
    let value = 0
    let invalidate = () => {}
    const input = external
        ? createInternalExternalAtom(domain, {
              getSnapshot: () => value,
              subscribe(next) {
                  invalidate = next
                  return () => {}
              },
          })
        : domain.atom(0)
    const written = domain.atom(0)
    const neighbor = domain.atom(0)
    const unrelated = domain.atom(0)
    const derived = domain.selector(
        get => {
            derivedRuns++
            const next = get(written) * 10
            if (fault === "selector throw" && armed && next === 10) {
                armed = false
                injected++
                throw cause
            }
            return next
        },
        { name: "derived" },
    )
    const combined = domain.selector(get => get(derived) + 1, {
        name: "combined",
    })
    const read = <Value>(
        state: Parameters<typeof tree.get<Value>>[0],
    ): unknown => {
        try {
            return tree.get(state)
        } catch (error) {
            return error
        }
    }
    // Pre-materialize and subscribe to the whole downstream chain.
    expect(tree.get(combined)).toBe(1)
    const observations: unknown[][] = []
    const calls = { written: 0, derived: 0, combined: 0 }
    let firstObservation = true
    tree.sub(input, () => {
        // Read the cached downstream selector first: reading its upstream
        // first would repair a dirty leaf and hide a stale descendant.
        const end = read(combined)
        observations.push([
            tree.get(input),
            tree.get(written),
            read(derived),
            end,
            tree.get(neighbor),
        ])
        if (firstObservation) {
            firstObservation = false
            throw observerFailure
        }
    })
    tree.sub(written, () => void calls.written++)
    tree.sub(derived, () => void calls.derived++)
    tree.sub(combined, () => void calls.combined++)
    tree.sub(input, {
        settle: tx => tx.set(written, tx.get(input) === 2 ? 1 : tx.get(input)),
    })
    let neighborRuns = 0
    tree.sub(input, {
        settle: tx => {
            neighborRuns++
            tx.set(neighbor, tx.get(input) + 100)
        },
    })
    const publish = (next: number) => {
        if (external) {
            value = next
            invalidate()
        } else tree.set(input as ReturnType<typeof domain.atom<number>>, next)
    }
    return {
        tree,
        cause,
        observerFailure,
        observations,
        calls,
        finishes,
        publish,
        unrelated,
        arm: () => {
            armed = true
            derivedRuns = 0
        },
        get injected() {
            return injected
        },
        get derivedRuns() {
            return derivedRuns
        },
        get neighborRuns() {
            return neighborRuns
        },
    }
}

const expectFailedBranch = (
    observation: unknown[] | undefined,
    cause: Error,
    head: readonly [number, number],
    neighbor: number,
) => {
    const [input, written, derived, combined, neighborValue] = observation!
    expect([input, written, neighborValue]).toEqual([...head, neighbor])
    expect(derived).toBe(cause)
    expect(combined).toBeInstanceOf(SelectorGetterError)
    const dependencyError = (combined as SelectorGetterError).cause
    expect(dependencyError).toBeInstanceOf(SelectorDependencyError)
    expect((dependencyError as SelectorDependencyError).cause).toBe(cause)
}

describe("Store settle handlers: selector recomputation failures", () => {
    for (const external of [false, true])
        for (const fault of ["before evaluation", "after evaluation"] as const)
            test(`${external ? "external" : "owned"} trigger, failure ${fault}: the failed branch publishes a coherent failure`, () => {
                const r = recomputation(external, fault)
                r.arm()

                const error = thrownBy(() => r.publish(1))

                expect(r.injected).toBe(1)
                // Exact reporting: the reaction cause, then the observer's.
                expect(error).toBeInstanceOf(SubscriberNotificationError)
                expect(error).toMatchObject({
                    causes: [r.cause, r.observerFailure],
                    committed: true,
                    source: external
                        ? "external-invalidation"
                        : "owned-mutation",
                })
                expect(r.finishes).toEqual([true, false])
                expect(r.neighborRuns).toBe(1)
                // No value computed before the write is served as current,
                // and every affected subscriber is notified once.
                expect(r.observations).toHaveLength(1)
                expectFailedBranch(r.observations[0], r.cause, [1, 1], 101)
                expect(r.calls).toEqual({ written: 1, derived: 1, combined: 1 })
                // The failed selector is not re-run within the boundary.
                expect(r.derivedRuns).toBe(fault === "after evaluation" ? 1 : 0)

                // Unrelated work notifies nothing and keeps the failure.
                r.tree.set(r.unrelated, 1)
                expect(r.observations).toHaveLength(1)
                expect(r.tree.get(r.unrelated)).toBe(1)
                // An equal write leaves the failed selector's inputs unchanged,
                // so its failure outcome remains current and coherent.
                r.publish(2)
                expectFailedBranch(r.observations[1], r.cause, [2, 1], 102)
                expect(r.calls).toEqual({ written: 1, derived: 1, combined: 1 })
                // A changed input re-evaluates the branch and recovers it.
                r.publish(3)
                expect(r.observations[2]).toEqual([3, 3, 30, 31, 103])
                expect(r.calls).toEqual({ written: 2, derived: 2, combined: 2 })
                expect(r.finishes).toEqual([
                    true,
                    false,
                    false,
                    false,
                    false,
                    false,
                ])
                expect(r.neighborRuns).toBe(3)
            })

    test("a persistent recomputation failure keeps dependency edges and recovers on the next input change", () => {
        const domain = createCommittedStoreTreeDomain()
        const cause = new Error("persistent")
        let failing = false
        let derivedRuns = 0
        const tree = domain.createStoreTree(
            undefined,
            Object.assign(() => {}, {
                evaluate: ((...args: Parameters<typeof evaluateSelector>) => {
                    if (failing && args[0].name === "derived") throw cause
                    return evaluateSelector(...args)
                }) as typeof evaluateSelector,
            }),
        )
        const input = domain.atom(0)
        const written = domain.atom(0)
        const derived = domain.selector(
            get => {
                derivedRuns++
                return get(written) * 10
            },
            { name: "derived" },
        )
        const combined = domain.selector(get => get(derived) + 1)
        tree.sub(combined, () => undefined)
        tree.sub(input, { settle: tx => tx.set(written, tx.get(input)) })
        failing = true

        expect(thrownBy(() => tree.set(input, 1))).toBeInstanceOf(
            SubscriberNotificationError,
        )
        // Reads while the fault persists serve the published failure; they
        // do not re-run the failed selector.
        const runs = derivedRuns
        expect(thrownBy(() => tree.get(derived))).toBe(cause)
        expect(thrownBy(() => tree.get(combined))).toBeInstanceOf(
            SelectorGetterError,
        )
        expect(derivedRuns).toBe(runs)

        failing = false
        tree.set(input, 2)
        expect(tree.get(derived)).toBe(20)
        expect(tree.get(combined)).toBe(21)
    })

    for (const external of [false, true])
        test(`${external ? "external" : "owned"} trigger control: an instrumentation failure keeps coherent values`, () => {
            const r = recomputation(external, "instrumentation")
            r.arm()

            const error = thrownBy(() => r.publish(1))

            expect((error as SubscriberNotificationError).causes).toEqual([
                r.cause,
                r.observerFailure,
            ])
            r.tree.set(r.unrelated, 1)
            r.publish(2)
            r.publish(3)
            expect(r.observations).toEqual([
                [1, 1, 10, 11, 101],
                [2, 1, 10, 11, 102],
                [3, 3, 30, 31, 103],
            ])
            expect(r.calls).toEqual({ written: 2, derived: 2, combined: 2 })
        })

    test("control: an ordinary selector throw follows the same failure shape", () => {
        const r = recomputation(false, "selector throw")
        r.arm()

        const error = thrownBy(() => r.publish(1))

        // A selector's own error is its outcome, not a reaction failure.
        expect((error as SubscriberNotificationError).causes).toEqual([
            r.observerFailure,
        ])
        expect(r.finishes).toEqual([false, false])
        const [, , derived, combined] = r.observations[0]!
        expect(derived).toBeInstanceOf(SelectorGetterError)
        expect((derived as SelectorGetterError).cause).toBe(r.cause)
        expect(combined).toBeInstanceOf(SelectorGetterError)
        r.publish(2)
        expect(r.observations[1]![2]).toBeInstanceOf(SelectorGetterError)
        r.publish(3)
        expect(r.observations[2]).toEqual([3, 3, 30, 31, 103])
        expect(r.calls).toEqual({ written: 2, derived: 2, combined: 2 })
    })
})

describe("Store settle handlers: callback capabilities", () => {
    test("keeps transaction-phase guards and read-only external atoms", () => {
        const { domain, tree } = fixture()
        const sibling = domain.createStoreTree()
        const keys = source(0)
        const external = createInternalExternalAtom(domain, keys.definition)
        const other = source(0)
        const otherExternal = createInternalExternalAtom(
            domain,
            other.definition,
        )
        const trigger = domain.atom(0)
        const a = domain.atom(0)
        tree.sub(otherExternal, () => undefined)
        const errors: Record<string, unknown> = {}
        let captured: RootTransaction | undefined
        tree.sub(trigger, {
            settle: tx => {
                captured = tx
                errors.get = thrownBy(() => tree.get(a))
                errors.set = thrownBy(() => tree.set(a, 1))
                errors.txn = thrownBy(() => tree.txn(() => undefined))
                errors.sub = thrownBy(() => tree.sub(a, () => undefined))
                errors.sibling = thrownBy(() => sibling.set(a, 1))
                errors.dispose = thrownBy(() => tree.dispose())
                errors.external = thrownBy(() =>
                    tx.set(external as never, 1 as never),
                )
                errors.invalidate = thrownBy(() => other.publish(1))
            },
        })

        tree.set(trigger, 1)

        expect(errors.get).toBeInstanceOf(TransactionPhaseError)
        expect(errors.set).toBeInstanceOf(TransactionPhaseError)
        expect(errors.txn).toBeInstanceOf(TransactionPhaseError)
        expect(errors.sub).toBeInstanceOf(TransactionPhaseError)
        expect(errors.sibling).toBeInstanceOf(TransactionPhaseError)
        expect(errors.dispose).toBeInstanceOf(TransactionPhaseError)
        expect(errors.external).toBeInstanceOf(TypeError)
        expect(errors.invalidate).toBeInstanceOf(CallbackCapabilityError)
        expect(thrownBy(() => captured!.get(a))).toBeInstanceOf(
            TransactionClosedError,
        )
    })

    test("unsubscribe is rejected inside a reaction and honored from a subscriber", () => {
        const { domain, tree } = fixture()
        const trigger = domain.atom(0)
        const keys = source(0)
        const external = createInternalExternalAtom(domain, keys.definition)
        let runs = 0
        let rejected: unknown
        const stop = tree.sub(external, {
            settle: () => {
                runs++
            },
        })
        tree.sub(trigger, {
            settle: () => {
                rejected = thrownBy(stop)
            },
        })
        tree.sub(trigger, () => {
            stop()
            // Deferred to a later round of this operation.
            keys.publish(1)
        })

        tree.set(trigger, 1)

        expect(rejected).toBeInstanceOf(TransactionPhaseError)
        expect(runs).toBe(0)
        expect(tree.get(external)).toBe(1)
    })
})
