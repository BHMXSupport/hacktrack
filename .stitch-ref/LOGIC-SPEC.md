# Hacktrack Logic Spec — Prototype → React/TypeScript Port

> Extracted from `prototype/hacktrack-prototype.html` (v3, ~78 KB) and `Hacktrack - Audit Backlog.md`.
> All constants, formulas, and strings are quoted verbatim from the prototype.

---

## A. DATA MODEL

### A.1 PEPTIDES catalog

Full JavaScript object — 25 entries, keyed by exact product name string:

```typescript
type CadenceType =
  | 'diaria'       // every day
  | 'lv'           // Lunes a Viernes (Mon–Fri, 5 on / 2 off)
  | 'semanal'      // once per week, fixed weekday
  | 'cadaN'        // every N days
  | 'ciclo'        // on/off cycle (e.g. 4 on / 4 off)
  | 'por-demanda'; // as-needed, no fixed days

interface PeptideEntry {
  cat: Category;
  type: CadenceType;
  weekday?: number;    // 0=Sun…6=Sat, only for type='semanal'
  n?: number;          // interval for type='cadaN'
  on?: number;         // on-days for type='ciclo'
  off?: number;        // off-days for type='ciclo'
  phases?: number;     // number of titration phases (2–5)
  phaseWeeks?: number; // weeks per phase (only on specific entries)
  howto: string;       // user-facing schedule description
}
```

**Full catalog (verbatim from prototype):**

| Key | cat | type | weekday | n | on | off | phases | phaseWeeks |
|-----|-----|------|---------|---|----|-----|--------|------------|
| Retatrutide | Metabolismo | semanal | 2 | — | — | — | 3 | 4 |
| Tirzepatida | Metabolismo | semanal | 2 | — | — | — | 4 | 4 |
| Semaglutida | Metabolismo | semanal | 2 | — | — | — | 4 | 4 |
| Tesamorelin | Metabolismo | diaria | — | — | — | — | — | — |
| MOTS-c | Anti-Aging | diaria | — | — | — | — | 5 | — |
| 5-Amino-1MQ | Metabolismo | diaria | — | — | — | — | — | — |
| SLU-PP-332 | Metabolismo | diaria | — | — | — | — | — | — |
| BPC-157 | Recuperación | lv | — | — | — | — | — | — |
| TB-500 | Recuperación | diaria | — | — | — | — | — | — |
| GHK-Cu | Recuperación | lv | — | — | — | — | 3 | — |
| ARA 290 | Recuperación | diaria | — | — | — | — | — | — |
| GLOW 70 | Piel | diaria | — | — | — | — | — | — |
| KLOW 80 | Piel | diaria | — | — | — | — | — | — |
| NAD+ | Anti-Aging | cadaN | — | 3 | — | — | — | — |
| SS-31 | Anti-Aging | diaria | — | — | — | — | — | — |
| L-Glutathione | Anti-Aging | diaria | — | — | — | — | — | — |
| Semax | Cognitivo | ciclo | — | — | 4 | 4 | 4 | — |
| Selank | Cognitivo | ciclo | — | — | 4 | 4 | 2 | — |
| DSIP | Cognitivo | diaria | — | — | — | — | — | — |
| Oxytocin | Cognitivo | por-demanda | — | — | — | — | — | — |
| CJC 1295 (No DAC) | Crecimiento | diaria | — | — | — | — | — | — |
| Ipamorelin | Crecimiento | diaria | — | — | — | — | — | — |
| Kisspeptin-10 | Reproductivo | diaria | — | — | — | — | 2 | — |
| PT-141 | Reproductivo | por-demanda | — | — | — | — | — | — |

**Generic howto string (GEN constant, verbatim):**
```
'Configura tu ritmo y registra tu dosis. Hacktrack no define la dosis — la pones tú.'
```

Used by: 5-Amino-1MQ, SLU-PP-332, ARA 290, KLOW 80, SS-31, L-Glutathione, DSIP, CJC 1295 (No DAC).

---

### A.2 Category Taxonomy

7 categories. Accent color not in the prototype JS — derived from CSS variables and audit context:

| Category | Emoji (goal screen) | Accent (from CSS / audit) |
|----------|---------------------|--------------------------|
| Metabolismo | ⚖️ | `#1B8A7D` (brand-500) / bg `#D6F2EC` |
| Recuperación | 🩹 | `#FF7A59` (ember) / bg `#FDE7DF` |
| Cognitivo | 🧠 | `#3B82F6` (blue) / bg `#E6EEFB` |
| Piel | ✨ | `#A855F7` (purple) / bg `#F3E9FB` |
| Anti-Aging | 🧬 | `#10B981` (green) / bg `#E3F7EF` |
| Crecimiento | — | Not shown on goal screen; no CSS accent defined in prototype |
| Reproductivo | — | Not shown on goal screen; no CSS accent defined in prototype |
| Explorar | 🧭 | `#EEF2F8` (ink-100) |

