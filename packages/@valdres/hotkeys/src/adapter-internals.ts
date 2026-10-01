// Framework adapters only (`@valdres-react/hotkeys`). Not a public API: it
// shares this package's dispatcher registry, which is why the build splits
// both entries over one module graph.
export { parseShortcuts } from "./lib/parseShortcut"
export { registerBinding } from "./lib/registry"
export { validateBindingConfig } from "./lib/validateBindingConfig"
export type { BindingConfig, BindingHandle } from "./lib/registry"
