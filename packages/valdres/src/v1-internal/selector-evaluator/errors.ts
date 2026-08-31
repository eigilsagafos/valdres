abstract class ImmutableSelectorError extends Error {
    abstract readonly code: string

    protected seal(): void {
        Object.freeze(this)
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
        this.seal()
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
        this.seal()
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
