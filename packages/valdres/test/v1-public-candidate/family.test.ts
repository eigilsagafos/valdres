import { describe, expect, test } from "bun:test"
import { readHydrationSnapshot } from "../../src/adapter-internals/v1"
import {
    CallbackCapabilityError,
    RuntimeMismatchError,
    atom,
    family,
    selector,
    store,
    type Atom,
    type FamilyKey,
    type Selector,
    type State,
    type Store,
} from "../../src/index"
import { createCommittedStoreTreeDomain } from "../../src/v1-internal/committed-store-tree/committed-store-tree"

type Equal<Left, Right> =
    (<Value>() => Value extends Left ? 1 : 2) extends <
        Value,
    >() => Value extends Right ? 1 : 2
        ? true
        : false

const assertType = <Condition extends true>(): void => {}

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const makeObservedThenable = () => {
    let containmentCalls = 0
    const thenable = Object.freeze({
        then(_resolve?: unknown, _reject?: unknown): void {
            containmentCalls++
        },
    })
    return {
        thenable,
        containmentCalls: (): number => containmentCalls,
    }
}

describe("v1 public family identity", () => {
    test("defines FamilyKey as exactly the seven primitive key categories", () => {
        assertType<
            Equal<
                FamilyKey,
                string | number | bigint | boolean | symbol | null | undefined
            >
        >()

        const marker = Symbol("marker")
        const keys: readonly FamilyKey[] = Object.freeze([
            "text",
            1,
            2n,
            true,
            marker,
            null,
            undefined,
        ])
        expect(keys).toEqual(["text", 1, 2n, true, marker, null, undefined])

        if (false) {
            // @ts-expect-error structured objects are not FamilyKey values.
            const objectKey: FamilyKey = { id: "a" }
            // @ts-expect-error arrays are not FamilyKey values.
            const arrayKey: FamilyKey = ["a"]
            // @ts-expect-error functions are not FamilyKey values.
            const functionKey: FamilyKey = () => "a"
            void [objectKey, arrayKey, functionKey]
        }
    })

    test("memoizes ordered primitive tuples by arity and SameValueZero", () => {
        let factoryCalls = 0
        const members = family((first: FamilyKey, ...rest: FamilyKey[]) => {
            factoryCalls++
            return atom({ first, rest })
        })
        const nan = members(Number.NaN)
        const zero = members(0)
        const one = members(1)
        const stringOne = members("1")
        const prefix = members("group")
        const tuple = members("group", 1)
        const reversed = members(1, "group")
        const extended = members("group", 1, undefined)
        const explicitUndefined = members(undefined)
        const nullable = members(null)
        const bigint = members(1n)
        const boolean = members(false)
        const sharedSymbol = Symbol("shared")
        const symbol = members(sharedSymbol)

        expect(members(Number.NaN)).toBe(nan)
        expect(members(-0)).toBe(zero)
        expect(members(+0)).toBe(zero)
        expect(members(1)).toBe(one)
        expect(members("1")).toBe(stringOne)
        expect(members("group")).toBe(prefix)
        expect(members("group", 1)).toBe(tuple)
        expect(members(1, "group")).toBe(reversed)
        expect(members("group", 1, undefined)).toBe(extended)
        expect(members(undefined)).toBe(explicitUndefined)
        expect(members(null)).toBe(nullable)
        expect(members(1n)).toBe(bigint)
        expect(members(false)).toBe(boolean)
        expect(members(sharedSymbol)).toBe(symbol)

        expect(one).not.toBe(stringOne)
        expect(prefix).not.toBe(tuple)
        expect(tuple).not.toBe(reversed)
        expect(tuple).not.toBe(extended)
        expect(members(Symbol("shared"))).not.toBe(symbol)
        expect(factoryCalls).toBe(14)
    })

    test("matches a slow tuple-identity model across deterministic mixed keys", () => {
        const shared = Symbol("shared")
        const values: readonly FamilyKey[] = [
            "a",
            "b",
            0,
            -0,
            1,
            Number.NaN,
            1n,
            false,
            true,
            shared,
            null,
            undefined,
        ]
        const modeled: Array<{
            readonly keys: readonly FamilyKey[]
            readonly member: Atom<number>
        }> = []
        let factoryCalls = 0
        const members = family((first: FamilyKey, ...rest: FamilyKey[]) =>
            atom(++factoryCalls + String(first).length + rest.length),
        )
        const sameValueZero = (left: FamilyKey, right: FamilyKey): boolean =>
            left === right || (left !== left && right !== right)
        let seed = 0x5eed
        const nextRandom = (): number => {
            seed ^= seed << 13
            seed ^= seed >>> 17
            seed ^= seed << 5
            return (seed >>>= 0)
        }

        for (let sample = 0; sample < 1_024; sample++) {
            const length = 1 + (nextRandom() % 4)
            const keys: FamilyKey[] = []
            for (let index = 0; index < length; index++) {
                keys.push(values[nextRandom() % values.length])
            }
            const expected = modeled.find(
                entry =>
                    entry.keys.length === keys.length &&
                    entry.keys.every((key, index) =>
                        sameValueZero(key, keys[index]),
                    ),
            )
            const member = Reflect.apply(members, undefined, keys)
            if (expected === undefined) {
                modeled.push({ keys: [...keys], member })
            } else {
                expect(member).toBe(expected.member)
            }
        }

        expect(factoryCalls).toBe(modeled.length)
        expect(modeled.length).toBeGreaterThan(100)
    })

    test("preserves the exact Atom and Selector subtype returned by each factory", () => {
        const source = atom(3)
        const atoms = family((group: string, id: number) => atom({ group, id }))
        const selectors = family((factor: number) =>
            selector(get => get(source) * factor),
        )

        assertType<
            Equal<
                typeof atoms,
                (
                    group: string,
                    id: number,
                ) => Atom<{ group: string; id: number }>
            >
        >()
        assertType<
            Equal<typeof selectors, (factor: number) => Selector<number>>
        >()
        assertType<
            Equal<ReturnType<typeof atoms>, Atom<{ group: string; id: number }>>
        >()
        assertType<Equal<ReturnType<typeof selectors>, Selector<number>>>()

        const target = store()
        const atomMember: Atom<{ group: string; id: number }> = atoms("a", 1)
        const selectorMember: Selector<number> = selectors(4)
        expect(target.get(atomMember)).toEqual({ group: "a", id: 1 })
        expect(target.get(selectorMember)).toBe(12)
    })

    test("uses one encoded primitive as identity while factories receive raw arguments", () => {
        interface Input {
            readonly id: string
            readonly payload: string
        }

        const encodedArguments: Array<readonly [Input, number]> = []
        const factoryArguments: Array<readonly [Input, number]> = []
        const members = family(
            (input: Input, revision: number) => {
                factoryArguments.push([input, revision])
                return atom(`${input.payload}:${revision}`)
            },
            {
                encodeKey: (input, revision) => {
                    encodedArguments.push([input, revision])
                    return input.id
                },
            },
        )
        const firstInput: Input = { id: "same", payload: "first" }
        const collidingInput: Input = { id: "same", payload: "second" }
        const otherInput: Input = { id: "other", payload: "third" }

        const first = members(firstInput, 1)
        const collision = members(collidingInput, 2)
        const other = members(otherInput, 3)

        expect(collision).toBe(first)
        expect(other).not.toBe(first)
        expect(encodedArguments).toEqual([
            [firstInput, 1],
            [collidingInput, 2],
            [otherInput, 3],
        ])
        expect(factoryArguments).toEqual([
            [firstInput, 1],
            [otherInput, 3],
        ])
        expect(store().get(first)).toBe("first:1")
    })

    test("rejects zero keys and unencoded structured keys before factory work", () => {
        let factoryCalls = 0
        const primitive = family((key: string) => {
            factoryCalls++
            return atom(key)
        })
        const variadic = family((first: string, second: string) => {
            factoryCalls++
            return atom(`${first}:${second}`)
        })

        expect(
            thrownBy(() => Reflect.apply(primitive, undefined, [])),
        ).toMatchObject({
            name: "TypeError",
            message: "family members require at least one key",
        })
        for (const invalid of [{ id: "a" }, ["a"], () => "a"]) {
            expect(
                thrownBy(() => Reflect.apply(primitive, undefined, [invalid])),
            ).toMatchObject({
                name: "TypeError",
                message:
                    "family keys must be primitive; use encodeKey for structured arguments",
            })
        }
        expect(
            thrownBy(() =>
                Reflect.apply(variadic, undefined, ["a", { id: "b" }]),
            ),
        ).toBeInstanceOf(TypeError)
        expect(factoryCalls).toBe(0)

        if (false) {
            // @ts-expect-error family factories require at least one argument.
            family(() => atom(0))
            // @ts-expect-error structured arguments require an explicit encodeKey.
            family((input: { readonly id: string }) => atom(input.id))
            // @ts-expect-error unencoded family calls accept only primitive keys.
            primitive({ id: "a" })
            // @ts-expect-error family accessors require at least one argument.
            primitive()
        }
    })

    test("validates the family constructor, options, and encoded result", () => {
        const validFactory = (key: string) => atom(key)

        expect(
            thrownBy(() => Reflect.apply(family, undefined, [])),
        ).toBeInstanceOf(TypeError)
        expect(
            thrownBy(() => Reflect.apply(family, undefined, [null])),
        ).toMatchObject({
            name: "TypeError",
            message: "family requires a State factory function",
        })
        expect(
            thrownBy(() =>
                Reflect.apply(family, undefined, [validFactory, null]),
            ),
        ).toMatchObject({
            name: "TypeError",
            message: "family options must be an object",
        })
        expect(
            thrownBy(() =>
                Reflect.apply(family, undefined, [
                    validFactory,
                    {
                        encodeKey: "id",
                    },
                ]),
            ),
        ).toMatchObject({
            name: "TypeError",
            message: "family encodeKey must be a function",
        })
        expect(
            thrownBy(() =>
                Reflect.apply(family, undefined, [validFactory, {}, "extra"]),
            ),
        ).toBeInstanceOf(TypeError)

        const invalidEncoding = family(validFactory, {
            encodeKey: (() => ({ id: "a" })) as never,
        })
        expect(() => invalidEncoding("a")).toThrow(
            "family encodeKey must return one primitive FamilyKey",
        )

        if (false) {
            // @ts-expect-error the factory must be a function returning State.
            family(null)
            // @ts-expect-error family options must be an object.
            family(validFactory, "options")
            // @ts-expect-error encodeKey must be a function.
            family(validFactory, { encodeKey: "id" })
            // @ts-expect-error FamilyOptions is a closed surface.
            family(validFactory, { name: "legacy-family" })
            // @ts-expect-error exact optional properties reject undefined encoders.
            family(validFactory, { encodeKey: undefined })
            // @ts-expect-error encoders must return a primitive FamilyKey.
            family(validFactory, { encodeKey: key => ({ key }) })
        }
    })
})

