import { store } from "valdres"
import {
    currentScreenAtom,
    requestScreenDetails,
    screenPermissionAtom,
    screensAtom,
    type ScreenDetail,
} from "../src"

const s = store()
const permissionEl = document.getElementById("permission")!
const screensEl = document.getElementById("screens")!
const layoutEl = document.getElementById("layout")!
const requestBtn = document.getElementById("request") as HTMLButtonElement

const field = (label: string, value: string | number) =>
    `<dt>${label}</dt><dd>${value}</dd>`

const renderScreen = (screen: ScreenDetail, current: ScreenDetail | null) => {
    const isCurrent = current?.label === screen.label &&
        current?.left === screen.left &&
        current?.top === screen.top
    return `
        <div class="screen${isCurrent ? " current" : ""}">
            <strong>${screen.label || "(unnamed)"}</strong>
            <dl>
                ${field("position", `${screen.left}, ${screen.top}`)}
                ${field("size", `${screen.width} × ${screen.height}`)}
                ${field("avail", `${screen.availWidth} × ${screen.availHeight}`)}
                ${field("dpr", screen.devicePixelRatio)}
                ${field("depth", `${screen.colorDepth}-bit`)}
                ${field("orientation", `${screen.orientationType} @ ${screen.orientationAngle}°`)}
                ${field("primary", String(screen.isPrimary))}
                ${field("internal", String(screen.isInternal))}
            </dl>
        </div>
    `
}

const renderLayout = (screens: ScreenDetail[], current: ScreenDetail | null) => {
    if (!screens.length) {
        layoutEl.style.height = "0"
        layoutEl.innerHTML = ""
        return
    }
    const minX = Math.min(...screens.map(s => s.left))
    const minY = Math.min(...screens.map(s => s.top))
    const maxX = Math.max(...screens.map(s => s.left + s.width))
    const maxY = Math.max(...screens.map(s => s.top + s.height))
    const totalWidth = maxX - minX
    const totalHeight = maxY - minY
    const scale = Math.min(900 / totalWidth, 1)
    layoutEl.style.height = `${totalHeight * scale + 16}px`
    layoutEl.innerHTML = screens
        .map(screen => {
            const isCurrent =
                current?.label === screen.label &&
                current?.left === screen.left &&
                current?.top === screen.top
            return `
                <div class="layout-screen${isCurrent ? " current" : ""}"
                    style="left:${(screen.left - minX) * scale + 8}px;
                           top:${(screen.top - minY) * scale + 8}px;
                           width:${screen.width * scale}px;
                           height:${screen.height * scale}px">
                    ${screen.label || ""}
                </div>
            `
        })
        .join("")
}

const render = () => {
    const screens = s.get(screensAtom)
    const current = s.get(currentScreenAtom)
    const permission = s.get(screenPermissionAtom)

    permissionEl.textContent = `permission: ${permission}`
    requestBtn.disabled = permission === "unsupported"
    if (screens.length === 0) {
        screensEl.innerHTML = `<p class="muted">No screen data yet. Click "Request screen details" to grant window-management permission.</p>`
    } else {
        screensEl.innerHTML = screens.map(sc => renderScreen(sc, current)).join("")
    }
    renderLayout(screens, current)
}

s.sub(screensAtom, render)
s.sub(currentScreenAtom, render)
s.sub(screenPermissionAtom, render)
render()

requestBtn.addEventListener("click", async () => {
    try {
        await requestScreenDetails()
    } catch (err) {
        alert(`Failed to get screen details: ${(err as Error).message}`)
    }
})
