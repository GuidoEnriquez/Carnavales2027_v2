# Plan: Perfiles Operativos con Nombre y DNI

> **Estado:** Implementado y validado el 2026-09-03 con 99 tests (28 archivos).
> Migraciones 064 (tablas/triggers) y 065 (delivery_status/sent_at) aplicadas.
> Invitaciones entregadas por consola en desarrollo, SMTP en producción.

## Objetivo
Implementar un modelo de perfil para roles operativos (VEEDOR, COMISARIO, SCRUTINEER, ESCRIBANO) similar al `judge_profile`, con name, document_number y ciclo de vida INVITED → REGISTERED → SUSPENDED. Un solo perfil compartido por usuario (no por rol).

---

## 1. Base de Datos — Nuevas tablas y triggers

### 1.1 Tabla `operational_profile`
Modelo idéntico a `judge_profile` adaptado para roles operativos:

```sql
CREATE TABLE operational_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE REFERENCES "user"(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  email TEXT NOT NULL CHECK (length(trim(email)) > 0),
  document_number TEXT NOT NULL CHECK (length(trim(document_number)) > 0),
  registration_status TEXT NOT NULL DEFAULT 'INVITED'
    CHECK (registration_status IN ('INVITED', 'REGISTERED', 'SUSPENDED')),
  created_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (registration_status = 'INVITED' OR user_id IS NOT NULL)
);

-- Unicidad
CREATE UNIQUE INDEX operational_profile_email_uq ON operational_profile (lower(email));
CREATE UNIQUE INDEX operational_profile_document_uq ON operational_profile (document_number);
```

**Diferencias con `judge_profile`:**
- Sin `role_code` — el perfil es compartido; los roles se asignan en `user_role` como hasta ahora.

### 1.2 Tabla `operational_invitation`
Modelo similar a `judge_invitation`:

```sql
CREATE TABLE operational_invitation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_profile_id UUID NOT NULL REFERENCES operational_profile(id) ON DELETE RESTRICT,
  secret_hash CHAR(64) NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'USED', 'REVOKED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT REFERENCES "user"(id) ON DELETE RESTRICT,
  acceptance_claim_id UUID,
  acceptance_claimed_at TIMESTAMPTZ,
  delivery_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (delivery_status IN ('PENDING', 'SENT', 'FAILED')),
  sent_at TIMESTAMPTZ,
  CHECK (expires_at > created_at),
  CHECK (status <> 'USED' OR used_at IS NOT NULL),
  CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL),
  CHECK (acceptance_claim_id IS NULL) = (acceptance_claimed_at IS NULL)
);
```

### 1.3 Tabla puente `operational_profile_role`
Para vincular perfil con uno o más roles operativos:

```sql
CREATE TABLE operational_profile_role (
  operational_profile_id UUID NOT NULL REFERENCES operational_profile(id) ON DELETE RESTRICT,
  role_code TEXT NOT NULL REFERENCES app_role(code),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (operational_profile_id, role_code)
);
```

**Nota:** Esto permite que un perfil tenga múltiples roles (ej. COMISARIO + SCRUTINEER). Cuando se acepta la invitación, se otorgan todos los roles asociados al perfil.

### 1.4 Triggers

**Trigger de perfil** (basado en `025_judge_transition_guards.sql`):
- `OPERATIONAL_PROFILE_DELETE_FORBIDDEN`
- `OPERATIONAL_IDENTITY_REASSIGNMENT_FORBIDDEN`
- `OPERATIONAL_IDENTITY_LINK_REQUIRES_REGISTRATION`
- `OPERATIONAL_PROFILE_HISTORY_IMMUTABLE` (created_by, created_at inmutables)
- Transiciones: INVITED→REGISTERED, REGISTERED→SUSPENDED, SUSPENDED→REGISTERED

**Trigger de invitación** (basado en `027_invitation_acceptance_claim.sql`):
- `OPERATIONAL_INVITATION_DELETE_FORBIDDEN`
- `OPERATIONAL_INVITATION_HISTORY_IMMUTABLE` (id, profile_id, secret_hash, expires_at, created_by, created_at inmutables)
- Transiciones: PENDING→USED, PENDING→REVOKED
- Estados finales: USED/REVOKED son inmutables

