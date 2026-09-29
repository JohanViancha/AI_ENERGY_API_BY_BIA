# SPEC 03 — Contrato de API HTTP

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-09-28
> **Objective:** Exponer 8 endpoints HTTP de solo lectura (más el disparo del motor) sobre los repositorios de SPEC 01 y el motor de SPEC 02, protegidos con Firebase Auth, validados con DTOs, documentados en Swagger y con manejo de errores HTTP consistente.

---

## Por qué existe este spec

SPEC 01 y SPEC 02 dejaron explícitamente fuera "cualquier controller, endpoint HTTP, DTO o guard". Este spec construye esa capa: controllers NestJS delgados que consumen los repositorios de SPEC 01 y el `AnomalyEngineService` de SPEC 02, sin duplicar su lógica. También reabre — de forma consciente y acotada — una decisión que SPEC 02 había diferido: incluir un endpoint de KPIs agregados (`GET /dashboard/summary`), limitado a la última corrida `COMPLETED` (no histórico cross-corridas, eso sigue fuera de scope).

Este spec también requiere un ajuste quirúrgico y aditivo a `AnomalyEngineService` (SPEC 02): un nuevo método `startAnalysis` que expone el `analysisId` antes de que termine la corrida, necesario para que `POST /ai/analyze` responda `202` de inmediato en vez de esperar minutos. El método `runAnalysis` existente (usado por `scripts/analyze.ts`) no cambia.

---

## Scope

**In:**

