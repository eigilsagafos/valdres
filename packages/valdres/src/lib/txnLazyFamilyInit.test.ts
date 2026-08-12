import { describe, expect, mock, test } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"

/** A family member that is lazily initialized *inside a transaction* via
 *  txn.get(family(key)) writes its default straight into committed
 *  data.values, but commit/abort discard the draft's body-read set, so the
 *  family-index registration the direct-read path performs never runs. The
 *  member ends up holding a value while being permanently absent from
 *  get(family). These tests lock the invariant: if a lazy read landed a
 *  value, the member must be visible in get(family). */
const memberKeys = (members: readonly { familyArgs: [string] }[]) =>
    members.map(atom => atom.familyArgs[0])

describe("lazy family-member init inside a transaction", () => {
    test("txn.get(family(key)) registers the member in get(family) (commit)", () => {
        const store1 = store()
        const fam = atomFamily<{ v: number }, [string]>({ v: 0 })

        store1.txn(({ get }) => {
            // Lazily initialize a member by reading it. Its default lands in
            // committed data.values.
            get(fam("lazy"))
        })

        // The member holds a value...
        expect(store1.get(fam("lazy"))).toStrictEqual({ v: 0 })
        // ...so it MUST be visible in the family membership list.
        expect(memberKeys(store1.get(fam))).toStrictEqual(["lazy"])
    })

    test("txn.get(family(key)) registers the member in get(family) (abort)", () => {
        const store1 = store()
        const fam = atomFamily<{ v: number }, [string]>({ v: 0 })

        expect(() => {
            store1.txn(({ get }) => {
                get(fam("lazy"))
                // Throwing aborts the transaction, but the lazy read's value
                // has already landed in committed data.values.
                throw new Error("abort")
            })
        }).toThrow("abort")

        // The value landed despite the abort...
        expect(store1.get(fam("lazy"))).toStrictEqual({ v: 0 })
        // ...so membership must be consistent with it.
        expect(memberKeys(store1.get(fam))).toStrictEqual(["lazy"])
    })

    test("green control: store.get(family(key)) registers the member directly", () => {
        const store1 = store()
        const fam2 = atomFamily<{ v: number }, [string]>({ v: 0 })

        // The direct-read path registers the member correctly today.
        expect(store1.get(fam2("lazy2"))).toStrictEqual({ v: 0 })
        expect(memberKeys(store1.get(fam2))).toStrictEqual(["lazy2"])
    })
})

/** Registration is folded into the commit's own write phase (staged into the
 *  working index while the txn is still open), so it obeys final transaction
 *  intent and settles atomically with the txn's writes — one notification,
 *  before any subscriber the commit releases. These lock that contract. */