> **Note (from audit P2):** `MEASURES_BY` has no entries for 'Crecimiento' or 'Reproductivo'. These must be added in the React port.

---

### A.3 MEASURES_ALL & MEASURES_BY

```typescript
const MEASURES_ALL = [
  'Peso','Cintura','% grasa','Energía','Apetito',
  'Dolor','Movilidad','Sueño','Foco','Ánimo',
  'Textura piel','Hidratación','Libido'
];

const MEASURES_BY: Record<string, string[]> = {
  Metabolismo:  ['Peso','Cintura','% grasa','Energía','Apetito'],
  Recuperación: ['Dolor','Movilidad','Sueño','Energía'],
  Cognitivo:    ['Foco','Ánimo','Sueño','Energía'],
  Piel:         ['Textura piel','Hidratación','Sueño'],
  'Anti-Aging': ['Energía','Sueño','Textura piel'],
  Explorar:     ['Peso','Energía','Sueño'],
  // MISSING in prototype — must add in React port:
  // Crecimiento: [...],
  // Reproductivo: [...],
};
```

---

### A.4 MEASURE_META

```typescript
type MeasureKind = 'num' | 'scale';

interface MeasureMeta {
  kind: MeasureKind;
  unit?: string;      // for kind='num'
  max?: number;       // for kind='scale'
  prof?: keyof Profile; // links to profile field
}

const MEASURE_META: Record<string, MeasureMeta> = {
  'Peso':          { kind: 'num',   unit: 'kg',  prof: 'peso'  },
  'Cintura':       { kind: 'num',   unit: 'cm'                  },
  '% grasa':       { kind: 'num',   unit: '%',   prof: 'grasa' },
  'Sueño':         { kind: 'num',   unit: 'h'                   },
  'Dolor':         { kind: 'scale', max: 10                     },
  'Energía':       { kind: 'scale', max: 5                      },
  'Apetito':       { kind: 'scale', max: 5                      },
  'Movilidad':     { kind: 'scale', max: 5                      },
  'Foco':          { kind: 'scale', max: 5                      },
  'Ánimo':         { kind: 'scale', max: 5                      },
  'Textura piel':  { kind: 'scale', max: 5                      },
  'Hidratación':   { kind: 'scale', max: 5                      },
  'Libido':        { kind: 'scale', max: 5                      },
};
```

Scale display rule: `max===10` → "Del 0 (nada) al 10 (máximo)"; else → "Del 1 (bajo) al 5 (alto)" (start=1 for max=5, start=0 for max=10).

---

### A.5 Profile shape

```typescript
interface Profile {
  peso:  number | null;
  est:   number | null;  // cm (see §D for detection rule)
  grasa: number | null;
  bmi:   number | null;  // derived, never entered by user
}
```

---

### A.6 LOG entry / Diary shape

The prototype seeds LOG as a static array. The React port must replace it with a live append structure.

```typescript
type LogItemType = 'dose' | 'medida' | 'none';

interface LogItem {
  t:    string;       // time string, e.g. '9:00 PM'
  n:    string;       // name: 'Dosis registrada' | measure name
  u:    string;       // value string: 'tu dosis' | '82.4 kg' | '4 / 5'
  cat:  string;       // hex color for icon background
  ic:   string;       // emoji icon
  type: LogItemType;
}

interface LogGroup {
  day:   string;      // display label: 'Hoy' | 'Ayer' | 'Vie 12 jun'
  range: number;      // 7 or 30 — which filter bucket this belongs to
  items: LogItem[];
}

// Runtime state
let LOG: LogGroup[] = [];
let dType: 'todo' | 'dose' | 'medida' = 'todo';
let dRange: 7 | 30 = 7;
```

**Color conventions (verbatim from seed data):**
- Dose entries: `cat: '#1B8A7D'`, `ic: '💉'`
- Peso: `cat: '#7BC96F'`, `ic: '⚖️'`
- Energía: `cat: '#FF7A59'`, `ic: '⚡'`
- Sueño: `cat: '#5FC9B8'`, `ic: '😴'`
- Rest day (no entry): `cat: '#D7DEEC'`, `ic: '·'`, `type: 'none'`

---

### A.7 Streak

```typescript
let streak: number = 0;  // MUST start at 0 for new users (prototype hardcodes 7 — BUG)
```

