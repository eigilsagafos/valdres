import { mount } from "svelte"
import { setValdresContext } from "valdres-svelte"
import { docsStore } from "./shared-store"
import SvelteCounter from "./SvelteCounter.svelte"

export function mountSvelteCounter(el: HTMLElement) {
    mount(SvelteCounter, {
        target: el,
        props: { store: docsStore },
    })
}