---

## 2. API — Backend

### 2.1 Nuevo servicio: `operational-profile-service.js`
Ubicación: `api/src/modules/operational-profiles/operational-profile-service.js`

Funciones a implementar:

| Función | Descripción |
|---|---|
| `createOperationalProfile({ name, email, documentNumber, roleCodes, actorUserId, sendInvitation })` | Crea perfil + roles + invitación. Transaccional. Entrega invitación por consola/SMTP. |
| `reissueOperationalInvitation({ actorUserId, operationalProfileId, sendInvitation })` | Revoca PENDING + nueva invitación. Re-entrega. |
| `revokeOperationalInvitation({ actorUserId, operationalProfileId, invitationId })` | Marca REVOKED. |
| `suspendOperationalProfile({ actorUserId, operationalProfileId })` | REGISTERED→SUSPENDED + revokeUserSessions(). |
| `reactivateOperationalProfile({ actorUserId, operationalProfileId })` | SUSPENDED→REGISTERED + revokeUserSessions(). |
| `listOperationalProfiles()` | Lista todos los perfiles con roles y delivery_status. |
| `inspectOperationalInvitation({ secret })` | Valida token, retorna email enmascarado + roles + expiración. |
| `acceptOperationalInvitation({ secret, password })` | Crea user con datos del perfil, vincula, otorga roles, audit. Solo requiere password. |
| `recordDelivery(invitationId, delivered, actorUserId)` | Actualiza delivery_status y sent_at. Transaccional. |
| `deliverInvitation({ profile, invitation, actorUserId, sendInvitation })` | Orquesta envío + recordDelivery. Maneja fallo con INVITATION_DELIVERY_FAILED. |

**Reutilización:**
- `hashSecret()`, `randomBytes(32)`, `maskEmail()`, `normalizeEmail()` — reutilizar de `judge-service.js` o extraer a un módulo compartido.
- `createOrVerifyCredentialUser()` — reutilizar de `account-service.js`.
- `grantRole()` — reutilizar de `role-service.js`.
- `revokeUserSessions()` — reutilizar de `judge-service.js` (o extraer a módulo compartido).
- `auditEvent()` — reutilizar de `audit-service.js`.

### 2.2 Nuevo controller: `operational-profile-controller.js`
Ubicación: `api/src/modules/operational-profiles/operational-profile-controller.js`

Funciones:
- `createProfile(req, res)` — extrae `{ name, email, documentNumber, roleCodes }`, pasa `sendInvitation: req.sendInvitation`
- `listProfiles(req, res)`
- `reissueInvitation(req, res)` — params: `profileId`, pasa `sendInvitation: req.sendInvitation`
- `revokeInvitation(req, res)` — params: `profileId, invitationId`
- `suspendProfile(req, res)` — params: `profileId`
- `reactivateProfile(req, res)` — params: `profileId`
- `inspectInvitation(req, res)` — público, body: `{ secret }`
- `acceptInvitation(req, res)` — público, body: `{ secret, password }` (sin name/documentNumber)

**Manejo de errores:**
- `INVALID_OPERATIONAL_ROLE` → 400
- `ACCOUNT_ALREADY_EXISTS` → 409 (email en tabla "user")
- `PROFILE_ALREADY_EXISTS` → 409 (email en operational_profile)
- `INVITATION_DELIVERY_FAILED` → 202 (perfil creado, entrega fallida)

### 2.3 Nuevas rutas: `operational-profiles.routes.js`
Ubicación: `api/src/routes/operational-profiles.routes.js`

```
POST   /api/v1/operational-profiles              [ADMIN+2FA]  crear perfil + invitación
GET    /api/v1/operational-profiles              [ADMIN+2FA]  listar perfiles
POST   /api/v1/operational-profiles/:id/invitations       [ADMIN+2FA]  reemitir invitación
DELETE /api/v1/operational-profiles/:id/invitations/:invId [ADMIN+2FA]  revocar invitación
POST   /api/v1/operational-profiles/:id/suspend           [ADMIN+2FA]  suspender
POST   /api/v1/operational-profiles/:id/reactivate        [ADMIN+2FA]  reactivar

POST   /api/v1/operational-invitations/inspect   [PÚBLICO]    inspeccionar invitación
POST   /api/v1/operational-invitations/accept    [PÚBLICO]    aceptar invitación (solo password)
```

