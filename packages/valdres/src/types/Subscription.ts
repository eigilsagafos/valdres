import type { AtomFamily } from "./AtomFamily"

export type AtomFamilySubscription<
    Value extends any = any,
    Args extends [any, ...any[]] = [any, ...any[]],
> = {
    state: AtomFamily<Value, Args>
    callback: (...args: Args) => void
    requireDeepEqualCheckBeforeCallback: boolean
}

export type SimpleSubscription = {
    requireDeepEqualCheckBeforeCallback: boolean
    callback: () => void
}

export type Subscription = SimpleSubscription | AtomFamilySubscription
