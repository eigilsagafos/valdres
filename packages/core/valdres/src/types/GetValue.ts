import type { State } from "./State"

export type GetValue = <V>(state: State<V>) => V | Promise<V>
