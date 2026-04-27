import { createRoot } from "react-dom/client"
import { Playground } from "./playground"

function mountWhenVisible(el: HTMLElement) {
    const code = el.dataset.code ?? ""
    let mounted = false
    const io = new IntersectionObserver(
        entries => {
            for (const entry of entries) {
                if (entry.isIntersecting && !mounted) {
                    mounted = true
                    io.disconnect()
                    el.textContent = ""
                    el.className = ""
                    createRoot(el).render(<Playground code={code} />)
                }
            }
        },
        { rootMargin: "200px" },
    )
    io.observe(el)
}

document
    .querySelectorAll<HTMLElement>("[data-playground]:not([data-playground-mounted])")
    .forEach(el => {
        el.setAttribute("data-playground-mounted", "")
        mountWhenVisible(el)
    })
