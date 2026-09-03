# AGENTS.md — Backend Carnavales2027

Este archivo complementa al AGENTS.md general del proyecto. Contiene reglas y contexto específicos del backend. Ante un conflicto, el AGENTS.md de la raíz del proyecto tiene prioridad.

## Stack

- Node.js + Express
- PostgreSQL como base de datos
- Better Auth para autenticación y sesiones
- 2FA: código OTP enviado por email

## Alcance del proyecto

Backend para la plataforma de gestión y votación de Carnavales, incluyendo:

- **Autenticación:** Registro, login (email + contraseña), 2FA con OTP, sesiones.
- **Configuración:** Eventos, noches, categorías, comparsas, especialidades, rubros, ítems, criterios.
- **Jurados:** Padrón, invitaciones, aceptación, 2FA, suspensión/reactivación, asignaciones, reemplazos.
- **Votación:** Planillas por jurado, puntuaciones por comparsa, confirmación inmutable, completitud obligatoria.
- **Perfiles Operativos:** Alta unificada de roles auxiliares (VEEDOR, COMISARIO, SCRUTINEER, ESCRIBANO), invitación por consola/SMTP, aceptación solo password.
- **Resultados:** Consolidación de puntajes, rankings, desempate por criterios 1 y 2, sorteo ceremonial.
- **Penalizaciones:** Gestión reglamentaria de `troupe_penalty`, deducción en Mejor Comparsa.
- **Escrutinio y Actas:** Certificación de escrutinio, actas oficiales con sello JCS/SHA-256.

## Estructura del código

```
api/src/
├── app.js                    # Creación de Express + middleware
├── server.js                 # Inicio del servidor
├── audit/                    # Eventos de auditoría
├── auth/                     # Configuración de Better Auth, 2FA, OTP
├── db/
│   ├── client.js             # Conexión PostgreSQL
│   ├── migrations/           # Migraciones SQL (001-065)
│   └── seeds/                # Seeds de datos iniciales
├── modules/                  # Módulos de negocio
│   ├── ballots/              # Planillas y puntuaciones
│   ├── events/               # Eventos, noches, categorías
│   ├── judges/               # Jurados, invitaciones, asignaciones
│   ├── operational-profiles/ # Perfiles operativos (VEEDOR, COMISARIO, etc.)
│   ├── penalties/            # Penalizaciones (troupe_penalty)
│   ├── results/              # Consolidación de resultados, rankings, desempate
│   ├── rubrics/              # Rúbricas, ítems, criterios
│   ├── scrutiny-records/     # Actas oficiales (official_scrutiny_record)
│   ├── specialties/          # Especialidades
│   ├── troupes/              # Comparsas, nominaciones
│   └── users/                # Usuarios Better Auth
├── routes/                   # Rutas agrupadas
├── scripts/                  # Scripts de utilidad (seeds, migración)
└── tests/                    # Tests de integración API
```

## Reglas de seguridad (no negociables)

- Nunca loguear contraseñas, códigos OTP ni tokens en consola o logs persistentes.
- La gestión de contraseñas, hashing y sesiones se delega en Better Auth; no reimplementar hashing manual (nada de argon2/bcrypt directo) ni manejo de sesiones por fuera de lo que provee la librería.
- Toda configuración de Better Auth (adapters, secretos, proveedores) va vía variables de entorno.
- Los códigos OTP deben tener expiración corta (5–10 minutos) y ser de un solo uso.
- Guardar en base de datos el hash del código, no el código en texto plano.
- Aplicar rate limiting en endpoints de login, registro y verificación/reenvío de OTP.
- Nunca exponer en las respuestas de la API si un email existe o no en la base (evitar enumeración de usuarios): usar mensajes genéricos.
- Variables sensibles (credenciales DB, secretos de sesión/JWT, credenciales del proveedor de email) siempre vía variables de entorno, nunca hardcodeadas.
- **Prohibido commitear** `.env`, contraseñas, tokens ni secretos.

## Convenciones de código

- Módulos organizados por dominio en `modules/` (service + controller + routes).
- Controladores async/await con manejo de errores centralizado.
- Validación de inputs antes de llegar a la lógica de negocio.
- Estados implementados con columnas `TEXT` y restricciones `CHECK`; no se usan tipos `ENUM` nativos.
- Auditoría append-only en tablas de historia.
- Transacciones para operaciones que modifican múltiples tablas.

## Variables de entorno relevantes

- `DATABASE_URL` — Conexión PostgreSQL
- `TEST_DATABASE_URL` — Base de datos de pruebas (aislada)
- `BETTER_AUTH_SECRET` — Secreto de Better Auth
- `EMAIL_PROVIDER` — `console` (desarrollo) o `smtp` (producción)
- `SMTP_*` — Credenciales de email (producción)
- `FRONTEND_URL` — URL del cliente para links de invitación
- `JUDGE_INVITATION_TTL_HOURS` — Vencimiento de invitaciones (default: 72)

## Testing

- Priorizar tests de casos límite de seguridad: OTP expirado, OTP ya usado, múltiples intentos fallidos, emails duplicados.
- Mockear el envío real de emails en tests (no enviar emails reales durante testing).
- Tests de integración API en `api/src/tests/`.
- Migraciones deben ser reproducibles y no destructivas.

## Qué evitar

- No implementar 2FA por SMS ni TOTP salvo que se indique explícitamente un cambio de enfoque.
- No reimplementar hashing de contraseñas ni manejo de sesiones "a mano" por fuera de Better Auth.
- No commitear el archivo `.env` ni secretos.
- No modificar módulos diferidos (Offline-First, publicación externa de resultados) sin incremento SDD aprobado.
