<script lang="ts">
    import { fromState } from "../../src/fromState"
    import type { Atom, Store } from "valdres"

    let { store, countAtom }: { store: Store; countAtom: Atom<number> } = $props()
    const count = fromState(countAtom, store)
</script>

<button onclick={() => count.current++}>count is {count.current}</button>
<input type="number" bind:value={count.current} />
