/**
 * Recoil's settled loadables. Valdres state is synchronous, so a loadable is
 * always `hasValue` or `hasError`; mapping to a Promise is refused rather than
 * returning a `loading` loadable that could never settle through Recoil.
 */
import type { Loadable } from "../types/Loadable"
import { UnsupportedRecoilFeatureError } from "../UnsupportedRecoilFeatureError"
import { isThenable } from "./isThenable"
import { ASYNC_DETAIL, unsupported } from "./unsupported"

abstract class SettledLoadable {
    abstract readonly state: "hasValue" | "hasError"
    abstract readonly contents: unknown

    valueOrThrow(): unknown {
        throw new Error(`Loadable expected value, but in "${this.state}" state`)
    }

    promiseOrThrow(): never {
        throw new Error(
            `Loadable expected promise, but in "${this.state}" state`,
        )
    }

    errorOrThrow(): unknown {
        throw new Error(`Loadable expected error, but in "${this.state}" state`)
    }

    promiseMaybe(): undefined {
        return undefined
    }

    is(other: Loadable<unknown>): boolean {
        return other.state === this.state && other.contents === this.contents
    }
}

class ValueLoadable extends SettledLoadable {
    readonly state = "hasValue" as const
    readonly contents: unknown

    constructor(value: unknown) {
        super()
        this.contents = value
    }

    getValue() {
        return this.contents
    }

    toPromise() {
        return Promise.resolve(this.contents)
    }

    valueMaybe() {
        return this.contents
    }

    override valueOrThrow() {
        return this.contents
    }

    errorMaybe(): undefined {
        return undefined
    }

    map(map: (value: unknown) => unknown): SettledLoadable {
        let next: unknown
        try {
            next = map(this.contents)
        } catch (error) {
            if (isThenable(error))
                unsupported("Loadable.map suspending", ASYNC_DETAIL)
            return new ErrorLoadable(error)
        }
        if (isThenable(next)) unsupported("Loadable.map to a Promise", ASYNC_DETAIL)
        return next instanceof SettledLoadable ? next : new ValueLoadable(next)
    }
}

class ErrorLoadable extends SettledLoadable {
    readonly state = "hasError" as const
    readonly contents: unknown

    constructor(error: unknown) {
        super()
        this.contents = error
    }

    getValue(): never {
        throw this.contents
    }

    toPromise() {
        return Promise.reject(this.contents)
    }

    valueMaybe(): undefined {
        return undefined
    }

    errorMaybe() {
        return this.contents
    }

    override errorOrThrow() {
        return this.contents
    }

    map(): this {
        return this
    }
}

/**
 * Reads into a loadable: the value, or what the read threw. A refusal is
 * thrown, not captured: Recoil would have returned a `loading` loadable.
 */
export const loadableOf = <Value>(read: () => Value): Loadable<Value> => {
    try {
        return new ValueLoadable(read()) as unknown as Loadable<Value>
    } catch (error) {
        if (error instanceof UnsupportedRecoilFeatureError) throw error
        return new ErrorLoadable(error) as unknown as Loadable<Value>
    }
}
