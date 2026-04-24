import { store } from "valdres"
import {
    positionAtom,
    permissionAtom,
    geolocationStatusAtom,
    geolocationErrorAtom,
    geolocationOptionsAtom,
    coordsSelector,
    accuracySelector,
    altitudeSelector,
    altitudeAccuracySelector,
    headingSelector,
    speedSelector,
} from "../src"

declare const L: any

const s = store()

const $ = (id: string) => document.getElementById(id)!

const statusEl = $("status")
const permissionEl = $("permission")
const errorEl = $("error")
const coordsEl = $("coords")
const accuracyEl = $("accuracy")
const altitudeEl = $("altitude")
const altitudeAccuracyEl = $("altitude-accuracy")
const headingEl = $("heading")
const speedEl = $("speed")
const snapshotEl = $("snapshot")

const highAccuracyInput = $("high-accuracy") as HTMLInputElement
const timeoutInput = $("timeout") as HTMLInputElement
const maxAgeInput = $("max-age") as HTMLInputElement

const setPill = (el: HTMLElement, value: string) => {
    el.textContent = value
    el.className = `pill pill-${value}`
}

const fmt = (n: number | null | undefined, digits = 2) =>
    typeof n === "number" ? n.toFixed(digits) : "—"

const fmtOptional = (
    n: number | null | undefined,
    hasPosition: boolean,
    digits = 2,
) => {
    if (typeof n === "number") return n.toFixed(digits)
    return hasPosition ? "n/a" : "—"
}

const renderStatus = () => setPill(statusEl, s.get(geolocationStatusAtom))
const renderPermission = () => setPill(permissionEl, s.get(permissionAtom))
const renderError = () => {
    const err = s.get(geolocationErrorAtom)
    errorEl.textContent = err ? `${err.code}: ${err.message}` : ""
}
const renderCoords = () => {
    const c = s.get(coordsSelector)
    coordsEl.textContent = c ? `${fmt(c.latitude, 5)}, ${fmt(c.longitude, 5)}` : "—"
}
const renderAccuracy = () => (accuracyEl.textContent = fmt(s.get(accuracySelector)))
const renderAltitude = () => {
    const hasPosition = s.get(positionAtom) !== null
    altitudeEl.textContent = fmtOptional(s.get(altitudeSelector), hasPosition)
}
const renderAltitudeAccuracy = () => {
    const hasPosition = s.get(positionAtom) !== null
    altitudeAccuracyEl.textContent = fmtOptional(
        s.get(altitudeAccuracySelector),
        hasPosition,
    )
}
const renderHeading = () => {
    const hasPosition = s.get(positionAtom) !== null
    headingEl.textContent = fmtOptional(s.get(headingSelector), hasPosition)
}
const renderSpeed = () => {
    const hasPosition = s.get(positionAtom) !== null
    speedEl.textContent = fmtOptional(s.get(speedSelector), hasPosition, 3)
}
const renderSnapshot = () => {
    const p = s.get(positionAtom)
    snapshotEl.textContent = p ? JSON.stringify(p, null, 2) : "—"
}

const opts = s.get(geolocationOptionsAtom)
highAccuracyInput.checked = !!opts.enableHighAccuracy
timeoutInput.value = String(opts.timeout ?? 30000)
maxAgeInput.value = String(opts.maximumAge ?? 0)

const updateOptions = () => {
    geolocationOptionsAtom.setSelf({
        enableHighAccuracy: highAccuracyInput.checked,
        timeout: Number(timeoutInput.value) || 30000,
        maximumAge: Number(maxAgeInput.value) || 0,
    })
}
highAccuracyInput.addEventListener("change", updateOptions)
timeoutInput.addEventListener("change", updateOptions)
maxAgeInput.addEventListener("change", updateOptions)

const map = L.map("map", { zoomControl: true }).setView([0, 0], 2)
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map)

let marker: any
let accuracyCircle: any
let hasCentered = false

const renderMap = () => {
    const p = s.get(positionAtom)
    if (!p) return
    const latlng: [number, number] = [p.latitude, p.longitude]

    if (!marker) {
        marker = L.marker(latlng).addTo(map)
        accuracyCircle = L.circle(latlng, {
            radius: p.accuracy,
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
            weight: 1,
        }).addTo(map)
    } else {
        marker.setLatLng(latlng)
        accuracyCircle.setLatLng(latlng).setRadius(p.accuracy)
    }

    if (!hasCentered) {
        map.setView(latlng, 15)
        hasCentered = true
    }
}

s.sub(geolocationStatusAtom, renderStatus)
s.sub(permissionAtom, renderPermission)
s.sub(geolocationErrorAtom, renderError)
s.sub(positionAtom, () => {
    renderCoords()
    renderAccuracy()
    renderAltitude()
    renderAltitudeAccuracy()
    renderHeading()
    renderSpeed()
    renderSnapshot()
    renderMap()
})

renderStatus()
renderPermission()
renderError()
renderCoords()
renderAccuracy()
renderAltitude()
renderAltitudeAccuracy()
renderHeading()
renderSpeed()
renderSnapshot()
renderMap()
