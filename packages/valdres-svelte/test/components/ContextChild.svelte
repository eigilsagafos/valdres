<script lang="ts">
    import { fromState } from "../../src/fromState"
    import { toStore } from "../../src/toStore"
    import type { Atom } from "valdres"

    let { countAtom }: { countAtom: Atom<number> } = $props()
    // No store argument — resolves the context store set by the provider.
    const count = fromState(countAtom)
    const count$ = toStore(countAtom)
</script>

<span class="from-state">{count.current}</span>
<span class="to-store">{$count$}</span>
