// src/lib/search.ts — fuzzy search helper (item 266)
// Bigrama + Levenshtein híbrido para búsqueda tolerante a typos sobre catálogos de texto en es-MX.
// Exporta fuzzyScore() y fuzzyFilter() para reutilización desde Recetario, CrearPlatillo, etc.

/** Normaliza texto: minúsculas, sin acentos, sin puntuación. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim()
}

/** Construye el set de bigramas de una cadena normalizada. */
function bigrams(s: string): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2)
    if (bg.trim()) out.add(bg)   // ignora bigramas de solo espacios
  }
  return out
}

/** Dice coefficient entre dos conjuntos de bigramas (0–1). */
function diceCoeff(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  a.forEach((bg) => { if (b.has(bg)) inter++ })
  return (2 * inter) / (a.size + b.size)
}

/**
 * Calcula una puntuación de similitud 0–1 entre query y candidate.
 * Usa includes() exacto como fast-path (score=1), luego bigrama Dice.
 * El query puede ser varias palabras separadas por espacios: se evalúa
 * cada token contra la cadena completa y se toma el max.
 */
export function fuzzyScore(query: string, candidate: string): number {
  const q = normalize(query)
  const c = normalize(candidate)
  if (!q) return 0
  if (c.includes(q)) return 1          // match exacto (substring)
  // multi-token: 'pech pol' → max(score('pech',c), score('pol',c))
  const tokens = q.split(' ').filter(Boolean)
  if (tokens.length > 1) {
    return Math.max(...tokens.map((t) => fuzzyScore(t, candidate)))
  }
  return diceCoeff(bigrams(q), bigrams(c))
}

/**
 * Filtra y ordena un array de items por similitud con el query.
 * @param items  Array de elementos
 * @param query  Cadena de búsqueda (puede tener typos, abreviaciones)
 * @param key    Función que extrae el texto de cada elemento
 * @param threshold  Score mínimo para incluir (default 0.25)
 * @param limit  Máximo de resultados (default 8)
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  key: (item: T) => string,
  threshold = 0.25,
  limit = 8,
): T[] {
  if (!query.trim()) return []
  const scored = items
    .map((item) => ({ item, score: fuzzyScore(query, key(item)) }))
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
  return scored.map(({ item }) => item)
}
