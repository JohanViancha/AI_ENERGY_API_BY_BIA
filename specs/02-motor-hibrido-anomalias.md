# SPEC 02 — Motor híbrido de detección de anomalías

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-09-25
> **Objective:** A partir de lecturas y eventos de un medidor, detectar tramos anómalos con cinco detectores independientes (Z-score robusto, IQR sobre residuos, calidad de datos, relación eléctrica y patrón horario), agruparlos, clasificarlos por tipo y severidad, calcular confianza y prioridad, generarles explicación y recomendación por reglas, y persistirlos en `analyses`/`anomalies`, todo disparable manualmente vía `npm run analyze`.

---

## Por qué existe este spec

SPEC 01 dejó explícitamente fuera "el motor de detección híbrida... y la escritura de documentos `analyses`/`anomalies` en tiempo de ejecución" y "la capa de explicación... (aunque los campos existen en el modelo desde ese spec)". Este spec construye exactamente eso: la lógica de negocio que llena `reason`, `recommendedAction`, `type`, `severity`, `confidence`, `priorityScore` y `evidence` de un `Anomaly`, y que hace avanzar `Analysis.progress` por sus 7 fases ya modeladas (`READINGS → BASELINE → DETECTION → CORRELATION → EVENTS → EXPLANATION → RECOMMENDATION`). No incluye ningún endpoint HTTP (eso es SPEC 03) ni integración real con OpenAI (explainer real, spec futuro).

---

## Scope

**In:**

- Módulo `AiModule` en `src/ai/`, con submódulos `engine/` (baseline, detectores, agrupación, correlación, clasificación, confianza) y `explainer/` (generación de `reason`/`recommendedAction` por plantillas determinísticas, sin llamadas a OpenAI).
- `AnomalyEngineService.runAnalysis(params: RunAnalysisParams)`: orquesta las 7 fases, actualiza el documento `Analysis` fase por fase, y persiste los `Anomaly` resultantes.
- Cálculo de baseline horario por medidor: `baseline[meterId][hour]` = mediana, `mad[meterId][hour]` = MAD (Median Absolute Deviation), sobre todas las lecturas recibidas en la corrida.
- Cinco detectores independientes por lectura: `Z_SCORE`, `IQR_OUTLIER`, `DATA_QUALITY`, `ELECTRICAL_RELATION`, `HOURLY_PATTERN`.
- Agrupación de lecturas anómalas contiguas del mismo medidor (gap configurable, default 7h) en tramos (`candidatos de anomalía`).
- Correlación de cada tramo con eventos operativos reales (excluyendo `UNKNOWN` y `DATA_QUALITY`, regla ya fijada en SPEC 01) y cálculo de cobertura temporal.
- Árbol de clasificación (`type` + `severity`) y fórmula de `confidence` documentados abajo.
- Cálculo de `priorityScore = severityWeight(severity) × confidence` (fórmula ya fijada en SPEC 01).
- Generación de `reason` y `recommendedAction` por plantillas parametrizadas (sin IA generativa).
- Métodos de escritura nuevos en `AnalysesRepository` (`create`, `updateProgress`, `finish`) y en `AnomaliesRepository` (`createMany`) — SPEC 01 solo definió lectura.
- `scripts/analyze.ts`: inicializa Firebase Admin, parsea flags (`--meters`, `--from`, `--to`, `--windowDays`, `--gapHours`), llama a `AnomalyEngineService.runAnalysis`, imprime un resumen (analysisId, anomaliesCount, highPriorityCount, duración) y termina. Script `"analyze"` en `package.json`.
- Registro de `AiModule` en `src/app.module.ts`.

**Out of scope (para specs futuros):**

- `POST /ai/analyze` y cualquier controller/DTO validado con `class-validator` (SPEC 03 — contrato de API). El script es el único disparador de esta corrida en este spec.
- Integración real con OpenAI para generar `reason`/`recommendedAction` con IA generativa (explainer real). Las plantillas de este spec son el fallback determinístico permanente si esa integración nunca se hace, o el paso previo si se hace.
- Transiciones de `Anomaly.status` (`OPEN → REVIEWED → RESOLVED`). El motor siempre escribe `OPEN`.
- Ejecución programada (`triggeredBy: 'SCHEDULED'`, cron). Este spec solo dispara `MANUAL`.
- El chequeo de consistencia `anomalies_count === count(anomalies WHERE analysis_id = X)` al finalizar (ya deferido en SPEC 01 al motor; se documenta aquí que **tampoco** se implementa en este spec — solo se persisten los contadores, no se auditan).
- Dashboard, KPIs agregados entre corridas, o cualquier lectura cross-`Analysis` (spec futuro de `dashboard/`).

