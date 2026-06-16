<script lang="ts">
    import { fromState } from "../../src/fromState"
    import type { Atom, Store } from "valdres"

    let {
        atom,
        store,
        renderValue,
    }: { atom: Atom<number>; store: Store; renderValue: boolean } = $props()

    const count = fromState(atom, store)
    let lastRead = 0
    // Reading `.current` only here (an event handler, never a tracked effect)
    // must NOT start the subscription — that's the lazy-bootstrap contract.
    const readInHandler = () => (lastRead = count.current)
</script>

{#if renderValue}
    <span class="val">{count.current}</span>
{/if}
<button onclick={readInHandler}>read</button>
