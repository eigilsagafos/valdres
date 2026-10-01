export {
    installKeyboardHarness,
    type KeyboardHarness,
} from "../../../@valdres/browser-keyboard/test/setup/keyboardHarness"
// The dispatcher registry behind `@valdres/hotkeys/adapter-internals`, for
// registration-count assertions.
export { inspectRegistry } from "../../../@valdres/hotkeys/src/lib/registry"

export const setPlatform = (platform: string) =>
    Object.defineProperty(navigator, "platform", {
        value: platform,
        configurable: true,
    })
