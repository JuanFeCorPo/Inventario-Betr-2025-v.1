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
├── App.jsx                  # Enrutador raíz: auth y selección de pantalla
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
│   └── useDismissedAlerts.js  # Alertas descartadas (compartidas entre usuarios)
└── utils/                    # Lógica pura, sin React ni Firebase — todo testeado con Vitest
    ├── alerts.js               # Reglas de alertas del inventario
    ├── dismissedAlerts.js      # Cuándo reaparece una alerta descartada (15 días)
    ├── maintenance.js          # Cálculo de mantenimiento preventivo
    ├── duplicates.js           # Detección de serial/Nº inventario repetidos
    ├── loginLockout.js         # Bloqueo de login por intentos fallidos
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

### 3.2b `puestos/{id}` — puestos de trabajo y hoja de vida (F-MAN-02)

`{ nombre, area: 'Operaciones' | 'Administrativos', grupo?, grupoOrden?, personas: [{ nombre, correo }], correos: [...], observaciones, origen?, hojaOriginal?, createdAt, addedByEmail }`, con subcolección `historial/{entryId}`: `{ fecha, tipo: 'preventivo' | 'correctivo' | 'cambio' | 'novedad' | 'nota', descripcion, responsable, reporta?, equipoId?, reemplazaA?, retirado?: { equipoId, codigo, nombre, casilla }, timestamp, user }`. (`carpetaEvidencia` ya no se usa: el enlace de Drive por puesto se quitó.)

**Equipo de trabajo** (`grupo`, la carpeta de Drive: Optimización, Diseño…): la lista agrupa Área → equipo de trabajo → puesto (`agruparPuestos`). Si el puesto no lo tiene guardado, `grupoDe` lo saca de `hojaOriginal` ("1. Hoja de Vida - Equipos de Optimización/…" → Optimización, orden 1).

**Casillas F-MAN-02** (`CASILLAS` en `utils/puestos.js`): CPU/Portátil, Monitor, UPS, Teclado, Mouse, Celular, Audífonos, Accesorios. `casillaDe(equipo)` la deduce de la categoría (y del nombre para teclado/mouse); `equipo.casilla` la fija cuando se asigna a otra a mano. Agregar y reemplazar ofrecen solo equipos de esa casilla (primero los Disponibles). Lo que sale queda en el historial con `retirado` y se muestra tachado en su casilla (`retiradosDelPuesto`; para lo importado se lee el texto "Sale … (tachado en la hoja de vida)"). Las líneas "Audífonos: …" de Observaciones son componentes sin Nº.

**Trasladar** (`trasladarEquipo`): desde el puesto de origen, el equipo pasa a la misma casilla del destino en un solo lote. Agregar, reemplazar, retirar y trasladar devuelven una función **Deshacer** (restaura los campos del equipo y borra los registros creados en las hojas de los puestos; el historial del equipo conserva una nota "Se deshizo…").

Un equipo pertenece a un puesto con `equipo.puestoId`. La hoja de vida **no se guarda aparte**: `HojaDeVida.jsx` la arma con el puesto, sus equipos (`equiposDelPuesto`) y el historial. Identificación y hardware salen del equipo principal (CPU, o portátil si no hay CPU). Cada acción de `usePuestos` escribe en un solo `writeBatch` el equipo, su historial y el del puesto:
- **Agregar / reemplazar / retirar** componente: actualiza `puestoId` y `personaEncargada` (= nombre del puesto; al salir queda `Betrmedia`, el valor de stock). Un equipo `Disponible` que entra pasa a `En Uso`. Reemplazar equivale al "tachado" de la hoja de Excel.
- **Mantenimiento preventivo**: además actualiza `ultimoMantenimiento` del equipo principal (la pantalla de Mantenimientos queda al día).
- Renombrar un puesto actualiza `personaEncargada` de sus equipos.

`personas[].correo` (y su copia plana `correos`) servirá para que el Colaborador vea "Mi puesto".

**Hoja de vida de un equipo suelto (F-MAN-03).** Cámaras, micrófonos, trípodes, luces y cualquier otro equipo tienen su hoja en el detalle del equipo (`PreviewModal`): se arma con el equipo (incluida la casilla `accesorios`, "Adicionales o accesorios") y su subcolección `historial`. Los registros de hoja de vida llevan campos (`tipo`, `fecha`, `descripcion`, `responsable`, `reporta?`) además de `action`; los anteriores se reconocen por su texto (`entradasDeEquipo`). "Registrar" usa `useInventory.registrarEvento`.

