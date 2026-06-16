import { defineComponent, watch, type PropType } from "vue"
import type { InitializeCallback } from "valdres"
import { provideValdresScope } from "./provideValdresScope"

// Declared at module scope (not global) to avoid clashing with consumers'
// @types/node; guarded at use so it can't throw in raw browser ESM. Plain
// member access keeps `process.env.NODE_ENV` matchable for consumer bundlers'
// dead-code elimination (mirrors valdres core's IS_PROD).
declare const process: { env?: { NODE_ENV?: string } }
const isDev =
    typeof process === "undefined" ||
    process.env == null ||
    process.env.NODE_ENV !== "production"

/** [Docs Reference](https://valdres.dev/vue/ValdresScope)
 *
 * Renderless component that scopes its slot to a child store — sugar over
 * {@link provideValdresScope} for template-driven scoping. Prefer the composable
 * when a `<script setup>` component scopes itself.
 *
 * ```vue
 * <ValdresScope scope-id="modal" :initialize="init">
 *   <ModalContent />
 * </ValdresScope>
 * ```
 *
 * `scopeId` is read once at mount (it is not reactive); a dynamic id needs
 * `:key="scopeId"` to force a remount. In dev, changing it without a remount
 * logs a warning.
 */
export const ValdresScope = defineComponent({
    name: "ValdresScope",
    props: {
        scopeId: {
            type: String,
            // No default factory: provideValdresScope computes the SSR-stable
            // useId() default in its body when scopeId is undefined.
            default: undefined,
        },
        initialize: {
            type: Function as PropType<InitializeCallback>,
        },
    },
    setup(props, { slots }) {
        provideValdresScope({
            scopeId: props.scopeId,
            initialize: props.initialize,
        })

        if (isDev) {
            watch(
                () => props.scopeId,
                (next, prev) => {
                    console.warn(
                        `valdres-vue: <ValdresScope> scopeId changed from ` +
                            `"${prev}" to "${next}" without a remount — descendants ` +
                            `keep the original scope. Add :key="scopeId" to re-scope.`,
                    )
                },
            )
        }

        return () => slots.default?.()
    },
})
