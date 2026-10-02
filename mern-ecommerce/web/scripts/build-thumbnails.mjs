// Generates public/products/thumbs/<name>.webp (640px wide) for every product
// photo, so grids and cart lines do not download the full-size JPEGs.
import { mkdir, readdir, stat } from 'node:fs/promises'
import { dirname, join, parse } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const WIDTH = 640
const QUALITY = 72

const source = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'products')
const target = join(source, 'thumbs')

await mkdir(target, { recursive: true })

const files = (await readdir(source)).filter((file) => /\.jpe?g$/i.test(file))
let before = 0
let after = 0

for (const file of files) {
  const out = join(target, `${parse(file).name}.webp`)
  await sharp(join(source, file)).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(out)
  before += (await stat(join(source, file))).size
  after += (await stat(out)).size
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} kB`
console.log(`${files.length} thumbnails written to public/products/thumbs (${kb(before)} -> ${kb(after)})`)