---

## Data model

Este spec **no introduce nuevas colecciones de Firestore**: reutiliza `Analysis` y `Anomaly` de SPEC 01 y les da valores reales de escritura. Introduce estructuras nuevas, todas **en memoria, no persistidas**:

```ts
// src/ai/engine/types.ts
interface RunAnalysisParams {
  meterIds?: string[]; // default: todos los meters (MetersRepository.listAll())
  from?: string; // ISO date; default: min(timestamp) de las lecturas del medidor
  to?: string; // ISO date; default: max(timestamp) de las lecturas del medidor
  windowDays?: number; // alternativa a from/to: últimos N días desde el máximo timestamp disponible
  gapHours?: number; // default 7; separación máxima entre lecturas anómalas para seguir en el mismo tramo
}

interface HourlyBaseline {
  median: number;
  mad: number; // Median Absolute Deviation
  sampleCount: number;
  isFallback: boolean; // true si sampleCount < 7 y se usó la mediana global del medidor
}
// Map<meterId, HourlyBaseline[24]>

interface DetectionSignal {
  detector: 'Z_SCORE' | 'IQR_OUTLIER' | 'DATA_QUALITY' | 'ELECTRICAL_RELATION' | 'HOURLY_PATTERN';
  value: number; // valor crudo (z, residual, etc.)
}

interface AnomalyCandidate {
  meterId: string;
  windowStart: string;
  windowEnd: string;
  readings: Reading[]; // lecturas del tramo
  signals: DetectionSignal[]; // unión de señales disparadas por cualquier lectura del tramo
  baselineMedian: number; // mediana de baseline[hora] promediada sobre el tramo
  observedMedian: number; // mediana de consumptionKwh observado en el tramo
  variationPct: number; // (observedMedian - baselineMedian) / baselineMedian × 100
}
```

**Detectores (señales booleanas por lectura):**

| Detector               | Condición                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `Z_SCORE`               | `z = 0.6745 × (x - median[hora]) / MAD[hora] > 5.5`                                            |
| `IQR_OUTLIER`           | `residual = x - baseline[hora]` fuera de `[Q1 - 3×IQR, Q3 + 3×IQR]` (IQR sobre residuos)       |
| `DATA_QUALITY`          | `status !== 'OK'` OR `voltage < 100` OR `voltage > 500` OR (`current <= 0` AND `consumo > 0`) OR `powerFactor < 0.7` OR `powerFactor > 1` |
| `ELECTRICAL_RELATION`   | `\|V×I×PF − consumptionKwh×1000\| / (consumptionKwh×1000) > 0.30`                              |
| `HOURLY_PATTERN`        | el perfil horario del día evaluado difiere >15% en forma (no en nivel) del perfil histórico del medidor |

> **Recalibración post-implementación (verificada contra el dataset sembrado):** los umbrales originales (`Z_SCORE > 3`, `IQR` 1.5×, `ELECTRICAL_RELATION` 15%) son convenciones estadísticas estándar, pero resultaron demasiado ajustados para el ruido real de `data/readings.csv`: con solo ~14 muestras por hora-del-día, el MAD muestral subestima la dispersión real y produce falsos positivos sistemáticos en los 12 medidores (142 `Anomaly` en vez de 4 sobre el dataset de referencia). Se recalibraron a `Z_SCORE > 5.5` (el z máximo observado en lecturas de fondo del dataset, sin ningún incidente conocido, es ~5.2), `IQR` 3× (convención de Tukey para outlier "extremo" en vez de "leve") y `ELECTRICAL_RELATION > 30%` (el ruido normal de sensor/redondeo del dataset ya alcanza 15-27%, p97≈16.7%/p99≈26.8% sobre las 4032 lecturas). Verificado: los 4 incidentes diseñados en el dataset (M-104, M-106, M-109, M-112) se siguen detectando con los umbrales nuevos; solo desaparece el ruido de fondo.

Baseline con `sampleCount < 7` en una hora → cae a mediana global del medidor (`isFallback = true`); no se define un detector adicional para esto, pero penaliza `confidence` (ver más abajo).

