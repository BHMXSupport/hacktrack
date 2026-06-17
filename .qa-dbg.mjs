import { chromium } from 'playwright'; import fs from 'fs'
const SEED=process.argv[2]
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})
const p=await ctx.newPage()
await p.goto('http://localhost:5173'); await p.waitForTimeout(300)
await p.evaluate(v=>localStorage.setItem('hacktrack:v2',v), fs.readFileSync(SEED,'utf8'))
await p.reload(); await p.waitForTimeout(2500)
const dbg=await p.evaluate(()=>globalThis.__dbg)
console.log(JSON.stringify(dbg,null,1))
await b.close()
