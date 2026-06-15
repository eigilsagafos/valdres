<script lang="ts">
    import { resourceState } from "../../src/resourceState"
    import type { Selector, Store } from "valdres"

    let {
        selector,
        store,
    }: { selector: Selector<string>; store: Store } = $props()

    const res = resourceState(selector, store)
</script>

<span class="loading">{res.loading}</span>
<span class="value">{res.current ?? ""}</span>
<span class="error">{res.error ? String(res.error) : ""}</span>
