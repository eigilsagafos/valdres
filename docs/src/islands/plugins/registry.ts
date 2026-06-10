// Maps a plugin short-name (the part after `@valdres/`) to a function that
// mounts its interactive demo into a `<div data-plugin-demo="<name>">`
// placeholder. Most entries are declarative `inspector(...)` configs that show
// live atom/selector values; richer plugins reuse hand-built islands. A plugin
// without an entry (e.g. redux-devtools) simply renders no demo — its page just
// shows code.
import { inspector } from "./inspector"
import { mountKeyboardDemo } from "../landing-keyboard"

import { onlineAtom } from "@valdres/browser-online"
import { windowSizeAtom } from "@valdres/browser-window"
import {
    colorSchemeAtom,
    isDarkSelector,
    isLightSelector,
} from "@valdres/browser-color-scheme"
import { visibilityAtom, isVisibleSelector } from "@valdres/browser-visibility"
import {
    coordsSelector,
    accuracySelector,
    geolocationStatusAtom,
} from "@valdres/browser-geolocation"
import {
    downloadSpeedAtom,
    uploadSpeedAtom,
    latencyAtom,
    measurementStatusAtom,
    measureBandwidth,
    invalidateMeasurement,
} from "@valdres/bandwidth"
import {
    contrastAtom,
    prefersMoreContrastSelector,
    prefersLessContrastSelector,
} from "@valdres/browser-contrast"
import {
    accelerationSelector,
    rotationRateSelector,
    motionStatusAtom,
    permissionAtom as motionPermissionAtom,
    requestMotionPermission,
} from "@valdres/browser-device-motion"
import {
    compassHeadingSelector,
    betaSelector,
    gammaSelector,
    orientationStatusAtom,
    requestOrientationPermission,
} from "@valdres/browser-device-orientation"
import { focusAtom } from "@valdres/browser-focus"
import { presenceSelector } from "@valdres/browser-presence"
import {
    reducedDataAtom,
    prefersReducedDataSelector,
} from "@valdres/browser-reduced-data"
import {
    reducedMotionAtom,
    prefersReducedMotionSelector,
} from "@valdres/browser-reduced-motion"
import {
    reducedTransparencyAtom,
    prefersReducedTransparencySelector,
} from "@valdres/browser-reduced-transparency"
import { screenAtom } from "@valdres/browser-screen"
import {
    currentScreenAtom,
    screensAtom,
    screenPermissionAtom,
    requestScreenDetails,
} from "@valdres/browser-screen-details"
import {
    colorModeSelector,
    isDarkModeSelector,
    isLightModeSelector,
    userSelectedColorModeAtom,
} from "@valdres/color-mode"
import {
    currentCodeCombinationAtom,
    currentKeyCombinationAtom,
} from "@valdres/hotkeys"
import { publicIpAtom, publicIpStatusAtom } from "@valdres/public-ip"

