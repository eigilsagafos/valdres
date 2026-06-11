import { atom, atomFamily, selectorFamily, selector, store } from "valdres"
import { demoContainerStyle, demoLabelStyle, buttonStyle, inputStyle, secondaryTextStyle } from "./styles"

export function mountFamilyDemo(el: HTMLElement) {
    const demoStore = store()

    let nextId = 1
    const userFamily = atomFamily<{ id: number; name: string; score: number }, number>(id => ({
        id,
        name: `User ${id}`,
        score: Math.floor(Math.random() * 100),
    }))
    const userIdsAtom = atom<number[]>([])
    const userLabelFamily = selectorFamily<string, number>(id => get => {
        const user = get(userFamily(id)) as { name: string; score: number }
        return `${user.name} (${user.score} pts)`
    })
    const totalScoreSelector = selector(get => {
        const ids = get(userIdsAtom) as number[]
        return ids.reduce((sum, id) => {
            const user = get(userFamily(id)) as { score: number }
            return sum + user.score
        }, 0)
    })

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

    function renderList() {
        const ids = demoStore.get(userIdsAtom) as number[]
        list.innerHTML = ""
        for (const id of ids) {
            const userLabel = demoStore.get(userLabelFamily(id)) as string
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
                demoStore.set(userFamily(id), (u: { id: number; name: string; score: number }) => ({
                    ...u,
                    score: u.score + 10,
                }))
            }

            const removeBtn = document.createElement("button")
            removeBtn.textContent = "\u00d7"
            removeBtn.style.cssText = "border: none; background: none; color: inherit; cursor: pointer; opacity: 0.4; font-size: 18px; padding: 0 4px;"
            removeBtn.onclick = () => {
                demoStore.set(userIdsAtom, (ids: number[]) => ids.filter(i => i !== id))
            }

            row.append(text, scoreBtn, removeBtn)
            list.appendChild(row)
        }
        const totalScore = demoStore.get(totalScoreSelector) as number
        total.textContent = ids.length === 0
            ? "No users yet \u2014 click Add User"
            : `Total: ${totalScore} pts across ${ids.length} users`
    }

    addBtn.onclick = () => {
        const id = nextId++
        demoStore.set(userIdsAtom, (ids: number[]) => [...ids, id])
    }

    // Subscribe to changes
    demoStore.sub(userIdsAtom, () => {
        const ids = demoStore.get(userIdsAtom) as number[]
        for (const id of ids) {
            demoStore.sub(userFamily(id), renderList)
        }
        renderList()
    })
    demoStore.sub(totalScoreSelector, renderList)

    container.append(label, addBtn, list, total)
    el.appendChild(container)
    renderList()
}
