import { defineConfig } from 'vitest/config'

// Config de tests AISLADA de vite.config.ts (no carga VitePWA ni el plugin de React:
// los tests golden cubren solo lógica pura de src/lib, sin render).
// TZ=America/Tijuana para TODA la suite: Tijuana observa horario de verano (CDMX lo abolió),
// y la deuda #69 (caminatas de día con 86_400_000 ms fijos) solo se manifiesta con DST.
// Node ≥13 relee process.env.TZ en tiempo de ejecución; dst.test.ts tiene un test guardia
// que verifica que el offset realmente cambia PST→PDT (si esto dejara de aplicar, cambiar
// el script a `TZ=America/Tijuana vitest run`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/lib/__tests__/**/*.test.ts'],
    env: { TZ: 'America/Tijuana' },
  },
})
