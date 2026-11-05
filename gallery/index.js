
// AWS icon gallery. Reads the generated vendor/aws-icons.json and renders a
// searchable grid. 850+ inline SVGs is more than is comfortable to put in the
// DOM up front, so bodies are injected lazily as cards scroll into view.

var families = [
  {id: 'all', label: 'All', match: () => true},
  {id: 'service', label: 'Services', match: (n) => !/^(res|cat|group)-/.test(n)},
  {id: 'resource', label: 'Resources', match: (n) => /^res-/.test(n)},
  {id: 'category', label: 'Categories', match: (n) => /^cat-/.test(n)},
  {id: 'group', label: 'Groups', match: (n) => /^group-/.test(n)}
]

var $ = (id) => document.getElementById(id)

var state = {
  entries: [],
  family: 'all',
  query: ''
}

// ----------------------------------------------------------------- loading

var load = async () => {
  var res = await fetch(chrome.runtime.getURL('/vendor/aws-icons.json'))
  if (!res.ok) throw new Error(res.status)
  return res.json()
}

// Collapse icons + aliases into one row per icon, carrying its alias list so
// searching for "s3" finds simple-storage-service.
var index = (pack) => {
  var byName = {}

  for (var name of Object.keys(pack.icons)) {
    byName[name] = {name, aliases: [], icon: pack.icons[name]}
  }
  for (var [alias, target] of Object.entries(pack.aliases || {})) {
    var entry = byName[target.parent]
    if (entry) entry.aliases.push(alias)
  }
  for (var entry of Object.values(byName)) {
    entry.aliases.sort((a, b) => a.length - b.length)
    entry.haystack = (entry.name + ' ' + entry.aliases.join(' ')).toLowerCase()
  }

  return Object.values(byName).sort((a, b) => a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------- rendering

var svg = (icon) =>
  `<svg viewBox="0 0 ${icon.width} ${icon.height}" ` +
  `xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${icon.body}</svg>`

// Inline the SVG only once the card is actually on screen.
var observer = new IntersectionObserver((records) => {
  for (var record of records) {
    if (!record.isIntersecting) continue
    var card = record.target
    observer.unobserve(card)
    var entry = card._entry
    card.querySelector('.g-icon').innerHTML = svg(entry.icon)
  }
}, {rootMargin: '400px'})

var card = (entry) => {
  var el = document.createElement('button')
  el.className = 'g-card'
  el.type = 'button'
  el._entry = entry
  el.dataset.name = entry.name
  el.title = `Click to copy aws:${entry.name}`

  var alias = entry.aliases.length
    ? `<span class="g-alias">${entry.aliases.slice(0, 2).join(' &middot; ')}</span>`
    : '<span class="g-alias">&nbsp;</span>'

  el.innerHTML =
    `<span class="g-icon"></span>` +
    `<span class="g-name">${entry.name}</span>` +
    alias

  observer.observe(el)
  return el
}

var render = () => {
  var family = families.find((f) => f.id === state.family)
  var query = state.query.trim().toLowerCase()

  var matches = state.entries.filter((entry) =>
    family.match(entry.name) && (!query || entry.haystack.includes(query)))

  var grid = $('g-grid')
  grid.replaceChildren(...matches.map(card))

  $('g-count').textContent = query || state.family !== 'all'
    ? `${matches.length} of ${state.entries.length} icons`
    : `${state.entries.length} icons`

  $('g-empty').classList.toggle('hidden', matches.length > 0)
}

// ------------------------------------------------------------------- copy

var toast = (text) => {
  var el = $('g-toast')
  el.textContent = text
  el.classList.remove('hidden')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => el.classList.add('hidden'), 1400)
}

var copy = async (name) => {
  var token = `aws:${name}`
  try {
    await navigator.clipboard.writeText(token)
    toast(`Copied ${token}`)
  }
  catch (err) {
    toast(token)
  }
}

// ------------------------------------------------------------------- init

var init = async () => {
  var pack
  try {
    pack = await load()
  }
  catch (err) {
    $('g-missing').classList.remove('hidden')
    document.querySelector('.g-controls').classList.add('hidden')
    return
  }

  state.entries = index(pack)

  $('g-search').placeholder =
    `Search ${state.entries.length} icons by name or alias…`

  $('g-families').replaceChildren(...families.map((family) => {
    var el = document.createElement('button')
    el.type = 'button'
    el.className = 'g-family' + (family.id === state.family ? ' active' : '')
    el.textContent = family.label
    el.dataset.family = family.id
    return el
  }))

  $('g-families').addEventListener('click', (e) => {
    var button = e.target.closest('.g-family')
    if (!button) return
    state.family = button.dataset.family
    for (var el of document.querySelectorAll('.g-family')) {
      el.classList.toggle('active', el === button)
    }
    render()
  })

  $('g-search').addEventListener('input', (e) => {
    state.query = e.target.value
    render()
  })

  $('g-grid').addEventListener('click', (e) => {
    var button = e.target.closest('.g-card')
    if (button) copy(button.dataset.name)
  })

  $('g-dark').addEventListener('change', (e) => {
    document.body.classList.toggle('g-dark-preview', e.target.checked)
  })

  render()
  $('g-search').focus()
}

init()
