import { afterEach, describe, expect, test } from "bun:test"
import { isEditableTarget } from "./isEditableTarget"

const mounted: Element[] = []
afterEach(() => {
    for (const element of mounted.splice(0)) element.remove()
})
const mount = <E extends Element>(element: E): E => {
    document.body.append(element)
    mounted.push(element)
    return element
}
const input = (type: string) =>
    mount(Object.assign(document.createElement("input"), { type }))

/** Whether a keydown dispatched at `target` is classified as text entry. */
const classify = (target: EventTarget) => {
    let seen: boolean | undefined
    const listener = (event: Event) => {
        seen = isEditableTarget(event as KeyboardEvent)
    }
    document.addEventListener("keydown", listener)
    target.dispatchEvent(
        new KeyboardEvent("keydown", {
            key: "a",
            bubbles: true,
            composed: true,
        }),
    )
    document.removeEventListener("keydown", listener)
    return seen
}

describe("isEditableTarget", () => {
    test("text entry: textarea, select, text-like inputs and contenteditable", () => {
        const editor = mount(document.createElement("div"))
        editor.contentEditable = "true"
        const inner = document.createElement("span")
        editor.append(inner)
        expect(
            [
                mount(document.createElement("textarea")),
                mount(document.createElement("select")),
                input("text"),
                input("search"),
                input("email"),
                input("password"),
                input("number"),
                editor,
                inner,
            ].map(classify),
        ).toEqual([true, true, true, true, true, true, true, true, true])
    })

    test("not text entry: buttons, toggles, other inputs, ordinary elements, the document", () => {
        expect(
            [
                input("checkbox"),
                input("radio"),
                input("button"),
                input("submit"),
                input("range"),
                input("color"),
                input("file"),
                mount(document.createElement("button")),
                mount(document.createElement("div")),
                document.body,
                document,
            ].map(classify),
        ).toEqual([
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
        ])
    })

    test("looks through an open shadow root to the innermost target", () => {
        const host = mount(document.createElement("div"))
        const root = host.attachShadow({ mode: "open" })
        const field = document.createElement("input")
        root.append(field)
        expect(classify(field)).toBe(true)
        expect(classify(host)).toBe(false)
    })

    test("an event with no composed path falls back to its target", () => {
        const field = input("text")
        const event = {
            composedPath: () => [],
            target: field,
        } as unknown as KeyboardEvent
        expect(isEditableTarget(event)).toBe(true)
        expect(
            isEditableTarget({ target: null } as unknown as KeyboardEvent),
        ).toBe(false)
    })
})