describe("lazy family-member init respects final intent and atomicity", () => {
    test("get then del commits the deletion (not resurrected by init)", () => {
        const store1 = store()
        const fam = atomFamily<{ v: number }, [string]>({ v: 0 })
        store1.txn(({ get, del }) => {
            get(fam("lazy"))
            del(fam("lazy"))
        })
        expect(memberKeys(store1.get(fam))).toStrictEqual([])
    })

    test("get then unset keeps membership at the default value (matches set-then-unset)", () => {
        // unset resets a family member to its default but does NOT remove it
        // from the family (see a plain `set` then `unset`). So init staging must
        // not force it out either: the member stays, holding the default.
        const store1 = store()
        const fam = atomFamily<{ v: number }, [string]>({ v: 0 })
        store1.set(fam("keep"), { v: 1 })
        store1.txn(({ get, unset }) => {
            get(fam("lazy"))
            unset(fam("lazy"))
        })
        expect(memberKeys(store1.get(fam)).sort()).toStrictEqual([
            "keep",
            "lazy",
        ])
        expect(store1.get(fam("lazy"))).toStrictEqual({ v: 0 })
    })

    test("a subscriber fired during the same commit sees the lazy member", () => {
        const store1 = store()
        const fam = atomFamily<{ v: number }, [string]>({ v: 0 })
        const trigger = atom(0)
        store1.set(fam("existing"), { v: 1 })
        let observed: string[] | undefined
        store1.sub(trigger, () => {
            observed = memberKeys(store1.get(fam))
        })
        store1.txn(({ get, set }) => {
            get(fam("lazy"))
            set(trigger, 1)
        })
        expect(observed).toContain("lazy")
    })

    test("a subscriber throwing during commit still leaves the member registered", () => {
        const store1 = store()
        const fam = atomFamily<{ v: number }, [string]>({ v: 0 })
        const trigger = atom(0)
        store1.sub(trigger, () => {
            throw new Error("subscriber boom")
        })
        expect(() => {
            store1.txn(({ get, set }) => {
                get(fam("lazy"))
                set(trigger, 1)
            })
        }).toThrow("subscriber boom")
        expect(memberKeys(store1.get(fam))).toStrictEqual(["lazy"])
    })

    test("get then set notifies family subscribers once, matching set-only", () => {
        const runReadThenSet = () => {
            const store1 = store()
            const fam = atomFamily<{ v: number }, [string]>({ v: 0 })
            store1.set(fam("existing"), { v: 1 })
            const cb = mock(() => {})
            store1.sub(fam, cb)
            store1.txn(({ get, set }) => {
                get(fam("m2"))
                set(fam("m2"), { v: 9 })
            })
            return cb.mock.calls.length
        }
        const runSetOnly = () => {
            const store1 = store()
            const fam = atomFamily<{ v: number }, [string]>({ v: 0 })
            store1.set(fam("existing"), { v: 1 })
            const cb = mock(() => {})
            store1.sub(fam, cb)
            store1.txn(({ set }) => {
                set(fam("m2"), { v: 9 })
            })
            return cb.mock.calls.length
        }
        expect(runReadThenSet()).toBe(1)
        expect(runReadThenSet()).toBe(runSetOnly())
    })
})

/** The contract, stated once: a lazy init inside a transaction must leave the
 *  store in the SAME observable state as the direct read that lazily inits the
 *  same member — membership, dependent-selector values, and the subscriber /
 *  onCommitEnd notifications that go with them. A transaction coalesces its work
 *  into ONE commit, so each observer fires at most once. Measuring against the
 *  direct read (rather than hard-coded counts) keeps these honest if the shared
 *  notification contract ever changes. */
const observe = (run: (store1: any, fam: any) => void) => {
    const store1 = store()
    const fam = atomFamily<number, [string]>(() => 0)
    const size = selector(get => get(fam).length)
    const sizeCb = mock(() => {})
    const famCb = mock(() => {})
    const commitEndCb = mock(() => {})
    store1.sub(size, sizeCb)
    store1.sub(fam, famCb)
    store1.onCommitEnd(commitEndCb)
    try {
        run(store1, fam)
    } catch {}
    return {
        members: memberKeys(store1.get(fam)),
        size: store1.get(size),
        sizeSubCalls: sizeCb.mock.calls.length,
        familySubCalls: famCb.mock.calls.length,
        commitEndCalls: commitEndCb.mock.calls.length,
    }
}

