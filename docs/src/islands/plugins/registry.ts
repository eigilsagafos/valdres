// Maps a plugin short-name (the part after `@valdres/`) to a function that
// mounts its interactive demo into a `<div data-plugin-demo="<name>">`
// placeholder and returns its cleanup. Most entries are declarative
// `inspector(...)` configs that show live atom/selector values; richer plugins
// reuse hand-built islands. A plugin without an entry (e.g. redux-devtools)
// simply renders no demo — its page just shows code.
//
// Packages not yet migrated to Valdres v1 render a notice instead, and must not
// be imported here: see ../unavailable.ts.
import { inspector } from "./inspector"
import { mountKeyboardDemo } from "../landing-keyboard"
import { mountV1Unavailable, type V1UnavailableKey } from "../unavailable"

import { onlineAtom } from "@valdres/browser-online"
import {
    colorSchemeAtom,
    isDarkSelector,
    isLightSelector,
} from "@valdres/browser-color-scheme"
import { visibilityAtom, isVisibleSelector } from "@valdres/browser-visibility"
import {
    contrastAtom,
    prefersMoreContrastSelector,
    prefersLessContrastSelector,
} from "@valdres/browser-contrast"
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
import { shortcutSelector } from "@valdres/hotkeys"

const unavailable = (key: V1UnavailableKey) => (el: HTMLElement) =>
    mountV1Unavailable(el, key)

export const pluginDemos: Record<string, (el: HTMLElement) => () => void> = {
    "browser-online": inspector({
        hint: "Toggle your network (or DevTools → offline)",
        rows: [{ label: "onlineAtom", state: onlineAtom }],
    }),

    "browser-window": unavailable("@valdres/browser-window"),

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

    "browser-geolocation": unavailable("@valdres/browser-geolocation"),

    "browser-keyboard": mountKeyboardDemo,

    bandwidth: unavailable("@valdres/bandwidth"),

    "browser-contrast": inspector({
        hint: "Change your OS contrast preference (accessibility settings)",
        rows: [
            { label: "contrastAtom", state: contrastAtom },
            { label: "prefersMoreContrastSelector", state: prefersMoreContrastSelector },
            { label: "prefersLessContrastSelector", state: prefersLessContrastSelector },
        ],
    }),

    "browser-device-motion": unavailable("@valdres/browser-device-motion"),

    "browser-device-orientation": unavailable("@valdres/browser-device-orientation"),

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

    "browser-screen": unavailable("@valdres/browser-screen"),

    "browser-screen-details": unavailable("@valdres/browser-screen-details"),

    "color-mode": unavailable("@valdres/color-mode"),

    hotkeys: inspector({
        hint: "Press Mod+K, then ? (Shift+/ on most layouts)",
        rows: [
            { label: 'shortcutSelector("Mod+K")', state: shortcutSelector("Mod+K") },
            { label: 'shortcutSelector("?")', state: shortcutSelector("?") },
        ],
    }),

    "public-ip": unavailable("@valdres/public-ip"),
}
