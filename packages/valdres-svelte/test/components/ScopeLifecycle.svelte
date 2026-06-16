<script lang="ts">
    import { setValdresContext } from "../../src/setValdresContext"
    import { scope } from "../../src/scope"
    import type { Store } from "valdres"

    let {
        rootStore,
        scopeId,
        onScope,
    }: {
        rootStore: Store
        scopeId: string
        onScope: (store: Store) => void
    } = $props()

    setValdresContext(rootStore)
    onScope(scope(scopeId))
</script>
