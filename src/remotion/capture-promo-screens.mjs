import pw from '/Users/jansieger/hacktrack/node_modules/playwright/index.js'
const { webkit } = pw
const BASE = 'http://localhost:8744/index.html'
const OUT = process.env.CLAUDE_JOB_DIR + '/tmp'
const seed = (TAB) => `(()=>{
  const DAY=86400000;const so=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
  const base=so(new Date());
  const k=ts=>{const x=new Date(ts);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
  const cad=(mode,semDays)=>({mode,every:1,days:[true,true,true,true,true,true,true],semDays:semDays||[false,false,false,false,false,false,false],n:1,on:1,off:0});
  const bpc={product:'BPC 157',cadence:cad('dia'),progOn:false,progN:2,curPhase:0,startDate:base.getTime()-25*DAY,endDate:null,reminderTime:'08:00'};
  const reta={product:'Retatrutide',cadence:cad('sem',[false,true,false,false,false,false,false]),progOn:false,progN:2,curPhase:0,startDate:base.getTime()-25*DAY,endDate:null,reminderTime:'20:00'};
  const sites=['abdomen-izq','abdomen-der','muslo-izq','muslo-der','gluteo-izq','gluteo-der'];
  const log=[];
  for(let off=25;off>=0;off--){const ts=base.getTime()-off*DAY;const items=[];
    if(![3,11,18].includes(off))items.push({id:'b'+off,t:'8:00',n:'Dosis registrada',u:'BPC 157 · 0.5 mg',cat:'#1B8A7D',ic:'dose',type:'dose',ts:ts+8*3600000,product:'BPC 157',value:0.5,unit:'mg',doseMg:0.5,site:sites[off%6]});
    if(new Date(ts).getDay()===2)items.push({id:'r'+off,t:'8:00 PM',n:'Dosis registrada',u:'Retatrutide · 4 mg',cat:'#5FC9B8',ic:'dose',type:'dose',ts:ts+20*3600000,product:'Retatrutide',value:4,unit:'mg',doseMg:4,site:sites[(off+2)%6]});
    if(items.length)log.push({dateKey:k(ts),items});}
  const todayK=k(base.getTime());
  const nutrition={[todayK]:{water:1600,meals:[
    {id:'m1',kcal:520,ts:base.getTime()+8*3600000,protein:34,carbs:48,fat:18,label:'Desayuno'},
    {id:'m2',kcal:680,ts:base.getTime()+13*3600000,protein:52,carbs:55,fat:22,label:'Comida'},
    {id:'m3',kcal:240,ts:base.getTime()+17*3600000,protein:20,carbs:18,fat:9,label:'Snack'}]}};
  const hist={};
  hist['Peso']=Array.from({length:8},(_,i)=>({ts:base.getTime()-(28-i*4)*DAY,value:+(84.2-i*0.24).toFixed(1)}));
  hist['Energía']=Array.from({length:6},(_,i)=>({ts:base.getTime()-(20-i*4)*DAY,value:6+(i%3)}));
  hist['Sueño']=Array.from({length:6},(_,i)=>({ts:base.getTime()-(20-i*4)*DAY,value:+(7+(i%2)*0.5).toFixed(1)}));
  hist['Sodio diario']=[{ts:base.getTime()+9*3600000,value:1850}];
  hist['Potasio diario']=[{ts:base.getTime()+9*3600000,value:3200}];
  hist['Magnesio diario']=[{ts:base.getTime()+9*3600000,value:290}];
  const profile={name:'Alex',peso:82.4,est:178,grasa:18,musculo:42,bmi:26};
  const calcDraft={vialStr:'10',aguaStr:'2',dosisStr:'0.5',unit:'mg',plumaMode:false};
  return JSON.stringify({screen:'s-app',tab:'${TAB}',sheet:null,sheetArg:null,justOnboarded:false,importedProducts:['BPC 157','Retatrutide'],protocols:{'BPC 157':bpc,'Retatrutide':reta},productDoses:{'BPC 157':{value:0.5,unit:'mg'},'Retatrutide':{value:4,unit:'mg'}},log,nutrition,history:hist,profile,calcDraft,lastMealTs:base.getTime()+17*3600000,fastStartTs:null})
})()`

const FAB = 'Agregar registro'
const shots = [
  { name:'inicio',     tab:'inicio',    goto:null, act: async()=>{} },
  { name:'registrar',  tab:'inicio',    goto:null, act: async(p)=>{ await p.getByRole('button',{name:FAB}).click(); await p.waitForTimeout(1500) } },
  { name:'calendario', tab:'protocolo', goto:null, act: async()=>{} },
  { name:'calc',       tab:'inicio',    goto:null, act: async(p)=>{ await p.getByRole('button',{name:FAB}).click(); await p.waitForTimeout(900); await p.getByRole('button',{name:'Calculadora de unidades'}).click(); await p.waitForTimeout(1300) } },
  { name:'vida',       tab:'vida',      goto:null, act: async()=>{} },
  { name:'comida',     tab:'comida',    goto:null, act: async()=>{} },
  { name:'medida',     tab:'inicio',    goto:'medida:Energía', act: async(p)=>{ await p.waitForTimeout(1300) } },
]
async function cap(browser, s){
  const ctx = await browser.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:3, hasTouch:true, reducedMotion:'reduce', serviceWorkers:'block' })
  await ctx.addInitScript((e)=>{ try{Object.defineProperty(navigator,'standalone',{get:()=>true})}catch{} try{if(!('Notification'in window))window.Notification=function(){};Object.defineProperty(window.Notification,'permission',{configurable:true,get:()=>'granted'})}catch{} try{const o=window.matchMedia.bind(window);window.matchMedia=q=>(typeof q==='string'&&q.includes('display-mode: standalone'))?{matches:true,media:q,onchange:null,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},dispatchEvent(){return false}}:o(q)}catch{} try{localStorage.setItem('hacktrack:v2',eval(e))}catch(err){console.error('seed',err)} }, seed(s.tab))
  const page = await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message))
  const url = BASE + (s.goto ? '?goto='+encodeURIComponent(s.goto)+'&cb=' : '?cb=') + Date.now()
  await page.goto(url,{waitUntil:'domcontentloaded'})
  try{const b=page.getByRole('button',{name:'Entrar'});await b.waitFor({state:'visible',timeout:6000});await b.click()}catch{}
  try{await page.getByRole('status',{name:'Cargando Hacktrack'}).waitFor({state:'detached',timeout:6000})}catch{}
  try{await page.getByRole('button',{name:FAB}).waitFor({state:'visible',timeout:8000})}catch{}
  await page.waitForTimeout(1200)
  try{ await s.act(page) }catch(e){ errs.push('act:'+e.message) }
  const out = `${OUT}/screen-${s.name}.png`
  await page.screenshot({ path: out })
  console.log(`${s.name}: ${errs.length?'ERR '+errs[0]:'ok'}`)
  await ctx.close()
}
const run = async () => { const b = await webkit.launch(); for(const s of shots) await cap(b,s); await b.close() }
run().catch(e=>{console.error('FATAL',e);process.exit(2)})
