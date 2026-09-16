import { store } from "valdres"
import {
    mouseButtonsAtom,
    mouseInsideAtom,
    mousePositionAtom,
} from "../src"

const s = store()
const el = document.getElementById("state")!

const field = (label: string, value: string | number) =>
    `<dt>${label}</dt><dd>${value}</dd>`

const render = () => {
    const pos = s.get(mousePositionAtom)
    const btn = s.get(mouseButtonsAtom)
    const inside = s.get(mouseInsideAtom)
    const pressed =
        [btn.left && "left", btn.right && "right", btn.middle && "middle"]
            .filter(Boolean)
            .join(", ") || "none"
    el.innerHTML = [
        field("client", `${pos.clientX} × ${pos.clientY}`),
        field("page", `${pos.pageX} × ${pos.pageY}`),
        field("screen", `${pos.screenX} × ${pos.screenY}`),
        field("buttons", pressed),
        field("inside page", String(inside)),
    ].join("")
}

s.sub(mousePositionAtom, render)
s.sub(mouseButtonsAtom, render)
s.sub(mouseInsideAtom, render)
render()
