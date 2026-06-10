/** Fail fast (with a clear message) when a valdres-lit decorator is applied to
 *  anything but a non-static `accessor` member — plain-JS misapplication
 *  otherwise surfaces as an opaque TypeError much later. */
export const assertAccessorContext = (
    context: { kind: string; static?: boolean },
    name: string,
) => {
    if (context.kind !== "accessor" || context.static) {
        throw new Error(
            `valdres-lit: @${name} only supports non-static \`accessor\` class members.`,
        )
    }
}
