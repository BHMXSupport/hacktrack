import pw from '/Users/jansieger/hacktrack/node_modules/playwright/index.js'
const { webkit } = pw
const BASE='http://localhost:8744/index.html'
const DIR=process.env.CLAUDE_JOB_DIR+'/tmp/clips'
const init=(e)=>{try{Object.defineProperty(navigator,'standalone',{get:()=>true})}catch{}try{if(!('Notification'in window))window.Notification=function(){};Object.defineProperty(window.Notification,'permission',{configurable:true,get:()=>'granted'})}catch{}try{const o=window.matchMedia.bind(window);window.matchMedia=q=>(typeof q==='string'&&q.includes('display-mode: standalone'))?{matches:true,media:q,onchange:null,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},dispatchEvent(){return false}}:o(q)}catch{}try{localStorage.setItem('hacktrack:v2',eval(e))}catch(err){console.error(err)}}
const enter=async(p)=>{try{const x=p.getByRole('button',{name:'Entrar'});await x.waitFor({state:'visible',timeout:6000});await x.click()}catch{}try{await p.getByRole('status',{name:'Cargando Hacktrack'}).waitFor({state:'detached',timeout:8000})}catch{}try{await p.getByRole('button',{name:'Agregar registro'}).waitFor({state:'visible',timeout:8000})}catch{}await p.waitForTimeout(800)}

// ── SEED comida (para el clip) ──
const seedComida=`(()=>{const DAY=86400000;const so=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};const base=so(new Date());const k=ts=>{const x=new Date(ts);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};const todayK=k(base.getTime());const nutrition={[todayK]:{water:1600,meals:[{id:'m1',kcal:520,ts:base.getTime()+8*3600000,protein:34,carbs:48,fat:18,label:'Desayuno'},{id:'m2',kcal:680,ts:base.getTime()+13*3600000,protein:52,carbs:55,fat:22,label:'Comida'},{id:'m3',kcal:240,ts:base.getTime()+17*3600000,protein:20,carbs:18,fat:9,label:'Snack'}]}};const hist={};hist['Sodio diario']=[{ts:base.getTime()+9*3600000,value:1850}];hist['Potasio diario']=[{ts:base.getTime()+9*3600000,value:3200}];hist['Magnesio diario']=[{ts:base.getTime()+9*3600000,value:290}];const profile={name:'Alex',peso:82.4,est:178,grasa:18,musculo:42,bmi:26};return JSON.stringify({screen:'s-app',tab:'comida',sheet:null,justOnboarded:false,importedProducts:['BPC-157'],protocols:{},nutrition,history:hist,profile,lastMealTs:base.getTime()-2*3600000,fastStartTs:null})})()`

// ── SEED vida (5 péptidos con half-life conocida → varias líneas) ──
const seedVida=`(()=>{const H=3600000;const now=Date.now();const k=ts=>{const x=new Date(ts);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
 const doses=[['Retatrutide',6,20],['Tirzepatida',8,16],['Semaglutida',5,30],['Ipamorelin',6,5],['MOTS-c',12,2]];
 const cad={mode:'sem',every:1,days:[true,true,true,true,true,true,true],semDays:[false,true,false,false,false,false,false],n:1,on:1,off:0};
 const protocols={};const importedProducts=[];const byKey={};
 doses.forEach(([p,mg,hAgo],i)=>{importedProducts.push(p);protocols[p]={product:p,cadence:cad,progOn:false,progN:2,curPhase:0,startDate:now-30*24*H,endDate:null,reminderTime:'08:00'};const ts=now-hAgo*H;const dk=k(ts);(byKey[dk]=byKey[dk]||[]).push({id:'d'+i,t:'8:00',n:'Dosis registrada',u:p+' · '+mg+' mg',cat:'#5FC9B8',ic:'dose',type:'dose',ts,product:p,value:mg,unit:'mg',doseMg:mg});});
 const log=Object.keys(byKey).map(dk=>({dateKey:dk,items:byKey[dk]}));
 const profile={name:'Alex',peso:82.4,est:178,grasa:18,musculo:42,bmi:26};
 return JSON.stringify({screen:'s-app',tab:'vida',sheet:null,justOnboarded:false,importedProducts,protocols,log,nutrition:{},history:{},profile,fastStartTs:null})})()`

const run=async()=>{
  const b=await webkit.launch()
  // 1) CLIP comida — recordVideo.size = viewport (sin franja blanca)
  { const ctx=await b.newContext({viewport:{width:430,height:932},hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block',recordVideo:{dir:DIR,size:{width:430,height:932}}})
    await ctx.addInitScript(init,seedComida); const p=await ctx.newPage()
    await p.goto(BASE+'?cb='+Date.now(),{waitUntil:'domcontentloaded'}); await enter(p)
    await p.evaluate(async()=>{const cands=[...document.querySelectorAll('*')].filter(el=>el.scrollHeight-el.clientHeight>80&&['auto','scroll'].includes(getComputedStyle(el).overflowY));const el=cands.sort((a,b)=>(b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight))[0]||document.scrollingElement||document.body;const max=el.scrollHeight-el.clientHeight;const dur=2800;const start=performance.now();await new Promise(res=>{const step=(t)=>{const pr=Math.min(1,(t-start)/dur);el.scrollTop=max*(0.5-0.5*Math.cos(pr*Math.PI));if(pr<1)requestAnimationFrame(step);else res()};requestAnimationFrame(step)})})
    await p.waitForTimeout(500); await p.close(); const vp=await p.video().path(); await ctx.close(); console.log('clip:',vp) }
  // 2) VIDA — 5 péptidos
  { const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:3,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'})
    await ctx.addInitScript(init,seedVida); const p=await ctx.newPage()
    await p.goto(BASE+'?cb='+Date.now(),{waitUntil:'domcontentloaded'}); await enter(p)
    await p.waitForTimeout(1000)
    try{ await p.getByText('72 h',{exact:false}).first().click({timeout:2500}); await p.waitForTimeout(900) }catch(e){ console.log('no 72h tab',e.message) }
    await p.screenshot({path:process.env.CLAUDE_JOB_DIR+'/tmp/screen-vida.png'}); console.log('vida ok') ; await ctx.close() }
  await b.close()
}
run().catch(e=>{console.error('FATAL',e);process.exit(2)})