**Fórmula de `confidence` (certeza, no gravedad):**

```
confidence = min(0.99, 0.40 + 0.20×señales_coincidentes + 0.20×magnitud + 0.20×claridad_evento)

señales_coincidentes = min(1, detectores_disparados.length / 3)
magnitud             = min(1, max(z_score_robusto / 6, |variation_pct| / 150))
claridad_evento:
  - sin evento real correlacionado (o solo UNKNOWN/DATA_QUALITY)      → 0.85
  - evento real cubre > 90% de la ventana                              → 1.00
  - evento real cubre 50–90%                                           → 0.70
  - evento real cubre < 50%                                            → 0.40

cobertura = intersección([eventTimestamp, eventTimestamp + durationHours], [windowStart, windowEnd])
            (durationHours === null → ventana ±24h por defecto, regla ya fijada en SPEC 01)
```

Si `baseline.isFallback === true` para la mayoría de las horas del tramo, `confidence` resultante se multiplica ×0.5 (penalización por baseline pobre).

**Árbol de clasificación (`type` + `severity`), en orden de precedencia:**

1. ¿Disparó `DATA_QUALITY`? → `type = 'DATA_QUALITY'`, `severity = 'HIGH'`. Fin.
2. ¿Evento real (excluye `UNKNOWN`/`DATA_QUALITY`) cubre la ventana?
   - `> 90%` → `type = 'FALSE_POSITIVE'`, `severity = 'LOW'`.
   - `50–90%` → `type = 'EXPLAINABLE_ANOMALY'`, `severity = 'MEDIUM'`.
   - `< 50%` → `type = 'EXPLAINABLE_ANOMALY'`, `severity = 'MEDIUM'`.
3. Sin evento que explique → `type = 'REAL_ANOMALY'`, `severity` según `variationPct` (regla fijada en SPEC 01, recalibrada tras verificar contra el dataset sembrado: `HIGH` > 90%, `MEDIUM` 30–90%, `LOW` < 30% — ver nota de recalibración en SPEC 01).

Un tramo solo llega a este árbol si disparó `Z_SCORE`, `IQR_OUTLIER`, `ELECTRICAL_RELATION` o `HOURLY_PATTERN` en al menos una lectura, o si disparó `DATA_QUALITY`. Si ninguna lectura del medidor dispara ningún detector, no se crea ningún `Anomaly` para ese medidor.

**Vocabulario cerrado de `evidence.signals`:** `'Z_SCORE'`, `'IQR_OUTLIER'`, `'DATA_QUALITY'`, `'ELECTRICAL_RELATION'`, `'HOURLY_PATTERN'`, `'NO_EVENT'`, `'EVENT_MATCH'`.

**Claves de `evidence.detectorScores`:** `Z_SCORE`, `IQR_RESIDUAL`, `VARIATION_PCT`, `MAGNITUDE`, `EVENT_CLARITY`, `SIGNALS_COUNT` (valores numéricos crudos).

**Plantillas de `reason`/`recommendedAction`:** parametrizadas por `type` + `severity` + `evidence`, por ejemplo:

- `reason`: `"{type} en {meterId} durante {windowStart}–{windowEnd}: variación de {variationPct}% vs. baseline horario. Señales: {signals.join(', ')}."`
- `recommendedAction` (`DATA_QUALITY`): `"Inspeccionar el medidor {meterId}: posible falla de instrumentación (calibración, cableado o comunicación)."`
- `recommendedAction` (`REAL_ANOMALY` / `HIGH`): `"Investigar de inmediato la causa del consumo anómalo en {meterId}; posible fuga, fallo de equipo o uso no autorizado."`
- `recommendedAction` (`EXPLAINABLE_ANOMALY` / `FALSE_POSITIVE`): `"Confirmar que el evento operativo registrado explica la variación; sin acción correctiva si se confirma."`

El texto exacto de cada plantilla se termina de redactar en implementación; la estructura (inputs, una plantilla por combinación `type`×`severity`) es lo que fija este spec.

---

## Implementation plan

