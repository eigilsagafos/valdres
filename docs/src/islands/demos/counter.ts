import { atom, store } from "valdres"
import { demoContainerStyle, demoLabelStyle, buttonStyle, valueStyle } from "./styles"

export function mountCounterDemo(el: HTMLElement) {
    const demoStore = store()
    const countAtom = atom(0)

    const container = document.createElement("div")
    container.setAttribute("style", demoContainerStyle)

    const label = document.createElement("div")
    label.setAttribute("style", demoLabelStyle)
    label.textContent = "Live demo"

    const row = document.createElement("div")
    row.style.cssText = "display: flex; align-items: center; gap: 16px;"

    const minus = document.createElement("button")
    minus.setAttribute("style", buttonStyle)
    minus.textContent = "-"

    const display = document.createElement("span")
    display.setAttribute("style", valueStyle)
    display.textContent = "0"

    const plus = document.createElement("button")
    plus.setAttribute("style", buttonStyle)
    plus.textContent = "+"

    minus.onclick = () => demoStore.set(countAtom, (c: number) => c - 1)
    plus.onclick = () => demoStore.set(countAtom, (c: number) => c + 1)

    demoStore.sub(countAtom, () => {
        display.textContent = String(demoStore.get(countAtom))
    })

    row.append(minus, display, plus)
    container.append(label, row)
    el.appendChild(container)
}
