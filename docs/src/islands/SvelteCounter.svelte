<script>
    import { watch } from "valdres-svelte"
    import { countAtom } from "./shared-store.ts"

    let { store } = $props()

    const count = watch(countAtom, store)
</script>

<div class="island-card" role="button" tabindex="0" onclick={() => count.set(c => c + 1)}>
    <span class="island-count" style="color: #FF3E00">{count.value}</span>
</div>
