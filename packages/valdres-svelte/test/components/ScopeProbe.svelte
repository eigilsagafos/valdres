<script lang="ts">
    import { setValdresContext } from "../../src/setValdresContext"
    import { scope } from "../../src/scope"
    import { fromState } from "../../src/fromState"
    import type { Atom, Store } from "valdres"

    let {
        rootStore,
        countAtom,
    }: { rootStore: Store; countAtom: Atom<number> } = $props()

    setValdresContext(rootStore)
    scope("checkout", { initialize: () => [[countAtom, 100]] })
    // Resolves the scoped store from context.
    const count = fromState(countAtom)
</script>

<span class="scoped">{count.current}</span>
