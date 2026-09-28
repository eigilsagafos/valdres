abstract class ImmutableSelectorError extends Error {
    abstract readonly code: string

    protected seal(): void {
        Object.freeze(this)
    }
}

// An Error's own `stack` on this engine: a lazily computed data property on
// JavaScriptCore, an accessor on V8, absent elsewhere.
let ownStack: PropertyDescriptor | undefined
const probeOwnStack = (): PropertyDescriptor =>
    (ownStack ??= Object.getOwnPropertyDescriptor(new Error(), "stack") ?? {})

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
    if (!("value" in probeOwnStack())) {
        Object.freeze(error)
        return
    }
    for (const key of ["message", "code", "name", metadata, "cause"]) {
        Object.defineProperty(error, key, READ_ONLY)
    }
    Object.preventExtensions(error)
}

// V8 captures an Error's frames when it is constructed (about 2µs for the
// default ten, most of a failing propagation there). A wrapper names its
// selector or dependency as data and its cause chain ends in the thrown value,
// which keeps its own stack, so there wrappers are constructed without frames.
// A writable Error.stackTraceLimit is suspended around the constructor alone,
// which runs no other code.
export const propagatedError = <Wrapper>(
    Type: new (subject: unknown, cause: unknown) => Wrapper,
    subject: unknown,
    cause: unknown,
): Wrapper => {
    const limit =
        "get" in probeOwnStack()
            ? Object.getOwnPropertyDescriptor(Error, "stackTraceLimit")
            : undefined
    if (limit?.writable !== true) return new Type(subject, cause)
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

    constructor(selector: unknown, cause: unknown) {
        super("Selector getter failed")
        this.name = "SelectorGetterError"
        this.selector = selector
        this.cause = cause
        sealPropagated(this, "selector")
    }
}

export class SelectorDependencyError extends ImmutableSelectorError {
    readonly code = "VALDRES_SELECTOR_DEPENDENCY_ERROR"
    readonly dependency: unknown
    override readonly cause: unknown

    constructor(dependency: unknown, cause: unknown) {
        super("Selector dependency failed")
        this.name = "SelectorDependencyError"
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
