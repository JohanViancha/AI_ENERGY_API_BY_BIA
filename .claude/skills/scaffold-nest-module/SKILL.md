---
name: scaffold-nest-module
description: Scaffold a new NestJS module (module/controller/service/dto/spec files) following this repo's conventions and the README's target architecture. Use when the user asks to add a new module, resource, or feature area (e.g. meters, readings, events, anomalies, ai, dashboard, firebase, auth) to the AI Energy Management Platform backend.
---

Scaffold a new NestJS module for this project under `src/<module-name>/`, matching the style of the
existing scaffold (`src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`) and the
target architecture documented in `README.md`.

## Steps

1. Confirm the module name and whether it maps to one of the README's documented modules
   (`meters`, `readings`, `events`, `anomalies`, `ai`, `dashboard`, `firebase`, `auth`) or is a new
   one the user is defining. Read `README.md`'s "Estructura del proyecto" section for the expected
   file layout of that module if it's one of the documented ones.
2. Create, under `src/<module-name>/`:
   - `<module-name>.module.ts` — a `@Module` that declares/exports the controller and service.
   - `<module-name>.controller.ts` — only if the module exposes HTTP routes (e.g. `firebase` is a
     provider-only module with no controller).
   - `<module-name>.service.ts`
   - `dto/` — request/response DTOs, only if the module needs them yet.
   - Co-located `*.spec.ts` next to each new file that has logic worth testing (controller, service).
3. Register the new module in `src/app.module.ts`'s `imports`.
4. Follow the project's existing code style: single quotes, trailing commas, standard Nest
   decorator patterns. Do not add `class-validator`, `class-transformer`, `firebase-admin`,
   `@nestjs/config`, or `@nestjs/swagger` unless the module being scaffolded actually needs them —
   these are not yet installed dependencies (see root `CLAUDE.md`).
5. Run `npm run lint` and `npm test` on the affected files to confirm the new module builds and
   passes.

Keep the scaffold minimal — empty CRUD stubs with a clear TODO where business logic (e.g. anomaly
detection algorithms, Firebase calls) belongs, rather than inventing implementation details the
user hasn't specified yet.
