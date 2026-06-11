import { docsStore, countAtom } from "./shared-store"

export function mountAngularCounter(el: HTMLElement) {
    const container = document.createElement("div")
    container.className = "island-card"
    container.onclick = () =>
        docsStore.set(countAtom, (c: number) => c + 1)

    const span = document.createElement("span")
    span.className = "island-count"
    span.style.color = "#DD0031"
    span.textContent = String(docsStore.get(countAtom))

    docsStore.sub(countAtom, () => {
        span.textContent = String(docsStore.get(countAtom))
    })

    container.appendChild(span)
    el.appendChild(container)
}