- `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) registrado en `src/main.ts`.
- `src/common/filters/http-exception.filter.ts`: filtro global que unifica la forma de todo error HTTP (`400`/`401`/`404`/`500`) y nunca expone stack traces ni mensajes internos crudos en `500`.
- `src/auth/firebase-auth.guard.ts` + `src/auth/auth.module.ts`: guard que verifica `Authorization: Bearer <idToken>` con `firebase-admin` (`admin.auth().verifyIdToken`). `401` si el header falta o el token es inválido/expirado.
- CORS configurado en `src/main.ts` leyendo `CORS_ORIGIN` (ya documentada en `.env.example` desde SPEC 01) vía `ConfigService`.
- Swagger (`@nestjs/swagger`) montado en `/docs`, con DTOs decorados (`@ApiProperty`) y controllers decorados (`@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse` por cada status code que el endpoint puede devolver).
- 8 endpoints, todos protegidos por `FirebaseAuthGuard`:
  1. `GET /meters` — proyección mínima por medidor (lista).
  2. `GET /meters/:meterId` — proyección completa de un medidor. `404` si no existe.
  3. `GET /meters/:meterId/readings` — lecturas paginadas (cursor + rango obligatorio). `404` si el medidor no existe.
  4. `GET /anomalies` — lista filtrable (`analysisId` requerido; `meterId`, `severity`, `type` opcionales).
  5. `GET /anomalies/:id` — detalle con evidencia completa. `404` si no existe.
  6. `POST /ai/analyze` — dispara el motor en background, responde `202` con el `analysisId` de inmediato.
  7. `GET /ai/analysis/:id` — estado/resultado de una corrida (`progress`, `status`). `404` si no existe.
  8. `GET /dashboard/summary` — KPIs de la última corrida `COMPLETED` (`200` con contadores en `0` si nunca corrió ninguna).
- Métodos nuevos, aditivos, en los repositorios de SPEC 01 (sin nuevas colecciones ni campos en Firestore):
  - `MetersRepository.findById(meterId)`
  - `ReadingsRepository.findLatestByMeter(meterId)`
  - `ReadingsRepository.countByMeter(meterId)`
  - `ReadingsRepository.findByMeterPaginated(meterId, from, to, limit, cursor)`
  - `AnomaliesRepository.findById(id)`
  - `AnalysesRepository.findLatestCompleted()`
  - `AnalysesRepository.findLatestByMeter(meterId)`
- `AnomalyEngineService.startAnalysis(params): Promise<string>` nuevo en `src/ai/engine/anomaly-engine.service.ts` (SPEC 02), en paralelo a `runAnalysis` existente.
- Módulos nuevos: `src/dashboard/` (module + controller + service), `src/auth/` (module + guard), `src/common/filters/`.
- Nuevo índice compuesto en `firestore.indexes.json`: `analyses(meters_analyzed array-contains, started_at desc)`.
- Registro de `AuthModule`, `DashboardModule` y los controllers nuevos en `src/app.module.ts`.
- Actualización de `README.md`: sección real "API Endpoints" (hoy es un link roto en la tabla de contenidos) documentando los 8 endpoints, el header `Authorization`, y la URL de Swagger.

**Out of scope (para specs futuros):**

- Cualquier endpoint de escritura sobre `meters`, `readings` o `events` (el dataset se siembra vía `scripts/seed.ts`, no vía API).
- Transiciones de `Anomaly.status` (`OPEN → REVIEWED → RESOLVED`) vía API.
- Roles/permisos granulares (RBAC) — el guard solo valida que el token sea válido, no diferencia roles.
- WebSockets/SSE para progreso en tiempo real de `POST /ai/analyze` — el cliente hace polling a `GET /ai/analysis/:id`.
- Dashboard histórico cross-corridas (tendencias, comparación entre `Analysis` distintos) — `GET /dashboard/summary` solo resume la última corrida `COMPLETED`.
- Paginación en `GET /anomalies` o `GET /meters` — solo `GET /meters/:meterId/readings` pagina.
- Rate limiting / throttling.
- Tests E2E contra Firestore real (se mockea igual que en SPEC 01/02; la verificación real es manual).
- Caché de tokens verificados por `firebase-admin`.

---

## Data model

Este spec no introduce colecciones ni campos nuevos en Firestore. Introduce DTOs de entrada (validados con `class-validator`) e interfaces de respuesta HTTP, todas **en memoria, no persistidas**:

```ts
// src/ai/dto/run-analysis.dto.ts
class RunAnalysisDto {
  meterIds?: string[];
  from?: string; // ISO 8601
  to?: string; // ISO 8601
  windowDays?: number; // entero positivo
  gapHours?: number; // número positivo
}
```

```ts
// src/anomalies/dto/list-anomalies-query.dto.ts
class ListAnomaliesQueryDto {
  analysisId: string; // requerido
  meterId?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  type?: 'REAL_ANOMALY' | 'EXPLAINABLE_ANOMALY' | 'FALSE_POSITIVE' | 'DATA_QUALITY';
}
```

```ts
// src/readings/dto/list-readings-query.dto.ts
class ListReadingsQueryDto {
  from: string; // requerido, ISO 8601
  to: string; // requerido, ISO 8601
  limit?: number; // default 100, máximo 500
  cursor?: string; // timestamp ISO de la última lectura de la página anterior
}
```

```ts
// respuestas HTTP (no persistidas)
interface MeterSummary {
  meterId: string;
  lastReadingAt: string | null;
  lastConsumptionKwh: number | null;
  openAnomaliesCount: number;
  highSeverityOpenCount: number;
}
interface MeterDetail extends MeterSummary {
  totalReadingsCount: number;
  lastAnalysisId: string | null;
  anomaliesByType: Record<string, number>;
}
interface PaginatedReadings {
  data: Reading[];
  nextCursor: string | null;
}
interface StartAnalysisResponse {
  analysisId: string;
  status: 'RUNNING';
}
interface DashboardSummary {
  analysisId: string | null; // null si nunca corrió una COMPLETED
  finishedAt: string | null;
  anomaliesCount: number;
  bySeverity: { HIGH: number; MEDIUM: number; LOW: number };
  byType: Record<string, number>;
  avgConfidence: number | null;
}
interface HttpErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}
```

---

## Implementation plan

1. Instalar `class-validator`, `class-transformer`, `@nestjs/swagger`. Registrar `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) en `src/main.ts`. `npm run build`/`start:dev` siguen funcionando igual.
2. Crear `src/common/filters/http-exception.filter.ts` (unifica `HttpErrorResponse` para `HttpException` y errores no controlados) y registrarlo global (`app.useGlobalFilters`). Unit tests: `HttpException` conocida y `Error` genérico (verifica que el mensaje de un error no controlado nunca se filtra tal cual, sino como "Internal server error").
3. Crear `src/auth/firebase-auth.guard.ts` + `src/auth/auth.module.ts`: verifica `Authorization: Bearer <token>` con `firebase-admin`. Unit tests con `FirebaseService`/`firebase-admin` mockeado: token válido pasa, header ausente o token inválido → `401`.
4. Configurar CORS en `src/main.ts` leyendo `CORS_ORIGIN` vía `ConfigService`. Sin test automatizado (limitación del navegador); se documenta en README.
5. Extender `AnomaliesRepository` con `findById(id): Promise<Anomaly | null>`. Unit test (encontrado / no encontrado).
6. Extender `MetersRepository` con `findById(meterId): Promise<Meter | null>`. Unit test.
7. Extender `ReadingsRepository` con `findLatestByMeter(meterId)`, `countByMeter(meterId)` y `findByMeterPaginated(meterId, from, to, limit, cursor)`. Unit tests, incluyendo el caso de página intermedia (`nextCursor` no nulo) y última página (`nextCursor: null`).
8. Extender `AnalysesRepository` con `findLatestCompleted()` y `findLatestByMeter(meterId)` (`where('meters_analyzed', 'array-contains', meterId)`, `orderBy('started_at', 'desc')`, `limit(1)`). Documentar el nuevo índice compuesto en `firestore.indexes.json`. Unit tests con Firestore mockeado.
9. Agregar `AnomalyEngineService.startAnalysis(params): Promise<string>`: crea el `Analysis` igual que `runAnalysis`, dispara la ejecución de fases sin esperar (mismo manejo de error que hoy: si falla, llama `finish(id, 'FAILED', errorCode, errorMessage)`), devuelve el `analysisId` de inmediato. `runAnalysis` no se modifica. Unit test verificando que la promesa resuelve con el id antes de que las fases terminen, y que un fallo en background también deja el `Analysis` en `FAILED`.
10. Crear `src/anomalies/dto/list-anomalies-query.dto.ts` y `src/anomalies/anomalies.controller.ts`: `GET /anomalies` (Firestore filtra `analysisId`+`meterId`; `severity`/`type` se filtran en memoria sobre el resultado) y `GET /anomalies/:id` (`404` si no existe). Protegidos por `FirebaseAuthGuard`. Unit tests del controller con `AnomaliesRepository` mockeado.
11. Crear `src/ai/dto/run-analysis.dto.ts` y `src/ai/ai.controller.ts`: `POST /ai/analyze` (`202` + `StartAnalysisResponse`) y `GET /ai/analysis/:id` (`200` con el `Analysis` completo, `404` si no existe). Protegidos por `FirebaseAuthGuard`. Unit tests con `AnomalyEngineService`/`AnalysesRepository` mockeados.
12. Crear `src/readings/dto/list-readings-query.dto.ts` y `src/meters/meters.controller.ts`: `GET /meters` (lista con `MeterSummary`), `GET /meters/:meterId` (`404` si no existe, `MeterDetail`), `GET /meters/:meterId/readings` (`404` si el medidor no existe, pagina con cursor). Protegidos por `FirebaseAuthGuard`. Unit tests del controller con los repositorios mockeados.
13. Crear `src/dashboard/` (`dashboard.module.ts`, `dashboard.service.ts`, `dashboard.controller.ts`): `GET /dashboard/summary` usa `AnalysesRepository.findLatestCompleted()` + `AnomaliesRepository.findByAnalysisId()`; si no hay ninguna corrida `COMPLETED`, responde `200` con `analysisId: null` y contadores en `0`. Protegido por `FirebaseAuthGuard`. Unit tests con repos mockeados.
14. Decorar todos los DTOs (`@ApiProperty`) y controllers (`@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse` por cada código `200`/`202`/`400`/`401`/`404`) y montar `SwaggerModule` en `/docs` en `src/main.ts`. Registrar `AuthModule`, `DashboardModule` y los controllers nuevos en `src/app.module.ts`. `npm run build` compila.
15. Verificación manual end-to-end contra el dataset sembrado (SPEC 01), con un ID token real de Firebase Auth: ejecutar los 8 endpoints (curl o Swagger UI) y confirmar los status codes documentados. Actualizar `README.md` con la sección real de "API Endpoints".

