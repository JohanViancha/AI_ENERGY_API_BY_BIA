# SPEC 01 — Modelo de datos y fuentes de ingesta

> **Status:** Approved
> **Depends on:** ninguno
> **Date:** 2026-09-25
> **Objective:** Definir las entidades Meter, Reading, OperationalEvent, Analysis y Anomaly, su estructura en Firestore, el script de siembra idempotente desde CSV, y las queries de lectura mínimas que necesitarán el motor de detección de anomalías y la API REST.

---

## Por qué existe este spec

Este proyecto es hoy el andamiaje por defecto de NestJS: no existe `firebase-admin`, ni `FirebaseModule`, ni ninguna entidad. Antes de construir el motor de detección híbrida (spec futuro) o los endpoints de la API (spec futuro), hace falta una base de datos concreta y consultable. Este spec cubre exclusivamente esa base: modelo de datos, conexión a Firestore, siembra desde CSV y queries de lectura. No incluye detección, clasificación, explicación con IA, ni ningún endpoint HTTP.

---

## Scope

**In:**

- Instalación y configuración de `firebase-admin` y `@nestjs/config`.
- `FirebaseModule` / `FirebaseService`: inicializa el cliente de Firestore a partir de `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` y lo expone como provider inyectable.
- Entidades TypeScript: `Meter`, `Reading`, `OperationalEvent`, `Analysis`, `Anomaly`, con mappers explícitos camelCase (código) ↔ snake_case (documento Firestore).
- Colecciones raíz en Firestore: `meters`, `readings`, `events`, `analyses`, `anomalies`.
- Repositorios de solo lectura (`MetersRepository`, `ReadingsRepository`, `EventsRepository`, `AnalysesRepository`, `AnomaliesRepository`) con las queries mínimas que necesitan el motor de anomalías y la API.
- `scripts/seed.ts`: lee `readings.csv` y `events.csv` (ruta configurable), normaliza enums a mayúsculas, valida ausencia de duplicados `(meter_id, timestamp)`, deriva los medidores por `meter_id` distinto, y escribe las tres colecciones de forma idempotente.
- Documentación de los índices compuestos de Firestore que las queries requieren.
- Actualización de `README.md` con instrucciones de siembra y variables de entorno.

**Out of scope (para specs futuros):**

- Controllers, endpoints HTTP, DTOs y guards de `meters/`, `readings/`, `events/`, `anomalies/` (SPEC 03 — contrato de API).
- Cualquier operación de escritura vía API.
- El motor de detección híbrida (Z-score, IQR, calidad, correlación) y la escritura de documentos `analyses`/`anomalies` en tiempo de ejecución (spec futuro del motor).
- La capa de explicación con IA y el cálculo real de `reason`, `recommended_action`, `priority_score` (aunque los campos existen en el modelo desde este spec, se completan en un spec futuro).
- El chequeo de consistencia `anomalies_count === count(anomalies WHERE analysis_id = X)` (se modela el campo `error_code`, pero la verificación la implementa el motor).
- Metadata ficticia de medidores (`location`, `type`, `rated_capacity_kw`, etc.) — no existe en los datos entregados y no se inventa.

---

## Data model

Todas las interfaces van en camelCase en TypeScript. Los documentos en Firestore usan snake_case. Cada entidad expone `toFirestoreDoc` / `fromFirestoreDoc` para la conversión.

```ts
// src/meters/entities/meter.entity.ts
interface Meter {
  meterId: string; // también es el id del documento
}
// Firestore doc: { meter_id: string }
```

```ts
// src/readings/entities/reading.entity.ts
interface Reading {
  meterId: string;
  timestamp: string; // ISO 8601, granularidad horaria
  consumptionKwh: number;
  voltage: number;
  current: number;
  powerFactor: number;
  status: 'OK' | 'ESTIMATED' | 'INVALID'; // viene del CSV, normalizado a mayúsculas
}
// Firestore doc: { meter_id, timestamp, consumption_kwh, voltage, current, power_factor, status }
// doc id: `${meterId}_${unixTimestampSeconds}`
```

```ts
// src/events/entities/operational-event.entity.ts
interface OperationalEvent {
  meterId: string;
  eventTimestamp: string; // ISO 8601
  eventType: string; // normalizado a mayúsculas
  description: string;
  durationHours: number | null; // null cuando el CSV no lo trae; el motor infiere ventana por defecto
}
// Firestore doc: { meter_id, event_timestamp, event_type, description, duration_hours }
// doc id: sha1(`${meterId}|${eventTimestamp}|${eventType}`).slice(0, 16)
```

