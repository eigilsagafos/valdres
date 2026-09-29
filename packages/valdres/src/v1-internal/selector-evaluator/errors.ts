abstract class ImmutableSelectorError extends Error {
    abstract readonly code: string
    // Only this module's constructors can give an object this private field,
    // so neither `code` nor the prototype chain can forge the check below.
    #selectorError = true

    static is(value: unknown): boolean {
        return (
            typeof value === "object" &&
            value !== null &&
            #selectorError in value
        )
    }

    protected seal(): void {
        Object.freeze(this)
    }
}

// How this engine holds an Error's own `stack`: "accessor" for V8, "lazy" for
// Bun's JavaScriptCore, whose lazily computed data property freezing would
// compute, and "" otherwise. Wrappers are then built exactly as on main:
// frozen, with frames. Detection runs once, at the first wrapper, and never
// reads a stack that an application's Error.prepareStackTrace could format or
// invokes an accessor.
let ownStack: string | undefined
const probeOwnStack = (): string => {
    if (ownStack !== undefined) return ownStack
    ownStack = ""
    try {
        // An Error constructed without frames still gets V8's own accessor. On
        // JavaScriptCore it has no stack to compute, so no hook runs.
        const limit = Object.getOwnPropertyDescriptor(Error, "stackTraceLimit")
        if (limit?.writable === true) {
            let probe: Error
            ;(Error as { stackTraceLimit?: unknown }).stackTraceLimit = 0
            try {
                probe = new Error()
            } finally {
                ;(Error as { stackTraceLimit?: unknown }).stackTraceLimit =
                    limit.value
            }
            const stack = Object.getOwnPropertyDescriptor(probe, "stack")
            if (stack !== undefined && "get" in stack) {
                ownStack = "accessor"
                return ownStack
            }
        }
        // Bun's own global is a non-writable, non-configurable data property.
        const bun = Object.getOwnPropertyDescriptor(globalThis, "Bun")
        if (
            bun !== undefined &&
            "value" in bun &&
            bun.writable === false &&
            bun.configurable === false &&
            typeof bun.value === "object" &&
            bun.value !== null
        ) {
            ownStack = "lazy"
        }
    } catch {
        // Detection must never replace the failure being wrapped. It is
        // not retried; wrappers are built as on main.
    }
    return ownStack
}

const READ_ONLY = { writable: false, configurable: false }

// A failure creates one getter and one dependency wrapper per failing
// dependent. JavaScriptCore keeps an Error's stack, line and column as lazily
// computed own data properties, and freezing the Error computes them (about
// 1µs each, most of a failing propagation). There, wrappers make their own
// metadata read-only and the Error non-extensible, leaving the engine's stack
// lazy. Elsewhere freezing computes nothing (V8's own `stack` is an accessor),
// so wrappers stay frozen.
const sealPropagated = (
    error: Error,
    metadata: "selector" | "dependency",
): void => {
    if (probeOwnStack() !== "lazy") {
        Object.freeze(error)
        return
    }
    for (const key of ["message", "code", "name", metadata, "cause"]) {
        Object.defineProperty(error, key, READ_ONLY)
    }
    Object.preventExtensions(error)
}

// V8 captures an Error's frames when it is constructed (about 2µs for the
// default ten, most of a failing propagation there). A wrapper around another
// selector error names its selector or dependency as data, so there it is
// constructed without frames; this returns undefined for every other wrapper,
// which the caller constructs itself so its stack is unchanged. The first
// selector error around a thrown value therefore keeps its frames, even when
// the value is a primitive. A writable Error.stackTraceLimit is suspended
// around the constructor alone. It only defines own fields, assigns fields it
// already defined and freezes, so with unmodified built-ins no application
// code runs until the limit is restored.
export const framelessError = <Wrapper>(
    Type: new (subject: unknown, cause: unknown) => Wrapper,
    subject: unknown,
    cause: unknown,
): Wrapper | undefined => {
    const limit =
        probeOwnStack() === "accessor" && ImmutableSelectorError.is(cause)
            ? Object.getOwnPropertyDescriptor(Error, "stackTraceLimit")
            : undefined
    if (limit?.writable !== true) return undefined
    ;(Error as { stackTraceLimit?: unknown }).stackTraceLimit = 0
    try {
        return new Type(subject, cause)
    } finally {
        ;(Error as { stackTraceLimit?: unknown }).stackTraceLimit = limit.value
    }
}

export class SelectorGetterError extends ImmutableSelectorError {
    readonly code = "VALDRES_SELECTOR_GETTER_ERROR"
    readonly selector: unknown
    override readonly cause: unknown
    // Defined, not assigned: assignment would run an application setter on
    // Error.prototype.name, possibly while the stack limit is suspended.
    override readonly name = "SelectorGetterError"

    constructor(selector: unknown, cause: unknown) {
        super("Selector getter failed")
        this.selector = selector
        this.cause = cause
        sealPropagated(this, "selector")
    }
}

export class SelectorDependencyError extends ImmutableSelectorError {
    readonly code = "VALDRES_SELECTOR_DEPENDENCY_ERROR"
    readonly dependency: unknown
    override readonly cause: unknown
    // Defined, not assigned: assignment would run an application setter on
    // Error.prototype.name, possibly while the stack limit is suspended.
    override readonly name = "SelectorDependencyError"

    constructor(dependency: unknown, cause: unknown) {
        super("Selector dependency failed")
        this.dependency = dependency
        this.cause = cause
        sealPropagated(this, "dependency")
    }
}

export class SelectorCircularDependencyError extends ImmutableSelectorError {
    readonly code = "VALDRES_SELECTOR_CIRCULAR_DEPENDENCY"
    readonly selector: unknown
    readonly path: readonly unknown[]

    constructor(selector: unknown, path: readonly unknown[]) {
        super("Selector dependency graph must be acyclic")
        this.name = "SelectorCircularDependencyError"
        this.selector = selector
        this.path = Object.freeze([...path])
        this.seal()
    }
}

export class InvalidSynchronousSelectorResultError extends ImmutableSelectorError {
    readonly code = "VALDRES_INVALID_SYNCHRONOUS_SELECTOR_RESULT"
    readonly phase: "getter" | "comparator"

    constructor(phase: "getter" | "comparator") {
        super(`Selector ${phase} returned or threw a thenable`)
        this.name = "InvalidSynchronousSelectorResultError"
        this.phase = phase
        this.seal()
    }
}

export class InvalidSelectorComparatorResultError extends ImmutableSelectorError {
    readonly code = "VALDRES_INVALID_SELECTOR_COMPARATOR_RESULT"

    constructor() {
        super("Selector comparator must return exactly true or false")
        this.name = "InvalidSelectorComparatorResultError"
        this.seal()
    }
}

export class SelectorComparatorError extends ImmutableSelectorError {
    readonly code = "VALDRES_SELECTOR_COMPARATOR_ERROR"
    readonly selector: unknown
    override readonly cause: unknown

    constructor(selector: unknown, cause: unknown) {
        super("Selector comparator failed")
        this.name = "SelectorComparatorError"
        this.selector = selector
        this.cause = cause
        this.seal()
    }
}

export class SelectorReadRevokedError extends ImmutableSelectorError {
    readonly code = "VALDRES_SELECTOR_READ_REVOKED"

    constructor() {
        super("Selector supplied get is no longer active")
        this.name = "SelectorReadRevokedError"
        this.seal()
    }
}
