# STORE-BUILD — Empaquetado nativo (Capacitor) y builds de tienda

Cómo producir los binarios de App Store / Google Play a partir del build web de tienda.
La PWA de producción NO cambia: este pipeline es paralelo (`dist-store-cap/`, `ios/`, `android/`).

---

## Regla de oro: exclusión EN TIEMPO DE COMPILACIÓN

**El binario de tienda NUNCA lleva la integración de import del vendor, ni precios, ni verbos
de compra, ni dominios de vendors, ni adjetivos de beneficio junto a nombres de compuestos.**

Razonamiento (research de políticas jul-2026 + red team; no relitigar):

- **Apple §1.4.3** prohíbe *facilitar la venta* de los compuestos del vendor. La exclusión debe ser
  **en compile time**: un toggle en runtime dentro del binario viola además la §2.3.1 (features
  ocultas). Si el código está en el bundle, para el revisor existe.
- **Google "Unapproved Substances"**: el verbo prohibido es *promote or sell*. En los strings del
  binario no puede existir ningún verbo de compra, dominio de vendor ni adjetivo de beneficio
  cerca de nombres de compuestos.
- La dosis siempre la teclea el usuario; la calculadora es solo aritmética.
- La gamificación de racha se reencuadra en builds de tienda como **"racha de registro"**
  (registrar en la app), nunca racha de inyección/consumo.

El mecanismo es la variable `VITE_STORE_BUILD=1` (build de tienda): el código gated por ella
queda fuera del bundle por dead-code-elimination de Vite/Rollup. El detalle vive en la capa A
(flag + gate de copy en CI). Documentación completa del razonamiento: notas del vault
`Hacktrack - Store Compliance Playbook` y `Hacktrack - Store Submission Kit`.

**Estado al 2026-07-16 (verificado):** el único resto de vendor en `dist-store-cap/` es
`aviso-privacidad.html` (email de soporte del vendor) y `promo/` agrega ~34 MB de assets de
marketing al binario. Ambos deben excluirse del build de tienda antes de subir nada (pendiente
en capa A / gate de CI).

---

## Setup de máquina (una sola vez) — pasos HUMANOS

Esta máquina NO tiene Xcode ni Android SDK (verificado): los proyectos nativos se generan y
sincronizan sin ellos, pero **compilar/firmar/subir requiere este setup**.

### iOS
1. **Xcode** desde el Mac App Store (≥ 15.x; incluye los simuladores al primer arranque).
2. `xcode-select --install` (command line tools) y abrir Xcode una vez para aceptar licencias.
3. **CocoaPods NO hace falta**: Capacitor 8 usa Swift Package Manager (`ios/App/Package.swift`,
   generado). Xcode resuelve los paquetes al abrir el proyecto.
4. Cuenta **Apple Developer Program** ($99 USD/año) como **entidad legal** (ver §5.1.1(ix) —
   apps de salud no se aceptan de cuentas individuales de hobby; detalle en el Submission Kit).

### Android
1. **Android Studio** (incluye SDK + Gradle). Primer arranque: instalar SDK Platform 35+ y
   Build-Tools que pida `android/variables.gradle`.
2. JDK: el embebido de Android Studio basta.
3. Cuenta **Google Play Console** ($25 USD una vez; verificar el requisito vigente de cuenta de
   Organización — ver Submission Kit).

---

## Pipeline de build

```bash
# 1) Build web de TIENDA (flag de compliance + outDir propio, no pisa dist/ ni dist-store/)
npm run build:store        # = tsc && VITE_STORE_BUILD=1 vite build --outDir dist-store-cap

# 2) Copiar el build web + config a ambos proyectos nativos
npx cap sync               # o: npm run cap:sync (hace build:store + sync en un paso)

# 3) Abrir el IDE nativo para compilar/firmar
npx cap open ios           # Xcode  → target App → Run / Archive
npx cap open android       # Android Studio → Run / Build > Generate Signed Bundle
```

- `capacitor.config.ts`: `appId mx.hacktrack.app`, `webDir dist-store-cap`, splash/status-bar
  oscuros (#0B1220 / #0E5A52), **sin** `server.allowNavigation` (cero dominios remotos).
- Los proyectos `ios/` y `android/` ya están generados (`npx cap add ios|android`, hecho).
  Regenerarlos solo si se borran; `cap sync` es el comando del día a día.

### Iconos y splash

Fuentes en `assets/` (derivadas de `public/pwa-512.png` + `maskable-512.png` con sharp,
fondo #0B1220). Para regenerar los nativos:

```bash
npx @capacitor/assets generate --ios --android \
  --iconBackgroundColor '#0B1220' --iconBackgroundColorDark '#0B1220' \
  --splashBackgroundColor '#0B1220' --splashBackgroundColorDark '#0B1220'
```

Verificado: Android 74 archivos (`mipmap-*/ic_launcher*`, `drawable-*/splash.png`),
iOS `AppIcon.appiconset` + `Splash.imageset` (claro y oscuro).

---

## Firma (básicos)

### iOS
- Xcode → target **App** → *Signing & Capabilities* → Team = la entidad legal; "Automatically
  manage signing" resuelve certificados/perfiles para `mx.hacktrack.app`.
- Distribución: *Product > Archive* → *Distribute App > App Store Connect*.

### Android
- Crear keystore UNA vez (`keytool -genkey -v -keystore hacktrack-upload.keystore -alias upload
  -keyalg RSA -keysize 2048 -validity 10000`). **Respaldarlo fuera del repo; nunca commitearlo.**
- Play App Signing: Google guarda la llave de firma; el keystore local es solo la *upload key*.
- Android Studio → *Build > Generate Signed App Bundle* (.aab, no APK, para Play).

---

## Integraciones nativas incluidas (runtime `Capacitor.isNativePlatform()`)

| Módulo | Qué hace | Nota |
|---|---|---|
| `src/lib/native/notifications.ts` | Recordatorios vía `@capacitor/local-notifications` — disparan con la app CERRADA (mejor que el setTimeout web) | El seam en `src/lib/notifications.ts` lo cablea la capa A (ver handoff) |
| `src/lib/native/secureStorage.ts` | Sesión Supabase en Keychain/Keystore (adapter `auth.storage`) | Cableado en `src/lib/backend/supabase.ts` |
| `src/lib/native/stateMirror.ts` | Espejo del blob `hacktrack:v2` en `@capacitor/preferences` + restauración al arrancar | Seguro anti-evicción de WKWebView; cableado en `src/main.tsx` |
| `src/lib/native/backButton.ts` | Botón back de Android → cierra el modal del tope (pila de `modalStack`) o minimiza | Solo Android |

En web/PWA todos son no-op: el comportamiento del beta no cambia.

- Android: `@capacitor/local-notifications` declara `SCHEDULE_EXACT_ALARM`; Play pide justificar
  alarmas exactas en la declaración de la ficha (recordatorios configurados por el usuario).
- El Service Worker de la PWA viaja en el binario pero en WKWebView no se registra (no soportado);
  inofensivo. Los recordatorios nativos no dependen de él.

---

## Checklist previo a subir CUALQUIER binario

1. `npm run build:store` en verde (tsc + tests del repo en verde).
2. `grep -ril "biohackmx" dist-store-cap/` → **cero resultados** (gate de la capa A).
3. Sin `precio|comprar|ordenar|envío|stock` en strings del bundle (gate de copy de CI, capa A).
4. `npx cap sync` limpio en ambas plataformas.
5. Submission Kit completo (ficha, privacy labels, Health declaration, cuenta demo) — ver la
   nota del vault `Hacktrack - Store Submission Kit`.
