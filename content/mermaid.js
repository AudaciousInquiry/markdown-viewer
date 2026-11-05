
var mmd = (() => {
  var loaded = false
  var registered = false
  var pack = null

  var walk = (regex, string, result = [], match = regex.exec(string)) =>
    !match ? result : walk(regex, string, result.concat(match[1]))

  // ------------------------------------------------------- aws icon pack

  // Fetched at most once per page, and only if a diagram actually references
  // an aws: icon. The pack is a couple of megabytes, so eagerly loading it on
  // every markdown page would be wasteful.
  var icons = () => pack || (pack =
    fetch(chrome.runtime.getURL('/vendor/aws-icons.json'))
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.status)))
  )

  var register = () => {
    if (registered || !mermaid.registerIconPacks) return
    registered = true
    mermaid.registerIconPacks([{name: 'aws', loader: icons}])
  }

  // --------------------------------------------------------- name hinting

  var distance = (a, b) => {
    var row = Array.from({length: b.length + 1}, (_, i) => i)
    for (var i = 1; i <= a.length; i++) {
      var prev = row[0]
      row[0] = i
      for (var j = 1; j <= b.length; j++) {
        var next = Math.min(
          row[j] + 1,
          row[j - 1] + 1,
          prev + (a[i - 1] === b[j - 1] ? 0 : 1)
        )
        prev = row[j]
        row[j] = next
      }
    }
    return row[b.length]
  }

  // Prefer names that contain what was typed, then fall back to edit
  // distance, so "lamda" finds "lambda" and "s3-" finds the s3 family.
  var suggest = (name, all) => {
    var contains = all
      .filter((other) => other.includes(name) || name.includes(other))
      .sort((a, b) => a.length - b.length)

    if (contains.length) return contains.slice(0, 5)

    return all
      .map((other) => [other, distance(name, other)])
      .filter(([, d]) => d <= Math.max(2, Math.floor(name.length / 3)))
      .sort((a, b) => a[1] - b[1])
      .slice(0, 5)
      .map(([other]) => other)
  }

  var notice = (diagram, children) => {
    var el = document.createElement('div')
    el.className = 'markdown-viewer-icon-hint'
    el.append(...children)

    var pre = diagram.closest('pre') || diagram
    pre.parentNode.insertBefore(el, pre)
  }

  var link = () => {
    var a = document.createElement('a')
    a.href = chrome.runtime.getURL('/gallery/index.html')
    a.target = '_blank'
    a.textContent = 'browse the icon gallery'
    return a
  }

  var text = (tag, value) => {
    var el = document.createElement(tag)
    el.textContent = value
    return el
  }

  // Mermaid renders an unknown icon as a silent placeholder, which reads as a
  // diagram bug rather than a typo. Check the names ourselves first and say
  // what went wrong.
  var validate = async () => {
    for (var el of document.querySelectorAll('.markdown-viewer-icon-hint')) {
      el.remove()
    }

    var diagrams = Array.from(document.querySelectorAll('pre code.mermaid'))
      .map((diagram) => ({
        diagram,
        used: [...new Set(
          walk(/\baws:([a-z0-9][a-z0-9-]*)/g, diagram.textContent)
        )]
      }))
      .filter(({used}) => used.length)

    if (!diagrams.length) return

    var all
    try {
      var json = await icons()
      all = new Set([
        ...Object.keys(json.icons),
        ...Object.keys(json.aliases || {})
      ])
    }
    catch (err) {
      for (var {diagram} of diagrams) {
        notice(diagram, [
          text('strong', 'No AWS icon pack is installed. '),
          text('span', 'This build of Markdown Viewer was packaged without ' +
                       'the AWS Architecture Icons, so aws: names will not ' +
                       'render. '),
          link(),
          text('span', ' for setup instructions.')
        ])
      }
      return
    }

    var names = [...all]

    for (var {diagram, used} of diagrams) {
      var unknown = used.filter((name) => !all.has(name))
      if (!unknown.length) continue

      var children = [
        text('strong', unknown.length === 1
          ? `Unknown icon aws:${unknown[0]}. `
          : `Unknown icons: ${unknown.map((n) => 'aws:' + n).join(', ')}. `)
      ]

      for (var name of unknown) {
        var matches = suggest(name, names)
        if (!matches.length) continue
        children.push(text('span',
          `Did you mean ${matches.map((n) => 'aws:' + n).join(', ')}? `))
      }

      children.push(text('span', 'Or '), link(), text('span', '.'))
      notice(diagram, children)
    }
  }

  // --------------------------------------------------------------- render

  return {
    render: () => {
      if (loaded) {
        var definitions = walk(/<pre><code class="mermaid">([\s\S]+?)<\/code><\/pre>/gi, state.html)

        Array.from(document.querySelectorAll('pre code.mermaid')).forEach((diagram, index) => {
          diagram.removeAttribute('data-processed')
          diagram.innerHTML = definitions[index]
        })
      }
      var theme =
        state._themes[state.theme] === 'dark' ||
        (state._themes[state.theme] === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark' : 'default'

      validate()
      register()

      mermaid.initialize({theme})
      // mermaid.init is deprecated since v10 and scheduled for removal in v13
      mermaid.run({querySelector: 'code.mermaid'})
      loaded = true

      var diagrams = Array.from(document.querySelectorAll('code.mermaid'))
      var timeout = setInterval(() => {
        // Direct children only, see the matching note in scroll.js
        var svg = Array.from(document.querySelectorAll('pre code.mermaid > svg'))
        if (diagrams.length === svg.length) {
          clearInterval(timeout)
          svg.forEach((diagram) => {
            var panzoom = Panzoom(diagram, {canvas: true})
            diagram.parentElement.parentElement.addEventListener('wheel', (e) => {
              if (!e.shiftKey) return
              panzoom.zoomWithWheel(e)
            })
          })
        }
      }, 50)
    }
  }
})()