describe("lazy family-member init matches the direct read it stands in for", () => {
    const direct = () => observe((s, fam) => s.get(fam("lazy")))

    test("committed transaction matches a direct lazy read", () => {
        const viaTxn = observe((s, fam) => s.txn(({ get }: any) => get(fam("lazy"))))
        expect(viaTxn).toStrictEqual(direct())
        // Pin the reference itself so a silent regression in BOTH can't pass.
        expect(viaTxn).toStrictEqual({
            members: ["lazy"],
            size: 1,
            sizeSubCalls: 1,
            familySubCalls: 1,
            commitEndCalls: 1,
        })
    })

    test("aborted transaction matches a direct lazy read (no permanently stale selector)", () => {
        const viaAbort = observe((s, fam) =>
            s.txn(({ get }: any) => {
                get(fam("lazy"))
                throw new Error("abort")
            }),
        )
        // The read's value landed, so everything that observes it must settle —
        // a bare index write would leave `size` cached at 0 forever.
        expect(viaAbort).toStrictEqual(direct())
    })

    test("get then reset registers membership and notifies once", () => {
        // reset stages the very default the lazy read already landed, so the
        // write phase is a value-equal no-op: the init pass must still deliver
        // membership AND the notification. Compare against reset alone.
        const viaGetReset = observe((s, fam) =>
            s.txn(({ get, reset }: any) => {
                get(fam("lazy"))
                reset(fam("lazy"))
            }),
        )
        const viaResetOnly = observe((s, fam) =>
            s.txn(({ reset }: any) => reset(fam("lazy"))),
        )
        expect(viaGetReset).toStrictEqual(viaResetOnly)
        expect(viaGetReset).toStrictEqual(direct())
    })

    test("get then set notifies once, matching set alone", () => {
        const viaGetSet = observe((s, fam) =>
            s.txn(({ get, set }: any) => {
                get(fam("lazy"))
                set(fam("lazy"), 7)
            }),
        )
        expect(viaGetSet).toStrictEqual(
            observe((s, fam) => s.txn(({ set }: any) => set(fam("lazy"), 7))),
        )
        expect(viaGetSet.familySubCalls).toBe(1)
    })
})

/** The init notification is part of the commit's OWN settlement (a trigger group
 *  on the commit plan), not a pass bolted on afterwards. That is what makes the
 *  observable sequence, the error behaviour, and the reporting identical to the
 *  direct read — these lock each of those properties. */