Streak ring: `strokeDashoffset = 314 * (1 - streak / 30)` — the 30 is the ring goal (implicit in prototype animation). Must be configurable.

Streakbar: 7 cells representing the current week (L Ma Mi J V S D). Each `on` if a log entry (dose OR measure) exists for that day.

---

### A.8 Goals (setup flow)

Goals are **display + measure-preset only** — they MUST NOT preload a product:

```typescript
interface GoalOption {
  label: string;
  sub: string;
  cat: Category;
  // NO proto field — removed in React port (see §E P0 fix)
}
```

Prototype goal button (buggy): `onclick="pickGoal('Metabolismo','Retatrutide')"` — the second arg (`'Retatrutide'`) must be removed.

---

### A.9 Cadence state (dose sheet)

```typescript
let cadModeV: 'dia' | 'sem' | 'mes' | 'uso' = 'dia';
let cadDays: boolean[]    = [true,true,true,true,true,true,true]; // indexed by WDS order
let cadEvery: number      = 1;   // weeks (sem) or months (mes)
let cadSemDays: boolean[] = [true,false,false,false,false,false,false];
```

Cadence-mode labels for WDS (verbatim):
```typescript
const WDS: [string, number][] = [
  ['L',1],['M',2],['Mi',3],['J',4],['V',5],['S',6],['D',0]
];
// Index maps: WDS[0]='L'=Monday(1), WDS[1]='M'=Tuesday(2), ...
```

Note: day-initial 'M' is ambiguous. Canonical table from audit (P2):
```
L  Ma  Mi  J  V  S  D
```
WDS array should be updated to `['L',1],['Ma',2],['Mi',3],['J',4],['V',5],['S',6],['D',0]`.

---

### A.10 Titration / phase state

```typescript
let progOn: boolean = false;
let progN:  number  = 2;      // number of phases (min 2, max 8)
let curPhase: number = 0;     // 0-indexed current phase
```

Phase chip label formula (verbatim, for when `weeks > 0`):
```
`Fase ${i+1}${weeks ? ' · sem ' + (i*weeks+1) + '-' + ((i+1)*weeks) : ''}`
```

`weeks` is set to `p.phaseWeeks` only when `progN === p.phases` (default count matches catalog). Otherwise `weeks = 0` (no week annotation).

Phase cards advance/back: user-driven only (`advancePhase`/`backPhase`). App never auto-advances.

---

### A.11 App navigation state

```typescript
let cur: string = 's-splash';
let hist: string[] = [];

// Screen IDs
const SCREENS = [
  's-splash','s-onb','s-account','s-login',
  's-goal','s-setup','s-qs',
  's-home','s-diary','s-proto','s-settings','s-pin'
];
```

Tab bar order (verbatim):
```typescript
const TABS = [
  ['s-home',     'Inicio',    /* home icon path */],
  ['s-diary',    'Diario',    /* chart path */],
  ['s-proto',    'Protocolo', /* calendar path */],
  ['s-settings', 'Ajustes',   /* gear icon */],
];
```

---

## B. CADENCE ENGINE

### B.1 `diaToca(d, p, start): boolean`

```typescript
function diaToca(d: Date, p: PeptideEntry, start: Date): boolean {
  const day = Math.round((d.getTime() - start.getTime()) / 86400000);
  if (p.type === 'diaria')     return true;
  if (p.type === 'lv')         return d.getDay() >= 1 && d.getDay() <= 5;
  if (p.type === 'semanal')    return d.getDay() === (p.weekday ?? start.getDay());
  if (p.type === 'cadaN')      return day >= 0 && day % p.n! === 0;
  if (p.type === 'ciclo') {
    const m = p.on! + p.off!;
    const pos = ((day % m) + m) % m;
    return pos < p.on!;
  }
  return false; // 'por-demanda' → never auto-scheduled
}
```

- `864e5` = 86400000 ms = 1 day
- `lv` uses `getDay()` where 0=Sun, 1=Mon…6=Sat → days 1–5 = Mon–Fri
- `ciclo` uses modular arithmetic with positive-remainder guard `((day % m) + m) % m`
- `por-demanda` always returns false (no scheduled day)

### B.2 `proximas(p, start, n=3): Date[]`

```typescript
function proximas(p: PeptideEntry, start: Date, n: number = 3): Date[] {
  const out: Date[] = [];
  let d = new Date(TODAY); // starts from today, not startDate
  for (let i = 0; i < 60 && out.length < n; i++) {
    if (diaToca(d, p, start)) out.push(new Date(d));
    d = new Date(d.getTime() + 86400000);
  }
  return out;
}
```

- Max lookahead: 60 days
- Returns up to `n` upcoming dates including today if today qualifies

### B.3 `fmtDate(d): string`

