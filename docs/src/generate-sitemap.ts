import type { CompiledDoc } from "./compile-mdx"

export async function generateSitemap(docs: CompiledDoc[], distDir: string, siteUrl: string) {
    // Generate sitemap.xml
    const urls = docs.map(doc => `  <url><loc>${siteUrl}${doc.route}</loc></url>`).join("\n")
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}</loc></url>
${urls}
</urlset>`
    await Bun.write(`${distDir}/sitemap.xml`, sitemap)

    // Generate robots.txt
    const robots = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml`
    await Bun.write(`${distDir}/robots.txt`, robots)
}
