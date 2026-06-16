<script lang="ts">
    import { setValdresContext } from "../../src/setValdresContext"
    import type { Atom, Store } from "valdres"
    import ContextChild from "./ContextChild.svelte"

    let { store, countAtom }: { store: Store; countAtom: Atom<number> } =
        $props()
    setValdresContext(store)
</script>

<ContextChild {countAtom} />
