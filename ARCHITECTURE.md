# Inventario Betr Media — Arquitectura y documentación técnica

Sistema interno de inventario de equipos de cómputo y periféricos de **Betrmedia SAS**. SPA en React que corre 100% en el navegador, con Firebase como único backend (Auth + Firestore, sin servidor propio ni funciones en la nube).

- **Repo:** `JuanFeCorPo/Inventario-Betr-2025-v.1`
- **Producción:** desplegado en **Vercel**, auto-deploy en cada push a `main`
- **Backend:** Firebase (proyecto `inventario-betrmedia-sas`) — Authentication (email/contraseña) + Cloud Firestore
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) — `npm ci && npm run lint && npm run build` en cada push/PR a `main`

---

## 1. Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | React 18 + Vite 5 |
| Estilos | Tailwind CSS 3 (paleta de marca custom, ver §7) |
| Iconos | lucide-react |
| Backend | Firebase Auth + Cloud Firestore (SDK modular v10, cliente puro) |
| Excel | [SheetJS (xlsx)](https://cdn.sheetjs.com/), cargado con `import()` dinámico |
| Tests | Vitest (solo lógica pura, sin jsdom) |
| Lint | ESLint (react, react-hooks, react-refresh) |
| Hosting | Vercel (frontend estático) |

No hay servidor propio, API REST, ni Cloud Functions. Toda la lógica de negocio vive en el cliente; la seguridad real se aplica en `firestore.rules`.

---

## 2. Estructura de carpetas

```
src/
├── App.jsx                  # Enrutador raíz: auth, selección de pantalla, control de inactividad
├── main.jsx                 # Punto de entrada (ReactDOM.createRoot)
├── config/
│   ├── firebase.js          # Init de Firebase + rutas de colecciones Firestore
│   └── constants.js         # Categorías, estados, paleta, tiempos de sesión
├── screens/                 # Pantallas de nivel superior (una por "vista" de la app)
│   ├── LoginScreen.jsx
│   ├── InventoryDashboard.jsx   # Pantalla principal (tabla/tarjetas, filtros, alertas)
│   ├── UsersScreen.jsx          # Gestión de usuarios (solo Administrador)
│   ├── MaintenanceScreen.jsx    # Mantenimientos preventivos (Laptops/CPU)
│   └── ConfigErrorScreen.jsx
├── components/
│   ├── ui/index.jsx          # Átomos: Modal, Button, Input, Select, Dropdown, StatusBadge…
│   ├── AlertsBell.jsx         # Icono de notificaciones (dropdown) en el header
│   ├── CategoryChart.jsx      # Donut de distribución por categoría
│   ├── HistoryTimeline.jsx    # Línea de tiempo de trazabilidad
│   ├── ErrorBoundary.jsx
│   └── modals/                # Modales de flujo (formulario, preview, import, reporte…)
├── hooks/                    # Toda la lógica de Firestore vive en hooks, no en las pantallas
│   ├── useInventory.js        # CRUD de equipos + historial (el hook más grande)
│   ├── useEquipoHistorial.js  # onSnapshot de la subcolección historial de un equipo
│   ├── useEncargados.js       # Lista de personas a cargo (autocompletado)
│   ├── useDismissedAlerts.js  # Alertas descartadas (compartidas entre usuarios)
│   └── useIdleTimeout.js      # Cierre de sesión por inactividad
└── utils/                    # Lógica pura, sin React ni Firebase — todo testeado con Vitest
    ├── alerts.js               # Reglas de alertas del inventario
    ├── dismissedAlerts.js      # Cuándo reaparece una alerta descartada (15 días)
    ├── maintenance.js          # Cálculo de mantenimiento preventivo
    ├── duplicates.js           # Detección de serial/Nº inventario repetidos
    ├── loginLockout.js         # Bloqueo de login por intentos fallidos
    ├── idle.js                 # Máquina de estados de inactividad (pura, testeable)
    ├── excel.js                # Import/export de Excel + sanitización anti-inyección
    └── report.js                # Armado del reporte por periodo (collectionGroup)
```

**Convención clave:** las pantallas (`screens/`) orquestan, los hooks (`hooks/`) hablan con Firestore, y los utils (`utils/`) son funciones puras sin dependencias externas — por eso son la parte con más cobertura de pruebas (Vitest).

---

## 3. Modelo de datos (Firestore)

Proyecto sin colecciones "raíz" tradicionales para los datos de negocio: casi todo vive bajo `artifacts/{APP_ID}/public/data/...` (patrón heredado del scaffold original de la app), con un par de colecciones de infraestructura en la raíz.

```
artifacts/{APP_ID}/public/data/
├── equipos/{equipoId}
│   └── historial/{entryId}        # subcolección — trazabilidad de cada equipo
├── equipos_eliminados/{docId}     # archivo de equipos borrados (no restaurable desde la UI)
└── encargados/{slug}              # lista de personas a cargo, para el autocompletado

users/{uid}                        # perfiles + roles (uid = Firebase Auth UID)
loginAttempts/{email}              # bloqueo de login (raíz, lectura/escritura sin sesión)
dismissedAlerts/{alertId}          # alertas descartadas, compartidas entre usuarios (raíz)
```

`APP_ID` sale de `import.meta.env.VITE_FIREBASE_CONFIG` (o `__app_id`), configurado en `src/config/firebase.js`.

### 3.1 `equipos/{id}`

| Campo | Tipo | Notas |
|---|---|---|
| `nombre` | string | |
| `categoria` | string | una de `CATEGORIAS` (constants.js) |
| `estado` | string | `Disponible` \| `En Uso` \| `En Mantenimiento` \| `Fuera de Servicio` \| `De Baja` |
| `condicion` | string | `Nuevo` \| `Usado` — pasa a `Usado` automáticamente en cuanto el equipo se usa una vez |
| `numeroSerial`, `numeroInventario` | string | validados contra duplicados al guardar (§5.4) |
| `fechaIngreso` | Timestamp | |
| `personaEncargada` | string | alimenta `encargados/` |
| `observaciones` | string | |
| `createdAt`, `addedBy`, `addedByEmail` | Timestamp / string | se usan para sintetizar la primera entrada de historial (§3.2) |
| `fecha_baja`, `motivo_baja` | Timestamp / string | solo si `estado === 'De Baja'` |
| `frecuenciaMantenimientoMeses` | number | solo Laptops/CPU — editable por equipo, default 6 (§4.2) |
| `ultimoMantenimiento` | Timestamp | fecha del último mantenimiento registrado |
| `sinMantenimiento` | boolean | exclusión manual del control de mantenimiento (ej. equipos en backup) |

### 3.2 `equipos/{id}/historial/{entryId}` — trazabilidad

Cada entrada: `{ timestamp, user, action, changes? }`. Se escribe en cada edición, nota, baja o mantenimiento registrado — **nunca** en la creación del equipo: esa primera entrada ("Equipo creado…") se **sintetiza en la UI** a partir de `createdAt`/`addedByEmail` (ver `PreviewModal.jsx`), justamente para que un Lector pueda crear equipos sin necesitar permiso de escritura en `historial` (reservado a Administrador).

### 3.3 `users/{uid}`

`{ email, role: 'Lector' | 'Administrador', active: boolean, history: [...] }`. El doc ID es el UID de Firebase Auth — los usuarios se crean primero en Firebase Auth (consola) y luego se registran aquí manualmente desde `UsersScreen`.

---

## 4. Funcionalidades principales

### 4.1 Inventario (CRUD + trazabilidad)
Tabla en escritorio / tarjetas en móvil, con búsqueda, filtro por categoría y estado. Cada acción de Administrador (editar, dar de baja, agregar nota) queda registrada en `historial`. El modal de detalle combina tres fuentes de historial: la entrada sintética de creación, historial legado embebido (equipos antiguos) y la subcolección `historial` en vivo.

### 4.2 Mantenimiento preventivo (`MaintenanceScreen`, `utils/maintenance.js`)
Solo aplica a **Laptops y CPU**. Vista separada, con lista agrupada por urgencia: **Vencidos → Esta semana → Este mes → Próximos**, calculada a partir de `ultimoMantenimiento` (o `fechaIngreso` si nunca tuvo uno) + `frecuenciaMantenimientoMeses` (default 6, editable por equipo).

Se excluyen automáticamente:
- Equipos `De Baja` o `Fuera de Servicio` (no tiene sentido mantenerlos mientras están dañados/retirados).
- Equipos marcados `sinMantenimiento` (casilla manual, para equipos en backup sin uso).

### 4.3 Alertas inteligentes (`utils/alerts.js`, `AlertsBell.jsx`)
Vive como ícono de campana en el header (no como banner fijo), con contador de alertas activas. Reglas actuales:
- **Categoría con ≥3 equipos "Fuera de Servicio".**
- **Equipos estancados** >30 días en Mantenimiento/Fuera de Servicio.
- **Mantenimiento preventivo vencido** (Laptops/CPU).

Al descartar una alerta (botón "Ver" o la X), queda oculta 15 días (`utils/dismissedAlerts.js`) — compartido entre todos los administradores vía Firestore (`dismissedAlerts/`), y **reaparece** si el problema sigue sin resolverse pasado ese plazo.

### 4.4 Detección de duplicados (`utils/duplicates.js`)
Al guardar un equipo se revisan `numeroSerial` y `numeroInventario` contra **todos** los equipos, incluidos los dados de baja (que no aparecen en el listado con el filtro en "Activos", así que un duplicado ahí quedaba invisible). No bloquea: muestra un popup con el equipo en conflicto (nombre, N° de inventario, estado) y deja elegir entre corregir o guardar de todos modos.

### 4.5 Import/Export Excel (`utils/excel.js`)
Export de inventario completo, historial de un equipo, o reporte por periodo (`utils/report.js`, usa `collectionGroup('historial')`). Import valida/normaliza cada fila (categoría, estado, condición, fechas) y reporta errores/advertencias antes de confirmar. Los valores libres (nombre, observaciones, notas) se **sanitizan contra inyección de fórmulas** (CSV/Excel formula injection): si empiezan por `=`, `+`, `-` o `@` se neutralizan con un apóstrofe. La librería `xlsx` se carga con `import()` dinámico — no va en el bundle inicial.

### 4.6 Autenticación y seguridad
- **Login:** Firebase Auth (email/contraseña), persistencia de sesión limitada al navegador (`browserSessionPersistence`).
- **Autorización de dos niveles:** estar autenticado en Firebase no basta — además debe existir un doc en `users/{uid}` con `active: true`. Roles: `Lector` (solo lectura + crear equipos) y `Administrador` (todo).
- **Bloqueo de login** (`utils/loginLockout.js`): 3 intentos fallidos → bloqueo de 1 hora, guardado en Firestore (`loginAttempts/{email}`, doc ID = correo normalizado) para que sea real y no se evada borrando el caché del navegador. El mensaje de error es siempre el mismo ("Email o contraseña incorrectos") sin importar la causa (contraseña mala, correo inexistente, cuenta bloqueada) — no revela información al atacante.
- **Cierre de sesión por inactividad** (`utils/idle.js` + `useIdleTimeout.js`): 15 min por defecto, con aviso 20 s antes del cierre. Implementado por comparación de timestamps (no `setTimeout` puro), porque los navegadores congelan los timers de pestañas en segundo plano — justo cuando el usuario se ausenta. Vive en `App.jsx` (no en una pantalla puntual), así que cubre toda la app.

---

## 5. Reglas de seguridad de Firestore (`firestore.rules`)

Funciones base:
- `isRegistered()` — hay sesión Y existe `users/{uid}`.
- `isActiveUser()` — registrado y `active` ≠ `false` (con `.get('active', true)`, nunca acceso directo a punto, porque Firestore rules explota si el campo no existe).
- `isActiveAdmin()` — activo y `role == 'Administrador'`.

| Colección | Lectura | Escritura |
|---|---|---|
| `users/{uid}` | dueño o Administrador | solo Administrador |
| `artifacts/.../equipos/{id}` (y demás bajo `public/data`) | cualquier usuario activo | crear: cualquier usuario activo · editar/borrar: solo Administrador |
| `.../equipos/{id}/historial/{entryId}` | cualquier usuario activo | solo Administrador |
| `loginAttempts/{email}` | pública (`true`) | validada por función — necesario porque se evalúa **antes** de iniciar sesión |
| `dismissedAlerts/{alertId}` | cualquier usuario activo | cualquier usuario activo, validada por función |

Las dos últimas colecciones tienen funciones de validación dedicadas (`isValidLoginAttemptWrite`, `isValidDismissedAlertWrite`) que limitan la forma exacta del documento y acotan cuánto se puede adelantar una fecha en el futuro (`duration.value(...)`), ya que se escriben sin los controles normales de rol.

**Índices** (`firestore.indexes.json`): `fieldOverride` en `historial.timestamp` con `queryScope: COLLECTION_GROUP` — necesario para el reporte por periodo, que hace `collectionGroup('historial')` con filtro de rango de fechas (las consultas de grupo de colecciones con rango siempre requieren índice explícito).

**Deploy de reglas/índices** es un paso manual, aparte de `git push` (que solo despliega el frontend vía Vercel):
```
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## 6. Patrones de desarrollo establecidos

- **Toda la lógica de negocio no trivial vive en `utils/` como funciones puras**, con su archivo `*.test.js` al lado (Vitest, `environment: 'node'`, sin jsdom). Los hooks son delgados: solo hablan con Firestore y delegan el cálculo a `utils/`.
- **Historial "sintético" en la creación:** para no requerir permiso de escritura en `historial` al crear (que sería admin-only), la primera entrada de trazabilidad se calcula al vuelo desde `createdAt`/`addedByEmail`, nunca se persiste.
- **Alertas y exclusiones se recalculan en vivo**, nunca se guardan como campo derivado — evita que queden desincronizadas.
- **No hay backend propio**: cualquier regla de negocio que necesite ser "a prueba de manipulación" (bloqueo de login, límites de fecha en alertas descartadas) se aplica en `firestore.rules`, no solo en el cliente.

### Verificación visual con datos mock (usado en desarrollo, no en producción)
Para probar cambios de UI sin tocar Firestore real: se crean archivos `*.mock.js` junto a un hook real (ej. `useInventory.mock.js`) con datos en memoria, se cambia el `import` en la pantalla afectada para apuntar al mock, y `main.jsx` se reemplaza temporalmente por un `PreviewRoot` que monta la pantalla directo (sin pasar por `App.jsx`/login). Todo esto se revierte antes de cada commit — **nunca debe quedar código `TEMP-DEV-PREVIEW` en el repo**.

---

## 7. Identidad visual

Paleta de marca definida en `tailwind.config.js` bajo el namespace `brand`:

| Token | Hex | Uso |
|---|---|---|
| `brand-orange` | `#E68E00` | acento primario, botones principales |
| `brand-amber` | `#EDAA00` | hover del acento |
| `brand-slate` | `#5E6A74` | texto secundario |
| `brand-ink` | `#1C2B35` | texto principal |
| `brand-bg` | `#F0F2F4` | fondo de la app |
| `brand-border` | `#E8EAED` | bordes |

Tipografía: **Inter** (Google Fonts) en toda la app — se migró desde una fuente vía CDN externo (`fonts.cdnfonts.com`) por caídas intermitentes que afectaban el layout.

Estados de equipo con badges de color fijos (`ESTADO_STYLES` en `constants.js`): verde=Disponible, ámbar=En Uso, violeta=En Mantenimiento, rosa=Fuera de Servicio, gris=De Baja.

---

## 8. Variables de entorno

`.env.local` (no versionado):
```
VITE_FIREBASE_CONFIG='{"apiKey":"...","authDomain":"...","projectId":"inventario-betrmedia-sas",...}'
```
Es la configuración web pública de Firebase (no es un secreto — Firebase la expone así por diseño; la seguridad real está en `firestore.rules`, no en ocultar este JSON). En Vercel se configura como variable de entorno del proyecto para el build de producción.

---

## 9. Scripts

```bash
npm run dev       # servidor de desarrollo (Vite)
npm run build     # build de producción -> dist/
npm run preview   # sirve el build de producción localmente
npm run lint      # ESLint, --max-warnings 0
npm run test      # vitest run (pruebas de utils/)
```