```typescript
function fmtDate(d: Date): string {
  const diff = Math.round((d.getTime() - TODAY.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  return WD[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
}
```

Where:
```typescript
const WD  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']; // 0=Sun
const MON = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
```

### B.4 `rhythmLabel(p)` and `rhythmBadge(p)` — verbatim

```typescript
function rhythmLabel(p: PeptideEntry): string {
  return ({
    diaria:      'Cada día',
    lv:          'Lun a Vie',
    semanal:     'Cada semana',
    cadaN:       'Cada ' + p.n + ' días',
    ciclo:       p.on + ' on / ' + p.off + ' off',
    'por-demanda': 'Por uso',
  }[p.type]) ?? 'Por uso';
}

function rhythmBadge(p: PeptideEntry): string {
  return ({
    diaria:      'diario',
    lv:          '5 on / 2 off',
    semanal:     'semanal',
    cadaN:       'cada ' + p.n + ' días',
    ciclo:       p.on + '/' + p.off,
    'por-demanda': 'por uso',
  }[p.type]) ?? 'por uso';
}
```

Both functions need `?? 'Por uso'` / `?? 'por uso'` fallback (P0 fix — prototype crashed on `por-demanda` before this was added).

### B.5 `presetCad(p)` — cadence preset logic

```typescript
function presetCad(p: PeptideEntry | undefined): void {
  if (!p) {
    cadDays = [1,1,1,1,1,1,1].map(Boolean);
    setCadMode('dia');
  } else if (p.type === 'lv') {
    cadDays = [1,1,1,1,1,0,0].map(Boolean); // Mon–Fri on, Sat–Sun off
    setCadMode('dia');
  } else if (p.type === 'semanal') {
    const wd = p.weekday ?? 1;
    cadSemDays = WDS.map(w => w[1] === wd);
    setCadMode('sem');
  } else if (p.type === 'por-demanda') {
    setCadMode('uso');
  } else {
    // BUG: 'diaria', 'cadaN', 'ciclo' all fall to this else — sets full cadDays + 'dia' mode
    // This is WRONG for cadaN and ciclo. See §E P0 fix.
    cadDays = [1,1,1,1,1,1,1].map(Boolean);
    setCadMode('dia');
  }
}
```

**Bug:** `cadaN` and `ciclo` fall into the else branch (treated as daily). `cadEvery` is also never reset when switching between 'sem' and 'mes' modes.

### B.6 `renderCadDetail()` — cadence modes

Four modes rendered in the dose sheet:

- **`dia`**: 7 weekday chip toggles (WDS labels). Allows arbitrary day combos. "Toca los días que tomas — quita Sáb y Dom para 5 on / 2 off"
- **`sem`**: stepper for `cadEvery` weeks (min 1) + weekday chip row `cadSemDays`
- **`mes`**: stepper for `cadEvery` months (min 1), no day selection
- **`uso`**: no controls, text "Sin horario fijo. Lo registras cuando lo usas — no programamos días."

### B.7 Protocol week strip

```typescript
// Week strip: Mon–Sun of the current week
const monday = new Date(TODAY);
monday.setDate(TODAY.getDate() - ((TODAY.getDay() + 6) % 7)); // ISO-week Monday

for (let i = 0; i < 7; i++) {
  const d = new Date(monday.getTime() + i * 86400000);
  // cell is 'on' if diaToca(d, p, startDate)
  // cell has 'today' outline if d.getTime() === TODAY.getTime()
  // label: WD[d.getDay()][0]  → first char of 'Dom'/'Lun'/'Mar'/etc.
}
```

---

## C. CALCULATOR

### C.1 Reconstitution formula — current (prototype)

```typescript
function calcRecon(): void {
  const vial  = parseFloat(c_vial.value);   // mg
  const agua  = parseFloat(c_agua.value);   // mL bacteriostatic water
  const dosis = parseFloat(c_dosis.value);  // user's dose
  const u     = c_unit.value;               // 'mg' | 'mcg'

  const C      = vial / agua;               // concentration mg/mL
  const doseMg = u === 'mcg' ? dosis / 1000 : dosis;  // normalize to mg
  const V      = doseMg / C;               // volume in mL
  const UI     = V * 100;                  // ← WRONG for U-40/U-50 (see below)

  window._calcUI = Math.round(UI * 10) / 10;
  // Display: `${_calcUI} UI`
  // Sub-display: `≈ ${Math.round(V*100)/100} mL · concentración ${Math.round(C*100)/100} mg/mL`
}
```

**Display precision:**
- `_calcUI`: `Math.round(UI * 10) / 10` → 1 decimal place
- Volume `V`: `Math.round(V * 100) / 100` → 2 decimal places
- Concentration `C`: `Math.round(C * 100) / 100` → 2 decimal places