**Nota:** El router recibe `sendInvitation` como parámetro de `createOperationalProfilesRouter({ requireSession, sendInvitation })`. Se inyecta en `req.sendInvitation` para las rutas protegidas.

### 2.4 Registrar rutas en `server.js`
Agregar el router al montaje de rutas API.

---

## 3. Client — Frontend

### 3.1 Modificar `AdminJudgesPage.jsx`
**Cambios:**

1. **Formulario de creación:**
   - Cuando `creationType !== "JUDGE"`, mostrar campos: Nombre, Email, DNI, y selector de roles (checkboxes o multi-select para VEEDOR/COMISARIO/SCRUTINEER/ESCRIBANO)
   - Botón: "Registrar e invitar" (mismo texto que JUDGE)
   - Submit: `POST /api/v1/operational-profiles` con `{ name, email, documentNumber, roleCodes: [...] }`

2. **Sección de perfiles operativos** (reemplaza la lista plana actual):
   - Tarjetas como los jueces, mostrando: Nombre, DNI, Email, Roles, Estado
   - Acciones según estado:
     - `INVITED`: Reemitir invitación + Revocar
     - `REGISTERED`: Suspender
     - `SUSPENDED`: Reactivar

3. **Link de invitación:** Ya no se muestra un link copiable. En su lugar, se emite la invitación igual que el JUDGE (el admin comparte el link manualmente o se envía email si se implementa delivery).

### 3.2 Página de aceptación: `AcceptOperationalInvitationPage.jsx`
**Cambios:**

1. **Inspect:** Mostrar email enmascarado + roles + expiración (similar al flujo JUDGE)
2. **Formulario de aceptación:** Solo Contraseña + Confirmar contraseña (sin nombre ni DNI; los datos ya están en el perfil)
3. **Submit:** `POST /api/v1/operational-invitations/accept` con `{ secret, password }`
4. **Ruta de enlace:** `#/invitations/operational/accept?secret=...` (ruta correcta, no la de jurados)

---

## 8. Entrega de Invitaciones

Las invitaciones se entregan por consola en desarrollo (`EMAIL_PROVIDER=console`) y por SMTP en producción.

### 8.1 URL de invitación
La función `invitationUrl()` genera la URL con la ruta correcta:
- Jurados: `#/invitations/accept?secret=...`
- Operativos: `#/invitations/operational/accept?secret=...`

**Fix aplicado:** Originalmente la función estaba hardcodeada a la ruta de jurados. Se agregó parámetro `route` configurable en `createInvitationDelivery()`.

### 8.2 Flujo de entrega
1. `issueInvitation()` crea la invitación (INSERT + audit)
2. `deliverInvitation()` llama a `sendInvitation()` y luego `recordDelivery()`
3. `recordDelivery()` actualiza `delivery_status` y `sent_at` (UPDATE + audit)
4. Si la entrega falla, `deliverInvitation()` lanza `INVITATION_DELIVERY_FAILED`
5. El controller retorna 202 con `{ code: "INVITATION_DELIVERY_FAILED" }` (perfil creado, entrega fallida)

### 8.3 Validación de duplicados
El servicio verifica unicidad de email en ambas tablas:
- `"user"` → error `ACCOUNT_ALREADY_EXISTS` (409)
- `operational_profile` → error `PROFILE_ALREADY_EXISTS` (409)

