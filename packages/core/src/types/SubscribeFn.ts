import type { State } from "./State"

export type SubscribeFn = <V>(state: State<V>) => () => void