### C.2 U-40/U-50/U-100 syringe scale bug

**Current:** `UI = V * 100` — this hardcodes U-100 scale (100 IU/mL = 1 IU per 0.01 mL).

**Problem:** U-40 syringes have 40 IU/mL; U-50 syringes have 50 IU/mL. Reading `V * 100` ticks on a U-40 gives a **2.5× overdose**, on a U-50 a **2× overdose**.

**Corrected formula (React port):**

```typescript
type SyringeScale = 40 | 50 | 100;

function calcUI(V: number, scale: SyringeScale): number {
  // UI ticks = volume (mL) × syringe IU per mL
  return V * scale;
}

// Examples:
// 0.1 mL on U-100 → 10 UI ticks
// 0.1 mL on U-40  →  4 UI ticks (not 10)
// 0.1 mL on U-50  →  5 UI ticks (not 10)
```

**React implementation requirement:** Add a syringe-scale selector (`<select>` with options 40 / 50 / 100) to the calculator card. Default to 100. Re-run `calcRecon` on change. Display selected scale in the output: `"${_calcUI} UI (jeringa U-${scale})"`.

### C.3 `useCalc()` — copy to dose input

```typescript
function useCalc(): void {
  if (!window._calcUI) return;
  dosein.value = String(window._calcUI);
  unit = 'UI';
  // highlight 'UI (unidades)' pill in dose-units row
  toggleCalc(); // collapse calculator
  toast('Copiado a tu registro: ' + window._calcUI + ' UI — verifica con tu jeringa');
}
```

Toast text is **compliance copy** — keep verbatim.

### C.4 Vial sizes (implicit in catalog / how-to text)

Not an explicit JS array in the prototype; the calculator accepts any user-entered vial size. No hardcoded vial-size list. The dose sheet input `c-vial` placeholder: `"ej. 10"` (mg).

---

## D. OTHER

### D.1 BMI — `bmiCalc(w, h)`

```typescript
function bmiCalc(w: number, h: number): number | null {
  if (!(w > 0) || !(h > 0)) return null;
  const m = h > 3 ? h / 100 : h;  // cm detection: if h > 3, assume cm; else assume meters
  const v = w / (m * m);
  return (v > 0 && v < 150) ? Math.round(v * 10) / 10 : null;
}
```

- Detection threshold: `h > 3` → cm (divide by 100); else meters
- Sanity check: `v > 0 && v < 150` (filters impossible BMI values)
- Returns `null` on invalid inputs
- Precision: 1 decimal place

Three call sites in prototype:
1. `calcBmi()` — setup screen (reads `sp-peso`, `sp-est`, writes `sp-bmi`)
2. `calcBmiM()` — measure sheet (reads `m-peso`, `m-est`, writes `m-bmi`)
3. `saveMeasureLog()` — recalculates after any measure with `prof` field

**Audit P1:** these 3 should be consolidated into one `saveProfile(updates)` function.

### D.2 KPI rendering

```typescript
function renderKpis(): void {
  const top = selectedMeasures.slice(0, 2);  // only first 2 shown (P2 bug: hides rest)
  // ...renders KPI cards for top[0] and top[1]
}

function mDisp(m: string): { val: number | null; txt: string } {
  const meta = MEASURE_META[m] ?? { kind: 'scale', max: 5 };
  let v = measureValues[m];
  if (v == null && meta.prof && profile[meta.prof] != null) v = profile[meta.prof];
  if (v == null) return { val: null, txt: '—' };
  return {
    val: v,
    txt: meta.kind === 'scale'
      ? (v + ' /' + meta.max)
      : (v + (meta.unit ? ' ' + meta.unit : ''))
  };
}
```

KPI scale display: `"4 /5"` for scale, `"82.4 kg"` for num.

### D.3 Quickstart (BiohackMX import flow)

```typescript
let importedProducts: string[] = ['BPC-157', 'Retatrutide']; // demo seed
let qsIndex: number  = 0;
let qsAdded: string[] = [];
let qsProg: Record<string, boolean> = {};

function finishQs(): void {
  const base = qsAdded.slice();
  curProto = base[0] ?? null;

  if (curProto) {
    curGoal = PEPTIDES[curProto].cat;
    selectedMeasures = [...(MEASURES_BY[curGoal] ?? MEASURES_BY.Explorar)];
  }

  // proto-sel: added products first, then rest of catalog, then '+ Otro / elegir después'
  const all = Object.keys(PEPTIDES);
  const opts = [...base, ...all.filter(o => !base.includes(o))];

  if (curProto && curProto in qsProg) {
    progOn = qsProg[curProto];
    if (progOn && progN < 2) progN = 2;
    renderProgControl();
  }
}
```

