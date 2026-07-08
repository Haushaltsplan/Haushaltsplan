/** tsx --require ./scripts/mock-server-only.cjs — erlaubt server-only-Imports in Scripts */
const Module = require('module')
const orig = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'server-only') return {}
  return orig.apply(this, arguments)
}
