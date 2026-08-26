import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const [distDirectory, outputFile] = process.argv.slice(2)
if (!distDirectory || !outputFile) {
  throw new Error('Usage: node make-native-html.mjs <dist-directory> <output-file>')
}

const dist = resolve(distDirectory)
let html = await readFile(join(dist, 'index.html'), 'utf8')

const stylesheet = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/)
const moduleScript = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/)

if (!stylesheet || !moduleScript) {
  throw new Error('Could not find the production stylesheet or script in dist/index.html')
}

const assetPath = (path) => join(dist, path.replace(/^\.\//, '').replace(/^\//, ''))
const css = (await readFile(assetPath(stylesheet[1]), 'utf8')).replace(/<\/style/gi, '<\\\\/style')
const javascript = (await readFile(assetPath(moduleScript[1]), 'utf8')).replace(/<\/script/gi, '<\\\\/script')

html = html
  .replace(stylesheet[0], () => `<style>${css}</style>`)
  .replace(moduleScript[0], '')
  .replace('</body>', () => `<script>${javascript}</script>\n  </body>`)

await mkdir(dirname(resolve(outputFile)), { recursive: true })
await writeFile(resolve(outputFile), html)
