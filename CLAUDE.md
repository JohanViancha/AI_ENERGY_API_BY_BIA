# CLAUDE.md

Este archivo proporciona orientación a Claude Code (o cualquier agente de IA) cuando trabaja con el código de este repositorio.

## Estado del proyecto

Este repositorio es actualmente el **andamiaje por defecto del CLI de NestJS** — solo existen `src/main.ts`, `app.module.ts`, `app.controller.ts`, `app.service.ts` y sus specs. El README describe un sistema objetivo mucho más grande (ver abajo); nada de eso ha sido construido todavía. No asumas que ningún módulo, dependencia o archivo del README existe hasta que lo hayas verificado — `src/` es la fuente de verdad, no el README.

## Qué es esto (arquitectura objetivo)

Un backend de "AI Energy Management Platform": API REST para gestión de medidores eléctricos, detección híbrida de anomalías (Z-score, IQR, reglas de calidad, correlación con eventos), una capa de IA que explica/prioriza/recomienda acciones sobre las anomalías detectadas, y agregación de KPIs para el dashboard. El almacén de datos es Firebase Firestore; la autenticación es Firebase Auth verificada vía `firebase-admin`.

Al añadir nuevas funcionalidades, estructúralas bajo el layout de módulos que documenta el README:
`meters/`, `readings/`, `events/`, `anomalies/`, `ai/` (con `engine/` para los detectores y `explainer/` para la explicación con IA), `dashboard/`, `firebase/`, `auth/`, `common/{filters,interceptors,pipes}` — cada uno como un conjunto estándar de módulo/controlador/servicio/dto de Nest. Ni `firebase-admin`, ni `@nestjs/config`, ni `@nestjs/swagger`, ni `class-validator`, ni `class-transformer` están instalados todavía; añádelos cuando la funcionalidad que los necesita se esté construyendo realmente, no de forma preventiva.

## Comandos

- `npm run start:dev` — servidor de desarrollo con watch
- `npm run build` — `nest build`
- `npm run lint` — ESLint con `--fix` sobre `src`, `apps`, `libs`, `test`
- `npm run format` — Prettier sobre `src/**/*.ts` y `test/**/*.ts`
- `npm test` — tests unitarios (Jest, `*.spec.ts` colocados junto al código)
- `npm run test:cov` — tests unitarios con cobertura
- `npm run test:e2e` — tests e2e (`test/*.e2e-spec.ts`, configuración de Jest separada)

## Estilo de código

- Prettier: comillas simples, comas finales en todas partes (`.prettierrc`).
- ESLint (configuración plana, con reconocimiento de tipos vía `typescript-eslint`): `@typescript-eslint/no-explicit-any` está **desactivado** — `any` está permitido en este repositorio. `no-floating-promises` y `no-unsafe-argument` son warnings, no errores.
- TypeScript: solo `strictNullChecks` está activado — esto **no** es el modo `strict` completo (`noImplicitAny: false`). No asumas garantías del modo estricto en el resto del código.

## Testing

- Los tests unitarios viven junto a su archivo fuente (`foo.service.ts` → `foo.service.spec.ts`), ejecutados por la configuración de Jest embebida en `package.json` (`rootDir: src`).
- Los tests E2E viven en `test/*.e2e-spec.ts` bajo la configuración separada `test/jest-e2e.json`.
- Todavía no hay umbrales de cobertura forzados.

## Variables de entorno

Variables conocidas (ver `.env.example` para la lista completa, sin valores): `PORT`, `NODE_ENV`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `CORS_ORIGIN`, `OPENAI_API_KEY`. `.env` está en gitignore y contiene secretos reales (clave de cuenta de servicio de Firebase, clave de OpenAI) — nunca leas, imprimas ni hagas commit de su contenido.