| Evento | Entidad | Cuando |
|---|---|---|
| `OPERATIONAL_PROFILE_CREATED` | `operational_profile` | Perfil creado (INVITED) |
| `OPERATIONAL_INVITATION_CREATED` | `operational_invitation` | Invitación emitida |
| `OPERATIONAL_INVITED` | `operational_invitation` | Entrega de invitación exitosa |
| `OPERATIONAL_INVITATION_DELIVERY_FAILED` | `operational_invitation` | Entrega de invitación fallida |
| `OPERATIONAL_INVITATION_REVOKED` | `operational_invitation` | Invitación revocada |
| `OPERATIONAL_COMPLETED_REGISTRATION` | `operational_profile` | Aceptación exitosa |
| `OPERATIONAL_SUSPENDED` | `operational_profile` | Perfil suspendido |
| `OPERATIONAL_REACTIVATED` | `operational_profile` | Perfil reactivado |

---

## 5. Migración de Datos (Opcional)

Si hay usuarios operativos existentes en `user_role` sin perfil:
1. Crear perfiles con datos derivados del email (nombre del email, email, DNI temporal o placeholder)
2. Asociar `user_id` y status `REGISTERED`
3. Script de migración como migración SQL separada

---

## 6. Secuencia de Implementación

| Paso | Archivos | Dependencias |
|---|---|---|
| **6.1** Migración BD: tablas + triggers | `api/src/db/migrations/0XX_operational_profiles.sql` | Ninguna |
| **6.2** Servicio backend | `api/src/modules/operational-profiles/operational-profile-service.js` | 6.1 |
| **6.3** Controller backend | `api/src/modules/operational-profiles/operational-profile-controller.js` | 6.2 |
| **6.4** Rutas backend | `api/src/routes/operational-profiles.routes.js` | 6.3 |
| **6.5** Registrar rutas en server | `api/src/server.js` | 6.4 |
| **6.6** Tests backend | `api/src/tests/operational-profiles.test.js` | 6.2-6.5 |
| **6.7** UI Admin: formulario + listado | `client/src/pages/AdminJudgesPage.jsx` | 6.2-6.5 |
| **6.8** UI Aceptación: campos nombre+DNI | `client/src/pages/AcceptRoleInvitationPage.jsx` | 6.2-6.5 |
| **6.9** Tests frontend | `client/src/tests/AdminJudgesPage.test.jsx`, `AcceptRoleInvitationPage.test.jsx` | 6.7-6.8 |
| **6.10** Migración de datos existentes | Script SQL | 6.1 |
| **6.11** Validación integral | Build + lint + tests + revisión manual | Todos |

---

## 7. Riesgos y Consideraciones

| Riesgo | Mitigación |
|---|---|
| Un usuario podría tener perfil operational Y judge | permitir — son entidades separadas |
| DNI duplicado entre jueces y operativos | Por ahora,索引 separados (judge_profile.document_number y operational_profile.document_number no se cruzan) |
| Perfil compartido entre roles | Un solo operational_profile por usuario; los roles van en user_role (ya existente) |
| Invitación pendiente para un email que ya tiene perfil REGISTERED | Validar en service: si email ya tiene perfil REGISTERED, rechazar |
| Secret expuesto en URL del link | El secret se hashea en BD; la URL solo se muestra una vez al admin |

---

## 8. Validación y Cierre

### 8.1 Tests ejecutados
- 99 tests (28 archivos) — todos pasando el 2026-09-03
- 5 tests de API para perfiles operativos: crear, duplicado email, rol inválido, campos requeridos, duplicado user email

### 8.2 Migraciones aplicadas
- Migración 064: tablas `operational_profile`, `operational_invitation`, trigger `protect_operational_invitation_history`
- Migración 065: columnas `delivery_status` y `sent_at` en `operational_invitation`

### 8.3 Fix aplicados durante implementación
- **URL de invitación:** Corregida ruta de aceptación de `#/invitations/accept` a `#/invitations/operational/accept`
- **Aceptación simplificada:** Solo password (sin name/DNI); datos del perfil ya almacenados en BD
- **Duplicados:** Verificación en ambas tablas (`"user"` y `operational_profile`)
- **Entrega:** `recordDelivery()` + `deliverInvitation()` con `sendInvitation` parametrizable
- **Email fallback:** Invitación emitida por consola en desarrollo, SMTP en producción

### 8.4 Estado del incremento
- Implementado y validado el 2026-09-03
- Evidencia en `PLAN-operational-profiles.md` (este archivo) y `docs/sdd-status.md`
