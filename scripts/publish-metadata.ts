export const MINIMUM_NODE_VERSION = "22.12.0"
export const NODE_ENGINE_RANGE = `>=${MINIMUM_NODE_VERSION}`
export const INSTANCE_GUARD_SIDE_EFFECTS = [
    "./dist/index.js",
    "./dist/development/index.js",
] as const
