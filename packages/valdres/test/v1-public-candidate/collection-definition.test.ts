import { describe, expect, test } from "bun:test"
import { LeakDetector } from "../../../test/src/LeakDetector"
import { atom, family } from "../../src/index"
import {
    InvalidCollectionKeyError,
    createCollectionDefinition,
    getCollectionPresence,
    hasCollectionDefinitionRegistry,
} from "../../src/v1-internal/collection"
import {
    CallbackCapabilityError,
    RuntimeMismatchError,
    classifyDefinitionHandleOwner,
    createCommittedStoreTreeDomain,
    type InternalCommittedStoreTreeDomain,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import type {
    CollectionKey,
    CollectionRow,
    State,
} from "../../src/v1-internal/committed-store-tree/types"
import { v1Domain } from "../../src/v1-internal/public-domain"
import type { WeakMemberRuntime } from "../../src/v1-internal/weak-member-cache"

interface FakeWeakReference {
    target: object | undefined
    deref(): object | undefined
}

interface FakeRegistration {
    readonly held: object
    readonly registryIndex: number
    readonly token: object
    active: boolean
}

/** Deterministic WeakRef/finalizer control shared by row and presence tests. */
class FakeWeakRuntime implements WeakMemberRuntime {
    readonly references: FakeWeakReference[] = []
    readonly registrations: FakeRegistration[] = []
    readonly #cleanups: Array<(held: object) => void> = []

    get registryCount(): number {
        return this.#cleanups.length
    }

    ref<Value extends object>(target: Value): { deref(): Value | undefined } {
        const reference: FakeWeakReference = {
            target,
            deref: () => reference.target,
        }
        this.references.push(reference)
        return reference as { deref(): Value | undefined }
    }

    registry<Held extends object>(
        cleanup: (held: Held) => void,
    ): {
        register(target: object, held: Held, token: object): void
        unregister(token: object): boolean
    } {
        const registryIndex =
            this.#cleanups.push(cleanup as (held: object) => void) - 1
        return {
            register: (_target, held, token): void => {
                this.registrations.push({
                    active: true,
                    held,
                    registryIndex,
                    token,
                })
            },
            unregister: (token): boolean => {
                const registration = this.registrations.find(
                    candidate => candidate.active && candidate.token === token,
                )
                if (registration === undefined) return false
                registration.active = false
                return true
            },
        }
    }

    makeReferenceDead(index: number): void {
        const reference = this.references[index]
        if (reference === undefined) {
            throw new Error(`Unknown fake weak reference ${index}`)
        }
        reference.target = undefined
    }

    finalize(index: number): void {
        const registration = this.registrations[index]
        if (registration === undefined) {
            throw new Error(`Unknown fake finalization registration ${index}`)
        }
        const cleanup = this.#cleanups[registration.registryIndex]
        if (cleanup === undefined) {
            throw new Error(
                `Unknown fake finalization registry ${registration.registryIndex}`,
            )
        }
        registration.active = false
        cleanup(registration.held)
    }
}

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const callUntyped = (callable: Function, input?: unknown): unknown =>
    Reflect.apply(callable, undefined, [input])

const expectInvalidKey = (
    operation: () => unknown,
): InvalidCollectionKeyError => {
    const error = thrownBy(operation)
    expect(error).toBeInstanceOf(InvalidCollectionKeyError)
    expect(error).toMatchObject({
        name: "InvalidCollectionKeyError",
        code: "VALDRES_INVALID_COLLECTION_KEY",
    })
    expect(Object.isFrozen(error)).toBe(true)
    return error as InvalidCollectionKeyError
}

describe("v1 collection definition identity", () => {
    test("separates portable scalar types and canonicalizes negative zero", () => {
        const domain = createCommittedStoreTreeDomain()
        const runtime = new FakeWeakRuntime()
        const rows = createCollectionDefinition<CollectionKey, object>(
            domain,
            undefined,
            runtime,
        )
        const keys: readonly CollectionKey[] = [
            "1",
            1,
            1n,
            true,
            false,
            null,
            0,
        ]
        const handles = keys.map(key => rows(key))

        expect(new Set(handles).size).toBe(keys.length)
        for (let index = 0; index < keys.length; index++) {
            const row = handles[index]!
            expect(rows(keys[index]!)).toBe(row)
            expect(row.kind).toBe("collection-row")
            expect(row.key).toBe(keys[index]!)
            expect(Object.isFrozen(row)).toBe(true)
        }

        const zero = rows(0)
        expect(rows(-0)).toBe(zero)
        expect(Object.is(rows(-0).key, -0)).toBe(false)
        expect(rows(0.5)).toBe(rows(0.5))
        expect(runtime.registrations).toHaveLength(keys.length + 1)
    })

    test("rejects the complete invalid direct-key domain before caching", () => {
        const domain = createCommittedStoreTreeDomain()
        const runtime = new FakeWeakRuntime()
        const rows = createCollectionDefinition<string, object>(
            domain,
            undefined,
            runtime,
        )
        const secretInput = { secret: "must-not-be-retained" }
        const invalid: readonly unknown[] = [
            undefined,
            Number.NaN,
            Number.POSITIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
            Symbol("invalid"),
            secretInput,
            () => "invalid",
        ]

        for (const key of invalid) {
            const error = expectInvalidKey(() => callUntyped(rows, key))
            expect("key" in error).toBe(false)
            expect("input" in error).toBe(false)
            expect(JSON.stringify(error)).not.toContain(secretInput.secret)
        }
        expect(runtime.references).toHaveLength(0)
        expect(runtime.registrations).toHaveLength(0)
    })

    test("collides encoded rich inputs on their canonical key and runs the encoder on hits", () => {
        interface Lookup {
            readonly id: string
            readonly payload: object
        }

        const domain = createCommittedStoreTreeDomain()
        const runtime = new FakeWeakRuntime()
        let encoderCalls = 0
        const rows = createCollectionDefinition<string, object, Lookup>(
            domain,
            {
                encodeKey: input => {
                    encoderCalls++
                    return input.id.toLowerCase()
                },
            },
            runtime,
        )
        const first = rows({ id: "SESSION", payload: { pass: 1 } })
        const collision = rows({ id: "session", payload: { pass: 2 } })

        expect(collision).toBe(first)
        expect(first.key).toBe("session")
        expect(encoderCalls).toBe(2)
        expect(runtime.references).toHaveLength(1)
        expect(runtime.registrations).toHaveLength(1)
    })

    test("does not retain a rich input while its encoded row remains live", async () => {
        interface Lookup {
            readonly id: string
            readonly payload: object
        }

        const domain = createCommittedStoreTreeDomain()
        const rows = createCollectionDefinition<string, object, Lookup>(
            domain,
            {
                encodeKey: input => input.id,
            },
        )
        let retainedRow: CollectionRow<string, object> | undefined
        const detector = (() => {
            let input: Lookup | undefined = {
                id: "retained-row",
                payload: { private: true },
            }
            const detector = new LeakDetector(input)
            retainedRow = rows(input)
            input = undefined
            return detector
        })()

        expect(await detector.isLeaking()).toBe(false)
        expect(rows({ id: "retained-row", payload: {} })).toBe(retainedRow)
    })

    test("preserves ordinary encoder throws and contains only actual thenables", () => {
        const domain = createCommittedStoreTreeDomain()
        const runtime = new FakeWeakRuntime()
        const sentinel = new Error("user encoder failure")
        const throwing = createCollectionDefinition<string, object, string>(
            domain,
            {
                encodeKey: () => {
                    throw sentinel
                },
            },
            runtime,
        )
        expect(thrownBy(() => throwing("a"))).toBe(sentinel)

        let returnedContainments = 0
        const returnedThenable = {
            then(_fulfilled: unknown, rejected: unknown): void {
                returnedContainments++
                if (typeof rejected === "function") rejected("contained")
            },
        }
        const returning = createCollectionDefinition<string, object, string>(
            domain,
            {
                encodeKey: (() => returnedThenable) as unknown as () => string,
            },
            runtime,
        )
        expectInvalidKey(() => returning("a"))
        expect(returnedContainments).toBe(1)

        let thrownContainments = 0
        const thrownThenable = {
            then(_fulfilled: unknown, rejected: unknown): void {
                thrownContainments++
                if (typeof rejected === "function") rejected("contained")
            },
        }
        const throwingThenable = createCollectionDefinition<
            string,
            object,
            string
        >(
            domain,
            {
                encodeKey: () => {
                    throw thrownThenable
                },
            },
            runtime,
        )
        expectInvalidKey(() => throwingThenable("a"))
        expect(thrownContainments).toBe(1)

        const inspectionFailure = new Error("then getter")
        const hostile = Object.defineProperty({}, "then", {
            get(): never {
                throw inspectionFailure
            },
        })
        const hostileResult = createCollectionDefinition<
            string,
            object,
            string
        >(domain, { encodeKey: (() => hostile) as () => string }, runtime)
        expect(thrownBy(() => hostileResult("a"))).toBe(inspectionFailure)
        expect(runtime.references).toHaveLength(0)
        expect(runtime.registrations).toHaveLength(0)
    })

    test("contains a rejected native encoder Promise without an unhandled rejection", async () => {
        const domain = createCommittedStoreTreeDomain()
        const runtime = new FakeWeakRuntime()
        const rejection = new Error("rejected collection key")
        const unhandled: unknown[] = []
        const onUnhandled = (reason: unknown): void => {
            unhandled.push(reason)
        }
        process.on("unhandledRejection", onUnhandled)
        try {
            const rejected = Promise.reject(rejection)
            const rows = createCollectionDefinition<string, object, string>(
                domain,
                { encodeKey: (() => rejected) as never },
                runtime,
            )

            expectInvalidKey(() => rows("promise"))
            await Bun.sleep(0)
            expect(unhandled).toEqual([])
            expect(runtime.references).toHaveLength(0)
            expect(runtime.registrations).toHaveLength(0)
        } finally {
            process.off("unhandledRejection", onUnhandled)
        }
    })

    test("rejects invalid encoded scalars after callback quarantine and before caching", () => {
        const domain = createCommittedStoreTreeDomain()
        const runtime = new FakeWeakRuntime()
        const invalidOutputs: readonly unknown[] = [
            undefined,
            Number.NaN,
            Number.POSITIVE_INFINITY,
            Symbol("invalid"),
            {},
        ]

        for (const output of invalidOutputs) {
            const rows = createCollectionDefinition<string, object, string>(
                domain,
                { encodeKey: (() => output) as () => string },
                runtime,
            )
            expectInvalidKey(() => rows("input"))
        }
        expect(runtime.references).toHaveLength(0)
        expect(runtime.registrations).toHaveLength(0)
    })

    test("makes collection and family accessor quarantine sticky across caught errors", () => {
        interface Lookup {
            readonly id: string
        }

        const runtime = new FakeWeakRuntime()
        const target = createCollectionDefinition<string, object>(
            v1Domain,
            undefined,
            runtime,
        )
        let collectionCaught: unknown
        let callCollection = true
        const encoded = createCollectionDefinition<string, object, Lookup>(
            v1Domain,
            {
                encodeKey: input => {
                    if (callCollection) {
                        try {
                            target(input.id)
                        } catch (error) {
                            collectionCaught = error
                        }
                    }
                    return input.id
                },
            },
            runtime,
        )

        const collectionOuter = thrownBy(() => encoded({ id: "collection" }))
        expect(collectionOuter).toBe(collectionCaught)
        expect(collectionOuter).toMatchObject({
            name: "TypeError",
            message:
                "collection encodeKey cannot call family or collection accessors",
        })
        expect(runtime.registrations).toHaveLength(0)

        callCollection = false
        expect(encoded({ id: "collection" }).key).toBe("collection")

        const targetRow = target("presence-target")
        const referencesBeforePresence = runtime.references.length
        const registrationsBeforePresence = runtime.registrations.length
        let presenceCaught: unknown
        const presenceEncoded = createCollectionDefinition<
            string,
            object,
            Lookup
        >(
            v1Domain,
            {
                encodeKey: input => {
                    try {
                        getCollectionPresence(v1Domain, targetRow)
                    } catch (error) {
                        presenceCaught = error
                    }
                    return input.id
                },
            },
            runtime,
        )
        const presenceOuter = thrownBy(() =>
            presenceEncoded({ id: "presence" }),
        )
        expect(presenceOuter).toBe(presenceCaught)
        expect(presenceOuter).toBeInstanceOf(TypeError)
        expect(runtime.references).toHaveLength(referencesBeforePresence)
        expect(runtime.registrations).toHaveLength(registrationsBeforePresence)

        let familyFactoryCalls = 0
        const members = family((key: string) => {
            familyFactoryCalls++
            return atom(key)
        })
        let familyCaught: unknown
        let callFamily = true
        const familyEncoded = createCollectionDefinition<
            string,
            object,
            Lookup
        >(
            v1Domain,
            {
                encodeKey: input => {
                    if (callFamily) {
                        try {
                            members(input.id)
                        } catch (error) {
                            familyCaught = error
                        }
                    }
                    return input.id
                },
            },
            runtime,
        )

        const familyOuter = thrownBy(() => familyEncoded({ id: "family" }))
        expect(familyOuter).toBe(familyCaught)
        expect(familyOuter).toBeInstanceOf(TypeError)
        expect(familyFactoryCalls).toBe(0)

        callFamily = false
        expect(familyEncoded({ id: "family" }).key).toBe("family")
    })

    test("preserves the first non-accessor capability fault", () => {
        const domain = createCommittedStoreTreeDomain()
        const runtime = new FakeWeakRuntime()
        const other = createCollectionDefinition<string, object>(
            domain,
            undefined,
            runtime,
        )
        let constructionFault: unknown
        let laterAccessorFault: unknown
        const rows = createCollectionDefinition<string, object, string>(
            domain,
            {
                encodeKey: input => {
                    try {
                        domain.atom(1)
                    } catch (error) {
                        constructionFault = error
                    }
                    try {
                        other(input)
                    } catch (error) {
                        laterAccessorFault = error
                    }
                    return input
                },
            },
            runtime,
        )

        const outer = thrownBy(() => rows("blocked"))
        expect(outer).toBeInstanceOf(CallbackCapabilityError)
        expect(outer).toBe(constructionFault)
        expect(laterAccessorFault).toBe(constructionFault)
        expect(runtime.references).toHaveLength(0)
        expect(runtime.registrations).toHaveLength(0)

        let accessorFault: unknown
        let laterConstructionFault: unknown
        const reverse = createCollectionDefinition<string, object, string>(
            domain,
            {
                encodeKey: input => {
                    try {
                        other(input)
                    } catch (error) {
                        accessorFault = error
                    }
                    try {
                        domain.atom(2)
                    } catch (error) {
                        laterConstructionFault = error
                    }
                    return input
                },
            },
            runtime,
        )

        const reverseOuter = thrownBy(() => reverse("reverse"))
        expect(reverseOuter).toBeInstanceOf(TypeError)
        expect(reverseOuter).toBe(accessorFault)
        expect(laterConstructionFault).toBe(accessorFault)
        expect(runtime.references).toHaveLength(0)
        expect(runtime.registrations).toHaveLength(0)
    })

    test("quarantines invalid State construction before its own validation", () => {
        const domain = createCommittedStoreTreeDomain()
        const runtime = new FakeWeakRuntime()
        const caught: unknown[] = []
        const rows = createCollectionDefinition<string, object, string>(
            domain,
            {
                encodeKey: input => {
                    try {
                        domain.atom(Promise.resolve(1))
                    } catch (error) {
                        caught.push(error)
                    }
                    try {
                        Reflect.apply(domain.atomLazy, undefined, [null])
                    } catch (error) {
                        caught.push(error)
                    }
                    try {
                        Reflect.apply(domain.selector, undefined, [null])
                    } catch (error) {
                        caught.push(error)
                    }
                    return input
                },
            },
            runtime,
        )

        expect(runtime.registryCount).toBe(1)
        const outer = thrownBy(() => rows("invalid definitions"))
        expect(outer).toBeInstanceOf(CallbackCapabilityError)
        expect(caught).toEqual([outer, outer, outer])
        expect(runtime.registryCount).toBe(1)
        expect(runtime.references).toHaveLength(0)
        expect(runtime.registrations).toHaveLength(0)
    })

    test("quarantines collection construction before malformed option validation", () => {
        const domain = createCommittedStoreTreeDomain()
        const runtime = new FakeWeakRuntime()
        let caught: unknown
        const rows = createCollectionDefinition<string, object, string>(
            domain,
            {
                encodeKey: input => {
                    try {
                        Reflect.apply(createCollectionDefinition, undefined, [
                            domain,
                            null,
                            runtime,
                        ])
                    } catch (error) {
                        caught = error
                    }
                    return input
                },
            },
            runtime,
        )

        expect(runtime.registryCount).toBe(1)
        const outer = thrownBy(() => rows("invalid options"))
        expect(outer).toBeInstanceOf(CallbackCapabilityError)
        expect(caught).toBe(outer)
        expect(runtime.registryCount).toBe(1)
        expect(runtime.references).toHaveLength(0)
        expect(runtime.registrations).toHaveLength(0)
    })

    test("freezes callable collection and row handles without index surface", () => {
        const domain = createCommittedStoreTreeDomain()
        const rows = createCollectionDefinition<string, object>(domain)
        const row = rows("frozen")

        expect(typeof rows).toBe("function")
        expect(rows.kind).toBe("collection")
        expect(Object.isFrozen(rows)).toBe(true)
        expect(Object.isFrozen(row)).toBe(true)
        expect("indexes" in rows).toBe(false)
        expect(Reflect.set(rows, "kind", "other")).toBe(false)
        expect(Reflect.set(row, "key", "other")).toBe(false)
        expect(Object.getOwnPropertyDescriptor(row, "key")).toMatchObject({
            configurable: false,
            enumerable: true,
            value: "frozen",
            writable: false,
        })
        expect(classifyDefinitionHandleOwner(domain, rows)).toBe("local")
        expect(classifyDefinitionHandleOwner(domain, row)).toBe("local")
    })

    test("repairs dead row references and ignores stale finalizers", () => {
        const domain = createCommittedStoreTreeDomain()
        const runtime = new FakeWeakRuntime()
        const rows = createCollectionDefinition<string, object>(
            domain,
            undefined,
            runtime,
        )
        const first = rows("weak")

        runtime.makeReferenceDead(0)
        const replacement = rows("weak")
        expect(replacement).not.toBe(first)
        expect(runtime.registrations).toHaveLength(2)
        expect(runtime.registrations[0]?.active).toBe(false)

        runtime.finalize(0)
        expect(rows("weak")).toBe(replacement)

        runtime.finalize(1)
        const afterFinalization = rows("weak")
        expect(afterFinalization).not.toBe(replacement)
        expect(afterFinalization.key).toBe("weak")
    })

    test("weakly memoizes presence as an ordinary same-domain Selector", () => {
        const domain = createCommittedStoreTreeDomain()
        const runtime = new FakeWeakRuntime()
        const rows = createCollectionDefinition<string, object>(
            domain,
            undefined,
            runtime,
        )
        const row = rows("presence")
        const first = getCollectionPresence(domain, row)

        expect(first.kind).toBe("selector")
        expect(Object.isFrozen(first)).toBe(true)
        expect(getCollectionPresence(domain, row)).toBe(first)
        expect(classifyDefinitionHandleOwner(domain, first)).toBe("local")
        expect(runtime.references).toHaveLength(2)

        runtime.makeReferenceDead(1)
        const replacement = getCollectionPresence(domain, row)
        expect(replacement).not.toBe(first)
        expect(replacement.kind).toBe("selector")
        expect(getCollectionPresence(domain, row)).toBe(replacement)
        expect(runtime.references).toHaveLength(3)
    })

    test("distinguishes same-domain rows from foreign and fake handles", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const localRows = createCollectionDefinition<string, object>(local)
        const foreignRows = createCollectionDefinition<string, object>(foreign)
        const localRow = localRows("local")
        const foreignRow = foreignRows("foreign")

        expect(getCollectionPresence(local, localRow)).toBe(
            getCollectionPresence(local, localRow),
        )
        expect(
            thrownBy(() => getCollectionPresence(local, foreignRow)),
        ).toBeInstanceOf(RuntimeMismatchError)

        const fake = Object.freeze({
            kind: "collection-row" as const,
            key: "fake",
        })
        expect(
            thrownBy(() =>
                getCollectionPresence(
                    local,
                    fake as CollectionRow<string, object>,
                ),
            ),
        ).toMatchObject({
            name: "TypeError",
            message: "presence requires a same-domain CollectionRow",
        })
        expect(
            thrownBy(() =>
                getCollectionPresence(
                    local,
                    local.atom(0) as unknown as CollectionRow<string, object>,
                ),
            ),
        ).toBeInstanceOf(TypeError)
        expect(
            thrownBy(() =>
                getCollectionPresence(
                    local,
                    localRows as unknown as CollectionRow<string, object>,
                ),
            ),
        ).toBeInstanceOf(TypeError)
    })

    test("allocates the per-domain registry lazily and performs zero Store work", () => {
        const untouched = createCommittedStoreTreeDomain()
        const invalid = createCommittedStoreTreeDomain()
        expect(hasCollectionDefinitionRegistry(untouched)).toBe(false)
        untouched.atom(0)
        expect(hasCollectionDefinitionRegistry(untouched)).toBe(false)

        expect(
            thrownBy(() =>
                Reflect.apply(createCollectionDefinition, undefined, [
                    invalid,
                    { indexes: undefined },
                ]),
            ),
        ).toBeInstanceOf(TypeError)
        expect(hasCollectionDefinitionRegistry(invalid)).toBe(false)

        const base = createCommittedStoreTreeDomain()
        let storeWork = 0
        const domain = new Proxy(base, {
            get(target, property, receiver) {
                if (property === "createStoreTree") storeWork++
                return Reflect.get(target, property, receiver)
            },
        }) as InternalCommittedStoreTreeDomain
        const rows = createCollectionDefinition<string, object>(domain)
        const row = rows("inert")
        const presence = getCollectionPresence(domain, row)

        expect(hasCollectionDefinitionRegistry(domain)).toBe(true)
        expect(hasCollectionDefinitionRegistry(untouched)).toBe(false)
        expect(row.kind).toBe("collection-row")
        expect(presence.kind).toBe("selector")
        expect(storeWork).toBe(0)
    })

    test("keeps collection rows and definitions outside family admission", () => {
        const rows = createCollectionDefinition<string, object>(v1Domain)
        const existing = rows("existing")
        const results: ReadonlyArray<() => object> = [
            () => existing,
            () => rows("constructed-in-family"),
            () => rows,
        ]

        for (const result of results) {
            const members = Reflect.apply(family, undefined, [
                (_key: string) => result(),
            ]) as (key: string) => State<unknown>
            expect(thrownBy(() => members("member"))).toMatchObject({
                name: "TypeError",
                message:
                    "family factories must construct or return a family State",
            })
        }

        if (false) {
            // @ts-expect-error family factories remain Atom-or-Selector only.
            family((_key: string) => rows("not-a-family-state"))
        }
    })

    test("keeps the first-beta options surface closed", () => {
        const invalidOptions: readonly unknown[] = [
            null,
            1,
            { indexes: undefined },
            { indexes: {} },
            { unknown: true },
            { encodeKey: null },
        ]

        for (const options of invalidOptions) {
            const domain = createCommittedStoreTreeDomain()
            expect(
                thrownBy(() =>
                    Reflect.apply(createCollectionDefinition, undefined, [
                        domain,
                        options,
                    ]),
                ),
            ).toBeInstanceOf(TypeError)
            expect(hasCollectionDefinitionRegistry(domain)).toBe(false)
        }
    })
})