---

## Acceptance criteria

- [ ] `npm run build` compila sin errores.
- [ ] `npm test` pasa, cubriendo: `FirebaseAuthGuard`, `http-exception.filter`, los métodos nuevos de `MetersRepository`/`ReadingsRepository`/`AnomaliesRepository`/`AnalysesRepository`, `AnomalyEngineService.startAnalysis`, y los 4 controllers (`meters`, `anomalies`, `ai`, `dashboard`).
- [ ] Los 8 endpoints responden con los status codes documentados (`200` en lecturas exitosas, `202` en `POST /ai/analyze`, `400` en validación fallida, `401` sin token o con token inválido, `404` en recursos inexistentes).
- [ ] Un request sin header `Authorization` a cualquier endpoint protegido responde `401` antes de llegar al controller.
- [ ] `POST /ai/analyze` responde `202` con `{ analysisId, status: 'RUNNING' }` antes de que la corrida completa termine.
- [ ] `GET /ai/analysis/:id` refleja el progreso incremental (`progress.phase`/`pct` cambia entre llamadas sucesivas mientras la corrida en background avanza) y termina en `COMPLETED` o `FAILED`.
- [ ] `GET /meters/:meterId/readings`: la segunda página (usando el `nextCursor` de la primera) no repite lecturas, y `nextCursor` es `null` en la última página.
- [ ] `GET /anomalies?analysisId=X&severity=HIGH` solo devuelve anomalías `HIGH` de esa corrida.
- [ ] `GET /dashboard/summary` devuelve `analysisId: null` y contadores en `0` si nunca corrió un análisis `COMPLETED` (no un error).
- [ ] Swagger UI en `/docs` lista los 8 endpoints con sus DTOs, respuestas por status code, y el esquema de autenticación Bearer.
- [ ] CORS solo permite el origin configurado en `CORS_ORIGIN`.
- [ ] Todos los errores (`400`/`401`/`404`/`500`) devuelven el mismo `HttpErrorResponse`; los `500` nunca exponen stack trace ni mensaje interno crudo.
- [ ] No se agregó ninguna operación de escritura sobre `meters`/`readings`/`events` vía API, ni transición de `Anomaly.status`.

