import { store } from "valdres"
import { screenAtom } from "../src"

// One store owns this demo. Its listeners (resize, orientation, screen change
// and a resolution media query) attach with the subscription below.
const demoStore = store()
const el = document.getElementById("screen")!
let notifications = 0

const field = (label: string, value: string | number) =>
    `<dt>${label}</dt><dd>${value}</dd>`

const render = () => {
    const info = demoStore.get(screenAtom)
    el.innerHTML = [
        field("size", `${info.width} × ${info.height}`),
        field("avail", `${info.availWidth} × ${info.availHeight}`),
        field("devicePixelRatio", info.devicePixelRatio),
        field("colorDepth", `${info.colorDepth}-bit`),
        field("pixelDepth", `${info.pixelDepth}-bit`),
        field(
            "orientation",
            `${info.orientationType} @ ${info.orientationAngle}°`,
        ),
        // A window resize that leaves the screen unchanged notifies nobody.
        field("notifications", notifications),
    ].join("")
}

demoStore.sub(screenAtom, () => {
    notifications++
    render()
})
render()
