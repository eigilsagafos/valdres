// Maps a plugin short-name (the part after `@valdres/`) to a function that
// mounts its interactive demo into a `<div data-plugin-demo="<name>">`
// placeholder. Most entries are declarative `inspector(...)` configs that show
// live atom/selector values; richer plugins reuse the hand-built landing
// islands. A plugin without an entry simply renders no demo — the page still
// shows its code examples.
import { inspector } from "./inspector"
import { mountKeyboardDemo } from "../landing-keyboard"

import { onlineAtom } from "@valdres/browser-online"
import { windowSizeAtom } from "@valdres/browser-window"
import {
    colorSchemeAtom,
    isDarkSelector,
    isLightSelector,
} from "@valdres/browser-color-scheme"
import {
    visibilityAtom,
    isVisibleSelector,
} from "@valdres/browser-visibility"
import {
    coordsSelector,
    accuracySelector,
    geolocationStatusAtom,
} from "@valdres/browser-geolocation"

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
        hint: "Switch to another tab and back",
        rows: [
            { label: "visibilityAtom", state: visibilityAtom },
            { label: "isVisibleSelector", state: isVisibleSelector },
        ],
    }),

    "browser-geolocation": inspector({
        gated: { buttonLabel: "Show my location" },
        hint: "Geolocation API — requires HTTPS and permission",
        rows: [
            {
                label: "coordsSelector",
                state: coordsSelector,
                format: (c: { latitude: number; longitude: number } | null) =>
                    c
                        ? `${c.latitude.toFixed(3)}, ${c.longitude.toFixed(3)}`
                        : "—",
            },
            {
                label: "accuracySelector",
                state: accuracySelector,
                format: (a: number | null) =>
                    a != null ? `±${Math.round(a)}m` : "—",
            },
            { label: "geolocationStatusAtom", state: geolocationStatusAtom },
        ],
    }),

    "browser-keyboard": mountKeyboardDemo,
}
