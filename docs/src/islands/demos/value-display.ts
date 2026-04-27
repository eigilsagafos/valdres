import { atom, selector, store } from "valdres"
import { demoContainerStyle, demoLabelStyle, buttonStyle, valueStyle, secondaryTextStyle } from "./styles"

export function mountValueDisplayDemo(el: HTMLElement) {
    const demoStore = store()
    const countAtom = atom(0)
    const doubledSelector = selector(get => (get(countAtom) as number) * 2)

    const container = document.createElement("div")
    container.setAttribute("style", demoContainerStyle)

    const label = document.createElement("div")
    label.setAttribute("style", demoLabelStyle)
    label.textContent = "Live demo"

    const hint = document.createElement("div")
    hint.setAttribute("style", secondaryTextStyle)
    hint.style.marginBottom = "12px"
    hint.textContent = "Read-only subscription \u2014 re-renders when the value changes"

    const row = document.createElement("div")
    row.style.cssText = "display: flex; align-items: center; gap: 24px;"

    // Value display
    const valueCol = document.createElement("div")
    const valueLabel = document.createElement("div")
    valueLabel.setAttribute("style", secondaryTextStyle)
    valueLabel.textContent = "count"
    const valueDisplay = document.createElement("div")
    valueDisplay.setAttribute("style", valueStyle)
    valueDisplay.textContent = "0"
    valueCol.append(valueLabel, valueDisplay)

    // Doubled display
    const doubledCol = document.createElement("div")
    const doubledLabel = document.createElement("div")
    doubledLabel.setAttribute("style", secondaryTextStyle)
    doubledLabel.textContent = "doubled (selector)"
    const doubledDisplay = document.createElement("div")
    doubledDisplay.setAttribute("style", valueStyle)
    doubledDisplay.textContent = "0"
    doubledCol.append(doubledLabel, doubledDisplay)

    row.append(valueCol, doubledCol)

    // Buttons
    const btnRow = document.createElement("div")
    btnRow.style.cssText = "display: flex; gap: 8px; margin-top: 16px;"

    const minus = document.createElement("button")
    minus.setAttribute("style", buttonStyle)
    minus.textContent = "-"
    const plus = document.createElement("button")
    plus.setAttribute("style", buttonStyle)
    plus.textContent = "+"

    minus.onclick = () => demoStore.set(countAtom, (c: number) => c - 1)
    plus.onclick = () => demoStore.set(countAtom, (c: number) => c + 1)

    demoStore.sub(countAtom, () => {
        valueDisplay.textContent = String(demoStore.get(countAtom))
    })
    demoStore.sub(doubledSelector, () => {
        doubledDisplay.textContent = String(demoStore.get(doubledSelector))
    })

    btnRow.append(minus, plus)
    container.append(label, hint, row, btnRow)
    el.appendChild(container)
}
