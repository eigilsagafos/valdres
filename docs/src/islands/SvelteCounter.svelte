<script>
    import { fromState } from "valdres-svelte"
    import { countAtom } from "./shared-store.ts"

    let { store } = $props()

    const count = fromState(countAtom, store)
</script>

<div class="island-card" role="button" tabindex="0" onclick={() => count.current++}>
    <span class="island-count" style="color: #FF3E00">{count.current}</span>
</div>