```ts
// src/anomalies/entities/analysis.entity.ts
interface Analysis {
  id: string; // id autogenerado por Firestore
  startedAt: string;
  finishedAt: string | null;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  errorCode: string | null; // p. ej. 'CONSISTENCY_MISMATCH'
  errorMessage: string | null;
  triggeredBy: 'MANUAL' | 'SCHEDULED'; // default 'MANUAL'
  metersAnalyzed: string[]; // meterIds incluidos en la corrida
  progress: {
    phase:
      | 'READINGS'
      | 'BASELINE'
      | 'DETECTION'
      | 'CORRELATION'
      | 'EVENTS'
      | 'EXPLANATION'
      | 'RECOMMENDATION';
    pct: number; // 0-100, progreso global del proceso completo
  };
  anomaliesCount: number; // solo sube
  highPriorityCount: number; // puede subir o bajar, recalculado por fase
}
// Firestore doc: { started_at, finished_at, status, error_code, error_message,
//                  triggered_by, meters_analyzed, progress: { phase, pct },
//                  anomalies_count, high_priority_count }
```

```ts
// src/anomalies/entities/anomaly.entity.ts
interface Anomaly {
  id: string; // id autogenerado por Firestore
  meterId: string;
  analysisId: string;
  detectedAt: string;
  type: 'REAL_ANOMALY' | 'EXPLAINABLE_ANOMALY' | 'FALSE_POSITIVE' | 'DATA_QUALITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number; // 0.0 - 1.0
  priorityScore: number; // severityWeight(severity) * confidence, calculado en fase RECOMMENDATION
  status: 'OPEN' | 'REVIEWED' | 'RESOLVED'; // default 'OPEN'; transiciones fuera del MVP
  reason: string | null; // lo completa el explainer (spec futuro)
  recommendedAction: string | null; // lo completa el explainer (spec futuro)
  evidence: {
    baselineKwh: number;
    observedKwh: number;
    variationPct: number;
    signals: string[]; // detectores que dispararon, p. ej. ['SPIKE', 'QUALITY']
    windowStart: string;
    windowEnd: string;
    relatedEvents: string[]; // ids de documentos en `events`
    detectorScores: Record<string, number>; // p. ej. { SPIKE: 3.2, OUTLIER: 1.1 }
  };
}
// Firestore doc: { meter_id, analysis_id, detected_at, type, severity, confidence,
//                  priority_score, status, reason, recommended_action,
//                  evidence: { baseline_kwh, observed_kwh, variation_pct, signals,
//                              window_start, window_end, related_events, detector_scores } }
```

**Reglas de correlación con eventos (contrato del motor, documentadas aquí porque afectan al modelo):**

- El motor debe **excluir** eventos con `event_type IN ('UNKNOWN', 'DATA_QUALITY')` al correlacionar anomalías. `UNKNOWN` significa "sin evento explicativo" (M-109); `DATA_QUALITY` es corroboración de un problema de sensor (M-112), no explicación de un cambio.
- `durationHours === null` → el motor usa ventana por defecto `±24h` alrededor de `eventTimestamp` para correlacionar.

**Reglas de asignación de `severity` (las aplica el motor futuro, se documentan aquí porque son parte del contrato de datos):**

- `HIGH` → variación > 100% sin evento explicativo, o problema de calidad de datos severo.
- `MEDIUM` → variación entre 30% y 100%, o evento que explica parcialmente.
- `LOW` → variación < 30%, o completamente explicada por un evento.

`severityWeight`: `HIGH = 3`, `MEDIUM = 2`, `LOW = 1`. `priorityScore = severityWeight × confidence`.

**Sobre `anomaly: boolean` del PDF sección 10:**

El JSON de salida del motor en el PDF incluye `"anomaly": true`. Esta entidad **no incluye ese campo** porque es redundante: la existencia de un documento `Anomaly` implica `anomaly = true`. Si existe la anomalía, se devuelve; si no existe, no hay documento que devolver. El contrato HTTP que exponga `GET /anomalies/:id` puede añadir `anomaly: true` en la respuesta si el evaluador lo exige, pero no es un campo persistido. Decisión documentada para evitar ambigüedad.

**Queries mínimas de lectura (repositorios):**

- `MetersRepository.listAll(): Meter[]`
- `ReadingsRepository.findByMeterAndRange(meterId, from, to): Reading[]` — ordenado por `timestamp` asc.
- `EventsRepository.findByMeterAndRange(meterId, from, to): OperationalEvent[]` — filtra por `meter_id == meterId` y ordena por `event_timestamp` asc.
- `AnalysesRepository.findById(analysisId): Analysis | null`
- `AnomaliesRepository.findByAnalysisId(analysisId): Anomaly[]` — ordenado por `priority_score` desc.
- `AnomaliesRepository.findByMeter(meterId): Anomaly[]` — ordenado por `detected_at` desc.

