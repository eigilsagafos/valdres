import { describe, expect, test } from "bun:test"
import { LeakDetector } from "../../../test/src/LeakDetector"
import {
    atom,
    family,
    selector,
    store,
    type Atom,
    type Selector,
    type Store,
} from "../../src/index"

interface MemberProbe<Member extends object> {
    readonly detector: LeakDetector
    readonly reference: WeakRef<Member>
}

const probeMember = <Member extends object>(
    member: Member,
): MemberProbe<Member> => ({
    detector: new LeakDetector(member),
    reference: new WeakRef(member),
})

const requireMember = <Member extends object>(
    reference: WeakRef<Member>,
): Member => {
    const member = reference.deref()
    if (member === undefined) {
        throw new Error("Expected the family member to still be retained")
    }
    return member
}

const expectRetained = async (detector: LeakDetector): Promise<void> => {
    expect(await detector.isLeaking(10)).toBe(true)
}

const expectCollected = async (detector: LeakDetector): Promise<void> => {
    let leaking = true
    for (let attempt = 0; attempt < 3 && leaking; attempt++) {
        leaking = await detector.isLeaking()
    }
    expect(leaking).toBe(false)
}

const expectMemberValue = <Value>(
    target: Store,
    reference: WeakRef<Atom<Value>>,
    expected: Value,
): void => {
    expect(target.get(requireMember(reference))).toBe(expected)
}

interface StateHolder<Value> {
    current: Selector<Value> | undefined
}

const expectHeldSelectorValue = <Value>(
    target: Store,
    holder: StateHolder<Value>,
    expected: Value,
): void => {
    const current = holder.current
    if (current === undefined) throw new Error("Expected a retained Selector")
    expect(target.get(current)).toBe(expected)
}

