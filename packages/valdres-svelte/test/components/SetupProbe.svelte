<script lang="ts">
    import { setValdresContext } from "../../src/setValdresContext"
    import type { Store } from "valdres"
    import type { SetValdresContextOptions } from "../../src/setValdresContext"

    let {
        options,
        onStore,
    }: {
        options?: Store | SetValdresContextOptions
        onStore: (store: Store) => void
    } = $props()

    onStore(setValdresContext(options))
</script>
