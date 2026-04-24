import { store } from "valdres"
import { screenAtom } from "../src"

const s = store()
const el = document.getElementById("screen")!

const field = (label: string, value: string | number) =>
    `<dt>${label}</dt><dd>${value}</dd>`

const render = () => {
    const info = s.get(screenAtom)
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
    ].join("")
}

s.sub(screenAtom, render)
render()