---

## Decisions

- **Sí:** mantener `GET /dashboard/summary` en este spec pese a que SPEC 02 lo había diferido explícitamente a un "spec futuro de `dashboard/`". Razón: decisión explícita del usuario al definir este spec; se acota a KPIs de la última corrida `COMPLETED` — el histórico cross-corridas sigue fuera de scope.
- **Sí:** agregar `AnomalyEngineService.startAnalysis` como método nuevo en paralelo a `runAnalysis`, sin modificar este último. Razón: `scripts/analyze.ts` (SPEC 02) sigue usando `runAnalysis` síncrono sin cambios; el endpoint HTTP necesita el `analysisId` de inmediato para responder `202`, así que se agrega un método paralelo en vez de romper el contrato existente.
- **Sí:** paginación cursor-based con `from`/`to` obligatorios en `GET /meters/:meterId/readings`. Razón: offset no es viable en Firestore a escala, y el cursor solo (sin rango) no cubre el caso de "quiero lecturas de esta ventana específica".
- **Sí:** filtros de `GET /anomalies` híbridos — `analysisId`/`meterId` se filtran en la query de Firestore (equality-only, no requieren índice compuesto nuevo), `severity`/`type` se filtran en memoria sobre el resultado. Razón: agregar índices nuevos para `severity`/`type` sería sobre-ingeniería al volumen del MVP.
- **Sí:** `GET /meters`, `/meters/:meterId`, `/meters/:meterId/readings`, `/anomalies/:id` y `/ai/analysis/:id` devuelven `404` cuando el recurso raíz no existe; `GET /dashboard/summary` devuelve `200` con contadores en `0` cuando no hay ninguna corrida `COMPLETED`. Razón: la ausencia de análisis no es un recurso "no encontrado", es un estado válido de un sistema recién sembrado.
- **Sí:** `FirebaseAuthGuard` solo verifica que el token sea válido, sin roles/permisos. Razón: ningún spec previo ni el PDF original exige RBAC; agregarlo sería overengineering.
- **No:** paginación en `GET /anomalies` o `GET /meters`. Razón: al volumen del MVP (~12 medidores, un puñado de anomalías por corrida) no hace falta; solo `/readings` crece sin límite práctico (una lectura por hora, potencialmente meses de historia).
- **No:** WebSockets/SSE para progreso en tiempo real. Razón: el PDF no lo exige; polling a `GET /ai/analysis/:id` es suficiente para el MVP.
- **No:** tests E2E contra Firestore real en este spec. Razón: sigue la convención de SPEC 01/02 (Firestore mockeado en unit tests); la verificación real es manual (paso 15 del plan).

---

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `GET /meters` hace N+1 queries (anomalías + última lectura por medidor) | Aceptable al volumen del MVP (~12 medidores), mismo criterio de aceptación que SPEC 02 para `createMany`. |
| `startAnalysis` dispara trabajo en background sin `await`; un fallo tardío podría no capturarse si el proceso termina antes | Nest mantiene vivo el event loop mientras haya promesas pendientes tras responder el request; se documenta como limitación conocida del MVP (sin cola de trabajos/worker separado). |
| `verifyIdToken` hace una llamada de red a Firebase por cada request protegido, añadiendo latencia | Aceptable para el volumen del MVP; cachear tokens verificados queda fuera de este spec. |
| Cursor de paginación basado en `timestamp` podría colisionar si dos lecturas del mismo medidor comparten timestamp exacto | El modelo ya garantiza `(meterId, timestamp)` único por validación del seed (SPEC 01); no hay colisiones posibles dentro de un mismo medidor. |

---

## What is **not** in this spec

- Cualquier endpoint de escritura sobre `meters`, `readings` o `events`.
- Transiciones de `Anomaly.status` vía API.
- Roles/permisos granulares (RBAC).
- WebSockets/SSE para progreso en tiempo real.
- Dashboard histórico cross-corridas (tendencias, comparación entre corridas).
- Rate limiting / throttling.
- Tests E2E contra Firestore real.

Cada uno de estos, si se construye, va en su propio spec.
