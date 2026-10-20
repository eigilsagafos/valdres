interface BaseLoadable<T> {
    getValue: () => T
    toPromise: () => Promise<T>
    valueOrThrow: () => T
    errorOrThrow: () => any
    promiseOrThrow: () => Promise<T>
    is: (other: Loadable<any>) => boolean
    /** Mapping to a Promise throws `UnsupportedRecoilFeatureError`. */
    map: <S>(map: (from: T) => Loadable<S> | S) => Loadable<S>
}

interface ValueLoadable<T> extends BaseLoadable<T> {
    state: "hasValue"
    contents: T
    valueMaybe: () => T
    errorMaybe: () => undefined
    promiseMaybe: () => undefined
}

interface ErrorLoadable<T> extends BaseLoadable<T> {
    state: "hasError"
    contents: any
    valueMaybe: () => undefined
    errorMaybe: () => any
    promiseMaybe: () => undefined
}

/**
 * A settled read: Recoil's `Loadable` without the `loading` state, which
 * synchronous Valdres state never enters.
 */
export type Loadable<T> = ValueLoadable<T> | ErrorLoadable<T>
