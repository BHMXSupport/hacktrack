import { chromium } from '/Users/jansieger/hacktrack/node_modules/playwright/index.mjs'

const DIR = '/Users/jansieger/.claude/jobs/aa3e7f72/tmp/redesign2/bitacora-master'
const files = ['inicio-light', 'inicio-dark', 'vida-light', 'vida-dark']

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()

for (const f of files) {
  await p.goto(`file://${DIR}/${f}.html`, { waitUntil: 'load' })
  await p.waitForTimeout(1600) // deja que las animaciones se asienten (forwards)
  await p.screenshot({ path: `${DIR}/_shot-${f}.png` })
  // scroll al fondo del área de contenido
  await p.evaluate(() => { const s = document.querySelector('.scroll'); if (s) s.scrollTop = s.scrollHeight })
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${DIR}/_shot-${f}-bottom.png` })
}
await b.close()
console.log('OK: 8 shots')
