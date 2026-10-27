import { store } from "valdres"
import { windowSizeAtom } from "../src"

// One store owns this demo. The resize listener attaches with the subscription
// below; reads without a subscription would sample the window and attach
// nothing.
const demoStore = store()
const el = document.getElementById("size")!
let notifications = 0

const field = (label: string, value: string | number) =>
    `<dt>${label}</dt><dd>${value}</dd>`

const render = () => {
    const size = demoStore.get(windowSizeAtom)
    el.innerHTML = [
        field("inner", `${size.innerWidth} × ${size.innerHeight}`),
        field("outer", `${size.outerWidth} × ${size.outerHeight}`),
        field(
            "outer − inner",
            `${size.outerWidth - size.innerWidth} × ${size.outerHeight - size.innerHeight}`,
        ),
        // A resize that leaves every size unchanged notifies nobody.
        field("notifications", notifications),
    ].join("")
}

demoStore.sub(windowSizeAtom, () => {
    notifications++
    render()
})
render()