describe("lazy family-member init is settled by the commit itself", () => {
    /** Record the order in which every observer fires for one lazy init. */
    const notificationOrder = (run: (store1: any, fam: any) => void) => {
        const store1 = store()
        const fam = atomFamily<number, [string]>(() => 0)
        const size = selector(get => get(fam).length)
        const order: string[] = []
        store1.sub(size, () => order.push("selector-sub"))
        store1.sub(fam, () => order.push("family-sub"))
        store1.onChange(() => order.push("onChange"))
        store1.onCommitEnd(() => order.push("onCommitEnd"))
        try {
            run(store1, fam)
        } catch {}
        return order
    }

    test("notification order matches the direct read", () => {
        expect(
            notificationOrder((s, fam) => s.txn(({ get }: any) => get(fam("lazy")))),
        ).toStrictEqual(notificationOrder((s, fam) => s.get(fam("lazy"))))
    })

    test("onChange fires after every subscriber when the txn also writes", () => {
        const order = notificationOrder((s, fam) =>
            s.txn(({ get, set }: any) => {
                get(fam("lazy"))
                set(fam("other"), 7)
            }),
        )
        expect(order.at(-1)).toBe("onCommitEnd")
        expect(order.indexOf("onChange")).toBeGreaterThan(
            order.lastIndexOf("family-sub"),
        )
        expect(order.indexOf("onChange")).toBeGreaterThan(
            order.lastIndexOf("selector-sub"),
        )
    })

    test("a lazy init is never reported to onChange (as with a direct read)", () => {
        const reported = (run: (store1: any, fam: any) => void) => {
            const store1 = store()
            const fam = atomFamily<number, [string]>(() => 0)
            const seen: string[] = []
            // The onChange payload IS the array of changes.
            store1.onChange((changes: any[]) => {
                for (const change of changes) {
                    seen.push(String(change.state?.familyArgs?.[0]))
                }
            })
            try {
                run(store1, fam)
            } catch {}
            return seen
        }
        expect(reported((s, fam) => s.txn(({ get }: any) => get(fam("lazy"))))).toStrictEqual(
            reported((s, fam) => s.get(fam("lazy"))),
        )
        // A real write in the same txn still reports — and only itself.
        expect(
            reported((s, fam) =>
                s.txn(({ get, set }: any) => {
                    get(fam("lazyOnly"))
                    set(fam("written"), 7)
                }),
            ),
        ).toStrictEqual(["written"])
    })

    test("a throwing subscriber does not swallow the init notification", () => {
        const store1 = store()
        const fam = atomFamily<number, [string]>(() => 0)
        const trigger = atom(0)
        const famCb = mock(() => {})
        store1.sub(fam, famCb)
        store1.sub(trigger, () => {
            throw new Error("subscriber boom")
        })
        expect(() => {
            store1.txn(({ get, set }: any) => {
                get(fam("lazy"))
                set(trigger, 1)
            })
        }).toThrow("subscriber boom")
        expect(memberKeys(store1.get(fam))).toStrictEqual(["lazy"])
        expect(famCb).toHaveBeenCalledTimes(1)
    })

    test("a write phase that throws still leaves membership consistent", () => {
        // `bad.equal` throws inside the write phase, before the staged family
        // index is written — the lazy read's value has already landed, so the
        // member must not be left holding a value with no membership.
        const store1 = store()
        const fam = atomFamily<number, [string]>(() => 0)
        const bad = atom(0, {
            equal: () => {
                throw new Error("equal boom")
            },
        })
        expect(() => {
            store1.txn(({ get, set }: any) => {
                get(fam("lazy"))
                set(bad, 5)
            })
        }).toThrow("equal boom")
        expect(store1.get(fam("lazy"))).toBe(0)
        expect(memberKeys(store1.get(fam))).toStrictEqual(["lazy"])
    })

    test("aborting a cross-scope txn settles the whole tree once, atomically", () => {
        const store1 = store()
        const scoped = store1.scope("c")
        const fam = atomFamily<number, [string]>(() => 0)
        let commitEndCalls = 0
        store1.onCommitEnd(() => commitEndCalls++)
        // The root's family callback must observe the SCOPE already populated:
        // the whole tree settles before any callback runs.
        let scopeSeenByRootCallback: string[] | undefined
        store1.sub(fam, () => {
            scopeSeenByRootCallback = memberKeys(scoped.get(fam))
        })
        expect(() => {
            store1.txn((t: any) => {
                t.get(fam("rootLazy"))
                t.scope("c", (ct: any) => ct.get(fam("scopeLazy")))
                throw new Error("abort")
            })
        }).toThrow("abort")
        expect(commitEndCalls).toBe(1)
        expect(memberKeys(scoped.get(fam)).sort()).toStrictEqual([
            "rootLazy",
            "scopeLazy",
        ])
        expect(scopeSeenByRootCallback?.sort()).toStrictEqual([
            "rootLazy",
            "scopeLazy",
        ])
    })

    test("user equality runs exactly as often as for the write alone", () => {
        // Classification uses the write phase's actual result, so `equal` is
        // never invoked a second time to predict it — a stateful comparator
        // cannot disagree with the write phase and double- or zero-notify.
        const runs = (body: (t: any, fam: any) => void) => {
            let calls = 0
            const store1 = store()
            const fam = atomFamily<number, [string]>(() => 0, {
                equal: (a: number, b: number) => {
                    calls++
                    return a === b
                },
            })
            store1.txn((t: any) => body(t, fam))
            return calls
        }
        expect(runs((t, fam) => {
            t.get(fam("m"))
            t.set(fam("m"), 7)
        })).toBe(runs((t, fam) => t.set(fam("m"), 7)))
    })
})

/** Paths where the init group is the ONLY work, or where the commit failed and
 *  the repair pass runs. Each is measured against the direct read. */