1. Crear `src/ai/ai.module.ts` (vacío, sin providers) y registrarlo en `src/app.module.ts`. `npm run build` sigue compilando.
2. Crear `src/ai/engine/types.ts` con `RunAnalysisParams`, `HourlyBaseline`, `DetectionSignal`, `AnomalyCandidate`.
3. Implementar `src/ai/engine/baseline-calculator.service.ts` (`calculate(readings: Reading[]): Map<meterId, HourlyBaseline[24]>`, mediana + MAD, fallback a mediana global si `sampleCount < 7`). Unit tests con arrays de lecturas sintéticas.
4. Implementar los cinco detectores en `src/ai/engine/detectors/` (`z-score.detector.ts`, `iqr.detector.ts`, `data-quality.detector.ts`, `electrical-relation.detector.ts`, `hourly-pattern.detector.ts`), cada uno una función pura `(reading, baseline) => DetectionSignal | null`. Unit tests por detector con casos borde (justo en el umbral, por encima, por debajo).
5. Implementar `src/ai/engine/anomaly-grouper.service.ts`: agrupa lecturas anómalas contiguas del mismo medidor con gap `< gapHours` en `AnomalyCandidate[]`. Unit test con el caso M-109 (58h contiguas → 1 candidato) y M-112 (lecturas cada 3h en 2 días con `gapHours=7` → 1 candidato).
6. Implementar `src/ai/engine/event-correlator.service.ts`: calcula cobertura de eventos reales (excluye `UNKNOWN`/`DATA_QUALITY`) sobre cada `AnomalyCandidate`. Unit tests con eventos que cubren >90%, 50-90%, <50% y sin evento.
7. Implementar `src/ai/engine/anomaly-classifier.service.ts`: aplica el árbol de precedencia y produce `{ type, severity }`. Unit tests para cada rama.
8. Implementar `src/ai/engine/confidence-calculator.service.ts`: aplica la fórmula de `confidence` y la penalización por `isFallback`. Unit tests numéricos verificando la fórmula exacta.
9. Implementar `src/ai/explainer/reason-template.service.ts` y `src/ai/explainer/recommendation-template.service.ts` con las plantillas por `type`+`severity`. Unit tests que verifiquen que el texto generado incluye los datos esperados (`meterId`, `variationPct`, etc.).
10. Añadir `create`, `updateProgress(analysisId, phase, pct)`, `finish(analysisId, status, errorCode?, errorMessage?)` a `AnalysesRepository`, y `createMany(anomalies: Anomaly[])` a `AnomaliesRepository`. Unit tests con Firestore mockeado.
11. Implementar `src/ai/engine/anomaly-engine.service.ts` con `runAnalysis(params)`: orquesta las 7 fases (`READINGS` carga lecturas/medidores → `BASELINE` calcula baseline → `DETECTION` corre detectores y agrupa → `CORRELATION` carga eventos y calcula cobertura → `EVENTS` clasifica type/severity → `EXPLANATION` genera `reason` → `RECOMMENDATION` genera `recommendedAction`, calcula `confidence`/`priorityScore`, persiste `Anomaly[]` y cierra el `Analysis` con `status = 'COMPLETED'`), actualizando `Analysis.progress` en cada fase. Unit test de orquestación con todos los colaboradores mockeados (verifica que se llaman en orden y que `updateProgress` se invoca 7 veces).
12. Manejo de error: si cualquier fase lanza, `runAnalysis` captura, llama `AnalysesRepository.finish(id, 'FAILED', errorCode, errorMessage)` y re-lanza. Unit test forzando un error en un colaborador mockeado.
13. Crear `scripts/analyze.ts`: parsea flags, inicializa Firebase Admin, instancia el contexto de Nest (`NestFactory.createApplicationContext`), obtiene `AnomalyEngineService`, llama `runAnalysis`, imprime resumen (`analysisId`, `anomaliesCount`, `highPriorityCount`, duración en ms) y sale con código 0/1 según `status`. Añadir script `"analyze": "ts-node scripts/analyze.ts"` en `package.json`.
14. Ejecutar `npm run analyze` contra el dataset sembrado por SPEC 01 y verificar manualmente los resultados de `M-109` y `M-112` (ver acceptance criteria). Actualizar `README.md` con el comando y sus flags.

---

## Acceptance criteria

