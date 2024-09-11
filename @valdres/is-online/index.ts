import { selector, atom } from "../valdres"

// https://icanhazip.com/

export const isOnlineNavigator = atom(() => {})

export const isOnlineSelector = atom(() => {}, {
    maxAge: 60,
    staleWhileRevalidate: 60,
})
