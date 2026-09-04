import { describe, expect, test } from "bun:test"
import {
    WeakTupleMemberCache,
    type WeakMemberRuntime,
} from "../../src/v1-internal/weak-member-cache"

interface FakeWeakReference {
    target: object | undefined
    deref(): object | undefined
}

interface FakeRegistration {
    readonly target: object
    readonly held: object
    readonly token: object
    active: boolean
}

/** A deterministic stand-in for WeakRef and FinalizationRegistry. */
class FakeWeakRuntime implements WeakMemberRuntime {
    readonly references: FakeWeakReference[] = []
    readonly registrations: FakeRegistration[] = []
    #cleanup: ((held: object) => void) | undefined

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
        if (this.#cleanup !== undefined) {
            throw new Error("FakeWeakRuntime supports one registry")
        }
        this.#cleanup = cleanup as (held: object) => void

        return {
            register: (target, held, token): void => {
                this.registrations.push({
                    target,
                    held,
                    token,
                    active: true,
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
        if (registration === undefined || this.#cleanup === undefined) {
            throw new Error(`Unknown fake finalization registration ${index}`)
        }
        registration.active = false
        this.#cleanup(registration.held)
    }
}

interface Member {
    readonly id: number
}

const memberFactory = () => {
    let calls = 0
    return {
        create: (): Member => ({ id: ++calls }),
        get calls(): number {
            return calls
        },
    }
}

const familyRecursionError = (): TypeError =>
    new TypeError("family cannot recursively construct the same member")

const createCache = <Value extends object>(
    createMember: (args: ArrayLike<unknown>) => Value,
    weakRuntime: WeakMemberRuntime,
    onReady?: (member: Value) => void,
): WeakTupleMemberCache<Value> =>
    new WeakTupleMemberCache(
        createMember,
        familyRecursionError,
        weakRuntime,
        onReady,
    )

describe("WeakTupleMemberCache cleanup", () => {
    test("repairs a dead reference synchronously before rebuilding its member", () => {
        const runtime = new FakeWeakRuntime()
        const factory = memberFactory()
        const cache = createCache(factory.create, runtime)
        const first = cache.getOrCreateOne("step", ["step"])

        runtime.makeReferenceDead(0)
        const replacement = cache.getOrCreateOne("step", ["step"])

        expect(replacement).not.toBe(first)
        expect(factory.calls).toBe(2)
        expect(runtime.registrations).toHaveLength(2)
        expect(runtime.registrations[0]?.active).toBe(false)
        expect(cache.routeCount).toBe(1)
        expect(cache.hasRoute(["step"])).toBe(true)
    })

    test("ignores a stale finalizer after dead-reference replacement", () => {
        const runtime = new FakeWeakRuntime()
        const factory = memberFactory()
        const cache = createCache(factory.create, runtime)

        cache.getOrCreateOne("step", ["step"])
        runtime.makeReferenceDead(0)
        const replacement = cache.getOrCreateOne("step", ["step"])

        // Finalization may already be queued when lookup unregisters the old
        // entry. Its callback must not remove the replacement.
        runtime.finalize(0)

        expect(cache.routeCount).toBe(1)
        expect(cache.hasRoute(["step"])).toBe(true)
        expect(cache.getOrCreateOne("step", ["step"])).toBe(replacement)
        expect(factory.calls).toBe(2)
    })

    test("prunes one tuple branch while preserving its shared prefix and sibling", () => {
        const runtime = new FakeWeakRuntime()
        const factory = memberFactory()
        const cache = createCache(factory.create, runtime)
        cache.getOrCreateTuple(["process", "left"], ["process", "left"])
        const right = cache.getOrCreateTuple(
            ["process", "right"],
            ["process", "right"],
        )

        expect(cache.routeCount).toBe(3)
        runtime.finalize(0)

        expect(cache.routeCount).toBe(2)
        expect(cache.hasRoute(["process"])).toBe(true)
        expect(cache.hasRoute(["process", "left"])).toBe(false)
        expect(cache.hasRoute(["process", "right"])).toBe(true)
        expect(
            cache.getOrCreateTuple(["process", "right"], ["process", "right"]),
        ).toBe(right)
    })

    test("preserves a prefix route independently of its terminal member", () => {
        const runtime = new FakeWeakRuntime()
        const factory = memberFactory()
        const cache = createCache(factory.create, runtime)
        cache.getOrCreateOne("process", ["process"])
        const child = cache.getOrCreateTuple(
            ["process", "step"],
            ["process", "step"],
        )

        runtime.finalize(0)
        expect(cache.routeCount).toBe(2)
        expect(cache.hasRoute(["process"])).toBe(true)
        expect(
            cache.getOrCreateTuple(["process", "step"], ["process", "step"]),
        ).toBe(child)

        const replacementPrefix = cache.getOrCreateOne("process", ["process"])
        expect(cache.routeCount).toBe(2)

        runtime.finalize(1)
        expect(cache.routeCount).toBe(1)
        expect(cache.hasRoute(["process", "step"])).toBe(false)
        expect(cache.getOrCreateOne("process", ["process"])).toBe(
            replacementPrefix,
        )
    })

    test("fully prunes a shared prefix after its final sibling is collected", () => {
        const runtime = new FakeWeakRuntime()
        const factory = memberFactory()
        const cache = createCache(factory.create, runtime)
        cache.getOrCreateTuple(["process", "left"], ["process", "left"])
        cache.getOrCreateTuple(["process", "right"], ["process", "right"])

        runtime.finalize(0)
        expect(cache.routeCount).toBe(2)

        runtime.finalize(1)
        expect(cache.routeCount).toBe(0)
        expect(cache.hasRoute(["process"])).toBe(false)
    })

    test("immediately prunes routes created by a failed factory", () => {
        const runtime = new FakeWeakRuntime()
        const failure = new Error("construction failed")
        const cache = createCache<Member>(() => {
            throw failure
        }, runtime)
        let thrown: unknown

        try {
            cache.getOrCreateTuple(["a", "b", "c"], ["a", "b", "c"])
        } catch (error) {
            thrown = error
        }

        expect(thrown).toBe(failure)
        expect(cache.routeCount).toBe(0)
        expect(cache.hasRoute(["a"])).toBe(false)
        expect(runtime.references).toHaveLength(0)
        expect(runtime.registrations).toHaveLength(0)
    })

    test("makes duplicate cleanup harmless even after the route is replaced", () => {
        const runtime = new FakeWeakRuntime()
        const factory = memberFactory()
        const cache = createCache(factory.create, runtime)
        cache.getOrCreateOne("step", ["step"])

        runtime.finalize(0)
        expect(cache.routeCount).toBe(0)

        const replacement = cache.getOrCreateOne("step", ["step"])
        runtime.finalize(0)

        expect(cache.routeCount).toBe(1)
        expect(cache.getOrCreateOne("step", ["step"])).toBe(replacement)
        expect(factory.calls).toBe(2)
    })

    test("keeps recursive construction failure sticky, then permits retry", () => {
        const runtime = new FakeWeakRuntime()
        let cache!: WeakTupleMemberCache<Member>
        let calls = 0
        let nestedError: unknown
        const published: Member[] = []
        cache = createCache(
            () => {
                calls++
                if (calls === 1) {
                    try {
                        cache.getOrCreateOne("recursive", ["recursive"])
                    } catch (error) {
                        nestedError = error
                    }
                }
                return { id: calls }
            },
            runtime,
            member => published.push(member),
        )
        let outerError: unknown

        try {
            cache.getOrCreateOne("recursive", ["recursive"])
        } catch (error) {
            outerError = error
        }

        expect(outerError).toBe(nestedError)
        expect(outerError).toBeInstanceOf(TypeError)
        expect((outerError as TypeError).message).toBe(
            "family cannot recursively construct the same member",
        )
        expect(cache.routeCount).toBe(0)
        expect(runtime.registrations).toHaveLength(0)
        expect(published).toEqual([])

        const retry = cache.getOrCreateOne("recursive", ["recursive"])
        expect(retry).toEqual({ id: 2 })
        expect(published).toEqual([retry])
        expect(cache.getOrCreateOne("recursive", ["recursive"])).toBe(retry)
        expect(published).toEqual([retry])
        expect(calls).toBe(2)
        expect(cache.routeCount).toBe(1)
    })
})
