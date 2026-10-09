import { afterEach, expect, test } from "bun:test"
import {
    atom,
    collection,
    selector,
    store,
    CallbackCapabilityError,
    InvalidTransactionCallbackResultError,
    StoreDisposedError,
    SubscriberNotificationError,
    TransactionClosedError,
    TransactionPhaseError,
    type Transaction,
} from "../../src/index"
import { createCommittedStoreTreeDomain } from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { evaluateSelector } from "../../src/v1-internal/selector-evaluator/evaluate"

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 5))
const thrown = (run: () => unknown) => {
    try {
        run()
    } catch (e) {
        return e
    }
    throw new Error("expected throw")
}
const roots: ReturnType<typeof store>[] = []
const make = () => {
    const s = store()
    roots.push(s)
    return s
}
afterEach(async () => {
    for (const s of roots.splice(0)) s.dispose()
    await tick()
})

test("normal commit, result, hooks outside restrictions and after notify/return", async () => {
    const s = make(),
        a = atom(0),
        log: string[] = []
    s.sub(a, () => {
        log.push("notify")
        expect(s.get(a)).toBe(1)
    })
    const value = s.txn(tx => {
        tx.set(a, 1)
        tx.onCommit(() => {
            log.push("hook")
            s.txn(t => t.set(atom(0), 2))
            const c = s.scope()
            c.dispose()
            const stop = s.sub(a, () => {})
            stop()
            const other = store()
            other.dispose()
        })
        return 42
    })
    log.push("return")
    expect(value).toBe(42)
    expect(log).toEqual(["notify", "return"])
    await tick()
    expect(log).toEqual(["notify", "return", "hook"])
})
test("successful empty/equal/reset-noop transactions run hooks without notifications", async () => {
    const s = make(),
        child = s.scope(),
        a = atom(0),
        log: number[] = []
    let notifications = 0
    s.sub(a, () => notifications++)
    s.txn(tx => tx.onCommit(() => log.push(1)))
    s.txn(tx => {
        tx.set(a, 0)
        tx.onCommit(() => log.push(2))
    })
    child.txn(tx => {
        tx.reset(a)
        tx.onCommit(() => log.push(3))
    })
    await tick()
    expect(log).toEqual([1, 2, 3])
    expect(notifications).toBe(0)
})
test("abort after registration discards hooks and writes", async () => {
    const s = make(),
        a = atom(0),
        log: number[] = []
    const error = new Error("abort")
    expect(
        thrown(() =>
            s.txn(tx => {
                tx.set(a, 1)
                tx.onCommit(() => log.push(1))
                throw error
            }),
        ),
    ).toBe(error)
    await tick()
    expect(s.get(a)).toBe(0)
    expect(log).toEqual([])
})
test("promise-returning callback is invalid, rejection contained, no effects", async () => {
    const s = make(),
        a = atom(0),
        log: number[] = []
    const error = thrown(() =>
        s.txn(((tx: Transaction) => {
            tx.set(a, 1)
            tx.onCommit(() => log.push(1))
            return Promise.reject(new Error("async"))
        }) as never),
    )
    expect(error).toBeInstanceOf(InvalidTransactionCallbackResultError)
    await tick()
    expect(s.get(a)).toBe(0)
    expect(log).toEqual([])
})
test("validation failure after registration aborts; invalid hook callback is rejected", async () => {
    const s = make(),
        a = atom(0),
        log: number[] = []
    expect(() =>
        s.txn(tx => {
            tx.onCommit(() => log.push(1))
            tx.set(a, Promise.resolve(1) as never)
        }),
    ).toThrow()
    expect(() => s.txn(tx => tx.onCommit(null as never))).toThrow(TypeError)
    await tick()
    expect(log).toEqual([])
    expect(s.get(a)).toBe(0)
})
test("collection input validation and atom comparator failure abort registered work", async () => {
    const s = make(),
        rows = collection<string, { n: number }>(),
        a = atom(0, {
            equal: () => {
                throw new Error("comparator")
            },
        }),
        log: number[] = []
    expect(() =>
        s.txn(tx => {
            tx.onCommit(() => log.push(1))
            tx.set(rows("a"), Promise.resolve({ n: 1 }) as never)
        }),
    ).toThrow()
    expect(() =>
        s.txn(tx => {
            tx.onCommit(() => log.push(2))
            tx.set(a, 1)
        }),
    ).toThrow()
    await tick()
    expect(log).toEqual([])
    expect(s.get(rows("a"))).toBeUndefined()
    expect(s.get(a)).toBe(0)
})
test("scope cursors share the caller draft; inner normal return does not commit", async () => {
    const s = make(),
        c = s.scope("editor"),
        log: string[] = []
    s.txn(tx => {
        tx.onCommit(() => log.push("root"))
        tx.scope(c, t => t.onCommit(() => log.push("child")))
        tx.scope(c)
            .scope(s)
            .onCommit(() => log.push("root2"))
    })
    expect(() =>
        s.txn(tx => {
            tx.scope(c, t => t.onCommit(() => log.push("aborted")))
            throw new Error("later")
        }),
    ).toThrow()
    await tick()
    expect(log).toEqual(["root", "child", "root2"])
})
test("cursor revoked after callback and cannot register from guarded updater", async () => {
    const s = make(),
        a = atom(0)
    let saved!: Transaction
    s.txn(tx => {
        saved = tx
    })
    expect(() => saved.onCommit(() => {})).toThrow(TransactionClosedError)
    expect(() =>
        s.txn(tx =>
            tx.update(a, () => {
                tx.onCommit(() => {})
                return 1
            }),
        ),
    ).toThrow(CallbackCapabilityError)
})
test("captured store and subscriber write restrictions unchanged", async () => {
    const s = make(),
        other = make(),
        a = atom(0)
    expect(() => s.txn(() => other.get(a))).toThrow(TransactionPhaseError)
    const stop = s.sub(a, () => {
        expect(s.get(a)).toBe(1)
        s.set(a, 2)
    })
    expect(thrown(() => s.set(a, 1))).toBeInstanceOf(
        SubscriberNotificationError,
    )
    stop()
    expect(s.get(a)).toBe(1)
})
test("committed transaction then subscriber failure retains hooks and original error", async () => {
    const s = make(),
        a = atom(0),
        log: string[] = [],
        cause = new Error("subscriber")
    s.sub(a, () => {
        log.push("bad")
        throw cause
    })
    s.sub(a, () => log.push("good"))
    const error = thrown(() =>
        s.txn(tx => {
            tx.set(a, 1)
            tx.onCommit(() => log.push("hook"))
            return 99
        }),
    ) as SubscriberNotificationError
    log.push("caught")
    expect(error).toBeInstanceOf(SubscriberNotificationError)
    expect(error.committed).toBe(true)
    expect(s.get(a)).toBe(1)
    await tick()
    expect(log).toEqual(["bad", "good", "caught", "hook"])
})
test("successful/failing/successful sibling settle handlers each own outcome", async () => {
    const s = make(),
        a = atom(0),
        b = atom(0),
        log: string[] = []
    s.sub(a, {
        settle: tx => {
            tx.set(b, 1)
            tx.onCommit(() => log.push("one"))
        },
    })
    s.sub(a, {
        settle: tx => {
            tx.set(b, 2)
            tx.onCommit(() => log.push("bad"))
            throw new Error("settle")
        },
    })
    s.sub(a, {
        settle: tx => {
            expect(tx.get(b)).toBe(1)
            tx.onCommit(() => log.push("three"))
        },
        notify: () => log.push("notify"),
    })
    expect(() =>
        s.txn(tx => {
            tx.set(a, 1)
            tx.onCommit(() => log.push("origin"))
        }),
    ).toThrow(SubscriberNotificationError)
    await tick()
    expect(s.get(b)).toBe(1)
    expect(log).toEqual(["notify", "origin", "one", "three"])
})
test("multiple settle rounds join FIFO and notify once before any callback", async () => {
    const s = make(),
        a = atom(0),
        log: string[] = []
    s.sub(a, {
        settle: tx => {
            const n = tx.get(a)
            if (n < 3) tx.set(a, n + 1)
            tx.onCommit(() => log.push("round" + n))
        },
        notify: () => log.push("notify" + s.get(a)),
    })
    s.txn(tx => {
        tx.set(a, 1)
        tx.onCommit(() => log.push("origin"))
    })
    await tick()
    expect(log).toEqual(["notify3", "origin", "round1", "round2", "round3"])
})
test("settlement round limit preserves all 64 committed handlers", async () => {
    const s = make(),
        a = atom(0),
        log: number[] = []
    let notified = 0
    s.sub(a, {
        settle: tx => {
            const n = tx.get(a)
            tx.set(a, n + 1)
            tx.onCommit(() => log.push(n))
        },
        notify: () => notified++,
    })
    const error = thrown(() =>
        s.txn(tx => {
            tx.set(a, 1)
            tx.onCommit(() => log.push(0))
        }),
    )
    expect(error).toBeInstanceOf(SubscriberNotificationError)
    await tick()
    expect(log).toEqual(Array.from({ length: 65 }, (_, n) => n))
    expect(s.get(a)).toBe(65)
    expect(notified).toBe(1)
})
test("same and later resetAll do not erase lifecycle registrations", async () => {
    const s = make(),
        c = s.scope(),
        a = atom(0),
        log: number[] = []
    c.txn(tx => {
        tx.set(a, 1)
        tx.onCommit(() => log.push(1))
        tx.resetAll()
    })
    c.txn(tx => {
        tx.set(a, 2)
        tx.onCommit(() => log.push(2))
    })
    c.txn(tx => tx.resetAll())
    await tick()
    expect(c.get(a)).toBe(0)
    expect(log).toEqual([1, 2])
})
test("child cursor owns lifetime; root registration survives disposal of originating editor", async () => {
    const s = make(),
        c = s.scope("editor"),
        log: string[] = []
    c.txn(tx => {
        tx.onCommit(() => log.push("child"))
        tx.scope(s).onCommit(() => log.push("root"))
    })
    c.dispose()
    const replacement = s.scope("editor")
    expect(replacement).not.toBe(c)
    await tick()
    expect(log).toEqual(["root"])
    expect(() => c.txn(() => {})).toThrow(StoreDisposedError)
})
test("root disposal before execution cancels root and child callbacks", async () => {
    const s = make(),
        c = s.scope(),
        log: number[] = []
    s.txn(tx => {
        tx.onCommit(() => log.push(1))
        tx.scope(c).onCommit(() => log.push(2))
    })
    s.dispose()
    await tick()
    expect(log).toEqual([])
})
test("disposal during a batch cancels each remaining affected entry", async () => {
    const s = make(),
        c = s.scope(),
        log: string[] = []
    s.txn(tx => {
        tx.onCommit(() => {
            log.push("first")
            c.dispose()
        })
        tx.scope(c).onCommit(() => log.push("child"))
        tx.onCommit(() => {
            log.push("root")
            s.dispose()
        })
        tx.onCommit(() => log.push("late"))
    })
    await tick()
    expect(log).toEqual(["first", "root"])
})
test("started promise is not canceled by scope disposal", async () => {
    const s = make(),
        c = s.scope(),
        log: string[] = []
    let resolve!: () => void
    const promise = new Promise<void>(r => (resolve = r))
    c.txn(tx =>
        tx.onCommit(async () => {
            log.push("start")
            await promise
            log.push("finish")
        }),
    )
    await tick()
    c.dispose()
    resolve()
    await tick()
    expect(log).toEqual(["start", "finish"])
})
test("FIFO registration and commit order across independent Stores; reentrant work goes at tail", async () => {
    const s = make(),
        other = make(),
        log: string[] = []
    s.txn(tx => {
        tx.onCommit(() => {
            log.push("a")
            s.txn(t => t.onCommit(() => log.push("nested")))
            log.push("a-end")
        })
        tx.onCommit(() => log.push("b"))
    })
    other.txn(tx => tx.onCommit(() => log.push("other")))
    s.txn(tx => tx.onCommit(() => log.push("c")))
    await tick()
    expect(log).toEqual(["a", "a-end", "b", "other", "c", "nested"])
})
test("FIFO starts do not serialize promise completion", async () => {
    const s = make(),
        log: string[] = []
    let first!: () => void, second!: () => void
    const p1 = new Promise<void>(r => (first = r)),
        p2 = new Promise<void>(r => (second = r))
    s.txn(tx => {
        tx.onCommit(async () => {
            log.push("start1")
            await p1
            log.push("end1")
        })
        tx.onCommit(async () => {
            log.push("start2")
            await p2
            log.push("end2")
        })
    })
    await tick()
    second()
    await tick()
    first()
    await tick()
    expect(log).toEqual(["start1", "start2", "end2", "end1"])
})
test("sync throws, rejected promises and hostile then getter reported; later callbacks run", async () => {
    const s = make(),
        log: number[] = [],
        errors: unknown[] = [],
        old = globalThis.reportError
    globalThis.reportError = e => {
        errors.push(e)
    }
    const a = new Error("sync"),
        b = new Error("reject"),
        c = new Error("then")
    try {
        s.txn(tx => {
            tx.onCommit(() => {
                throw a
            })
            tx.onCommit(() => Promise.reject(b))
            tx.onCommit(() => ({
                get then() {
                    throw c
                },
            }))
            tx.onCommit(() => log.push(4))
        })
        await tick()
        expect(errors).toEqual([a, b, c])
        expect(log).toEqual([4])
    } finally {
        globalThis.reportError = old
    }
})
test("reporter throw/rejection fall back independently with original errors preserved", async () => {
    const s = make(),
        errors: unknown[] = [],
        tasks: (() => void)[] = [],
        old = globalThis.reportError,
        timer = globalThis.setTimeout
    // Hold timer tasks so fallback throws can be asserted without an uncaught
    // process error; execute reset tasks too, without inspecting function text.
    globalThis.setTimeout = ((fn: () => void) => {
        tasks.push(fn)
        return 0
    }) as typeof setTimeout
    const realTick = () => new Promise<void>(resolve => timer(resolve, 5))
    const cause = new Error("callback"),
        failure = new Error("reporter")
    let ran = 0
    try {
        globalThis.reportError = () => {
            throw failure
        }
        s.txn(tx => {
            tx.onCommit(() => {
                throw cause
            })
            tx.onCommit(() => ran++)
        })
        await realTick()
        globalThis.reportError = (() =>
            Promise.reject(failure)) as typeof reportError
        s.txn(tx => tx.onCommit(() => Promise.reject(cause)))
        await realTick()
        for (const task of tasks) {
            try {
                task()
            } catch (error) {
                errors.push(error)
            }
        }
        expect(ran).toBe(1)
        expect(errors).toHaveLength(2)
        for (const e of errors)
            expect((e as AggregateError).errors).toEqual([cause, failure])
    } finally {
        globalThis.reportError = old
        globalThis.setTimeout = timer
    }
})
test("ordinary selector throw is a served error, unlike internal injected escape", async () => {
    const s = make(),
        a = atom(0),
        cause = new Error("selector"),
        log: string[] = []
    const derived = selector(get => {
        if (get(a)) throw cause
        return 0
    })
    s.sub(derived, () => {
        expect(() => s.get(derived)).toThrow()
    })
    expect(() =>
        s.txn(tx => {
            tx.set(a, 1)
            tx.onCommit(() => log.push("committed"))
        }),
    ).not.toThrow()
    await tick()
    expect(log).toEqual(["committed"])
})
test("INTERNAL FAULT INJECTION: escaped evaluator error after apply retains hooks", async () => {
    const domain = createCommittedStoreTreeDomain(),
        cause = new Error("internal"),
        log: string[] = []
    let armed = false
    const s = domain.createStoreTree(
        undefined,
        Object.assign(() => {}, {
            evaluate: ((...args: Parameters<typeof evaluateSelector>) => {
                if (armed) {
                    armed = false
                    throw cause
                }
                return evaluateSelector(...args)
            }) as typeof evaluateSelector,
        }),
    )
    const a = domain.atom(0),
        derived = domain.selector(get => get(a) * 2)
    s.sub(derived, () => {})
    armed = true
    expect(
        thrown(() =>
            s.txn(tx => {
                tx.set(a, 1)
                tx.onCommit(() => log.push("committed"))
            }),
        ),
    ).toBe(cause)
    expect(s.get(a)).toBe(1)
    await tick()
    expect(log).toEqual(["committed"])
    s.dispose()
})
test("reentrant sync + promise hooks yield to tasks within the shared 1024 budget", async () => {
    const s = make(),
        other = make()
    let count = 0,
        seenAtTimer = -1
    const register = () =>
        (count % 2 ? s : other).txn(tx =>
            tx.onCommit(async () => {
                count++
                if (count < 2200) {
                    if (count % 2) await Promise.resolve()
                    register()
                }
            }),
        )
    setTimeout(() => (seenAtTimer = count), 0)
    register()
    for (let n = 0; n < 30 && count < 2200; n++) await tick()
    expect(count).toBe(2200)
    expect(seenAtTimer).toBeGreaterThan(0)
    expect(seenAtTimer).toBeLessThanOrEqual(1024)
})
test("disposal attempt inside aborting transaction remains restricted; does not cancel old hooks", async () => {
    const s = make(),
        log: string[] = []
    s.txn(tx => tx.onCommit(() => log.push("old")))
    expect(() =>
        s.txn(tx => {
            tx.onCommit(() => log.push("new"))
            s.dispose()
        }),
    ).toThrow(TransactionPhaseError)
    await tick()
    expect(log).toEqual(["old"])
})
test("INTERNAL FAULT INJECTION: pre-apply trace fails vs post-apply trace fails", async () => {
    for (const phase of [1, 2]) {
        const domain = createCommittedStoreTreeDomain(),
            cause = new Error("trace" + phase),
            log: number[] = []
        const s = domain.createStoreTree(undefined, ((code: number) => {
                if (code === phase) throw cause
            }) as never),
            a = domain.atom(0)
        expect(
            thrown(() =>
                s.txn(tx => {
                    tx.set(a, 1)
                    tx.onCommit(() => log.push(1))
                }),
            ),
        ).toBe(cause)
        await tick()
        expect(s.get(a)).toBe(phase === 1 ? 0 : 1)
        expect(log).toEqual(phase === 1 ? [] : [1])
        s.dispose()
    }
})
test("original subscriber error stays synchronous when deferred callback also fails", async () => {
    const s = make(),
        a = atom(0),
        original = new Error("subscriber"),
        hook = new Error("hook"),
        reports: unknown[] = [],
        old = globalThis.reportError
    globalThis.reportError = e => {
        reports.push(e)
    }
    try {
        s.sub(a, () => {
            throw original
        })
        const error = thrown(() =>
            s.txn(tx => {
                tx.set(a, 1)
                tx.onCommit(() => {
                    throw hook
                })
            }),
        ) as SubscriberNotificationError
        expect(error.causes).toContain(original)
        expect(reports).toEqual([])
        await tick()
        expect(reports).toEqual([hook])
        expect(s.get(a)).toBe(1)
    } finally {
        globalThis.reportError = old
    }
})
test("onCommit is bound, registration returns void, and same named scope is shared", async () => {
    const s = make(),
        c = s.scope("shared"),
        log: number[] = []
    expect(s.scope("shared")).toBe(c)
    c.txn(({ onCommit }) => {
        expect(onCommit(() => log.push(1))).toBeUndefined()
    })
    s.scope("shared").dispose()
    await tick()
    expect(log).toEqual([])
})
test("caught scope callback error is not a savepoint; outer commit owns its registration", async () => {
    const s = make(),
        c = s.scope(),
        log: string[] = []
    s.txn(tx => {
        try {
            tx.scope(c, t => {
                t.onCommit(() => log.push("kept"))
                throw new Error("caught")
            })
        } catch {}
    })
    await tick()
    expect(log).toEqual(["kept"])
})
test("promise-returning settle handler discards only its own registrations", async () => {
    const s = make(),
        a = atom(0),
        log: string[] = []
    s.sub(a, {
        settle: ((tx: Transaction) => {
            tx.onCommit(() => log.push("async"))
            return Promise.reject(new Error("bad"))
        }) as never,
    })
    s.sub(a, { settle: tx => tx.onCommit(() => log.push("sibling")) })
    expect(() =>
        s.txn(tx => {
            tx.set(a, 1)
            tx.onCommit(() => log.push("origin"))
        }),
    ).toThrow()
    await tick()
    expect(log).toEqual(["origin", "sibling"])
})

test("callback receives no internal receiver or arguments", async () => {
    const root = make()
    let receiver: unknown = "not called"
    let args: unknown[] = ["not called"]
    root.txn(tx =>
        tx.onCommit(function (this: unknown, ...values: unknown[]) {
            receiver = this
            args = values
        }),
    )
    await tick()
    expect(receiver).toBeUndefined()
    expect(args).toEqual([])
})
