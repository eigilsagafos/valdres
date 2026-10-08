import { atom, store } from "valdres"

// Single shared store for the docs site's React islands: the landing counter,
// the keyboard and online cards, and the plugin inspectors.
//
// It used to drive the theme toggle through @valdres/color-mode, which is not
// migrated to Valdres v1 (see ./unavailable.ts). The toggle is plain DOM in
// client.ts on every page now.
export const docsStore = store()

// Shared counter atom for the cross-framework demo
export const countAtom = atom(0)