describe("lazy family-member init in degenerate and failed commits", () => {
    /** A member that was set then unset still HAS membership, so a later lazy
     *  read contributes no updated/deleted/unset group — the init group is the
     *  commit's only work. It must still count as work. */
    const afterSetThenUnset = (act: (store1: any, fam: any) => void) => {
        const store1 = store()
        const fam = atomFamily<number, [string]>(() => 0)
        store1.set(fam("m"), 1)
        store1.txn(({ unset }: any) => unset(fam("m")))
        const famCb = mock(() => {})
        const commitEndCb = mock(() => {})
        store1.sub(fam, famCb)
        store1.onCommitEnd(commitEndCb)
        try {
            act(store1, fam)
        } catch {}
        return {
            members: memberKeys(store1.get(fam)),
            familySubCalls: famCb.mock.calls.length,
            commitEndCalls: commitEndCb.mock.calls.length,
        }
    }

    test("an init-only commit is work: it notifies like the direct read", () => {
        const viaTxn = afterSetThenUnset((s, fam) =>
            s.txn(({ get }: any) => get(fam("m"))),
        )
        expect(viaTxn).toStrictEqual(
            afterSetThenUnset((s, fam) => s.get(fam("m"))),
        )
        expect(viaTxn.familySubCalls).toBe(1)
        expect(viaTxn.commitEndCalls).toBe(1)
    })

    test("a failed commit's repair never resurrects an explicit delete", () => {
        const store1 = store()
        const fam = atomFamily<number, [string]>(() => 0)
        const trigger = atom(0)
        store1.sub(trigger, () => {
            throw new Error("subscriber boom")
        })
        expect(() => {
            store1.txn(({ get, del, set }: any) => {
                get(fam("m"))
                del(fam("m"))
                set(trigger, 1)
            })
        }).toThrow("subscriber boom")
        // The delete was applied; repairing membership would leave a phantom
        // member whose value is gone.
        expect(memberKeys(store1.get(fam))).toStrictEqual([])
    })

    test("a failed commit reports commit-end once, after the repair", () => {
        const store1 = store()
        const fam = atomFamily<number, [string]>(() => 0)
        const bad = atom(0, {
            equal: () => {
                throw new Error("equal boom")
            },
        })
        const order: string[] = []
        store1.sub(fam, () => order.push("family-sub"))
        store1.onCommitEnd(() => order.push("onCommitEnd"))
        expect(() => {
            store1.txn(({ get, set }: any) => {
                get(fam("lazy"))
                set(bad, 5)
            })
        }).toThrow("equal boom")
        expect(order).toStrictEqual(["family-sub", "onCommitEnd"])
    })
})

/** The repair pass repairs exactly one invariant — a member that HOLDS A VALUE
 *  must be visible in get(family) — and must do so without disturbing the
 *  commit's boundary or the transaction's lifecycle. */
