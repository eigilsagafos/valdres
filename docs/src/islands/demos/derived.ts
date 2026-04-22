import { atom, selector, store } from "valdres"
import { demoContainerStyle, demoLabelStyle, inputStyle, secondaryTextStyle } from "./styles"

export function mountDerivedDemo(el: HTMLElement) {
    const demoStore = store()
    const nameAtom = atom("World")
    const greetingSelector = selector(get => {
        const name = get(nameAtom) as string
        return `Hello, ${name}!`
    })

    const container = document.createElement("div")
    container.setAttribute("style", demoContainerStyle)

    const label = document.createElement("div")
    label.setAttribute("style", demoLabelStyle)
    label.textContent = "Live demo"

    const input = document.createElement("input")
    input.setAttribute("style", inputStyle)
    input.value = "World"
    input.placeholder = "Type a name..."

    const output = document.createElement("div")
    output.style.cssText = `margin-top: 12px; font-size: 20px; font-weight: 600; color: oklch(0.7 0.18 80);`
    output.textContent = demoStore.get(greetingSelector) as string

    const hint = document.createElement("div")
    hint.setAttribute("style", secondaryTextStyle)
    hint.style.marginTop = "8px"
    hint.textContent = "The greeting updates automatically via a selector"

    input.oninput = () => {
        demoStore.set(nameAtom, input.value)
    }

    demoStore.sub(greetingSelector, () => {
        output.textContent = demoStore.get(greetingSelector) as string
    })

    container.append(label, input, output, hint)
    el.appendChild(container)
}