Note: `importedProducts` is a demo seed. Real implementation: OAuth → store returns product name strings.

### D.4 IMC capture in setup screen

Setup screen captures `peso` (kg) + `est` (cm) + `grasa` (%) → auto-computes `bmi` via `bmiCalc`. The `est` field placeholder says "Estatura (cm)" — input is in cm, `bmiCalc` handles the conversion.

### D.5 Day initials — canonical table

**Current prototype (inconsistent):** WD array uses `'Dom','Lun','Mar','Mié','Jue','Vie','Sáb'` for dates; WDS for dose chips uses `['L',1],['M',2],['Mi',3],['J',4],['V',5],['S',6],['D',0]`; streakbar hardcodes `['L','M','M','J','V','S','D']`.

**Canonical table (from audit P2, to use in React port):**
```
L   Ma   Mi   J   V   S   D
Mon Tue  Wed  Thu Fri Sat Sun
```

Rationale: 'M' is ambiguous (Martes vs Miércoles). Use 2-char where needed.

---

## E. P0 / P1 FIX LIST

### P0-1 ⏳ REGISTER→DIARY CYCLE BROKEN (most critical)

**Bug:** `logDose()` and `saveMeasureLog()` do not actually write to `LOG`. `logDose()` sets `logged=true`, hides `aha-card`, shows `dash`, and animates the ring — but reads nothing from the dose sheet inputs (`#dosein`, `unit`, `dose-sel`/`dose-custom`, `cadModeV`). `saveMeasureLog()` writes only to `measureValues`/`profile` in memory. Neither appends to `LOG`. The diary (`renderDiary()`) is never re-invoked after saving. For a new user the diary is empty (if LOG seed is cleared) or shows static seed data only.

**Correct behavior in React port:**

```typescript
// logDose() must:
function logDose(input: DoseInput): void {
  const productName = doseSelValue === '__otro' ? doseCustomValue : doseSelValue;
  const value       = parseFloat(dosein.value);
  const now         = new Date();

  const item: LogItem = {
    t:    formatTime(now),   // e.g. '9:00 PM'
    n:    'Dosis registrada',
    u:    productName + (value ? ' · ' + value + ' ' + unit : ''),
    cat:  '#1B8A7D',
    ic:   '💉',
    type: 'dose',
  };

  // prepend to today's group in LOG (create group if none)
  prependToLog('Hoy', 7, item);
  incrementStreak();
  rerenderDiary();
  rerenderRing();
  showDash();
  closeSheet();
  ping(); haptic(18);
  toast('Empezaste tu cambio 🎉');
}

// saveMeasureLog() must:
function saveMeasureLog(): void {
  // ...existing measureValues/profile write...
  const item: LogItem = {
    t:    formatTime(new Date()),
    n:    _mlName,
    u:    formatMeasureValue(_mlName, _mlVal),
    cat:  getMeasureColor(_mlName),
    ic:   getMeasureIcon(_mlName),
    type: 'medida',
  };
  prependToLog('Hoy', 7, item);
  // Also: activate dash if not logged (medidas alone should activate it — P1 fix)
  rerenderDiary();
  renderKpis(); renderProfile();
}
```

### P0-2 ⏳ HARDCODED STREAK / RING / STREAKBAR

