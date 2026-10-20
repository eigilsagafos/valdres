import { selector as valdresSelector } from "valdres"
import type { ReadOnlySelectorOptions } from "../types/ReadOnlySelectorOptions"
import type { ReadWriteSelectorOptions } from "../types/ReadWriteSelectorOptions"
import { readThrough, resolveWrite } from "./actions"
import { DEFAULT_VALUE } from "./defaultValue"
import { isThenable } from "./isThenable"
import {
    createRecoilValue,
    isRecoilValueObject,
    type RecoilState,
    type RecoilValue,
    type RecoilValueReadOnly,
    type WriteContext,
} from "./recoilValue"
import { registerKey } from "./registerKey"
import { ASYNC_DETAIL, unsupported } from "./unsupported"
import { UnsupportedRecoilFeatureError } from "../UnsupportedRecoilFeatureError"

const ASYNC_SET = "Recoil: Async selector sets are not currently supported."

const getCallback = () =>
    unsupported(
        "selector getCallback",
        "Valdres selectors are not bound to a Store while they evaluate; create the callback with useRecoilCallback in a component instead.",
    )

export function createSelector<T>(options: ReadWriteSelectorOptions<T>): RecoilState<T>
export function createSelector<T>(options: ReadOnlySelectorOptions<T>): RecoilValueReadOnly<T>
export function createSelector<T>(
    options: ReadOnlySelectorOptions<T> | ReadWriteSelectorOptions<T>,
): RecoilValue<T> {
    const { key } = options
    registerKey(key, "selector")
    const state = valdresSelector<T>(
        get => {
            // A refusal must not be caught and replaced by a getter's fallback:
            // Recoil would re-run that getter once the dependency settled.
            let refusal: UnsupportedRecoilFeatureError | undefined
            const read = <V>(value: RecoilValue<V>) => {
                try {
                    return readThrough({ get }, value, "get")
                } catch (error) {
                    if (error instanceof UnsupportedRecoilFeatureError)
                        refusal ??= error
                    throw error
                }
            }
            let result: unknown
            try {
                result = options.get({ get: read, getCallback } as never)
            } catch (error) {
                if (refusal !== undefined) throw refusal
                if (isThenable(error)) unsupported("async selectors", ASYNC_DETAIL)
                throw error
            }
            if (refusal !== undefined) throw refusal
            if (isRecoilValueObject(result)) return read(result as RecoilValue<T>)
            if (isThenable(result)) unsupported("async selectors", ASYNC_DETAIL)
            return result as T
        },
        { name: key },
    )
    const set = "set" in options ? options.set : undefined
    return createRecoilValue<T>({
        key,
        kind: "selector",
        state,
        write:
            set === undefined
                ? undefined
                : (context: WriteContext, newValue: unknown) => {
                      let open = true
                      const guard = () => {
                          if (!open) throw new Error(ASYNC_SET)
                      }
                      try {
                          const result: unknown = set(
                              {
                                  get: value => (guard(), context.read(value)),
                                  set: (target, value) => (
                                      guard(),
                                      resolveWrite(context, target, value, "set")
                                  ),
                                  reset: target => (
                                      guard(),
                                      resolveWrite(context, target, DEFAULT_VALUE, "reset")
                                  ),
                              },
                              newValue as T,
                          )
                          if (result !== undefined)
                              throw new Error(
                                  isThenable(result)
                                      ? ASYNC_SET
                                      : "Recoil: selector set should be a void function.",
                              )
                      } finally {
                          open = false
                      }
                  },
    })
}
