import { atom, family, selector, store } from "valdres"
import { demoContainerStyle, demoLabelStyle, buttonStyle, secondaryTextStyle } from "./styles"

export function mountFamilyDemo(el: HTMLElement) {
    const demoStore = store()

    type User = { id: number; name: string; score: number }
    let nextId = 1
    const userFamily = family((id: number) => atom<User>({
        id,
        name: `User ${id}`,
        score: Math.floor(Math.random() * 100),
    }))
    const userIdsAtom = atom<readonly number[]>([])
    const userLabelFamily = family((id: number) => selector(get => {
        const user = get(userFamily(id))
        return `${user.name} (${user.score} pts)`
    }))
    const totalScoreSelector = selector(get => {
        const ids = get(userIdsAtom)
        return ids.reduce((sum, id) => sum + get(userFamily(id)).score, 0)
    })
    // One derived view of the rendered rows: it depends on the id list and on
    // every listed label, so a single subscription sees adds, scores and removes.
    const labelsSelector = selector(get =>
        get(userIdsAtom).map(id => ({ id, label: get(userLabelFamily(id)) })),
    )

    const container = document.createElement("div")
    container.setAttribute("style", demoContainerStyle)

    const label = document.createElement("div")
    label.setAttribute("style", demoLabelStyle)
    label.textContent = "Live demo"

    // Add user button
    const addBtn = document.createElement("button")
    addBtn.setAttribute("style", buttonStyle)
    addBtn.style.marginBottom = "12px"
    addBtn.textContent = "+ Add User"

    // List
    const list = document.createElement("div")
    list.style.cssText = "display: flex; flex-direction: column; gap: 6px;"

    // Total
    const total = document.createElement("div")
    total.setAttribute("style", secondaryTextStyle)
    total.style.marginTop = "12px"

    // Runs as a subscription notification: it only reads committed state.
    // Writes happen in the DOM event handlers, outside the notification.
    function renderList() {
        const rows = demoStore.get(labelsSelector)
        list.innerHTML = ""
        for (const { id, label: userLabel } of rows) {
            const row = document.createElement("div")
            row.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid oklch(0.5 0 0 / 0.1);"

            const text = document.createElement("span")
            text.textContent = userLabel
            text.style.flex = "1"

            const scoreBtn = document.createElement("button")
            scoreBtn.setAttribute("style", buttonStyle)
            scoreBtn.style.cssText += "padding: 2px 10px; font-size: 12px;"
            scoreBtn.textContent = "+10"
            scoreBtn.onclick = () => {
                demoStore.update(userFamily(id), u => ({
                    ...u,
                    score: u.score + 10,
                }))
            }

            const removeBtn = document.createElement("button")
            removeBtn.textContent = "\u00d7"
            removeBtn.style.cssText = "border: none; background: none; color: inherit; cursor: pointer; opacity: 0.4; font-size: 18px; padding: 0 4px;"
            removeBtn.onclick = () => {
                // Resetting the member drops this Store's value, so the
                // family can release it.
                demoStore.txn(tx => {
                    tx.update(userIdsAtom, ids => ids.filter(i => i !== id))
                    tx.reset(userFamily(id))
                })
            }

            row.append(text, scoreBtn, removeBtn)
            list.appendChild(row)
        }
        const totalScore = demoStore.get(totalScoreSelector)
        total.textContent = rows.length === 0
            ? "No users yet \u2014 click Add User"
            : `Total: ${totalScore} pts across ${rows.length} users`
    }

    addBtn.onclick = () => {
        const id = nextId++
        demoStore.update(userIdsAtom, ids => [...ids, id])
    }

    const unsubscribe = demoStore.sub(labelsSelector, renderList)

    container.append(label, addBtn, list, total)
    el.appendChild(container)
    renderList()

    return () => {
        unsubscribe()
        demoStore.dispose()
        container.remove()
    }
}
