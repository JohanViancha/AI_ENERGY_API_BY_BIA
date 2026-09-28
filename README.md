# AI Energy Management Platform — Backend

API REST para la gestión de medidores eléctricos, detección de anomalías asistida por IA, priorización y recomendación de acciones.

Construido con **NestJS + TypeScript + Firebase (Firestore + Auth)**.

---

## 📋 Tabla de contenidos

- [Descripción](#-descripción)
- [Stack tecnológico](#-stack-tecnológico)
- [Arquitectura](#-arquitectura)
- [Requisitos previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Variables de entorno](#-variables-de-entorno)
- [Scripts disponibles](#-scripts-disponibles)
- [Seed de datos](#-seed-de-datos)
- [API Endpoints](#-api-endpoints)
- [Motor de anomalías](#-motor-de-anomalías)
- [Testing](#-testing)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Despliegue](#-despliegue)
- [Decisiones técnicas](#-decisiones-técnicas)

---

## 🎯 Descripción

Este backend expone la API que consume el frontend de la plataforma. Sus responsabilidades:

1. **Gestión de medidores** — CRUD y consultas de los 12 medidores eléctricos.
2. **Lecturas** — series temporales de consumo, voltaje, corriente y factor de potencia.
3. **Motor de anomalías** — detección híbrida (Z-score, IQR, reglas de calidad, correlación con eventos).
4. **Capa de IA** — explicación, priorización y recomendación de acciones sobre anomalías detectadas.
5. **Dashboard** — agregaciones para KPIs del panel principal.

El flujo end-to-end es: **DATOS → ANÁLISIS → ANOMALÍA → EXPLICACIÓN → PRIORIZACIÓN → ACCIÓN**.

---

## 🛠 Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | NestJS 10+ |
| Lenguaje | TypeScript 5+ |
| Base de datos | Firebase Firestore |
| Autenticación | Firebase Auth (verificación con `firebase-admin`) |
| Validación | class-validator + class-transformer |
| Documentación | Swagger (`@nestjs/swagger`) |
| Testing | Jest + Supertest |
| Runtime | Node.js 20 LTS |

---

## 🏗 Arquitectura
┌─────────────┐ ┌──────────────────┐ ┌──────────────┐
│ React SPA │─────▶│ NestJS API │─────▶│ Firestore │
│ (Frontend) │ │ (Backend) │ │ + Auth │
└─────────────┘ └──────────────────┘ └──────────────┘
│
▼
┌──────────────┐
│ Anomaly │
│ Engine │
│ + AI Layer │
└──────────────┘


### Módulos principales

- `MetersModule` — gestión de medidores
- `ReadingsModule` — lecturas por medidor
- `EventsModule` — eventos operativos conocidos
- `AnomaliesModule` — consulta de anomalías detectadas
- `AiModule` — motor de detección + capa de explicación
- `DashboardModule` — agregaciones y KPIs
- `FirebaseModule` — configuración global de `firebase-admin`
- `AuthModule` — guard de autenticación con Firebase

---

## ✅ Requisitos previos

- Node.js 20 LTS
- npm 10+ (o pnpm/yarn)
- Cuenta de Firebase con un proyecto creado
- Firestore habilitado en modo producción
- Firebase Authentication habilitado (proveedor Email/Password)
- Cuenta de servicio (`serviceAccountKey.json`) descargada desde Firebase Console

---

## 📦 Instalación

```bash
# 1. Clonar repositorio
git clone <URL_DEL_REPO>
cd ai-energy-management/backend

# 2. Instalar dependencias
npm install

# 3. Copiar plantilla de variables de entorno
cp .env.example .env

# 4. Editar .env con tus credenciales (ver siguiente sección)

# 5. Levantar en modo desarrollo
npm run start:dev
```

---

## 🔑 Variables de entorno

Copia `.env.example` a `.env` y completa los valores (ver `.env.example` para la lista completa, sin valores reales).

| Variable | Descripción | Usada por |
|---|---|---|
| `PORT` | Puerto en el que arranca el servidor HTTP. | `src/main.ts` |
| `NODE_ENV` | Entorno de ejecución (`development`, `production`, etc.). | Convención estándar de Node; no leída por código propio todavía. |
| `FIREBASE_PROJECT_ID` | ID del proyecto de Firebase. | `FirebaseService` (inicialización de `firebase-admin`). |
| `FIREBASE_CLIENT_EMAIL` | Email de la cuenta de servicio de Firebase. | `FirebaseService`. |
| `FIREBASE_PRIVATE_KEY` | Private key de la cuenta de servicio. | `FirebaseService`. |
| `CORS_ORIGIN` | Origen permitido para CORS. | Reservada — CORS aún no se configura en el código (spec futuro). |
| `OPENAI_API_KEY` | API key de OpenAI. | Reservada para la capa de IA (spec futuro); no usada todavía. |

**Formato de `FIREBASE_PRIVATE_KEY`:** el JSON del service account trae la clave con saltos de línea reales. Al copiarla a `.env` debe ir en una sola línea, entre comillas dobles, con los saltos de línea como `\n` literales:

```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
```

---

## 📜 Scripts disponibles

| Script | Comando | Descripción |
|---|---|---|
| `start` | `npm run start` | Arranca el servidor (sin watch). |
| `start:dev` | `npm run start:dev` | Arranca el servidor en modo watch. |
| `start:debug` | `npm run start:debug` | Arranca en modo watch con el debugger de Node. |
| `start:prod` | `npm run start:prod` | Arranca el build compilado (`dist/main.js`). |
| `build` | `npm run build` | Compila el proyecto (`nest build`). |
| `lint` | `npm run lint` | ESLint con `--fix` sobre `src`, `apps`, `libs`, `test`. |
| `format` | `npm run format` | Prettier sobre `src/**/*.ts` y `test/**/*.ts`. |
| `test` | `npm test` | Tests unitarios (Jest). |
| `test:watch` | `npm run test:watch` | Tests unitarios en modo watch. |
| `test:cov` | `npm run test:cov` | Tests unitarios con reporte de cobertura. |
| `test:e2e` | `npm run test:e2e` | Tests end-to-end (`test/*.e2e-spec.ts`). |
| `seed` | `npm run seed` | Siembra `meters`, `readings` y `events` en Firestore desde CSV. Ver [Seed de datos](#-seed-de-datos). |
| `analyze` | `npm run analyze` | Dispara manualmente el motor híbrido de detección de anomalías. Ver [Motor de anomalías](#-motor-de-anomalías). |

---

## 🌱 Seed de datos

`scripts/seed.ts` lee dos CSV (`readings.csv` y `events.csv`), deriva los medidores a partir de los `meter_id` distintos en `readings.csv`, y escribe `meters`, `readings` y `events` en Firestore de forma idempotente: usa `.set()` con ids deterministas, así que correr el seed varias veces no duplica documentos.

### Ubicación de los CSVs

Por defecto el seed busca:

- `data/readings.csv`
- `data/events.csv`

### Formato esperado

`readings.csv` (columnas requeridas):

```
meter_id,timestamp,consumption_kwh,voltage,current,power_factor,status
```

`events.csv` (columnas requeridas):

```
meter_id,event_timestamp,event_type,description
```

`status` y `event_type` se normalizan a mayúsculas automáticamente sin importar el casing del CSV de origen. `duration_hours` no viene en `events.csv`; el seed siempre lo escribe como `null` (el motor de detección infiere una ventana por defecto de `±24h` cuando es `null`).

### Ejecutar el seed

```bash
npm run seed
```

### Overridear la ruta de los CSVs

Por argumento:

```bash
npm run seed -- --readings=ruta/a/mis-readings.csv --events=ruta/a/mis-events.csv
```

O por variable de entorno:

```bash
SEED_READINGS_PATH=ruta/a/mis-readings.csv SEED_EVENTS_PATH=ruta/a/mis-events.csv npm run seed
```

### Validaciones

El seed falla con un error claro si:

- el archivo CSV no existe;
- le faltan columnas esperadas;
- `readings.csv` contiene filas duplicadas para el mismo `(meter_id, timestamp)`.

---

## 🧠 Motor de anomalías

`scripts/analyze.ts` dispara manualmente el motor híbrido de detección de anomalías (`AnomalyEngineService.runAnalysis`) sobre las lecturas y eventos ya sembrados en Firestore. Orquesta 7 fases (`READINGS → BASELINE → DETECTION → CORRELATION → EVENTS → EXPLANATION → RECOMMENDATION`), corre 5 detectores independientes (`Z_SCORE`, `IQR_OUTLIER`, `DATA_QUALITY`, `ELECTRICAL_RELATION`, `HOURLY_PATTERN`), agrupa lecturas anómalas contiguas en tramos, clasifica tipo/severidad, calcula `confidence`/`priorityScore`, genera `reason`/`recommendedAction` por plantillas determinísticas (sin IA generativa todavía) y persiste los documentos `Anomaly` resultantes, dejando el `Analysis` en `status = 'COMPLETED'` (o `'FAILED'` si alguna fase lanza error).

No expone ningún endpoint HTTP: el script es el único disparador de esta corrida (el contrato de API llega en un spec futuro).

### Ejecutar el análisis

```bash
npm run analyze
```

Sin flags, analiza todos los medidores (`MetersRepository.listAll()`) sobre el rango completo de lecturas disponibles, con `gapHours = 4`.

### Flags disponibles

| Flag | Formato | Default | Descripción |
|---|---|---|---|
| `--meters` | `--meters=M-101,M-102` | todos los medidores | Lista de `meterId` a analizar, separados por coma. |
| `--from` | `--from=2026-09-01` | `min(timestamp)` de las lecturas del medidor | Fecha ISO de inicio de la ventana de análisis. |
| `--to` | `--to=2026-09-14` | `max(timestamp)` de las lecturas del medidor | Fecha ISO de fin de la ventana de análisis. |
| `--windowDays` | `--windowDays=7` | — | Alternativa a `--from`/`--to`: últimos N días desde el máximo timestamp disponible. |
| `--gapHours` | `--gapHours=4` | `4` | Separación máxima (en horas) entre lecturas anómalas consecutivas para seguir en el mismo tramo. |

Ejemplo con varios flags:

```bash
npm run analyze -- --meters=M-109,M-112 --windowDays=14 --gapHours=6
```

Al finalizar imprime un resumen (`analysisId`, `status`, `anomaliesCount`, `highPriorityCount`, duración en ms) y termina con código `0` si `status = 'COMPLETED'` o `1` si `status = 'FAILED'`.

---

## 📦 Estructura del proyecto

```
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── firebase/
│   │   ├── firebase.module.ts
│   │   └── firebase.service.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.guard.ts
│   │   └── auth.decorator.ts
│   ├── meters/
│   │   ├── meters.module.ts
│   │   ├── meters.controller.ts
│   │   ├── meters.service.ts
│   │   └── dto/
│   ├── readings/
│   ├── events/
│   ├── anomalies/
│   ├── ai/
│   │   ├── ai.module.ts
│   │   ├── ai.controller.ts
│   │   ├── ai.service.ts
│   │   ├── engine/
│   │   │   ├── baseline.calculator.ts
│   │   │   ├── spike.detector.ts
│   │   │   ├── outlier.detector.ts
│   │   │   ├── quality.detector.ts
│   │   │   ├── correlation.analyzer.ts
│   │   │   └── classifier.ts
│   │   └── explainer/
│   │       ├── template.explainer.ts
│   │       └── llm.explainer.ts
│   ├── dashboard/
│   └── common/
│       ├── filters/
│       ├── interceptors/
│       └── pipes/
├── scripts/
│   └── seed.ts
├── test/
│   └── anomaly-engine.e2e-spec.ts
├── data/                  
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```