
// Convert the official AWS Architecture Icons asset package into an Iconify
// icon set consumable by mermaid's registerIconPacks().
//
// The AWS asset package is not redistributed with this extension. Point
// AWS_ICONS_DIR at a local copy of the unpacked download:
//   https://aws.amazon.com/architecture/icons/
//
// Usage: node build-icons.js <source-dir> <target-file>

var fs = require('fs')
var path = require('path')

var source = path.resolve(process.argv[2])
var target = path.resolve(process.argv[3])

// ---------------------------------------------------------------- utilities

var walk = (dir, result = []) => {
  for (var entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name === '__MACOSX') continue
    var full = path.join(dir, entry.name)
    entry.isDirectory() ? walk(full, result) : result.push(full)
  }
  return result
}

// Deliberately does not split camelCase. AWS brand names are single words
// (CloudFront, DynamoDB, EventBridge, SageMaker) and that is how people type
// them; splitting produces sage-maker, event-bridge and io-t.
var slug = (name) => name
  .replace(/&/g, '-and-')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .toLowerCase()
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')

var unvendor = (name) => name.replace(/^(AWS|Amazon)-/, '')

// Some icons ship Light/Dark pairs, and the package is not consistent about
// where the marker goes: Res_Server_48_Light.svg puts it after the size,
// Arch_AWS-Marketplace_Light_48.svg puts it before. Normalise both out of
// the filename and treat Light as the unsuffixed default.
var variant = (base) => /_Dark(_\d+)?\.svg$/.test(base) ? '-dark' : ''
var devariant = (base) => base.replace(/_(Dark|Light)(?=(_\d+)?\.svg$)/, '')

// ------------------------------------------------------------ svg -> body

// Strip ids that nothing references, and namespace the ones that remain so
// two different icons on the same page cannot collide. Two copies of the
// *same* icon still emit identical ids, but they also emit identical
// definitions, so first-match resolution renders correctly either way.
var namespaceIds = (svg, prefix) => {
  var referenced = new Set()
  for (var match of svg.matchAll(/url\(#([^)]+)\)/g)) referenced.add(match[1])
  for (var match of svg.matchAll(/(?:xlink:)?href="#([^"]+)"/g)) referenced.add(match[1])

  svg = svg.replace(/\s+id="([^"]*)"/g, (all, id) =>
    referenced.has(id) ? ` id="${prefix}-${id}"` : '')

  svg = svg.replace(/url\(#([^)]+)\)/g, (all, id) =>
    referenced.has(id) ? `url(#${prefix}-${id})` : all)

  svg = svg.replace(/((?:xlink:)?href)="#([^"]+)"/g, (all, attr, id) =>
    referenced.has(id) ? `${attr}="#${prefix}-${id}"` : all)

  return svg
}

