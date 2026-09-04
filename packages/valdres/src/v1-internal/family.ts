import { WeakTupleMemberCache, type WeakMemberKey } from "./weak-member-cache"

export type FamilyKey = WeakMemberKey

type InspectedThenable =
    | Readonly<{ kind: "not-thenable" }>
    | Readonly<{
          kind: "thenable"
          target: object | ((...args: never[]) => unknown)
          then: (...args: unknown[]) => unknown
      }>
    | Readonly<{ kind: "inspection-error"; error: unknown }>

const NOT_THENABLE: InspectedThenable = { kind: "not-thenable" }
const NOOP = (): void => {}

const inspectThenable = (value: unknown): InspectedThenable => {
    if (
        (typeof value !== "object" || value === null) &&
        typeof value !== "function"
    ) {
        return NOT_THENABLE
    }
    try {
        const then = (value as { readonly then?: unknown }).then
        return typeof then === "function"
            ? Object.freeze({
                  kind: "thenable" as const,
                  target: value,
                  then: then as (...args: unknown[]) => unknown,
              })
            : NOT_THENABLE
    } catch (error) {
        return Object.freeze({ kind: "inspection-error" as const, error })
    }
}

const rejectThenable = (
    inspected: Extract<InspectedThenable, { kind: "thenable" }>,
): never => {
    try {
        Reflect.apply(inspected.then, inspected.target, [undefined, NOOP])
    } catch {
        // Containment never replaces the stable synchronous-boundary failure.
    }
    throw new TypeError("Definition callbacks must complete synchronously")
}

const runSynchronousDefinitionCallback = <Result, Validated = Result>(
    runDefinitionCallback: <CallbackResult, CallbackValidated = CallbackResult>(
        phase: "factory" | "encoder",
        callback: (...args: any[]) => CallbackResult,
        args: ArrayLike<unknown>,
        validate?: (result: CallbackResult) => CallbackValidated,
    ) => CallbackValidated,
    phase: "factory" | "encoder",
    callback: (...args: any[]) => Result,
    args: ArrayLike<unknown>,
    validate?: (result: Result) => Validated,
): Validated =>
    runDefinitionCallback(
        phase,
        (...callbackArgs: any[]): Result => {
            let result: Result
            try {
                result = Reflect.apply(callback, undefined, callbackArgs)
            } catch (thrown) {
                const inspected = inspectThenable(thrown)
                if (inspected.kind === "not-thenable") throw thrown
                if (inspected.kind === "inspection-error") {
                    throw inspected.error
                }
                return rejectThenable(inspected)
            }
            const inspected = inspectThenable(result)
            if (inspected.kind === "not-thenable") return result
            if (inspected.kind === "inspection-error") throw inspected.error
            return rejectThenable(inspected)
        },
        args,
        validate,
    )

const familyRecursionError = (): TypeError =>
    new TypeError("family cannot recursively construct the same member")

const isFamilyKey = (value: unknown): value is FamilyKey =>
    value === null ||
    value === undefined ||
    (typeof value !== "object" && typeof value !== "function")

const structuredFamilyKeyError = (): TypeError =>
    new TypeError(
        "family keys must be primitive; use encodeKey for structured arguments",
    )

const encodedFamilyKeyError = (): TypeError =>
    new TypeError("family encodeKey must return one primitive FamilyKey")

const familyArgumentCountError = (): TypeError =>
    new TypeError("family members require at least one key")

interface EncodingFrame {
    fault: TypeError | undefined
}

/** @internal Store-free identity implementation composed by the public root. */
export const createFamilyAccessor = <Value extends object>(
    createNode: (...args: any[]) => unknown,
    encodeKey: ((...args: any[]) => unknown) | undefined,
    runDefinitionCallback: <Result, Validated = Result>(
        phase: "factory" | "encoder",
        callback: (...args: any[]) => Result,
        args: ArrayLike<unknown>,
        validate?: (result: Result) => Validated,
    ) => Validated,
    assertMember: (value: unknown) => Value,
    markReady: (member: Value) => void,
    assertCallAllowed: () => void,
): ((...args: any[]) => Value) => {
    let encodingFrame: EncodingFrame | undefined
    const cache = new WeakTupleMemberCache<Value>(
        args =>
            runSynchronousDefinitionCallback(
                runDefinitionCallback,
                "factory",
                createNode,
                args,
                assertMember,
            ),
        familyRecursionError,
        undefined,
        markReady,
    )

    const callable = {
        family(first?: unknown): Value {
            const args = arguments
            const activeEncoding = encodingFrame
            if (activeEncoding !== undefined) {
                const fault =
                    activeEncoding.fault ??
                    new TypeError("family encodeKey cannot call its own family")
                activeEncoding.fault = fault
                throw fault
            }
            assertCallAllowed()
            if (args.length === 0) throw familyArgumentCountError()

            if (encodeKey !== undefined) {
                const frame: EncodingFrame = { fault: undefined }
                encodingFrame = frame
                let key: unknown
                try {
                    key = runSynchronousDefinitionCallback(
                        runDefinitionCallback,
                        "encoder",
                        encodeKey,
                        args,
                    )
                } catch (error) {
                    throw frame.fault ?? error
                } finally {
                    encodingFrame = undefined
                }
                if (frame.fault !== undefined) throw frame.fault
                if (!isFamilyKey(key)) throw encodedFamilyKeyError()
                return cache.getOrCreateOne(key, args)
            }

            if (args.length === 1) {
                if (!isFamilyKey(first)) throw structuredFamilyKeyError()
                return cache.getOrCreateOne(first, args)
            }

            for (let index = 0; index < args.length; index++) {
                if (!isFamilyKey(args[index])) {
                    throw structuredFamilyKeyError()
                }
            }
            return cache.getOrCreateTuple(
                args as unknown as ArrayLike<FamilyKey>,
                args,
            )
        },
    }.family

    return Object.freeze(callable)
}