**Índices compuestos requeridos en Firestore:**

- `readings(meter_id, timestamp)`
- `events(meter_id, event_timestamp)`
- `anomalies(analysis_id, priority_score desc)`
- `anomalies(meter_id, detected_at desc)`

---

## Implementation plan

1. Instalar `firebase-admin` y `@nestjs/config`. Añadir `ConfigModule.forRoot({ isGlobal: true })` en `src/app.module.ts`. Sistema sigue arrancando igual que antes.
2. Crear `src/firebase/firebase.service.ts` (inicializa `admin.initializeApp` con las 3 env vars vía `ConfigService`, expone la instancia de Firestore) y `src/firebase/firebase.module.ts`. Test manual: `npm run start:dev` arranca sin lanzar excepción con un `.env` válido.
3. Crear las entidades y sus mappers: `src/meters/entities/meter.entity.ts`, `src/readings/entities/reading.entity.ts`, `src/events/entities/operational-event.entity.ts`, `src/anomalies/entities/analysis.entity.ts`, `src/anomalies/entities/anomaly.entity.ts`. Unit tests de los mappers (camelCase ↔ snake_case) sin tocar Firestore.
4. Crear `MetersRepository` + `MetersModule`, `ReadingsRepository` + `ReadingsModule`, `EventsRepository` + `EventsModule`, con las queries de lectura listadas arriba. Unit tests con el cliente de Firestore mockeado.
5. Crear `AnalysesRepository` y `AnomaliesRepository` + `AnomaliesModule` (agrupa ambas entidades) con sus queries de lectura. Unit tests con Firestore mockeado.
6. Registrar `MetersModule`, `ReadingsModule`, `EventsModule`, `AnomaliesModule` y `FirebaseModule` en `src/app.module.ts`. `npm run build` compila sin errores.
7. Crear `scripts/seed.ts`: parsea `--readings=`/`--events=` (o `SEED_READINGS_PATH`/`SEED_EVENTS_PATH`), default `data/readings.csv` y `data/events.csv`; parsea el CSV; **valida que no haya duplicados `(meter_id, timestamp)` en `readings.csv` y falla con error claro si los hay**; normaliza `status`/`event_type` a mayúsculas; deriva `meters` por `meter_id` distinto en `readings.csv`; asigna `duration_hours = null` (el CSV no lo trae); escribe `meters`, `readings`, `events` con los doc ids deterministas definidos en el modelo de datos vía `.set()` (upsert idempotente). Añadir script `"seed"` en `package.json`.
8. Documentar los 4 índices compuestos en `firestore.indexes.json` en la raíz del repo.
9. Actualizar `README.md` (dónde van los CSVs, cómo overridear la ruta, cómo correr `npm run seed`) y verificar que `.env.example` ya documenta las 3 variables de Firebase.

---

## Acceptance criteria

- [ ] `npm run build` compila sin errores.
- [ ] `npm test` pasa, cubriendo los mappers de entidades y los repositorios (Firestore mockeado).
- [ ] `FirebaseModule` inicializa sin lanzar excepción cuando las 3 env vars de Firebase están presentes; `npm run start:dev` arranca correctamente.
- [ ] Ejecutar `npm run seed` dos veces seguidas contra el mismo proyecto de Firestore produce el mismo número de documentos en `meters`, `readings` y `events` (idempotencia verificada).
- [ ] El seed **falla con error claro** si `readings.csv` contiene duplicados `(meter_id, timestamp)`.
- [ ] La colección `meters` contiene exactamente los `meter_id` distintos presentes en `readings.csv`, ni uno más ni uno menos.
- [ ] Todos los valores de enum (`status`, `event_type`) quedan en mayúsculas en Firestore, sin importar el casing del CSV de origen.
- [ ] `ReadingsRepository.findByMeterAndRange`, `EventsRepository.findByMeterAndRange`, `AnalysesRepository.findById`, `AnomaliesRepository.findByAnalysisId`, `AnomaliesRepository.findByMeter` y `MetersRepository.listAll` están implementados y probados.
- [ ] Los 4 índices compuestos están documentados en `firestore.indexes.json`.
- [ ] `README.md` documenta las env vars de Firebase, la ubicación por defecto de los CSVs y cómo overridear la ruta.
- [ ] No se agregó ningún controller, DTO ni guard en este spec.

---

## Decisions