var parse = (file, name) => {
  var raw = fs.readFileSync(file, 'utf8')

  var open = raw.match(/<svg\b[^>]*>/)
  if (!open) return null

  var viewBox = (open[0].match(/viewBox="([^"]*)"/) || [])[1]
  var [, , width, height] = viewBox
    ? viewBox.split(/[\s,]+/).map(Number)
    : [0, 0, Number((open[0].match(/width="(\d+)/) || [])[1] || 24),
             Number((open[0].match(/height="(\d+)/) || [])[1] || 24)]

  var body = raw
    .slice(raw.indexOf(open[0]) + open[0].length, raw.lastIndexOf('</svg>'))
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // <title> is the Sketch artboard name, not useful and it leaks into
    // tooltips when the icon is inlined
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<desc>[\s\S]*?<\/desc>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim()

  if (!body) return null

  return {body: namespaceIds(body, name), width, height}
}

// ------------------------------------------------------------- collection

// Each family contributes a differently-shaped filename. Resolve every file
// to {name, size} and let the caller pick the preferred size per name.
var families = [
  {
    dir: 'Architecture-Service-Icons',
    // Arch_AWS-Lambda_48.svg -> lambda
    match: /^Arch_(.+)_(\d+)\.svg$/,
    name: (m) => slug(unvendor(m[1])),
    alias: (m) => slug(m[1]),
    prefer: 48
  },
  {
    dir: 'Resource-Icons',
    // Res_Amazon-EC2_AMI_48.svg -> res-ec2-ami
    match: /^Res_(.+)_(\d+)\.svg$/,
    name: (m) => 'res-' + slug(unvendor(m[1])),
    alias: (m) => 'res-' + slug(m[1]),
    prefer: 48
  },
  {
    dir: 'Category-Icons',
    // Arch-Category_Analytics_48.svg -> cat-analytics
    match: /^Arch-Category_(.+)_(\d+)\.svg$/,
    name: (m) => 'cat-' + slug(m[1]),
    alias: () => null,
    prefer: 48
  },
  {
    dir: 'Architecture-Group-Icons',
    // Virtual-private-cloud-VPC_32.svg -> group-virtual-private-cloud-vpc
    match: /^(.+)_(\d+)\.svg$/,
    name: (m) => 'group-' + slug(m[1]),
    alias: () => null,
    prefer: 32
  }
]

var icons = {}
var aliases = {}
var skipped = []
var collisions = []

for (var file of walk(source)) {
  if (!file.endsWith('.svg')) continue

  var base = path.basename(file)
  var family = families.find((f) => file.includes(f.dir))
  if (!family) { skipped.push(file); continue }

  var suffix = variant(base)
  var m = devariant(base).match(family.match)
  if (!m) { skipped.push(file); continue }
  if (Number(m[2]) !== family.prefer) continue

  var name = family.name(m) + suffix

  if (icons[name]) {
    // Two categories ship the same service at the same size with different
    // background colours. Keep the first and record it rather than letting
    // directory iteration order silently decide.
    collisions.push({name, kept: icons[name]._file, dropped: file})
    continue
  }

  var icon = parse(file, name)
  if (!icon) { skipped.push(file); continue }

  icon._file = path.relative(source, file).replace(/\\/g, '/')
  icons[name] = icon

  var alias = family.alias(m)
  if (alias) alias += suffix
  if (alias && alias !== name && !aliases[alias]) aliases[alias] = {parent: name}
}

// ------------------------------------------------------- curated shortcuts

var curated = JSON.parse(fs.readFileSync(path.join(__dirname, 'aliases.json'), 'utf8'))
var unresolved = []

for (var [short, full] of Object.entries(curated)) {
  if (short.startsWith('_')) continue // commentary
  if (!icons[full]) { unresolved.push(`${short} -> ${full}`); continue }
  if (icons[short]) { unresolved.push(`${short} (would shadow a real icon)`); continue }
  aliases[short] = {parent: full}
}

// ------------------------------------------------------------------ output

for (var icon of Object.values(icons)) delete icon._file

var pack = {
  prefix: 'aws',
  info: {
    name: 'AWS Architecture Icons',
    author: {
      name: 'Amazon Web Services',
      url: 'https://aws.amazon.com/architecture/icons/'
    },
    license: {
      title: 'AWS Trademark Guidelines / Architecture Icons Terms of Use',
      url: 'https://aws.amazon.com/architecture/icons/'
    },
    total: Object.keys(icons).length
  },
  icons,
  aliases
}

fs.mkdirSync(path.dirname(target), {recursive: true})
fs.writeFileSync(target, JSON.stringify(pack), 'utf8')

var size = (fs.statSync(target).size / 1024).toFixed(0)
console.log(`aws-icons: ${Object.keys(icons).length} icons, ` +
            `${Object.keys(aliases).length} aliases, ${size} KB`)

if (collisions.length) {
  console.log(`aws-icons: ${collisions.length} duplicate name(s), first kept:`)
  for (var c of collisions) console.log(`  ${c.name}: kept ${c.kept}`)
}
if (unresolved.length) {
  console.log(`aws-icons: ${unresolved.length} curated alias(es) not applied:`)
  for (var u of unresolved) console.log(`  ${u}`)
}
if (skipped.length) {
  console.log(`aws-icons: ${skipped.length} file(s) skipped (unrecognised layout)`)
}