describe("v1 public family failure semantics", () => {
    test("does not cache factory throws and retries the same identity", () => {
        const sentinel = new Error("factory failed")
        let shouldThrow = true
        let calls = 0
        const members = family((key: string) => {
            calls++
            if (shouldThrow) throw sentinel
            return atom(key)
        })

        expect(thrownBy(() => members("a"))).toBe(sentinel)
        shouldThrow = false
        const recovered = members("a")
        expect(members("a")).toBe(recovered)
        expect(calls).toBe(2)
    })

    test("does not cache encoder throws or call the factory for them", () => {
        const sentinel = new Error("encoder failed")
        let shouldThrow = true
        let encoderCalls = 0
        let factoryCalls = 0
        const members = family(
            (input: { readonly id: string }) => {
                factoryCalls++
                return atom(input.id)
            },
            {
                encodeKey: input => {
                    encoderCalls++
                    if (shouldThrow) throw sentinel
                    return input.id
                },
            },
        )
        const input = { id: "a" }

        expect(thrownBy(() => members(input))).toBe(sentinel)
        shouldThrow = false
        const recovered = members(input)
        expect(members(input)).toBe(recovered)
        expect(encoderCalls).toBe(3)
        expect(factoryCalls).toBe(1)
    })

    test("contains returned and thrown factory thenables synchronously", () => {
        const returned = makeObservedThenable()
        const thrown = makeObservedThenable()
        const returnedFamily = Reflect.apply(family, undefined, [
            (_key: string) => returned.thenable,
        ]) as (key: string) => State<unknown>
        const thrownFamily = Reflect.apply(family, undefined, [
            (_key: string) => {
                throw thrown.thenable
            },
        ]) as (key: string) => State<unknown>

        expect(thrownBy(() => returnedFamily("a"))).toMatchObject({
            name: "TypeError",
            message: "Definition callbacks must complete synchronously",
        })
        expect(thrownBy(() => thrownFamily("a"))).toMatchObject({
            name: "TypeError",
            message: "Definition callbacks must complete synchronously",
        })
        expect(returned.containmentCalls()).toBe(1)
        expect(thrown.containmentCalls()).toBe(1)

        if (false) {
            // @ts-expect-error asynchronous factories cannot produce State.
            family(async (key: string) => atom(key))
        }
    })

    test("contains returned and thrown encoder thenables synchronously", () => {
        const returned = makeObservedThenable()
        const thrown = makeObservedThenable()
        let factoryCalls = 0
        const createNode = (input: { readonly id: string }) => {
            factoryCalls++
            return atom(input.id)
        }
        const returnedFamily = family(createNode, {
            encodeKey: (() => returned.thenable) as never,
        })
        const thrownFamily = family(createNode, {
            encodeKey: (() => {
                throw thrown.thenable
            }) as never,
        })

        expect(thrownBy(() => returnedFamily({ id: "a" }))).toMatchObject({
            name: "TypeError",
            message: "Definition callbacks must complete synchronously",
        })
        expect(thrownBy(() => thrownFamily({ id: "a" }))).toMatchObject({
            name: "TypeError",
            message: "Definition callbacks must complete synchronously",
        })
        expect(returned.containmentCalls()).toBe(1)
        expect(thrown.containmentCalls()).toBe(1)
        expect(factoryCalls).toBe(0)

        if (false) {
            // @ts-expect-error asynchronous encoders cannot produce FamilyKey.
            family(createNode, { encodeKey: async input => input.id })
        }
    })

    test("contains a rejected native Promise without an unhandled rejection", async () => {
        const rejection = new Error("rejected family result")
        const unhandled: unknown[] = []
        const onUnhandled = (reason: unknown): void => {
            unhandled.push(reason)
        }
        process.on("unhandledRejection", onUnhandled)
        try {
            const rejected = Promise.reject(rejection)
            const members = Reflect.apply(family, undefined, [
                (_key: string) => rejected,
            ]) as (key: string) => State<unknown>

            expect(thrownBy(() => members("a"))).toMatchObject({
                name: "TypeError",
                message: "Definition callbacks must complete synchronously",
            })
            await Bun.sleep(0)
            expect(unhandled).toEqual([])
        } finally {
            process.off("unhandledRejection", onUnhandled)
        }
    })

    test("rejects same-key factory recursion even when caught, then recovers", () => {
        let recurse = true
        let innerError: unknown
        let calls = 0
        let members!: (key: string) => Atom<string>
        members = family((key: string) => {
            calls++
            if (recurse) {
                try {
                    members(key)
                } catch (error) {
                    innerError = error
                }
            }
            return atom(key)
        })

        const outerError = thrownBy(() => members("same"))
        expect(outerError).toBe(innerError)
        expect(outerError).toMatchObject({
            name: "TypeError",
            message: "family cannot recursively construct the same member",
        })

        recurse = false
        const recovered = members("same")
        expect(members("same")).toBe(recovered)
        expect(calls).toBe(2)
    })

    test("allows different-key recursion and published family aliases", () => {
        const constructionOrder: string[] = []
        let members!: (key: string) => Atom<string>
        members = family((key: string) => {
            constructionOrder.push(key)
            if (key === "outer") members("inner")
            return atom(key)
        })
        const values = family((key: string) => atom(key.length))
        const derived = family((key: string) =>
            selector(get => get(values(key)) * 2),
        )
        const aliases = family((key: string) => values(key))
        let sameFamilyAliases!: (key: string) => Atom<string>
        sameFamilyAliases = family((key: string) =>
            key === "canonical" ? atom(key) : sameFamilyAliases("canonical"),
        )

        const outer = members("outer")
        const inner = members("inner")
        expect(outer).not.toBe(inner)
        expect(constructionOrder).toEqual(["outer", "inner"])
        expect(store().get(derived("abcd"))).toBe(8)
        expect(aliases("abcd")).toBe(values("abcd"))
        expect(sameFamilyAliases("alias")).toBe(sameFamilyAliases("canonical"))
    })

    test("rejects self-recursion from encodeKey before factory work", () => {
        let factoryCalls = 0
        let innerError: unknown
        let members!: (key: string) => Atom<string>
        members = family(
            (key: string) => {
                factoryCalls++
                return atom(key)
            },
            {
                encodeKey: key => {
                    try {
                        members(`${key}:other`)
                    } catch (error) {
                        innerError = error
                    }
                    return key
                },
            },
        )

        const outerError = thrownBy(() => members("a"))
        expect(outerError).toBe(innerError)
        expect(outerError).toMatchObject({
            name: "TypeError",
            message: "family encodeKey cannot call its own family",
        })
        expect(factoryCalls).toBe(0)
    })

    test("rejects plain, same-domain non-State, and foreign State results", () => {
        const existingAtom = atom(1)
        const existingSelector = selector(() => 1)
        const nonStateResults: readonly unknown[] = [
            null,
            1,
            { kind: "atom" },
            () => atom(0),
            store(),
        ]

        for (const result of nonStateResults) {
            const members = Reflect.apply(family, undefined, [
                (_key: string) => result,
            ]) as (key: string) => State<unknown>
            expect(thrownBy(() => members("a"))).toMatchObject({
                name: "TypeError",
                message:
                    "family factories must construct or return a family State",
            })
        }

        for (const existingState of [existingAtom, existingSelector]) {
            const members = family((_key: string) => existingState)
            expect(thrownBy(() => members("a"))).toMatchObject({
                name: "TypeError",
                message:
                    "family factories must construct or return a family State",
            })
        }

        const foreign = createCommittedStoreTreeDomain()
        let foreignFactoryCalls = 0
        const foreignMembers = family((key: string) => {
            foreignFactoryCalls++
            return foreign.atom(key)
        })
        expect(thrownBy(() => foreignMembers("a"))).toBeInstanceOf(
            RuntimeMismatchError,
        )
        expect(thrownBy(() => foreignMembers("a"))).toBeInstanceOf(
            RuntimeMismatchError,
        )
        expect(foreignFactoryCalls).toBe(2)

        if (false) {
            // @ts-expect-error family factories must return a State subtype.
            family((key: string) => ({ key }))
        }
    })
})

