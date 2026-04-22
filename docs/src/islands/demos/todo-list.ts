import { atom, atomFamily, selector, store } from "valdres"
import { demoContainerStyle, demoLabelStyle, buttonStyle, inputStyle, secondaryTextStyle } from "./styles"

export function mountTodoListDemo(el: HTMLElement) {
    const demoStore = store()

    type Todo = { id: number; text: string; done: boolean }
    let nextId = 1

    const todoFamily = atomFamily<Todo, number>(id => ({
        id,
        text: "",
        done: false,
    }))
    const todoIdsAtom = atom<number[]>([])
    const remainingSelector = selector(get => {
        const ids = get(todoIdsAtom) as number[]
        return ids.filter(id => !(get(todoFamily(id)) as Todo).done).length
    })

    const container = document.createElement("div")
    container.setAttribute("style", demoContainerStyle)

    const label = document.createElement("div")
    label.setAttribute("style", demoLabelStyle)
    label.textContent = "Live demo"

    // Input row
    const inputRow = document.createElement("div")
    inputRow.style.cssText = "display: flex; gap: 8px; margin-bottom: 12px;"

    const input = document.createElement("input")
    input.setAttribute("style", inputStyle)
    input.style.flex = "1"
    input.style.width = "auto"
    input.placeholder = "Add a todo..."

    const addBtn = document.createElement("button")
    addBtn.setAttribute("style", buttonStyle)
    addBtn.textContent = "Add"

    inputRow.append(input, addBtn)

    // Todo list
    const list = document.createElement("div")
    list.style.cssText = "display: flex; flex-direction: column; gap: 4px;"

    // Status
    const status = document.createElement("div")
    status.setAttribute("style", secondaryTextStyle)
    status.style.marginTop = "12px"

    function addTodo() {
        const text = input.value.trim()
        if (!text) return
        const id = nextId++
        demoStore.set(todoFamily(id), { id, text, done: false })
        demoStore.set(todoIdsAtom, (ids: number[]) => [...ids, id])
        input.value = ""
    }

    addBtn.onclick = addTodo
    input.onkeydown = (e) => { if (e.key === "Enter") addTodo() }

    function renderList() {
        const ids = demoStore.get(todoIdsAtom) as number[]
        list.innerHTML = ""
        for (const id of ids) {
            const todo = demoStore.get(todoFamily(id)) as Todo
            const row = document.createElement("div")
            row.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 4px 0;"

            const checkbox = document.createElement("input")
            checkbox.type = "checkbox"
            checkbox.checked = todo.done
            checkbox.style.cssText = "accent-color: oklch(0.7 0.18 80); width: 16px; height: 16px;"
            checkbox.onchange = () => {
                demoStore.set(todoFamily(id), (t: Todo) => ({ ...t, done: !t.done }))
            }

            const text = document.createElement("span")
            text.textContent = todo.text
            text.style.cssText = todo.done ? "text-decoration: line-through; opacity: 0.5;" : ""
            text.style.flex = "1"

            const removeBtn = document.createElement("button")
            removeBtn.textContent = "\u00d7"
            removeBtn.style.cssText = "border: none; background: none; color: inherit; cursor: pointer; opacity: 0.4; font-size: 18px; padding: 0 4px;"
            removeBtn.onclick = () => {
                demoStore.set(todoIdsAtom, (ids: number[]) => ids.filter(i => i !== id))
            }

            row.append(checkbox, text, removeBtn)
            list.appendChild(row)
        }
        const remaining = demoStore.get(remainingSelector) as number
        const total = ids.length
        status.textContent = total === 0 ? "No todos yet" : `${remaining} of ${total} remaining`
    }

    demoStore.sub(todoIdsAtom, renderList)
    // Also sub to each todo for checkbox changes - we'll re-render the whole list
    // This is fine for a small demo
    demoStore.sub(todoIdsAtom, () => {
        const ids = demoStore.get(todoIdsAtom) as number[]
        for (const id of ids) {
            demoStore.sub(todoFamily(id), renderList)
        }
    })

    container.append(label, inputRow, list, status)
    el.appendChild(container)
    renderList()
}