**Bug:** `logDose()` animates ring to `314 * (1 - 7/30)` regardless of actual record count. `countUp('streaknum', 0, 7, ...)` hardcodes 7. `renderDiary()` streakbar hardcodes `i < 6` (6 of 7 days on). `streakbar` labels: `['L','M','M','J','V','S','D']` (ambiguous M's).

**Correct behavior:**

```typescript
// streak = count of consecutive days (up to today) with at least one log entry
function computeStreak(log: LogGroup[]): number {
  let count = 0;
  let d = new Date(TODAY);
  while (true) {
    const label = formatDayLabel(d); // 'Hoy', 'Ayer', or date string
    const group  = log.find(g => g.day === label);
    const hasDose = group?.items.some(it => it.type === 'dose');
    if (!hasDose) break;
    count++;
    d = new Date(d.getTime() - 86400000);
  }
  return count;
}

// ring: strokeDashoffset = 314 * (1 - streak / STREAK_GOAL)
// STREAK_GOAL: 30 (implicit in prototype)
// For new user with 0 logs: streak=0, ring is empty, streaknum shows 0

// streakbar: 7 cells for current week using canonical initials (L Ma Mi J V S D)
// each cell 'on' if any log entry (dose OR medida) exists for that calendar day
```

### P0-3 ⏳ CADENCE IS DEAD STATE

**Bug:** `cadModeV`, `cadDays`, `cadSemDays`, `cadEvery` in the dose sheet are read-only UI state. They are NEVER passed to `logDose()`, never stored on the product/protocol, and never feed `diaToca()` or reminder scheduling. `presetCad()` handles `diaria`/`lv`/`semanal`/`por-demanda` but silently treats `cadaN` and `ciclo` as fully-daily.

**Correct behavior:**

The dose cadence must be persisted on the per-product `UserProtocol` record:

```typescript
interface UserCadence {
  mode:     'dia' | 'sem' | 'mes' | 'uso';
  days:     boolean[];      // 7-element, for mode='dia'
  every:    number;         // for mode='sem'|'mes'
  semDays:  boolean[];      // 7-element, for mode='sem'
}

interface UserProtocol {
  product:  string;
  cadence:  UserCadence;
  progOn:   boolean;
  progN:    number;
  curPhase: number;
  startDate: Date;
}
```

`presetCad` must handle all 6 cadence types:
- `cadaN` → mode='dia', compute equivalent days or store as custom interval
- `ciclo` → store on/off counts; compute `diaToca` from cycle position
- `cadEvery` must reset to 1 when switching between 'sem' and 'mes' (bug: shared variable never resets)

`diaToca()` must accept `UserCadence` as the source of truth (not just PEPTIDES catalog entries).

### P0-4 ⏳ pickGoal PRELOADS GLP-1 PRODUCT (compliance)

**Bug:** `pickGoal('Metabolismo','Retatrutide')` sets `curProto='Retatrutide'`. The app thereby recommends a specific controlled substance in response to the health goal "Bajar de peso". This is LFPDPPP + regulatory risk (association of substance with medical condition).

**Correct behavior:**

```typescript
// Goal selection configures ONLY the measure set.
function pickGoal(cat: Category): void {
  curGoal = cat;
  selectedMeasures = [...(MEASURES_BY[cat] ?? MEASURES_BY.Explorar)];
  // curProto remains null until user adds a product manually OR BiohackMX import
  // No product suggestion, no routing to a substance
}
```

Goal button `onclick` must call `pickGoal(cat)` with no second argument. Product is set only via:
1. `qsAdd()` during BiohackMX quickstart import flow
2. Manual product selection by user in protocol screen

### P0-5 ⏳ ARCO / BORRAR CUENTA ARE DEAD BUTTONS (compliance)

**Bug:** "Privacidad y datos (ARCO)" and "Borrar mi cuenta" are inert `<div class="row">` elements. The app claims "Cumple LFPDPPP" in the footer. LFPDPPP Article 22 requires operational access/rectification/cancellation/opposition channels.

**Correct behavior in React port:**

```typescript
// ARCO sheet (bottom-sheet component):
// 4 sections, one per ARCO right:
// A — Acceso: "Descarga tus datos"   → triggers export (JSON/CSV of LOG + profile)
// R — Rectificación: "Corregir info" → opens profile edit sheet
// C — Cancelación: "Borrar mis datos"→ opens destructive confirmation dialog
// O — Oposición: "Revocar consentimiento" → revokes health-data consent + deletes

// Destructive confirmation pattern (reusable component):
// 1. Sheet with warning text + product name/action
// 2. User must type "BORRAR" or tap a second confirm button
// 3. Only then execute deletion
// Same component reused for "Borrar registro" (P1) and "Borrar cuenta" (P0)

// PIN toggle must reflect real state:
// If PIN is not set, toggle shows 'off'. Toggling 'on' opens PIN creation flow.
// Toggling 'off' requires PIN entry for confirmation.
```

### P0-6 🟡 CALCULATOR U-40/U-50/U-100 SCALE SELECTOR (partial)

**Bug:** `UI = V * 100` hardcodes U-100 scale. For a U-40 syringe this is 2.5× wrong.

**Fix (React port — see §C.2 for full formula):**
- Add `<select>` with `[40, 50, 100]` options, default 100
- `UI = V * scale` (where scale = selected value)
- Output label: `"${calcUI} UI (jeringa U-${scale})"`
- Copy-to-register toast: include scale label so user can verify against their syringe

---

### P1-1 ⏳ EDIT/DELETE LOG ENTRY

**Bug:** `openEdit(when)` calls `toast('Editar: ' + when + ' (demo)')` only.

**Correct behavior:** Open a sheet pre-populated with the log item's values. Allow edit of dose/value/time. Include a destructive delete button (uses reusable confirmation from P0-5).

### P1-2 ⏳ "PRÓXIMA TOMA" ON HOME IS STATIC

**Bug:** `#next-when` shows "Hoy" and `#next-sub` shows "según tu ritmo" as hardcoded HTML. They are never updated by `renderProto()` or cadence state.

**Fix:** On home render, call `proximas(PEPTIDES[curProto], startDate, 1)` and write result to `#next-when`/`#next-sub`. If `curProto` is null, hide the card.

### P1-3 ⏳ TOGGLES THAT LIE

**Bugs:**
- PIN toggle is always `class="toggle on"` (hardcoded in HTML). Clicking it calls `openPin()` but never persists off-state.
- "Registrada" toggle in dose sheet (`onclick="this.classList.toggle('on')"`) is not read by `logDose()`.

**Fix:** PIN toggle must reflect `userSettings.pinEnabled` boolean. "Registrada" toggle should be removed or wired to a `markedTaken: boolean` field on the log item.

### P1-4 ⏳ PROFILE/IMC CAPTURE IN 3 PLACES

**Bug:** Identical peso/est/grasa/bmi capture logic in: setup screen (`sp-*`), measure sheet (`m-*`), measure-log sheet (for `prof`-linked measures). No single `saveProfile()`.

**Fix:** One `saveProfile(updates: Partial<Profile>)` function. All three capture points call it.

### P1-5 ⏳ DASH ACTIVATES ONLY ON DOSE

**Bug:** `logDose()` is the only place that sets `logged=true` and shows `#dash`. Saving measures via `saveMeasureLog()` never activates the dashboard.

**Fix:** `activateDash()` is called from both `logDose()` and `saveMeasureLog()`. Also: `aha-card` must check if `curProto` is null before showing "Registra tu dosis de [product]".

### P1-6 ⏳ BACK NAVIGATION BROKEN ON TAB SCREENS

**Bug:** `back()` pops `hist` stack. Tab screens (`s-home`, `s-diary`, `s-proto`, `s-settings`) push to `hist` when navigated via `tabTo()`. Pressing back on a tab screen replays previous tab in hist, not intended behavior.

**Fix:** Tab navigation should NOT push to `hist`. `go(id)` should be called with `isBack=false` from `tabTo()` but tab destinations should be excluded from hist (or maintain a separate tab-state vs. modal-navigation stacks).

### P1-7 ⏳ `logged` NOT RESET ON ONBOARDING REDO

**Bug:** `logged` is module-level `let logged=false`. If user re-runs onboarding (e.g., clears account), `logDose()` would behave as if already past the first-log gate.

**Fix:** Reset `logged = false` and `streak = 0` and `LOG = []` in any "reset state" or logout function.

---

## F. CONSTANTS REFERENCE (verbatim)

```typescript
// Colors (CSS custom properties)
const BRAND = {
  900: '#063B36',
  700: '#0E5A52',
  500: '#1B8A7D',
  300: '#5FC9B8',
  100: '#D6F2EC',
};
const LIME      = '#B6F09C';
const LIME_DEEP = '#7BC96F';
const EMBER     = '#FF7A59';
const EMBER_DEEP = '#E85D3A';
const SUCCESS   = '#2FB57C';
const WARNING   = '#E8A317';
const ERROR     = '#E4564B';

// Typography fonts (loaded from Google Fonts)
// Headlines: 'Bricolage Grotesque' (wght 600/700/800, opsz 12..96)
// Body/UI:   'Inter' (wght 400/500/600/700)
// Mono/data: 'JetBrains Mono' (wght 500/700)

// Disclaimer (legal copy — keep ALL instances, unify wording):
const DISCLAIMER_DOSE    = 'Tú registras tu propia dosis. Hacktrack no la calcula ni la prescribe.';
const DISCLAIMER_CALC    = 'Solo convierte unidades con TU dosis. Hacktrack no decide cuánto debes aplicarte. No es consejo médico.';
const DISCLAIMER_MEASURE = 'Tú registras cómo te sientes. Son tus datos, no una promesa de resultado.';
const DISCLAIMER_GENERAL = 'Hacktrack es una herramienta de auto-registro. No es consejo médico.';
const DISCLAIMER_PROTO   = 'Esto describe un ritmo general. Tú confirmas y ajustas lo que TÚ haces. No es consejo médico.';
```

---

## G. AUDIT GUARDRAILS (do not violate in React port)

From audit preamble (verbatim):
- "el usuario teclea su dosis, calculadora solo convierte"
- "cero venta in-app"
- "OAuth mediado"
- "sin curva de outcome"
- "disclaimers redundantes a propósito (unificar redacción, NO reducir instancias)"

---

*Spec generated 2026-06-15 from prototype v3 + audit backlog (2-round, 13-agent review).*
