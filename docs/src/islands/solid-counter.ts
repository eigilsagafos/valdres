import { createSignal, createEffect, onCleanup, createRoot } from "solid-js"
import { docsStore, countAtom } from "./shared-store"

export function mountSolidCounter(el: HTMLElement) {
    createRoot(() => {
        const [count, setCount] = createSignal(
            docsStore.get(countAtom) as number,
        )

        const unsub = docsStore.sub(countAtom, () => {
            setCount(docsStore.get(countAtom) as number)
        })
        onCleanup(() => unsub())

        const container = document.createElement("div")
        container.className = "island-card"
        container.onclick = () =>
            docsStore.set(countAtom, (c: number) => c + 1)

        const span = document.createElement("span")
        span.className = "island-count"
        span.style.color = "#4F88C6"

        createEffect(() => {
            span.textContent = String(count())
        })

        container.appendChild(span)
        el.appendChild(container)
    })
}