export const pluginDemos: Record<string, (el: HTMLElement) => void> = {
    "browser-online": inspector({
        hint: "Toggle your network (or DevTools → offline)",
        rows: [{ label: "onlineAtom", state: onlineAtom }],
    }),

    "browser-window": inspector({
        hint: "Resize the window",
        rows: [
            {
                label: "windowSizeAtom",
                state: windowSizeAtom,
                format: (v: { innerWidth: number; innerHeight: number } | null) =>
                    v ? `${v.innerWidth} × ${v.innerHeight}` : "—",
            },
        ],
    }),

    "browser-color-scheme": inspector({
        hint: "Change your OS light/dark preference",
        rows: [
            { label: "colorSchemeAtom", state: colorSchemeAtom },
            { label: "isDarkSelector", state: isDarkSelector },
            { label: "isLightSelector", state: isLightSelector },
        ],
    }),

    "browser-visibility": inspector({
        hint: "Switch to another tab and back, then return here",
        rows: [
            { label: "visibilityAtom", state: visibilityAtom },
            { label: "isVisibleSelector", state: isVisibleSelector },
        ],
        log: { state: visibilityAtom, label: "visibility changes" },
    }),

    "browser-geolocation": inspector({
        gated: { buttonLabel: "Show my location" },
        hint: "Geolocation API — requires HTTPS and permission",
        rows: [
            {
                label: "coordsSelector",
                state: coordsSelector,
                format: (c: { latitude: number; longitude: number } | null) =>
                    c ? `${c.latitude.toFixed(3)}, ${c.longitude.toFixed(3)}` : "—",
            },
            {
                label: "accuracySelector",
                state: accuracySelector,
                format: (a: number | null) => (a != null ? `±${Math.round(a)}m` : "—"),
            },
            { label: "geolocationStatusAtom", state: geolocationStatusAtom },
        ],
    }),

    "browser-keyboard": mountKeyboardDemo,

    bandwidth: inspector({
        gated: { buttonLabel: "Measure", request: () => measureBandwidth() },
        action: { label: "Re-measure", run: () => invalidateMeasurement() },
        hint: "Run a live throughput test against your connection",
        rows: [
            {
                label: "downloadSpeedAtom",
                state: downloadSpeedAtom,
                format: (v: number) => `${v.toFixed(1)} Mbps`,
            },
            {
                label: "uploadSpeedAtom",
                state: uploadSpeedAtom,
                format: (v: number) => `${v.toFixed(1)} Mbps`,
            },
            {
                label: "latencyAtom",
                state: latencyAtom,
                format: (v: number) => `${v.toFixed(0)} ms`,
            },
            { label: "measurementStatusAtom", state: measurementStatusAtom },
        ],
    }),

    "browser-contrast": inspector({
        hint: "Change your OS contrast preference (accessibility settings)",
        rows: [
            { label: "contrastAtom", state: contrastAtom },
            { label: "prefersMoreContrastSelector", state: prefersMoreContrastSelector },
            { label: "prefersLessContrastSelector", state: prefersLessContrastSelector },
        ],
    }),

    "browser-device-motion": inspector({
        gated: {
            buttonLabel: "Enable motion",
            request: () => requestMotionPermission(),
        },
        hint: "DeviceMotionEvent — needs a device that reports motion (usually null on desktop)",
        rows: [
            { label: "accelerationSelector", state: accelerationSelector },
            { label: "rotationRateSelector", state: rotationRateSelector },
            { label: "motionStatusAtom", state: motionStatusAtom },
            { label: "permissionAtom", state: motionPermissionAtom },
        ],
    }),

    "browser-device-orientation": inspector({
        gated: {
            buttonLabel: "Enable motion sensors",
            request: () => requestOrientationPermission(),
        },
        hint: "Tilt or rotate your device (iOS needs the gesture)",
        rows: [
            {
                label: "compassHeadingSelector",
                state: compassHeadingSelector,
                format: (h: number | null) => (h == null ? "—" : `${Math.round(h)}°`),
            },
            {
                label: "betaSelector",
                state: betaSelector,
                format: (b: number | null) => (b == null ? "—" : `${Math.round(b)}°`),
            },
            {
                label: "gammaSelector",
                state: gammaSelector,
                format: (g: number | null) => (g == null ? "—" : `${Math.round(g)}°`),
            },
            { label: "orientationStatusAtom", state: orientationStatusAtom },
        ],
    }),

    "browser-focus": inspector({
        hint: "Click outside the page or switch tabs/windows and back",
        rows: [{ label: "focusAtom", state: focusAtom }],
    }),

    "browser-presence": inspector({
        hint: "Switch to another tab or click outside the window",
        rows: [{ label: "presenceSelector", state: presenceSelector }],
    }),

    "browser-reduced-data": inspector({
        hint: "Toggle prefers-reduced-data (DevTools → Rendering → Emulate CSS media feature)",
        rows: [
            { label: "reducedDataAtom", state: reducedDataAtom },
            { label: "prefersReducedDataSelector", state: prefersReducedDataSelector },
        ],
    }),

    "browser-reduced-motion": inspector({
        hint: 'Toggle "Reduce motion" in your OS accessibility settings',
        rows: [
            { label: "reducedMotionAtom", state: reducedMotionAtom },
            { label: "prefersReducedMotionSelector", state: prefersReducedMotionSelector },
        ],
    }),

    "browser-reduced-transparency": inspector({
        hint: "Toggle Reduce transparency in your OS accessibility settings",
        rows: [
            { label: "reducedTransparencyAtom", state: reducedTransparencyAtom },
            {
                label: "prefersReducedTransparencySelector",
                state: prefersReducedTransparencySelector,
            },
        ],
    }),

    "browser-screen": inspector({
        hint: "Resize the window or rotate the device",
        rows: [
            {
                label: "screenAtom",
                state: screenAtom,
                format: (s: {
                    width: number
                    height: number
                    devicePixelRatio: number
                    orientationType: string
                }) =>
                    `${s.width} × ${s.height} @${s.devicePixelRatio}× · ${s.orientationType}`,
            },
        ],
    }),

    "browser-screen-details": inspector({
        gated: {
            buttonLabel: "Allow screen access",
            request: () => requestScreenDetails(),
        },
        hint: "Window Management API — requires permission; move the window between displays",
        rows: [
            {
                label: "currentScreenAtom",
                state: currentScreenAtom,
                format: (s: { label: string; width: number; height: number } | null) =>
                    s ? `${s.label}: ${s.width} × ${s.height}` : "—",
            },
            {
                label: "screensAtom",
                state: screensAtom,
                format: (s: unknown[]) => `${s.length} screen${s.length === 1 ? "" : "s"}`,
            },
            { label: "screenPermissionAtom", state: screenPermissionAtom },
        ],
    }),

    "color-mode": inspector({
        hint: "Change your OS light/dark preference",
        rows: [
            { label: "colorModeSelector", state: colorModeSelector },
            { label: "userSelectedColorModeAtom", state: userSelectedColorModeAtom },
            { label: "isDarkModeSelector", state: isDarkModeSelector },
            { label: "isLightModeSelector", state: isLightModeSelector },
        ],
    }),

    hotkeys: inspector({
        hint: "Press and hold any keys",
        rows: [
            { label: "currentCodeCombinationAtom", state: currentCodeCombinationAtom },
            { label: "currentKeyCombinationAtom", state: currentKeyCombinationAtom },
        ],
    }),

    "public-ip": inspector({
        gated: { buttonLabel: "Fetch my public IP" },
        hint: "Fetches your public IP and revalidates in the background",
        rows: [
            { label: "publicIpAtom", state: publicIpAtom },
            { label: "publicIpStatusAtom", state: publicIpStatusAtom },
        ],
    }),
}
