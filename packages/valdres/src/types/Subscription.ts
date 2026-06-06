import type { AtomFamily } from "./AtomFamily"

export type AtomFamilySubscription<
    Value extends any = any,
    Args extends [any, ...any[]] = [any, ...any[]],
> = {
    state: AtomFamily<Value, Args>
    callback: (...args: Args) => void
    requireDeepEqualCheckBeforeCallback: boolean
    /** Present only on a scope subscription that is delegating to an ancestor.
     *  Drops the ancestor delegate (idempotent). Called eagerly when the scope
     *  shadows the state so an ancestor write in the same transaction commit
     *  does not also notify this subscription. */
    reRoot?: () => void
    /** Inverse of `reRoot`: re-establishes the ancestor delegate (idempotent).
     *  Present on scope atom/family subscriptions; called by `clear` when the
     *  scope drops its own value so the subscription tracks ancestor changes
     *  again. */
    reDelegate?: () => void
}

export type SimpleSubscription = {
    requireDeepEqualCheckBeforeCallback: boolean
    callback: () => void
    /** See AtomFamilySubscription.reRoot. */
    reRoot?: () => void
    /** See AtomFamilySubscription.reDelegate. */
    reDelegate?: () => void
}

export type Subscription = SimpleSubscription | AtomFamilySubscription