- **Sí:** dividir la funcionalidad original ("detección híbrida con clasificación, explicación y recomendación") en varios specs — este (modelo de datos), uno futuro para el motor de detección, y otro para la API. Razón: tocaba más de 3 dominios grandes a la vez.
- **Sí:** `Meter` solo tiene `meterId`, sin `location`/`type`/`rated_capacity_kw`. Razón: esos datos no existen en el dataset entregado; inventarlos se ve amateur en la demo.
- **Sí:** los medidores se derivan de `SELECT DISTINCT meter_id` sobre `readings.csv` en el seed, no de un `meters.csv` ni de una lista hardcodeada. Razón: frágil si el dataset cambia.
- **Sí:** colecciones raíz (`meters`, `readings`, `events`, `analyses`, `anomalies`) en vez de subcolecciones bajo `meters/{id}`. Razón: las queries cross-meter (dashboard, `WHERE analysis_id = X`) son directas, sin `collectionGroup`.
- **Sí:** documentos en Firestore en snake_case, código TypeScript en camelCase, con mappers explícitos por entidad. Razón: coincide con la convención global del proyecto (BD en snake_case) sin sacrificar el estilo idiomático de TS.
- **Sí:** `Analysis` y `Anomaly` viven en `src/anomalies/`, no en `src/ai/`. Razón: en este spec son solo modelo + lectura; `src/ai/` queda reservado para el motor y el explainer reales.
- **Sí:** los contadores `anomaliesCount`/`highPriorityCount` se actualizan atómicamente por fase del pipeline (~7 escrituras por corrida), no por anomalía ni por query agregada. Razón: cuota de Firestore y el frontend se suscribe a un solo documento, no a la colección completa.
- **Sí:** `priorityScore` se persiste en el documento `Anomaly`. Razón: Firestore no puede hacer `orderBy` sobre una expresión calculada.
- **Sí:** `Anomaly.status` (`OPEN` | `REVIEWED` | `RESOLVED`) se incluye en el modelo con default `OPEN`. Razón: el PDF sección 16 lo lista explícitamente. Las transiciones no se implementan en el MVP; el motor siempre escribe `OPEN`.
- **Sí:** `durationHours: number | null` en `OperationalEvent`. Razón: el CSV no trae el campo; el motor infiere ventana por defecto (`±24h`) cuando es `null`. Evita inventar un valor.
- **Sí:** `source` no existe en el CSV entregado y se elimina del modelo. Razón: no hay dato que poblar; agregarlo obligaría a inventar un valor constante que no aporta.
- **Sí:** el doc id de `events` usa `sha1(meterId|eventTimestamp|eventType)` sin `source`. Razón: `source` no existe y no aporta entropía al hash. `slice(0, 16)` da 64 bits de entropía, suficiente para este volumen.
- **Sí:** el seed valida duplicados `(meter_id, timestamp)` en `readings.csv` y falla con error claro. Razón: el doc id determinista haría upsert silencioso, perdiendo una lectura sin avisar.
- **Sí:** la ruta de los CSVs es configurable por argumento/env var con default en `data/`. Razón: el evaluador puede pasar los archivos desde otra ubicación; evitar rutas absolutas hardcodeadas.
- **No:** implementar aquí el chequeo de consistencia `anomalies_count === count(anomalies)`. Razón: es responsabilidad del motor de detección (spec futuro); este spec solo modela el campo `error_code` para soportarlo.
- **No:** incluir `anomaly: boolean` como campo persistido en `Anomaly`. Razón: redundante con la existencia del documento. Se documenta explícitamente en "Data model".

---

## Risks

| Riesgo                                                                 | Mitigación                                                                                   |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Las queries fallan por falta de índice compuesto en Firestore           | Índices documentados en `firestore.indexes.json`, desplegables con `firebase deploy --only firestore:indexes`. |
| Colisión de doc id en `events` si dos eventos comparten meter+timestamp+type | Baja probabilidad con datos horarios; el seed sobrescribe (idempotente) en vez de duplicar o fallar. |
| CSVs de origen ausentes o con columnas distintas a las asumidas         | El seed falla con un mensaje claro si faltan columnas esperadas, no silenciosamente.     |
| CSVs con duplicados `(meter_id, timestamp)` sobrescriben silenciosamente | El seed valida duplicados antes de escribir y falla con error claro indicando las filas conflictivas. |
| Eventos con `event_type = UNKNOWN` tratados como eventos explicativos   | Regla de correlación documentada en "Data model": el motor excluye `UNKNOWN` y `DATA_QUALITY`. |

---

## What is **not** in this spec

- Controllers, endpoints HTTP, DTOs y guards (SPEC 03 — contrato de API).
- El motor de detección híbrida y la escritura real de `analyses`/`anomalies` en tiempo de ejecución.
- La capa de explicación con IA (`reason`, `recommended_action` reales, integración con OpenAI).
- El chequeo de consistencia de contadores al finalizar una corrida.
- Cualquier metadata de medidor no presente en el dataset entregado.

Cada uno de estos, si se construye, va en su propio spec.