describe("v1 public family capability and Store semantics", () => {
    const selectorReadLanes: ReadonlyArray<
        readonly [string, (target: Store, state: State<string>) => string]
    > = [
        ["committed", (target, state) => target.get(state)],
        [
            "transaction scratch",
            (target, state) =>
                target.txn(transaction => transaction.get(state)),
        ],
        ["hydration", (target, state) => readHydrationSnapshot(target, state)],
    ]

    test("quarantines hostile thenable inspection and containment", () => {
        const target = store()
        const count = atom(0)
        const hostileGetter = Object.defineProperty({}, "then", {
            get() {
                target.set(count, 1)
                return undefined
            },
        })
        const hostileThenable = {
            then(): void {
                target.set(count, 2)
            },
        }
        const factoryInspectionFamilies = [
            Reflect.apply(family, undefined, [(_key: string) => hostileGetter]),
            Reflect.apply(family, undefined, [
                (_key: string) => {
                    throw hostileGetter
                },
            ]),
        ] as ReadonlyArray<(key: string) => State<unknown>>
        const factoryContainmentFamily = Reflect.apply(family, undefined, [
            (_key: string) => hostileThenable,
        ]) as (key: string) => State<unknown>
        const encoderInspectionFamily = family(
            (input: { readonly id: string }) => atom(input.id),
            { encodeKey: (() => hostileGetter) as never },
        )
        const encoderContainmentFamily = family(
            (input: { readonly id: string }) => atom(input.id),
            { encodeKey: (() => hostileThenable) as never },
        )

        for (const members of factoryInspectionFamilies) {
            expect(thrownBy(() => members("a"))).toBeInstanceOf(
                CallbackCapabilityError,
            )
        }
        expect(
            thrownBy(() => encoderInspectionFamily({ id: "a" })),
        ).toBeInstanceOf(CallbackCapabilityError)
        expect(thrownBy(() => factoryContainmentFamily("a"))).toMatchObject({
            name: "TypeError",
            message: "Definition callbacks must complete synchronously",
        })
        expect(
            thrownBy(() => encoderContainmentFamily({ id: "a" })),
        ).toMatchObject({
            name: "TypeError",
            message: "Definition callbacks must complete synchronously",
        })
        expect(target.get(count)).toBe(0)
    })

    test("quarantines captured Store work in factories without side effects", () => {
        const target = store()
        const count = atom(0)
        let updaterCalls = 0
        let subscriberCalls = 0
        const operations: ReadonlyArray<readonly [string, () => unknown]> = [
            ["read", () => target.get(count)],
            ["set", () => target.set(count, 1)],
            [
                "update",
                () =>
                    target.update(count, current => {
                        updaterCalls++
                        return current + 1
                    }),
            ],
            ["reset", () => target.reset(count)],
            ["transaction", () => target.txn(() => undefined)],
            ["subscribe", () => target.sub(count, () => subscriberCalls++)],
            ["scope", () => target.scope("captured")],
            ["dispose", () => target.dispose()],
        ]

        for (const [name, operation] of operations) {
            const members = family((key: string) => {
                operation()
                return atom(`${name}:${key}`)
            })
            expect(thrownBy(() => members("a"))).toBeInstanceOf(
                CallbackCapabilityError,
            )
        }

        expect(target.get(count)).toBe(0)
        expect(updaterCalls).toBe(0)
        expect(subscriberCalls).toBe(0)
        expect(target.scope("captured")).toBeDefined()
    })

    test("quarantines captured Store work in encoders before factory work", () => {
        const target = store()
        const count = atom(0)
        let updaterCalls = 0
        let subscriberCalls = 0
        let factoryCalls = 0
        const operations: ReadonlyArray<readonly [string, () => unknown]> = [
            ["read", () => target.get(count)],
            ["set", () => target.set(count, 1)],
            [
                "update",
                () =>
                    target.update(count, current => {
                        updaterCalls++
                        return current + 1
                    }),
            ],
            ["reset", () => target.reset(count)],
            ["transaction", () => target.txn(() => undefined)],
            ["subscribe", () => target.sub(count, () => subscriberCalls++)],
            ["scope", () => target.scope("captured")],
            ["dispose", () => target.dispose()],
        ]

        for (const [name, operation] of operations) {
            const members = family(
                (input: { readonly id: string }) => {
                    factoryCalls++
                    return atom(`${name}:${input.id}`)
                },
                {
                    encodeKey: input => {
                        operation()
                        return input.id
                    },
                },
            )
            expect(thrownBy(() => members({ id: "a" }))).toBeInstanceOf(
                CallbackCapabilityError,
            )
        }

        expect(target.get(count)).toBe(0)
        expect(updaterCalls).toBe(0)
        expect(subscriberCalls).toBe(0)
        expect(factoryCalls).toBe(0)
        expect(target.scope("captured")).toBeDefined()
    })

    test("quarantines an active selector get captured by a family factory", () => {
        for (const [lane, read] of selectorReadLanes) {
            const source = atom(7)
            let capturedGet: (<Value>(state: State<Value>) => Value) | undefined
            let caught: unknown
            let outerCaught: unknown
            let factoryCalls = 0
            let attemptCapturedRead = true
            const members = family((key: string) => {
                factoryCalls++
                if (attemptCapturedRead) {
                    try {
                        capturedGet!(source)
                    } catch (error) {
                        caught = error
                    }
                }
                return atom(`${lane}:${key}`)
            })
            const outer = selector(get => {
                capturedGet = get
                try {
                    return get(members("member"))
                } catch (error) {
                    outerCaught = error
                    return "recovered"
                }
            })
            const target = store()

            const failure = thrownBy(() => read(target, outer))
            expect(failure).toBeInstanceOf(CallbackCapabilityError)
            expect(caught).toBeInstanceOf(CallbackCapabilityError)
            expect(failure).toBe(caught)
            expect(outerCaught).toBe(caught)
            expect(factoryCalls).toBe(1)

            attemptCapturedRead = false
            expect(read(store(), outer)).toBe(`${lane}:member`)
            expect(factoryCalls).toBe(2)
        }
    })

    test("quarantines an active selector get captured by encodeKey", () => {
        for (const [lane, read] of selectorReadLanes) {
            const source = atom(7)
            let capturedGet: (<Value>(state: State<Value>) => Value) | undefined
            let caught: unknown
            let outerCaught: unknown
            let encoderCalls = 0
            let factoryCalls = 0
            let attemptCapturedRead = true
            const members = family(
                (input: { readonly id: string }) => {
                    factoryCalls++
                    return atom(`${lane}:${input.id}`)
                },
                {
                    encodeKey: input => {
                        encoderCalls++
                        if (attemptCapturedRead) {
                            try {
                                capturedGet!(source)
                            } catch (error) {
                                caught = error
                            }
                        }
                        return input.id
                    },
                },
            )
            const outer = selector(get => {
                capturedGet = get
                try {
                    return get(members({ id: "member" }))
                } catch (error) {
                    outerCaught = error
                    return "recovered"
                }
            })
            const target = store()

            const failure = thrownBy(() => read(target, outer))
            expect(failure).toBeInstanceOf(CallbackCapabilityError)
            expect(caught).toBeInstanceOf(CallbackCapabilityError)
            expect(failure).toBe(caught)
            expect(outerCaught).toBe(caught)
            expect(encoderCalls).toBe(1)
            expect(factoryCalls).toBe(0)

            attemptCapturedRead = false
            expect(read(store(), outer)).toBe(`${lane}:member`)
            expect(encoderCalls).toBe(2)
            expect(factoryCalls).toBe(1)
        }
    })

    test("quarantines a captured ancestor selector get before frame access", () => {
        for (const [lane, read] of selectorReadLanes) {
            const source = atom(7)
            let capturedAncestorGet:
                | (<Value>(state: State<Value>) => Value)
                | undefined
            let factoryCaught: unknown
            let innerCaught: unknown
            let outerCaught: unknown
            let factoryCalls = 0
            let attemptCapturedRead = true
            const members = family((key: string) => {
                factoryCalls++
                if (attemptCapturedRead) {
                    try {
                        capturedAncestorGet!(source)
                    } catch (error) {
                        factoryCaught = error
                    }
                }
                return atom(`${lane}:${key}`)
            })
            const inner = selector(get => {
                try {
                    return get(members("member"))
                } catch (error) {
                    innerCaught = error
                    return "inner recovered"
                }
            })
            const outer = selector(get => {
                capturedAncestorGet = get
                try {
                    return get(inner)
                } catch (error) {
                    outerCaught = error
                    return "outer recovered"
                }
            })
            const target = store()

            const failure = thrownBy(() => read(target, outer))
            expect(failure).toBeInstanceOf(CallbackCapabilityError)
            expect(factoryCaught).toBe(failure)
            expect(innerCaught).toBe(failure)
            expect(outerCaught).toBe(failure)
            expect(factoryCalls).toBe(1)

            attemptCapturedRead = false
            expect(read(store(), outer)).toBe(`${lane}:member`)
            expect(factoryCalls).toBe(2)
        }
    })

    test("quarantines an outer selector get during isolated dependency settlement", () => {
        const seed = atom(0)
        const parentEnabled = atom(false)
        const branchUsesOld = atom(true)
        const oldEnabled = atom(false)
        let capturedOuterGet:
            | (<Value>(state: State<Value>) => Value)
            | undefined
        let borrowedReadFault: unknown
        let factoryCalls = 0
        let attemptCapturedRead = true
        const members = family((_key: string) => {
            factoryCalls++
            let value = -1
            if (attemptCapturedRead) {
                try {
                    value = capturedOuterGet!(seed)
                } catch (error) {
                    borrowedReadFault = error
                }
            }
            return atom(value)
        })
        const oldChild = selector(get =>
            get(oldEnabled) ? get(members("member")) : 0,
        )
        const branch = selector(get => (get(branchUsesOld) ? get(oldChild) : 7))
        const parent = selector(get => {
            capturedOuterGet = get
            return get(parentEnabled) ? get(branch) : 0
        })
        const first = store()
        first.set(seed, 99)

        expect(first.get(branch)).toBe(0)
        expect(first.get(parent)).toBe(0)

        const failure = thrownBy(() =>
            first.txn(transaction => {
                transaction.set(parentEnabled, true)
                transaction.set(branchUsesOld, false)
                transaction.set(oldEnabled, true)
            }),
        )
        expect(failure).toBeInstanceOf(CallbackCapabilityError)
        expect(borrowedReadFault).toBe(failure)
        expect(factoryCalls).toBe(1)

        attemptCapturedRead = false
        expect(store().get(members("member"))).toBe(-1)
        expect(factoryCalls).toBe(2)
    })

    test("quarantines an outer selector get from encodeKey during isolated dependency settlement", () => {
        const seed = atom(0)
        const parentEnabled = atom(false)
        const branchUsesOld = atom(true)
        const oldEnabled = atom(false)
        let capturedOuterGet:
            | (<Value>(state: State<Value>) => Value)
            | undefined
        let borrowedReadFault: unknown
        let encoderCalls = 0
        let factoryCalls = 0
        let attemptCapturedRead = true
        const members = family(
            (input: { readonly id: string }) => {
                factoryCalls++
                return atom(input.id)
            },
            {
                encodeKey: input => {
                    encoderCalls++
                    if (attemptCapturedRead) {
                        try {
                            capturedOuterGet!(seed)
                        } catch (error) {
                            borrowedReadFault = error
                        }
                    }
                    return input.id
                },
            },
        )
        const oldChild = selector(get =>
            get(oldEnabled) ? get(members({ id: "member" })) : "idle",
        )
        const branch = selector(get =>
            get(branchUsesOld) ? get(oldChild) : "current",
        )
        const parent = selector(get => {
            capturedOuterGet = get
            return get(parentEnabled) ? get(branch) : "disabled"
        })
        const first = store()

        expect(first.get(branch)).toBe("idle")
        expect(first.get(parent)).toBe("disabled")

        const failure = thrownBy(() =>
            first.txn(transaction => {
                transaction.set(parentEnabled, true)
                transaction.set(branchUsesOld, false)
                transaction.set(oldEnabled, true)
            }),
        )
        expect(failure).toBeInstanceOf(CallbackCapabilityError)
        expect(borrowedReadFault).toBe(failure)
        expect(encoderCalls).toBe(1)
        expect(factoryCalls).toBe(0)

        attemptCapturedRead = false
        expect(store().get(members({ id: "member" }))).toBe("member")
        expect(encoderCalls).toBe(2)
        expect(factoryCalls).toBe(1)
    })

    test("quarantines an ancestor selector get captured by encodeKey", () => {
        for (const [lane, read] of selectorReadLanes) {
            const source = atom(7)
            let capturedAncestorGet:
                | (<Value>(state: State<Value>) => Value)
                | undefined
            let encoderCaught: unknown
            let innerCaught: unknown
            let outerCaught: unknown
            let encoderCalls = 0
            let factoryCalls = 0
            let attemptCapturedRead = true
            const members = family(
                (input: { readonly id: string }) => {
                    factoryCalls++
                    return atom(`${lane}:${input.id}`)
                },
                {
                    encodeKey: input => {
                        encoderCalls++
                        if (attemptCapturedRead) {
                            try {
                                capturedAncestorGet!(source)
                            } catch (error) {
                                encoderCaught = error
                            }
                        }
                        return input.id
                    },
                },
            )
            const inner = selector(get => {
                try {
                    return get(members({ id: "member" }))
                } catch (error) {
                    innerCaught = error
                    return "inner recovered"
                }
            })
            const outer = selector(get => {
                capturedAncestorGet = get
                try {
                    return get(inner)
                } catch (error) {
                    outerCaught = error
                    return "outer recovered"
                }
            })
            const target = store()

            const failure = thrownBy(() => read(target, outer))
            expect(failure).toBeInstanceOf(CallbackCapabilityError)
            expect(encoderCaught).toBe(failure)
            expect(innerCaught).toBe(failure)
            expect(outerCaught).toBe(failure)
            expect(encoderCalls).toBe(1)
            expect(factoryCalls).toBe(0)

            attemptCapturedRead = false
            expect(read(store(), outer)).toBe(`${lane}:member`)
            expect(encoderCalls).toBe(2)
            expect(factoryCalls).toBe(1)
        }
    })

    test("carries the selector guard through a lazy initializer", () => {
        for (const [lane, read] of selectorReadLanes) {
            let lazySourceCalls = 0
            const lazySource = atom.lazy(() => {
                lazySourceCalls++
                return 7
            })
            let capturedAncestorGet:
                | (<Value>(state: State<Value>) => Value)
                | undefined
            let factoryCaught: unknown
            let innerCaught: unknown
            let outerCaught: unknown
            let factoryCalls = 0
            let initializerCalls = 0
            let attemptCapturedRead = true
            const members = family((key: string) => {
                factoryCalls++
                if (attemptCapturedRead) {
                    try {
                        capturedAncestorGet!(lazySource)
                    } catch (error) {
                        factoryCaught = error
                    }
                }
                return atom(`${lane}:${key}`)
            })
            const bridge = atom.lazy(() => {
                initializerCalls++
                return members("member")
            })
            const inner = selector(get => {
                try {
                    return get(get(bridge))
                } catch (error) {
                    innerCaught = error
                    return "inner recovered"
                }
            })
            const outer = selector(get => {
                capturedAncestorGet = get
                try {
                    return get(inner)
                } catch (error) {
                    outerCaught = error
                    return "outer recovered"
                }
            })
            const target = store()

            const failure = thrownBy(() => read(target, outer))
            expect(failure).toBeInstanceOf(CallbackCapabilityError)
            expect(factoryCaught).toBe(failure)
            expect(innerCaught).toBe(failure)
            expect(outerCaught).toBe(failure)
            expect(factoryCalls).toBe(1)
            expect(initializerCalls).toBe(1)
            expect(lazySourceCalls).toBe(0)

            attemptCapturedRead = false
            expect(read(store(), outer)).toBe(`${lane}:member`)
            expect(factoryCalls).toBe(2)
            expect(initializerCalls).toBe(2)
            expect(lazySourceCalls).toBe(0)
        }
    })

    test("preserves an earlier selector control fault through a borrowed get", () => {
        const foreign = createCommittedStoreTreeDomain()
        const foreignSource = foreign.atom(1)
        const source = atom(7)
        let capturedGet: (<Value>(state: State<Value>) => Value) | undefined
        let firstFault: unknown
        let factoryCaught: unknown
        let outerCaught: unknown
        let factoryCalls = 0
        let attemptCapturedRead = true
        const members = family((key: string) => {
            factoryCalls++
            if (attemptCapturedRead) {
                try {
                    capturedGet!(source)
                } catch (error) {
                    factoryCaught = error
                }
            }
            return atom(key)
        })
        const outer = selector(get => {
            try {
                get(foreignSource)
            } catch (error) {
                firstFault = error
            }
            capturedGet = get
            try {
                return get(members("member"))
            } catch (error) {
                outerCaught = error
                return "recovered"
            }
        })
        const target = store()

        const failure = thrownBy(() => target.get(outer))
        expect(failure).toBeInstanceOf(RuntimeMismatchError)
        expect(firstFault).toBe(failure)
        expect(factoryCaught).toBe(failure)
        expect(outerCaught).toBe(failure)
        expect(factoryCalls).toBe(1)

        attemptCapturedRead = false
        expect(target.get(members("member"))).toBe("member")
        expect(factoryCalls).toBe(2)
    })

    test("preserves an earlier callback control fault through a borrowed get", () => {
        const foreign = createCommittedStoreTreeDomain()
        const foreignSource = foreign.atom(1)
        const source = atom(7)
        const target = store()
        let capturedGet: (<Value>(state: State<Value>) => Value) | undefined
        let firstFault: unknown
        let borrowedReadFault: unknown
        let outerCaught: unknown
        let factoryCalls = 0
        let attemptCapturedRead = true
        const members = family((key: string) => {
            factoryCalls++
            if (attemptCapturedRead) {
                try {
                    target.get(foreignSource)
                } catch (error) {
                    firstFault = error
                }
                try {
                    capturedGet!(source)
                } catch (error) {
                    borrowedReadFault = error
                }
            }
            return atom(key)
        })
        const outer = selector(get => {
            capturedGet = get
            try {
                return get(members("member"))
            } catch (error) {
                outerCaught = error
                return "recovered"
            }
        })

        const failure = thrownBy(() => target.get(outer))
        expect(failure).toBeInstanceOf(RuntimeMismatchError)
        expect(firstFault).toBe(failure)
        expect(borrowedReadFault).toBe(failure)
        expect(outerCaught).toBe(failure)
        expect(factoryCalls).toBe(1)

        attemptCapturedRead = false
        expect(store().get(members("member"))).toBe("member")
        expect(factoryCalls).toBe(2)
    })

    test("keeps encoders pure while factories may construct definitions", () => {
        const source = atom(1)
        const existing = family((key: string) => atom(key.length))
        existing("cached")
        let factoryCalls = 0
        const forbiddenDefinitionWork: readonly (() => unknown)[] = [
            () => atom(1),
            () => atom.lazy(() => 1),
            () => selector(get => get(source)),
            () => existing("cached"),
            () => existing("new"),
        ]

        for (const definitionWork of forbiddenDefinitionWork) {
            const members = family(
                (input: { readonly id: string }) => {
                    factoryCalls++
                    return atom(input.id)
                },
                {
                    encodeKey: input => {
                        definitionWork()
                        return input.id
                    },
                },
            )
            expect(thrownBy(() => members({ id: "a" }))).toBeInstanceOf(
                CallbackCapabilityError,
            )
        }

        expect(factoryCalls).toBe(0)
    })

    test("keeps member identity Store-free while scopes retain normal semantics", () => {
        const counts = family((id: string) => atom(id.length))
        const doubled = family((id: string) =>
            selector(get => get(counts(id)) * 2),
        )
        const root = store()
        const child = root.scope("child")
        const member = counts("step")

        expect(counts("step")).toBe(member)
        expect(root.get(member)).toBe(4)
        expect(child.get(member)).toBe(4)
        expect(root.get(doubled("step"))).toBe(8)
        expect(child.get(doubled("step"))).toBe(8)

        root.set(counts("step"), 5)
        expect(root.get(member)).toBe(5)
        expect(child.get(member)).toBe(5)
        expect(child.get(doubled("step"))).toBe(10)

        child.set(counts("step"), 7)
        expect(root.get(member)).toBe(5)
        expect(child.get(member)).toBe(7)
        expect(root.get(doubled("step"))).toBe(10)
        expect(child.get(doubled("step"))).toBe(14)
    })

    test("creates and uses members transparently inside transactions", () => {
        const counts = family((id: string) => atom(id.length))
        const doubled = family((id: string) =>
            selector(get => get(counts(id)) * 2),
        )
        const target = store()
        let createdInTransaction: Atom<number> | undefined

        const result = target.txn(transaction => {
            createdInTransaction = counts("transaction")
            transaction.set(createdInTransaction, 20)
            expect(transaction.get(doubled("transaction"))).toBe(40)
            return transaction.get(createdInTransaction)
        })

        expect(result).toBe(20)
        expect(createdInTransaction).toBe(counts("transaction"))
        expect(target.get(counts("transaction"))).toBe(20)

        const sentinel = new Error("abort")
        let abortedMember: Atom<number> | undefined
        expect(
            thrownBy(() =>
                target.txn(transaction => {
                    abortedMember = counts("aborted")
                    transaction.set(abortedMember, 99)
                    throw sentinel
                }),
            ),
        ).toBe(sentinel)
        expect(abortedMember).toBe(counts("aborted"))
        expect(target.get(counts("aborted"))).toBe("aborted".length)
    })

    test("has no State, membership, enumeration, deletion, or release surface", () => {
        const members = family((key: string) => atom(key.length))
        const target = store()
        const ownKeysBefore = Reflect.ownKeys(members)

        members("a")
        members("b")

        expect(Reflect.ownKeys(members)).toEqual(ownKeysBefore)
        expect(Object.keys(members)).toEqual([])
        expect(Object.isFrozen(members)).toBe(true)
        expect("kind" in members).toBe(false)
        for (const legacySurface of [
            "keys",
            "values",
            "entries",
            "members",
            "has",
            "delete",
            "release",
            "sub",
        ]) {
            expect(
                (members as unknown as Record<string, unknown>)[legacySurface],
            ).toBeUndefined()
        }

        expect(
            thrownBy(() => Reflect.apply(target.get, undefined, [members])),
        ).toBeInstanceOf(TypeError)
        expect(
            thrownBy(() =>
                Reflect.apply(target.sub, undefined, [members, () => {}]),
            ),
        ).toBeInstanceOf(TypeError)
        expect(
            thrownBy(() => Reflect.apply(target.set, undefined, [members, 1])),
        ).toBeInstanceOf(TypeError)

        if (false) {
            // @ts-expect-error a family accessor is not State.
            const state: State<number> = members
            // @ts-expect-error Store.get accepts members, not the family accessor.
            target.get(members)
            // @ts-expect-error Store.sub accepts members, not the family accessor.
            target.sub(members, () => undefined)
            // @ts-expect-error Store mutation accepts Atom members, not the family accessor.
            target.set(members, 1)
            // @ts-expect-error families expose no membership enumeration.
            members.keys()
            // @ts-expect-error families expose no deletion operation.
            members.delete("a")
            // @ts-expect-error families expose no manual release operation.
            members.release("a")
            void state
        }
    })
})
