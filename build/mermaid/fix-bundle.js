
var fs = require('fs')
var path = require('path')

// mermaid.min.js
var source = path.resolve(__dirname, process.argv[2])
var target = path.resolve(__dirname, process.argv[3])

var code = fs.readFileSync(source, 'utf8')

var replace = (find, replacement) => {
  if (!code.includes(find)) {
    console.error(`mermaid: expected pattern not found: ${find}`)
    process.exit(1)
  }
  code = code.replaceAll(find, replacement)
}

// https://github.com/mermaid-js/mermaid/issues/5378
// https://discourse.mozilla.org/t/cannot-inject-a-javascript-file-because-of-a-csp-limitations/128649
replace(
  'Function("return this")',
  '(() => globalThis)'
)

// The bundle ends with:
//
//   var __esbuild_esm_mermaid_nm;
//   ...
//   globalThis["mermaid"] = globalThis.__esbuild_esm_mermaid_nm["mermaid"].default
//
// which assumes it is evaluated as a top level classic script, where `var`
// becomes a property of the global object. chrome.scripting.executeScript
// wraps each injected file in a function scope, so the var stays local,
// globalThis.__esbuild_esm_mermaid_nm is undefined, and the last line throws
// before `mermaid` is ever defined.
//
// Reading the variable directly works in either scope.
replace(
  'globalThis.__esbuild_esm_mermaid_nm["mermaid"]',
  '__esbuild_esm_mermaid_nm["mermaid"]'
)

fs.writeFileSync(target, code, 'utf8')