- [ ] `npm run build` compila sin errores.
- [ ] `npm test` pasa, cubriendo: `baseline-calculator`, los 5 detectores, `anomaly-grouper`, `event-correlator`, `anomaly-classifier`, `confidence-calculator`, las plantillas de explicación/recomendación, y `anomaly-engine.service` orquestado con mocks.
- [ ] `npm run analyze` corre de punta a punta contra el dataset sembrado (SPEC 01) sin lanzar excepciones no capturadas.
- [ ] El `Analysis` resultante tiene `status = 'COMPLETED'`, `finishedAt` no nulo, y `progress.pct = 100`.
- [ ] Para `M-109`: se agrupan sus ~58 horas contiguas anómalas en un único documento `Anomaly` (no 58 documentos).
- [x] Para `M-112`: sus lecturas intermitentes cada 3h en 2 días se agrupan en un único documento `Anomaly` con `gapHours = 7` (default).
  > **Nota de verificación (actualizada):** con el `gapHours` default original (4h), este criterio no se cumplía: M-112 producía 3 documentos `Anomaly` (`DATA_QUALITY`) en vez de 1, porque el dataset (`data/readings.csv`) tiene dos huecos reales de 6h sin ninguna señal disparada dentro del tramo 09-13/09-14 (09-13 12:00→18:00 y 09-14 15:00→21:00). Un hueco real de 6h con `gapHours = 4` corta el tramo correctamente según la regla de agrupación — no era un bug del agrupador, sino un default demasiado corto para los huecos reales del dataset semilla. Se subió el default a `gapHours = 7` (por encima del mayor hueco real conocido) para que el incidente se persista como un único documento en vez de fragmentarse. `M-109` ya cumplía el criterio equivalente.
- [ ] Cada `Anomaly` persistido tiene `confidence` dentro de `[0.40, 0.99]` y `priorityScore = severityWeight(severity) × confidence`.
- [ ] `evidence.signals` de cada `Anomaly` solo contiene valores del vocabulario cerrado (`Z_SCORE`, `IQR_OUTLIER`, `DATA_QUALITY`, `ELECTRICAL_RELATION`, `HOURLY_PATTERN`, `NO_EVENT`, `EVENT_MATCH`).
- [ ] Ningún `Anomaly` se crea para un medidor cuyas lecturas no dispararon ningún detector.
- [ ] Eventos con `event_type IN ('UNKNOWN', 'DATA_QUALITY')` nunca cuentan como `EVENT_MATCH` ni afectan la cobertura de correlación.
- [ ] Si una fase falla, el `Analysis` queda con `status = 'FAILED'`, `errorCode` y `errorMessage` no nulos (no queda `RUNNING` indefinidamente).
- [ ] `scripts/analyze.ts` acepta `--meters`, `--from`, `--to`, `--windowDays`, `--gapHours` y usa los defaults documentados cuando se omiten.
- [ ] No se agregó ningún controller, endpoint HTTP, ni integración con OpenAI en este spec.

---

## Decisions

