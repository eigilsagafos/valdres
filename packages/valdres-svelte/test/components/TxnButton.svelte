<script lang="ts">
    import { setValdresContext } from "../../src/setValdresContext"
    import { transaction } from "../../src/transaction"
    import { fromState } from "../../src/fromState"
    import type { Atom, Store } from "valdres"

    let { store, countAtom }: { store: Store; countAtom: Atom<number> } =
        $props()

    setValdresContext(store)
    // Captured at init, then used from a deferred event handler — the case
    // getContext-in-handler would otherwise throw on.
    const txn = transaction()
    const count = fromState(countAtom)
</script>

<button onclick={() => txn(({ set, get }) => set(countAtom, get(countAtom) + 2))}>
    count is {count.current}
</button>
