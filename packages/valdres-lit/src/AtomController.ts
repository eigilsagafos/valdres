import type { ReactiveControllerHost } from "lit"
import type { Atom, SetAtomValue, Store } from "valdres"
import { ValueController } from "./ValueController"

type Host = ReactiveControllerHost & HTMLElement

export class AtomController<Value = unknown> extends ValueController<Value> {
    constructor(host: Host, atom: Atom<Value>, store?: Store) {
        super(host, atom, store)
    }

    set(value: SetAtomValue<Value>) {
        const store = this._store
        if (!store) {
            throw new Error(
                "valdres-lit: AtomController.set called before store was attached.",
            )
        }
        store.set(this._state as Atom<Value>, value)
    }

    reset() {
        const store = this._store
        if (!store) {
            throw new Error(
                "valdres-lit: AtomController.reset called before store was attached.",
            )
        }
        store.reset(this._state as Atom<Value>)
    }
}
