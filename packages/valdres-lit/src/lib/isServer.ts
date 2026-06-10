/** True when no DOM is available (SSR / plain Node). Used to skip starting
 *  store subscriptions server-side — values still resolve synchronously so
 *  server renders show real state; only the live wiring is browser-only. */
export const isServer = typeof document === "undefined"
