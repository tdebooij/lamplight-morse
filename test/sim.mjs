// Simulates a sender's light seen through a phone camera and runs it through the page's Detector + Decoder.
// Usage: node test/sim.mjs
import { readFileSync } from 'node:fs'

const html = readFileSync(process.env.FILE || new URL('../index.html', import.meta.url), 'utf8')
const core = html.slice(html.indexOf('/* CORE START'), html.indexOf('/* CORE END */'))
const { encode, Decoder, Detector, unitFromWpm } = new Function(`${core}; return { encode, Decoder, Detector, unitFromWpm }`)()

let seed = 1
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand())

function simulate(text, o) {
  const U = unitFromWpm(o.wpm)
  // Light edges as the sender produces them, with switching lag and timer jitter
  const edges = []
  let t = 400
  for (const s of encode(text)) {
    edges.push({ t: t + (s.on ? o.latOn : o.latOff) + gauss() * o.jit, on: s.on })
    t += s.units * U
  }
  edges.push({ t: t + o.latOff, on: false })
  const end = t + 20 * U
  const lightAt = x => { let on = false; for (const e of edges) { if (e.t > x) break; on = e.on } return on }
  const onFraction = (a, b) => { let n = 0, c = 0; for (let x = a; x < b; x += 1) { c++; if (lightAt(x)) n++ } return c ? n / c : 0 }

  const det = new Detector(), dec = new Decoder(unitFromWpm(5))
  let ft = 0, y = o.ambient
  while (ft < end) {
    const dt = (1000 / o.fps) * (1 + (rand() * 2 - 1) * 0.15)
    ft += dt
    const x = o.ambient + o.peak * onFraction(ft - o.exposure * dt, ft)
    y += (x - y) * o.lag // exposure / sensor lag
    const v = Math.max(0, Math.min(255, y + gauss() * o.noise + (o.flick || 0) * Math.sin(2 * Math.PI * 100 * ft / 1000)))
    const edge = det.push(v, ft, 16)
    if (edge) dec.edge(edge.on, edge.t)
    dec.tick(ft)
  }
  dec.flush()
  return dec.text.trim()
}

const base = { wpm: +(process.env.WPM || 5), fps: 30, latOn: 0, latOff: 0, jit: 5, exposure: 1, lag: 1, noise: 3, ambient: 40, peak: 180 }
const scenarios = {
  'ideal 30fps':                 {},
  'screen, laptop webcam 15fps': { fps: 15, latOn: 16, latOff: 16, lag: 0.7, noise: 5 },
  'torch lag (on 120, off 30)':  { latOn: 120, latOff: 30, jit: 25 },
  'torch lag + bloom':           { latOn: 60, latOff: 0, jit: 20, lag: 0.45 },
  'heavy bloom 24fps':           { fps: 24, lag: 0.35, noise: 6, jit: 20 },
  'gaps shrink 80ms':            { latOn: 0, latOff: 80, jit: 15, lag: 0.6 },
  'weak light, noisy':           { peak: 45, noise: 7, jit: 15 },
  'office, leftover flicker':    { ambient: 10, peak: 70, flick: 5, noise: 3, jit: 15 },
  'office, weak light':          { ambient: 10, peak: 35, flick: 2, noise: 2, jit: 15 },
  'slow sender 4wpm':            { wpm: 4, latOn: 60, latOff: 10, jit: 20, lag: 0.6 },
  // Informational: at 10 WPM a dot is ~2 camera frames after torch lag, so misses are expected
  'fast sender 10wpm 30fps':     { wpm: 10, latOn: 40, latOff: 10, jit: 15, lag: 0.6, info: true },
}
const texts = ['HELLO WORLD', 'SOS', 'THE QUICK BROWN FOX 123', 'TIM MET EVE', 'WHERE ARE YOU?', 'OK, FINE.', 'IS IT 5:30?']

let allOk = true
for (const [name, over] of Object.entries(scenarios)) {
  let ok = 0, n = 0, bad = []
  for (let trial = 0; trial < 8; trial++) for (const text of texts) {
    const got = simulate(text, { ...base, ...over })
    n++; if (got === text) ok++; else if (bad.length < 2) bad.push(`${text} -> ${got}`)
  }
  if (ok / n < 0.95 && !over.info) allOk = false
  console.log(`${(ok / n * 100).toFixed(0).padStart(4)}%  ${name}${over.info ? ' (info only)' : ''}${bad.length ? '   e.g. ' + bad.join(' | ') : ''}`)
}
process.exit(allOk ? 0 : 1)
