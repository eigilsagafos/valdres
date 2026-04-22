import { createApp, defineComponent, h, ref, onMounted, onUnmounted } from "vue"
import { createValdres } from "valdres-vue"
import { docsStore, countAtom } from "./shared-store"

const VueCounter = defineComponent({
    setup() {
        // Sync with the shared store manually since we're using a pre-existing store
        const count = ref(docsStore.get(countAtom) as number)

        let unsub: (() => void) | undefined
        onMounted(() => {
            unsub = docsStore.sub(countAtom, () => {
                count.value = docsStore.get(countAtom) as number
            })
        })
        onUnmounted(() => unsub?.())

        const increment = () => docsStore.set(countAtom, (c: number) => c + 1)
        const decrement = () => docsStore.set(countAtom, (c: number) => c - 1)
        const reset = () => docsStore.set(countAtom, 0)

        return () =>
            h("div", { class: "island-card", onClick: increment }, [
                h("span", { class: "island-count", style: { color: "#42B883" } }, count.value),
            ])
    },
})

export function mountVueCounter(el: HTMLElement) {
    const app = createApp(VueCounter)
    app.use(createValdres({ store: docsStore }))
    app.mount(el)
}