describe("lazy family-member init repair after a half-applied commit", () => {
    /** An atom whose equality throws, to fail the write phase on demand. */
    const throwingAtom = () =>
        atom(0, {
            equal: () => {
                throw new Error("equal boom")
            },
        })

    test("a write that throws BEFORE the delete applies keeps membership", () => {
        // The delete never ran, so the lazily-read value is still live — the
        // member must be visible. Keying the repair off delete INTENT rather
        // than the surviving value gets exactly this case backwards.
        const store1 = store()
        const fam = atomFamily<number, [string]>(() => 0)
        const bad = throwingAtom()
        expect(() => {
            store1.txn(({ get, set, del }: any) => {
                get(fam("m"))
                set(bad, 1)
                del(fam("m"))
            })
        }).toThrow("equal boom")
        expect(store1.get(fam("m"))).toBe(0)
        expect(memberKeys(store1.get(fam))).toStrictEqual(["m"])
    })

    test("a write that throws AFTER the delete applies leaves no phantom member", () => {
        const store1 = store()
        const fam = atomFamily<number, [string]>(() => 0)
        const trigger = atom(0)
        store1.sub(trigger, () => {
            throw new Error("subscriber boom")
        })
        expect(() => {
            store1.txn(({ get, del, set }: any) => {
                get(fam("m"))
                del(fam("m"))
                set(trigger, 1)
            })
        }).toThrow("subscriber boom")
        expect(memberKeys(store1.get(fam))).toStrictEqual([])
    })

    test("repair after get+unset still reports commit-end once", () => {
        // Staging skips unset members, so the boundary gate must key off what
        // the body initialized, not off what staging kept.
        const store1 = store()
        const fam = atomFamily<number, [string]>(() => 0)
        const bad = throwingAtom()
        const order: string[] = []
        store1.sub(fam, () => order.push("family-sub"))
        store1.onCommitEnd(() => order.push("onCommitEnd"))
        expect(() => {
            store1.txn(({ get, unset, set }: any) => {
                get(fam("m"))
                unset(fam("m"))
                set(bad, 1)
            })
        }).toThrow("equal boom")
        expect(order.filter(e => e === "onCommitEnd")).toHaveLength(1)
        expect(order.at(-1)).toBe("onCommitEnd")
    })

    test("a throwing onCommitEnd still closes the transaction", () => {
        const store1 = store()
        const fam = atomFamily<number, [string]>(() => 0)
        store1.onCommitEnd(() => {
            throw new Error("commitEnd boom")
        })
        let captured: any
        expect(() => {
            store1.txn((t: any) => {
                captured = t
                t.get(fam("m"))
            })
        }).toThrow("commitEnd boom")
        // The listener error must not strand the tree mid-commit: a retained
        // handle reports "closed", not "committing".
        expect(() => captured.get(fam("m"))).toThrow(/while it is closed/)
        // The commit itself still landed.
        expect(memberKeys(store1.get(fam))).toStrictEqual(["m"])
    })
})

/** A lazy read is not a change, so it must stay invisible to `onChange` — and
 *  that has to hold for a listener that opted into selector entries too. The
 *  family index a lazy init touches carries `get(family)` selectors into the
 *  commit, so those selectors must be attributed to init provenance unless a
 *  real write also reached them. */
describe("lazy family-member init is invisible to onChange", () => {
    const reportedTypes = (
        run: (store1: any, fam: any) => void,
        options?: { selectors: boolean },
    ) => {
        const store1 = store()
        const fam = atomFamily<number, [string]>(() => 0)
        const size = selector(get => get(fam).length)
        store1.sub(size, () => {}) // keep the selector live
        const seen: string[] = []
        store1.onChange((changes: any[]) => {
            for (const change of changes) seen.push(change.type)
        }, options as any)
        try {
            run(store1, fam)
        } catch {}
        return seen
    }

    test("a committed lazy read reports nothing, with selectors enabled", () => {
        const viaTxn = reportedTypes(
            (s, fam) => s.txn(({ get }: any) => get(fam("lazy"))),
            { selectors: true },
        )
        expect(viaTxn).toStrictEqual(
            reportedTypes((s, fam) => s.get(fam("lazy")), { selectors: true }),
        )
        expect(viaTxn).toStrictEqual([])
    })

    test("an aborted lazy read reports nothing, with selectors enabled", () => {
        expect(
            reportedTypes(
                (s, fam) =>
                    s.txn(({ get }: any) => {
                        get(fam("lazy"))
                        throw new Error("abort")
                    }),
                { selectors: true },
            ),
        ).toStrictEqual([])
    })

    test("a real write in the same txn still reports its selectors", () => {
        // The family had an actual write, so its index change is not init-only
        // and must report exactly as a write-only transaction does.
        const mixed = reportedTypes(
            (s, fam) =>
                s.txn(({ get, set }: any) => {
                    get(fam("lazyOnly"))
                    set(fam("written"), 7)
                }),
            { selectors: true },
        )
        expect(mixed).toStrictEqual(
            reportedTypes(
                (s, fam) => s.txn(({ set }: any) => set(fam("written"), 7)),
                { selectors: true },
            ),
        )
        expect(mixed.filter(t => t === "selector").length).toBeGreaterThan(0)
    })
})
