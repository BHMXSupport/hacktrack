// Aritmética de días LOCAL y segura ante DST.
// Regla: nunca sumar/restar múltiplos de 86_400_000 ms para "caminar días" —
// en zonas con horario de verano (p.ej. Tijuana) un día local puede durar 23/25 h
// y el walk se salta o duplica un día (deuda #69). Usar siempre el constructor
// local: new Date(y, m, d + n) normaliza correctamente.

/** Devuelve una fecha al INICIO del día local, desplazada n días (n puede ser negativo). */
export function addDays(base: Date | number, n: number): Date {
  const d = new Date(base)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** Inicio del día local (00:00:00.000) de la fecha dada. */
export function startOfLocalDay(base: Date | number): Date {
  return addDays(base, 0)
}
