import { store } from "valdres"
import { windowSizeAtom } from "../src"

const s = store()
const el = document.getElementById("size")!

const field = (label: string, value: string | number) =>
    `<dt>${label}</dt><dd>${value}</dd>`

const render = () => {
    const size = s.get(windowSizeAtom)
    el.innerHTML = [
        field("inner", `${size.innerWidth} × ${size.innerHeight}`),
        field("outer", `${size.outerWidth} × ${size.outerHeight}`),
        field(
            "outer − inner",
            `${size.outerWidth - size.innerWidth} × ${size.outerHeight - size.innerHeight}`,
        ),
    ].join("")
}

s.sub(windowSizeAtom, render)
render()
