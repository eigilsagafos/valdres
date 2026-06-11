import { atom, store } from "valdres"
import { demoContainerStyle, demoLabelStyle, buttonStyle, valueStyle, secondaryTextStyle } from "./styles"

export function mountSetterDemo(el: HTMLElement) {
    const demoStore = store()
    const countAtom = atom(0)

    const container = document.createElement("div")
    container.setAttribute("style", demoContainerStyle)

    const label = document.createElement("div")
    label.setAttribute("style", demoLabelStyle)
    label.textContent = "Live demo"

    const hint = document.createElement("div")
    hint.setAttribute("style", secondaryTextStyle)
    hint.style.marginBottom = "12px"
    hint.textContent = "These buttons use only the setter \u2014 they don't subscribe to changes"

    const row = document.createElement("div")
    row.style.cssText = "display: flex; align-items: center; gap: 12px; flex-wrap: wrap;"

    const set0 = document.createElement("button")
    set0.setAttribute("style", buttonStyle)
    set0.textContent = "Set 0"

    const set10 = document.createElement("button")
    set10.setAttribute("style", buttonStyle)
    set10.textContent = "Set 10"

    const set100 = document.createElement("button")
    set100.setAttribute("style", buttonStyle)
    set100.textContent = "Set 100"

    const incBtn = document.createElement("button")
    incBtn.setAttribute("style", buttonStyle)
    incBtn.textContent = "+1"

    set0.onclick = () => demoStore.set(countAtom, 0)
    set10.onclick = () => demoStore.set(countAtom, 10)
    set100.onclick = () => demoStore.set(countAtom, 100)
    incBtn.onclick = () => demoStore.set(countAtom, (c: number) => c + 1)

    // Display area (separate from setter)
    const displayRow = document.createElement("div")
    displayRow.style.cssText = "margin-top: 16px; display: flex; align-items: center; gap: 12px;"

    const displayLabel = document.createElement("span")
    displayLabel.setAttribute("style", secondaryTextStyle)
    displayLabel.textContent = "Current value:"

    const display = document.createElement("span")
    display.setAttribute("style", valueStyle)
    display.textContent = "0"

    demoStore.sub(countAtom, () => {
        display.textContent = String(demoStore.get(countAtom))
    })

    row.append(set0, set10, set100, incBtn)
    displayRow.append(displayLabel, display)
    container.append(label, hint, row, displayRow)
    el.appendChild(container)
}
