import { atom, family, selector, store } from "valdres"
import { demoContainerStyle, demoLabelStyle, buttonStyle, inputStyle, secondaryTextStyle } from "./styles"

export function mountTodoListDemo(el: HTMLElement) {
    const demoStore = store()

    type Todo = { id: number; text: string; done: boolean }
    let nextId = 1

    const todoAtom = family((id: number) => atom<Todo>({ id, text: "", done: false }))
    const todoIdsAtom = atom<readonly number[]>([])
    // One derived view of the whole list: it depends on the id list and on
    // every listed todo, so a single subscription sees adds, toggles and removes.
    const todosSelector = selector(get => get(todoIdsAtom).map(id => get(todoAtom(id))))
    const remainingSelector = selector(get => {
        const ids = get(todoIdsAtom)
        return ids.filter(id => !get(todoAtom(id)).done).length
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
        demoStore.txn(tx => {
            tx.set(todoAtom(id), { id, text, done: false })
            tx.update(todoIdsAtom, ids => [...ids, id])
        })
        input.value = ""
    }

    addBtn.onclick = addTodo
    input.onkeydown = (e) => { if (e.key === "Enter") addTodo() }

    // Runs as a subscription notification: it only reads committed state.
    // Writes happen in the DOM event handlers, outside the notification.
    function renderList() {
        const todos = demoStore.get(todosSelector)
        list.innerHTML = ""
        for (const todo of todos) {
            const { id } = todo
            const row = document.createElement("div")
            row.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 4px 0;"

            const checkbox = document.createElement("input")
            checkbox.type = "checkbox"
            checkbox.checked = todo.done
            checkbox.style.cssText = "accent-color: oklch(0.7 0.18 80); width: 16px; height: 16px;"
            checkbox.onchange = () => {
                demoStore.update(todoAtom(id), t => ({ ...t, done: !t.done }))
            }

            const text = document.createElement("span")
            text.textContent = todo.text
            text.style.cssText = todo.done ? "text-decoration: line-through; opacity: 0.5;" : ""
            text.style.flex = "1"

            const removeBtn = document.createElement("button")
            removeBtn.textContent = "×"
            removeBtn.style.cssText = "border: none; background: none; color: inherit; cursor: pointer; opacity: 0.4; font-size: 18px; padding: 0 4px;"
            removeBtn.onclick = () => {
                // Resetting the member drops this Store's value, so the
                // family can release it.
                demoStore.txn(tx => {
                    tx.update(todoIdsAtom, ids => ids.filter(i => i !== id))
                    tx.reset(todoAtom(id))
                })
            }

            row.append(checkbox, text, removeBtn)
            list.appendChild(row)
        }
        const remaining = demoStore.get(remainingSelector)
        const total = todos.length
        status.textContent = total === 0 ? "No todos yet" : `${remaining} of ${total} remaining`
    }

    const unsubscribe = demoStore.sub(todosSelector, renderList)

    container.append(label, inputRow, list, status)
    el.appendChild(container)
    renderList()

    return () => {
        unsubscribe()
        demoStore.dispose()
        container.remove()
    }
}