describe("v1 public family lifecycle", () => {
    test("anonymous scope resets release owned members", async () => {
        const members = family((id: string) => atom(id.length))
        const root = store()
        const anonymous = root.scope()
        const detector = (() => {
            let member: Atom<number> | undefined = members("anonymous")
            const detector = new LeakDetector(member)
            anonymous.set(member, 17)
            anonymous.reset(member)
            member = undefined
            return detector
        })()

        await expectCollected(detector)
        expect(root.get(members("anonymous"))).toBe("anonymous".length)
    })

    test("does not retain an encoded structured argument while its member stays live", async () => {
        let factoryCalls = 0
        const members = family(
            (input: { readonly id: string }) => {
                factoryCalls++
                return atom(input.id.length)
            },
            { encodeKey: input => input.id },
        )
        const holder: { current: Atom<number> | undefined } = {
            current: undefined,
        }
        const detector = (() => {
            let input: { readonly id: string } | undefined = {
                id: "structured",
            }
            const detector = new LeakDetector(input)
            holder.current = members(input)
            input = undefined
            return detector
        })()

        await expectCollected(detector)
        expect(holder.current).toBe(members({ id: "structured" }))
        expect(store().get(holder.current!)).toBe("structured".length)
        expect(factoryCalls).toBe(1)
    })

    test("the final Store reset releases a shared family member", async () => {
        const members = family((id: string) => atom(id.length))
        const first = store()
        const second = store()
        const detector = (() => {
            let member: Atom<number> | undefined = members("shared-release")
            const detector = new LeakDetector(member)
            first.set(member, 1)
            second.set(member, 2)
            first.reset(member)
            second.reset(member)
            member = undefined
            return detector
        })()

        await expectCollected(detector)
        expect(first.get(members("shared-release"))).toBe(
            "shared-release".length,
        )
        expect(second.get(members("shared-release"))).toBe(
            "shared-release".length,
        )
    })

    test("keeps an equal-value child shadow after root reset", async () => {
        const members = family((id: string) => atom(id.length))
        const root = store()
        const child = root.scope("equal-shadow")
        const { detector, reference } = (() => {
            let member: Atom<number> | undefined = members("retained")
            const probe = probeMember(member)
            root.set(member, 41)
            child.set(member, 41)
            root.reset(member)
            member = undefined
            return probe
        })()

        await expectRetained(detector)
        expectMemberValue(root, reference, "retained".length)
        expectMemberValue(child, reference, 41)
        child.dispose()
    })

    test("releases an equal-value child shadow after its final reset", async () => {
        const members = family((id: string) => atom(id.length))
        const root = store()
        const child = root.scope("equal-shadow")
        const detector = (() => {
            let member: Atom<number> | undefined = members("released")
            const detector = new LeakDetector(member)
            root.set(member, 41)
            child.set(member, 41)
            root.reset(member)
            child.reset(member)
            member = undefined
            return detector
        })()

        await expectCollected(detector)
        expect(root.get(members("released"))).toBe("released".length)
    })

    test("committed transaction writes retain members", async () => {
        const members = family((id: string) => atom(id.length))
        const target = store()
        const { detector } = (() => {
            let member: Atom<number> | undefined = members("transaction")
            const probe = probeMember(member)
            target.txn(
                transaction => transaction.set(member!, 23),
                "family set",
            )
            member = undefined
            return probe
        })()

        await expectRetained(detector)
        target.dispose()
    })

    test("transaction resets release committed family members", async () => {
        const members = family((id: string) => atom(id.length))
        const target = store()
        const detector = (() => {
            let member: Atom<number> | undefined = members("transaction-reset")
            const detector = new LeakDetector(member)
            target.txn(
                transaction => transaction.set(member!, 23),
                "family set",
            )
            target.txn(
                transaction => transaction.reset(member!),
                "family reset",
            )
            member = undefined
            return detector
        })()

        await expectCollected(detector)
        expect(target.get(members("transaction-reset"))).toBe(
            "transaction-reset".length,
        )
    })

    test("aborted transaction writes do not retain members", async () => {
        let factoryCalls = 0
        const members = family((id: string) => {
            factoryCalls++
            return atom(id.length)
        })
        const target = store()
        const sentinel = new Error("abort")
        let caught: unknown
        const { detector } = (() => {
            let member: Atom<number> | undefined = members("aborted")
            const probe = probeMember(member)
            try {
                target.txn(transaction => {
                    transaction.set(member!, 99)
                    throw sentinel
                }, "aborted family set")
            } catch (error) {
                caught = error
            }
            member = undefined
            return probe
        })()
        expect(caught).toBe(sentinel)

        await expectCollected(detector)
        expect(target.get(members("aborted"))).toBe("aborted".length)
        expect(factoryCalls).toBe(2)
    })

    test("disposing a named child releases its owned family members", async () => {
        let factoryCalls = 0
        const members = family((id: string) => {
            factoryCalls++
            return atom(id.length)
        })
        const root = store()
        const child = root.scope("named")
        const { detector } = (() => {
            let member: Atom<number> | undefined = members("named-member")
            const probe = probeMember(member)
            child.set(member, 7)
            member = undefined
            return probe
        })()

        await expectRetained(detector)
        child.dispose()
        await expectCollected(detector)
        expect(root.get(members("named-member"))).toBe("named-member".length)
        expect(factoryCalls).toBe(2)
    })

    test("disposing the root releases family members owned by it and an anonymous child", async () => {
        const members = family((id: string) => atom(id.length))
        const root = store()
        const child = root.scope()
        const { detector } = (() => {
            let member: Atom<number> | undefined = members("tree-member")
            const probe = probeMember(member)
            root.set(member, 11)
            child.set(member, 12)
            member = undefined
            return probe
        })()

        await expectRetained(detector)
        root.dispose()
        await expectCollected(detector)
    })

    test("each Store independently owns the same family member", async () => {
        const members = family((id: string) => atom(id.length))
        const first = store()
        const second = store()
        const { detector, reference } = (() => {
            let member: Atom<number> | undefined = members("shared")
            const probe = probeMember(member)
            first.set(member, 1)
            second.set(member, 2)
            first.reset(member)
            member = undefined
            return probe
        })()

        await expectRetained(detector)
        expectMemberValue(second, reference, 2)
        second.dispose()
    })

    test("ordinary Atom overrides remain weak Store keys", async () => {
        const target = store()
        const detector = (() => {
            let ordinary: Atom<number> | undefined = atom(0)
            const detector = new LeakDetector(ordinary)
            target.set(ordinary, 1)
            ordinary = undefined
            return detector
        })()

        await expectCollected(detector)
        expect(target.get(atom(0))).toBe(0)
    })

    test("a cold family Atom read does not retain its member", async () => {
        let factoryCalls = 0
        const members = family((id: string) => {
            factoryCalls++
            return atom(id.length)
        })
        const target = store()
        const detector = (() => {
            let member: Atom<number> | undefined = members("cold-atom")
            const detector = new LeakDetector(member)
            expect(target.get(member)).toBe("cold-atom".length)
            member = undefined
            return detector
        })()

        await expectCollected(detector)
        expect(target.get(members("cold-atom"))).toBe("cold-atom".length)
        expect(factoryCalls).toBe(2)
    })

    test("a cold family Selector read does not retain its member", async () => {
        let factoryCalls = 0
        const members = family((id: string) => {
            factoryCalls++
            return selector(() => id.length)
        })
        const target = store()
        const detector = (() => {
            let member: Selector<number> | undefined = members("cold-selector")
            const detector = new LeakDetector(member)
            expect(target.get(member)).toBe("cold-selector".length)
            member = undefined
            return detector
        })()

        await expectCollected(detector)
        expect(target.get(members("cold-selector"))).toBe(
            "cold-selector".length,
        )
        expect(factoryCalls).toBe(2)
    })

    test("the final unsubscribe releases a family member", async () => {
        const members = family((id: string) => selector(() => id.length))
        const target = store()
        const { detector, unsubscribeFirst, unsubscribeSecond } = (() => {
            let member: Selector<number> | undefined = members("subscribed")
            const detector = new LeakDetector(member)
            const unsubscribeFirst = target.sub(member, () => undefined)
            const unsubscribeSecond = target.sub(member, () => undefined)
            member = undefined
            return { detector, unsubscribeFirst, unsubscribeSecond }
        })()

        await expectRetained(detector)

        unsubscribeFirst()
        await expectRetained(detector)

        unsubscribeSecond()
        await expectCollected(detector)
        expect(target.get(members("subscribed"))).toBe("subscribed".length)
    })

    test("a retained parent Selector owns its family dependency snapshot until the parent is released", async () => {
        const members = family((id: string) => atom(id.length))
        const target = store()
        const holder: StateHolder<number> = { current: undefined }
        const { detector, unsubscribe } = (() => {
            holder.current = selector(get => get(members("dependency")) * 2)
            const unsubscribe = target.sub(holder.current, () => undefined)
            let dependency: Atom<number> | undefined = members("dependency")
            const detector = new LeakDetector(dependency)
            dependency = undefined
            return { detector, unsubscribe }
        })()

        await expectRetained(detector)

        unsubscribe()
        await expectRetained(detector)
        expectHeldSelectorValue(target, holder, "dependency".length * 2)

        holder.current = undefined
        await expectCollected(detector)
    })
})