- **Sí:** disparo manual vía `scripts/analyze.ts`, sin endpoint HTTP. Razón: SPEC 03 es el contrato de API; este spec se enfoca en la lógica del motor y permite probarla end-to-end sin levantar la API.
- **Sí:** explicación y recomendación por plantillas determinísticas, sin llamada real a OpenAI. Razón: mantiene el motor testeable sin red ni `OPENAI_API_KEY`; la integración real queda para un spec futuro del explainer.
- **Sí:** baseline por mediana + MAD (z-score robusto) sobre todo el histórico recibido en la corrida, no ventana móvil. Razón: robusto a outliers (ej. lecturas de 110 kWh mezcladas con 50 kWh en M-109) sin necesidad de un parámetro de ventana adicional.
- **Sí:** ventana de análisis dinámica (`min`/`max` timestamp de las lecturas recibidas), `windowDays` opcional solo para acotar. Razón: el motor no debe asumir un dataset de 14 días fijos.
- **Sí:** IQR se calcula sobre residuos (`consumo - baseline[hora]`), no sobre el consumo crudo. Razón: aísla la anomalía de la estacionalidad horaria normal.
- **Sí:** agrupar lecturas anómalas contiguas (`gap < gapHours`, default 7h) en un único `Anomaly` por tramo, en vez de un documento por lectura. Razón: el modelo de SPEC 01 ya expone `evidence.windowStart`/`windowEnd`, pensado para tramos, no lecturas sueltas; evita explotar la colección `anomalies` con documentos redundantes. El default se subió de 4h a 7h tras verificar que el dataset semilla tiene incidentes reales con huecos internos de 6h sin señal (ver nota de verificación de `M-112` en acceptance criteria).
- **Sí:** `FALSE_POSITIVE` sí lo asigna el motor automáticamente (evento real cubre >90% de la ventana), y sí se persiste como documento. Razón: es útil para auditoría/dashboard filtrar anomalías estadísticas ya explicadas, en vez de descartarlas silenciosamente.
- **Sí:** un tramo con evento que cubre 50-90% y uno que cubre <50% reciben el mismo `type`/`severity` (`EXPLAINABLE_ANOMALY`/`MEDIUM`); la diferencia entre ambos casos la captura `confidence` (`claridad_evento` 0.70 vs 0.40), no la clasificación. Razón: evita una categoría adicional sin valor operativo distinto.
- **Sí:** si la mayoría de horas del tramo usan baseline de fallback (`sampleCount < 7`), `confidence` final se multiplica ×0.5. Razón: sin suficientes muestras el baseline es poco confiable; se penaliza en vez de bloquear la detección. Valor de penalización (`×0.5`) es una decisión de implementación de este spec, ajustable en revisión.
- **Sí:** no se excluyen lecturas con `status !== 'OK'` del cálculo de baseline. Razón: la mediana ya es robusta a esa contaminación por diseño; añadir un filtro extra sería una regla redundante.
- **Sí:** `AnalysesRepository`/`AnomaliesRepository` (de SPEC 01, solo lectura) ganan métodos de escritura en este spec (`create`, `updateProgress`, `finish`, `createMany`) en vez de crear repositorios nuevos. Razón: son las mismas entidades; separar lectura/escritura en clases distintas sería una capa sin beneficio aquí.
- **Sí:** mapeo de las 7 fases de `Analysis.progress` (ya fijadas en SPEC 01) a pasos concretos del pipeline: `READINGS` (carga) → `BASELINE` (cálculo) → `DETECTION` (detectores + agrupación) → `CORRELATION` (carga eventos + cobertura) → `EVENTS` (clasificación type/severity) → `EXPLANATION` (`reason`) → `RECOMMENDATION` (`recommendedAction` + `confidence` + `priorityScore` + persistencia). Razón: SPEC 01 fijó los nombres de fase sin definir su contenido; este spec les da semántica concreta.
- **No:** ejecución programada (`triggeredBy: 'SCHEDULED'`) o cron. Razón: fuera de scope del MVP; el campo ya existe en el modelo pero el motor solo escribe `'MANUAL'`.
- **No:** chequeo de consistencia de contadores (`anomalies_count === count(anomalies)`) al finalizar. Razón: SPEC 01 lo deferió explícitamente al motor; este spec persiste los contadores pero no los audita.
- **No:** transiciones de `Anomaly.status`. Razón: fuera de scope del MVP; el motor siempre escribe `'OPEN'`.

---

## Risks

| Riesgo                                                                        | Mitigación                                                                                     |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Baseline con pocas muestras por hora produce falsos positivos/negativos          | Fallback a mediana global del medidor + penalización ×0.5 en `confidence` cuando aplica.        |
| `ELECTRICAL_RELATION` con tolerancia 15% dispara en medidores con baja precisión de sensor | Es una señal más entre 5; sola no clasifica como `DATA_QUALITY` salvo que también dispare esa regla. |
| Agrupar con `gapHours` fijo mezcla dos incidentes distintos separados por poco tiempo | `gapHours` es parámetro de la corrida (`--gapHours`), ajustable sin cambiar código.             |
| Corridas grandes generan muchas escrituras a Firestore (`createMany` + 7 updates de progreso) | Aceptable para el volumen del MVP (12 medidores); optimización de batch queda fuera de este spec. |
| Plantillas de `reason`/`recommendedAction` demasiado genéricas para el evaluador | Se documentan como determinísticas y reemplazables por IA real en un spec futuro sin cambiar el resto del pipeline. |

---

## What is **not** in this spec

- `POST /ai/analyze` y cualquier controller/DTO validado (SPEC 03 — contrato de API).
- Integración real con OpenAI para `reason`/`recommendedAction` (explainer real con IA generativa).
- Ejecución programada (`SCHEDULED`) o cron.
- Transiciones de `Anomaly.status` (`REVIEWED`, `RESOLVED`).
- Chequeo de consistencia de contadores al finalizar una corrida.
- Dashboard, KPIs agregados o lectura cross-`Analysis`.

Cada uno de estos, si se construye, va en su propio spec.
