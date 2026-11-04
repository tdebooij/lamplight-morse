// Browser test: replaces the camera with a canvas scene and runs the real receiver on it.
// Load on the page, then: await runFake({ scene: 'office', text: 'HELLO WORLD', wpm: 5 })
window.runFake = async ({ scene = 'office', text = 'HELLO WORLD', wpm = 5 } = {}) => {
  const { encode } = window.Lamplight
  const c = document.createElement('canvas'); c.width = 640; c.height = 480
  const x = c.getContext('2d')
  const U = 1200 / wpm
  const steps = encode(text)
  let start = 1e15
  const lightOn = now => {
    let t = start
    if (now < t) return false
    for (const s of steps) { t += s.units * U; if (now < t) return s.on }
    return false
  }
  const grey = v => { const g = Math.max(0, Math.min(255, Math.round(v))); return `rgb(${g},${g},${g})` }
  const scenes = {
    // Dark room: a bright light on a nearly black background
    dark: { wall: 18, flicker: 0, tube: 0, tubeFlicker: 0, lightOn: 255, lightOff: 22, r: 9, shake: 0 },
    // Office: bright wall, fluorescent tubes flickering at 100 Hz, small light adding modest contrast
    office: { wall: 190, flicker: 0.05, tube: 225, tubeFlicker: 0.15, lightOn: 255, lightOff: 195, r: 7, shake: 0 },
    // Same office, hand-held camera
    officeShake: { wall: 190, flicker: 0.05, tube: 225, tubeFlicker: 0.15, lightOn: 255, lightOff: 195, r: 7, shake: 1.5 },
  }
  const s = scenes[scene]
  const draw = () => {
    const now = performance.now()
    const wave = Math.sin(2 * Math.PI * 100 * now / 1000)
    const dx = s.shake * Math.sin(now / 310), dy = s.shake * Math.cos(now / 430)
    x.fillStyle = grey(s.wall * (1 + s.flicker * wave)); x.fillRect(0, 0, 640, 480)
    x.save(); x.translate(dx, dy)
    if (s.tube) {
      x.fillStyle = grey(s.tube * (1 + s.tubeFlicker * wave))
      x.fillRect(80, 30, 200, 26); x.fillRect(360, 30, 200, 26)
    }
    x.fillStyle = grey(s.wall * 0.45); x.fillRect(60, 200, 170, 200) // cabinet
    x.fillStyle = grey(s.wall * 0.75); x.fillRect(300, 240, 140, 90) // desk item
    x.fillStyle = grey(lightOn(now) ? s.lightOn : s.lightOff)
    x.beginPath(); x.arc(560, 400, s.r, 0, 7); x.fill()
    x.restore()
  }
  const timer = setInterval(draw, 4)
  const stream = c.captureStream(30)
  navigator.mediaDevices.getUserMedia = async () => stream
  navigator.mediaDevices.enumerateDevices = async () => []
  const $ = id => document.getElementById(id)
  $('tab-recv').click()
  $('rx-start').click()
  await new Promise(r => setTimeout(r, 2500))
  const before = $('target').style.cssText
  start = performance.now() + 300
  const units = steps.reduce((a, b) => a + b.units, 0)
  await new Promise(r => setTimeout(r, 300 + units * U + 1500))
  const result = {
    scene, text, wpm,
    decoded: $('decoded').textContent.trim(),
    lockBefore: before,
    lockAfter: $('target').style.cssText,
    signal: $('st-sig').textContent, contrast: $('st-con').textContent, fps: $('st-fps').textContent,
    room: $('st-room')?.textContent,
  }
  clearInterval(timer)
  return result
}
