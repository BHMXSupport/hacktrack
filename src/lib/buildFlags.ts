// Banderas de COMPILACIÓN. Vite reemplaza import.meta.env.VITE_* estáticamente al compilar,
// así que las ramas if (!STORE_BUILD) quedan como código muerto y Rollup las ELIMINA del
// bundle de tienda: la exclusión existe en el binario, no como toggle de runtime (Apple 2.3.1).
// Verificación empírica de la eliminación: scripts/store-gate.mjs (npm run gate:store).

// true SOLO al compilar con VITE_STORE_BUILD=1 (binarios para App Store / Play Store).
export const STORE_BUILD = import.meta.env.VITE_STORE_BUILD === '1'

// Punto de entrada "Importar protocolos" (Ajustes → abre ImportSheet): NO existe en builds
// de tienda (Apple 1.4.3 — el binario no debe facilitar la compra de los compuestos del
// vendedor). Ajustes.tsx pertenece a otro flujo de trabajo: este flag le permite ocultar
// la fila con una sola línea ({IMPORT_ENTRY_ENABLED && …}); mientras tanto la fila queda
// muerta en tienda (ImportSheet no está montado y el dispatch no abre nada).
export const IMPORT_ENTRY_ENABLED = !STORE_BUILD

// Copy de racha por variante: en builds de tienda la racha se presenta SIEMPRE como
// "racha de registro" — celebra la constancia de REGISTRAR, no la aplicación de dosis
// (lectura discrecional de Apple 1.4.3 sobre gamificación de inyecciones).
// En la PWA el copy queda intacto (devuelve `base` tal cual).
// Uso: rachaLabel() → 'racha…' · rachaLabel('Racha') → 'Racha…' · rachaLabel('racha integral').
export function rachaLabel(base: string = 'racha'): string {
  return STORE_BUILD ? `${base} de registro` : base
}
