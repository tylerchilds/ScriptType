import { readLines } from "https://deno.land/std@0.175.0/io/read_lines.ts";
import * as path from "https://deno.land/std@0.175.0/path/mod.ts";

let scope = 'global'
let dynamic = ''

const ScriptType = {
  '{': metaCode,
  '#': place,
  '@': actor,
  '"': message,
  '(': subtext,
  '!': context,
  '^': composition,
  '<': dynamicCode,
}

const input = Deno.args[0];
const output = Deno.args[1];

const result = path.join(Deno.cwd(), output)
const format = path.join(Deno.cwd(), 'src/format.css')

await Deno.create(result);

const NORMAL_MODE = 'normal'
const META_MODE = 'meta'
const DYNAMIC_MODE = 'dynamic'

const modes = {
  [NORMAL_MODE]: normalMode,
  [META_MODE]: metaMode,
  [DYNAMIC_MODE]: dynamicMode,
}

let mode = NORMAL_MODE

const bus = {
  state: {}
}

const symbols = Object.keys(ScriptType)

const filename = path.join(Deno.cwd(), input);
const fileReader = await Deno.open(filename);

for await (const line of readLines(fileReader)) {
  await (modes[mode] || noop)(line)
}

async function normalMode(line) {
  if(!line) return await blank()

  const symbol = line[0]

  if(symbols.includes(symbol)) {
    const [_, text] = line.split(symbol)
    return await ScriptType[symbol](text.trim())
  }

  return await freetext(line)
}

async function metaMode(line) {
  const [key, value] = line.split(':')

  if(!value) {
    await headers()
    await metapage()
    return setMode(NORMAL_MODE)
  }

  bus.state[scope][key.trim()] = value.trim()
}

async function dynamicMode(line) {
  const [key, value] = line.split(':')

  if(!value) {
    await module()
    return setMode(NORMAL_MODE)
  }

  bus.state[dynamic][key.trim()] = value.trim()
}


function setMode(m) {
  mode = m
}

function setScope(s) {
  scope = s
}

function setDynamic(d) {
  dynamic = d
}


function metaCode(scope) {
  setScope(scope)
  resetAttributes(scope)
  setMode(META_MODE)
}

function dynamicCode(x) {
  setDynamic(x)
  resetAttributes(x)
  setMode(DYNAMIC_MODE)
}

function resetAttributes(x) {
  bus.state[x] = {}
}

async function headers() {
  const style = await Deno.readTextFile(format)
  const {
    title,
    author,
  } = bus.state[scope]


  const html = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <title>${title} by ${author}</title>

    <meta name="viewport" content="width=device-width, initial-scale=1">

    <style>
      ${style}
    </style>
    <script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js" defer></script>
  </head>
  <body>
  `

  await Deno.writeTextFile(result, html, { append: true})
}

async function metapage() {
  const {
    title,
    author,
    contact,
    agent
  } = bus.state[scope]

  await append('metapage', `
    <metapage-cover>
      <metapage-main>
        <metapage-title>
          ${title}
        </metapage-title>
        by
        <metapage-author>
          ${author}
        </metapage-author>
      </metapage-main>
      <metapage-contact>
        ${markup(contact)}
      </metapage-contact>
      <metapage-agent>
        ${markup(agent)}
      </metapage-agent>
    </metapage-cover>
  `)
}
async function module() {
  const properties = bus.state[dynamic]

  const attributes = Object.keys(properties)
    .map(x => `${x}="${properties[x]}"`).join('')

  const html = `<${dynamic} ${attributes}></${dynamic}>`
  await Deno.writeTextFile(result, html, { append: true})
}

function markup(string) {
  return string.replaceAll('\\', '<br>')
}

async function place(line) {
  await append('place', line)
}
async function actor(line) {
  await append('actor', line)
}
async function message(line) {
  await append('message', line)
}
async function subtext(line) {
  await append('subtext', line)
}
async function context(line) {
  await append('context', line)
}
async function composition(line) {
  await append('composition', line)
}
async function freetext(line) {
  await append('freetext', line)
}

async function blank() {
  await append("blankline", "")
}

async function append(tag, content) {
  const html = `
    <${scope}-${tag}>
      ${content}
    </${scope}-${tag}>
  `
  await Deno.writeTextFile(result, html, { append: true})
}

function noop() {}
