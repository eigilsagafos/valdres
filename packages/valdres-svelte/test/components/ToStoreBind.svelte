<script lang="ts">
    import { toStore } from "../../src/toStore"
    import type { Atom, Store } from "valdres"

    let { atom, store }: { atom: Atom<number>; store: Store } = $props()
    const count$ = toStore(atom, store)
</script>

<input type="number" bind:value={$count$} />
<span class="v">{$count$}</span>