**Descargas con el diseño exacto de los formatos.** `utils/hojaDeVida.js` arma los datos (`datosHojaPuesto`, `datosHojaEquipo`) y el PDF (`htmlHojaPuesto`, `htmlHojaEquipo`: la misma cuadrícula, colores del tema de las hojas #EA4335 / #666666 / #D41500, tachados en rojo). El Excel (`utils/hojaDeVidaExport.js`, ExcelJS cargado solo al descargar) llena las **plantillas reales** `public/plantillas/F-MAN-02.xlsx` y `F-MAN-03.xlsx` (logo, bordes, celdas combinadas); historial y novedades se reescriben copiando el estilo de la plantilla. Las plantillas se regeneran desde dos hojas reales con `node scripts/hojas-de-vida/crear-plantillas.mjs "<F-MAN-02>" "<F-MAN-03>"` (borra los datos). `DescargarHoja.jsx` y `hooks/useDescargasHoja.js` ponen los botones.

**Importación de las hojas de Excel (una sola vez).** Dos pasos:
1. `node scripts/hojas-de-vida/preparar-importacion.mjs "<carpeta>"` lee las hojas exportadas de Drive (con el tachado, vía `leer-hoja.mjs`) y `decisiones-importacion.xlsx`, y escribe `plan-importacion.json` en esa carpeta. La carpeta tiene datos personales: nunca entra al repo. F-MAN-02 de un puesto → puesto; F-MAN-02 de backup y F-MAN-03 → historial del equipo; tachado → componente que salió. Los cargadores de portátil no son equipos: su código va en la casilla `cargador` del portátil (`CATEGORIAS_CON_CARGADOR`); la importación la llena con lo que dicen sus Observaciones.
2. En la app, Puestos → **Importar hojas de vida** (Administrador) carga el plan, lo cruza con el inventario en vivo (`utils/importarHojas.js`: códigos repetidos o De Baja no se tocan, avisos) y lo escribe en lotes (`usePuestos.importarHojas`). Los puestos quedan con `origen: 'hoja-de-vida'` y el botón desaparece; los registros importados llevan `importado: true`.

### 3.2c `tickets/{id}` — solicitudes de soporte de los colaboradores

`{ codigo ('T-0311-4F2'), creadoPor: { uid, email, nombre }, categoria: 'equipo' | 'internet' | 'software' | 'cuentas' | 'impresora' | 'otro', urgencia: 'normal' | 'bloquea', puestoId?, puestoNombre, equipoId?, equipoNombre, equipoCodigo, descripcion, estado: 'recibido' | 'en_proceso' | 'resuelto', creadoAt (hora del servidor), actualizado, mensajes: [{ autor: 'ti' | 'colaborador', nombre, texto, fecha, resolucion? }], vistoPorTI, vistoPorColaborador, tomadoPor?, equipoEnMantenimiento?, solucion?, resueltoAt?, resueltoPor? }`.

- **Colaborador** (`ColaboradorScreen`, `useMiPuesto` / `useMisTickets`): ve sus puestos (su correo en `puestos.correos`, que T.I. escribe en Editar puesto) y los equipos de esos puestos, reporta (`ReportarModal`) y conversa en sus solicitudes.
- **T.I.** (`SolicitudesScreen`, `useTicketsTI`): bandeja con abiertas primero (las que impiden trabajar arriba). Tomar (opcional: el equipo pasa a En Mantenimiento), responder, resolver y reabrir. Al **resolver**, en un solo lote: la solicitud queda resuelta y, si se marca, la hoja de vida del puesto recibe una **Novedad** (el reporte, con quién lo hizo) y un **Correctivo** (la solución); el equipo recibe el correctivo en su historial y vuelve al estado elegido.
- **Archivos adjuntos** (PDF, JPG, PNG o WEBP; `utils/adjuntos.js`, `AdjuntosUI.jsx`, `useAdjuntos`): sin Firebase Storage (pide plan Blaze), cada archivo se guarda en base64 partido en documentos de ≤700 KB en `tickets/{id}/partes/{archivoId}_{n}` y el mensaje (o el ticket, si se adjunta al reportar) lleva solo su ficha `{ id, nombre, tipo, tamano, partes }` en `adjuntos`. Máximo **5 MB por mensaje en total** y 3 archivos; las fotos se reducen solas (máx. 1600 px, JPEG) antes de subirse. Los pedazos se escriben en el mismo lote que el mensaje (`escribirAdjuntos` en `useTickets`) y se leen bajo demanda con `leerAdjunto`. Las reglas dejan al colaborador subir y leer solo los de sus tickets (`getAfter`, porque el ticket puede crearse en el mismo lote). Si se activa Blaze, migrar a Storage cambiando solo `escribirAdjuntos` y `leerAdjunto`.
- **Reglas** (`firestore.rules`): el Colaborador solo lee los puestos con su correo, los equipos de esos puestos (consulta por `puestoId ==`) y sus propias solicitudes; crea solicitudes a su nombre (validadas: campos, categoría, hora del servidor, puesto propio) y solo puede agregar mensajes. Tomar/resolver es del Administrador (regla general).
- El botón **Solicitudes** del inventario muestra cuántas piden atención (`pendientesTI`: nuevas o con mensaje sin leer).

**Eliminar un puesto** (`eliminarPuesto`): no se borra; queda con `eliminado: true` (oculto, con su historial) y sus equipos salen (En Uso → Disponible, Encargado Betrmedia). Devuelve Deshacer.

**Archivar un puesto** (`archivarPuesto`, `reactivarPuesto`, `pasarAOtroPuesto`): es el "portátiles backup" de las hojas de Sheets y NO borra nada. El puesto queda con `archivado: true` (+ `archivadoAt`, `archivadoPor`, `archivadoMotivo`, `archivadoPersonas`), sale de `puestos` en `usePuestos` y aparece en `archivados` (filtro Archivados de Puestos, la hoja se abre y se descarga pero no se edita; solo "Volver a usar"). Sus equipos se quedan ligados a la hoja (`puestoId`), pasan de En Uso a Disponible, con Encargado Betrmedia y con `sinMantenimiento` + `sinMantenimientoPorArchivo` para que no pidan mantenimiento (al reactivar se quita solo lo que puso el archivo). `pasarAOtroPuesto` mueve en un solo lote equipos y personas elegidos de la hoja de origen a la de destino (`moverPersonas` actualiza `personas` y `correos` de los dos puestos) y deja "Sale…"/"Llega…" en las dos hojas; si se pide, archiva el origen. Las tres devuelven Deshacer. `useMiPuesto` no muestra al colaborador un puesto archivado.

### 3.3 `users/{uid}`

`{ email, nombre?, role: 'Administrador' | 'Lector' | 'Colaborador', active: boolean, createdAt?, history: [...] }`. El doc ID es el UID de Firebase Auth. Dos formas de llegar aquí:

- **Correo/contraseña (personal de T.I.):** la cuenta se crea en Firebase Auth (consola) y se registra manualmente desde `UsersScreen` con su UID.
- **Google Workspace (colaboradores):** la primera vez que alguien entra con "Continuar con Google" y su correo es `@betrmedia.com` (verificado), `App.jsx` crea su perfil como `Colaborador` activo. `firestore.rules` (`isValidSelfSignup`) solo permite exactamente eso: su propio UID, su propio correo, rol Colaborador. El dominio vive en `COMPANY_DOMAIN` (`src/utils/roles.js`) y en `isCompanyGoogleUser` (reglas): si cambia, cambiar ambos.

El Administrador cambia el rol de cualquiera desde `UsersScreen` (selector de 3 roles).

---

### 3.4 Navegación del personal de T.I.

`App.jsx` manda al Colaborador a `ColaboradorScreen` y al personal de T.I. a `StaffApp`, que pinta el marco `AppShell` (pestañas Inicio · Solicitudes · Puestos · Mantenimientos, Avisos y menú de cuenta con Usuarios) y la pantalla activa. `useResumenTI` calcula para el marco lo que pide atención (solicitudes sin atender, puestos con pendientes, mantenimientos vencidos y alertas del inventario). Inicio (`InventoryDashboard`) empieza con la franja **Hoy** (`HoyBand`) y sigue con el inventario.

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
- **Autorización de dos niveles:** estar autenticado en Firebase no basta — además debe existir un doc en `users/{uid}` con `active: true`. Roles: `Administrador` (todo), `Lector` (solo lectura + crear equipos) y `Colaborador` (cuenta de Google de la empresa; **no ve el inventario**: las reglas usan `isActiveStaff()` = Administrador o Lector para todo `artifacts/…`, historial y alertas). El Colaborador solo ve `ColaboradorScreen`, que será la puerta de "Mi puesto", reportes y solicitudes.
- **Login con Google:** `signInWithPopup` con `hd: betrmedia.com` (solo sugiere el dominio; el control real es `accessForUnregistered` en `utils/roles.js` y las reglas). El bloqueo por intentos fallidos aplica solo a correo/contraseña.
- **Bloqueo de login** (`utils/loginLockout.js`): 3 intentos fallidos → bloqueo de 1 hora, guardado en Firestore (`loginAttempts/{email}`, doc ID = correo normalizado) para que sea real y no se evada borrando el caché del navegador. El mensaje de error es siempre el mismo ("Email o contraseña incorrectos") sin importar la causa (contraseña mala, correo inexistente, cuenta bloqueada) — no revela información al atacante.
- **Sesión persistente** (`App.jsx`): el inicio de sesión usa `browserLocalPersistence`, así que sobrevive a recargar la página, cerrar la pestaña y reiniciar el navegador, y no hay cierre por inactividad: T.I. deja la app abierta todo el día para ver los tickets. La sesión termina solo con "Cerrar sesión" (o si T.I. desactiva el usuario). Antes: sesión de pestaña (`browserSessionPersistence`) y cierre a las 8 h sin actividad.

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

Tipografía: **IBM Plex Sans** en toda la app y **IBM Plex Mono** solo para códigos (Nº de inventario y serial). Se sirven desde el propio sitio con `@fontsource` (importadas en `src/main.jsx`: pesos 400/500/600/700 y 400/500/600, solo alfabeto latino), sin CDN externo: las fuentes externas (primero `fonts.cdnfonts.com`, luego Google Fonts) cambiaban el ancho del texto entre visitas y descuadraban el layout. Tablas con cifras de ancho fijo (`tabular-nums`).

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
