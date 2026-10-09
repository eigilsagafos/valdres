/**
 * The window's inner (layout viewport, including any scrollbar) and outer
 * (whole browser window) size, in CSS pixels. Snapshots are frozen and shared
 * by every store that reads them, so the fields are read-only.
 */
export interface WindowSize {
    readonly innerWidth: number
    readonly innerHeight: number
    readonly outerWidth: number
    readonly outerHeight: number
}
