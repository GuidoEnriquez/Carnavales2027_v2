# Clarificaciones — Spec 019

## Decisiones registradas

### T08 — Sesión y confianza en proxies (aprobada el 2026-09-10)

- La excepción sensible se limita al pathname exacto `/api/auth/get-session` con método GET/HEAD; una query no cambia la clasificación. Otros métodos, subrutas y variantes no reciben la excepción. Se evalúa fuera del `skip` inyectable del limiter para conservarla también en pruebas.
- Se agrega una instancia separada del límite general (300/min/IP) para autenticación. Se mantiene un único cupo sensible compartido de 10/15min/IP para las demás operaciones, incluidos login y OTP; no se afirma soporte nuevo para muchos usuarios en una misma IP.
- `TRUST_PROXY` se recorta antes de interpretar. Ausente equivale a `1` numérico por compatibilidad; `0`/`false` equivalen a `false`; enteros seguros no negativos equivalen a saltos. Las listas separadas por comas admiten IP IPv4/IPv6, CIDR con prefijo numérico válido y alias `loopback`, `linklocal`, `uniquelocal`. Se rechazan listas vacías, alias desconocidos, `true`, prefijos /0 que confían en toda una familia, negativos y enteros fuera de rango seguro. Un error no incluye el valor recibido.
- Desarrollo con acceso directo a Node: configurar `TRUST_PROXY=0`. Producción: confiar solo en el proxy real; un número de saltos requiere que todas las rutas de acceso tengan esa topología y que Node no sea accesible directamente.
- No se modifica el bloqueo de Better Auth ni la configuración de las invitaciones. Los tests nuevos de auth/proxy no requieren PostgreSQL; las regresiones de integración usan una base aislada.

1. **Almacenamiento de Rate Limiter:**
   - Para la versión actual (despliegue de nodo único), `express-rate-limit` utilizará el almacén en memoria (`MemoryStore`) por defecto.
   - El diseño del middleware encapsula el almacén de modo que si se escala a múltiples instancias en el futuro, baste configurar un `store` basado en Redis sin alterar los controladores ni las rutas.

2. **Formato y manejo de `Idempotency-Key`:**
   - Se acepta el encabezado estándar `Idempotency-Key` (y alternativamente `X-Idempotency-Key` para compatibilidad).
   - El valor debe ser un UUID v4 válido. Si no se suministra el encabezado, los endpoints de planilla operan de manera tradicional (sin reintentos idempotentes automáticos).
   - Si se reintenta una operación con la misma clave y el mismo hash de contenido, se devuelve la entidad con HTTP 200 y encabezado `Idempotency-Replay: true`.

3. **Migración 068 — Cadena de integridad en `audit_event`:**
   - La tabla `audit_event` ya poseía las columnas `hash_chain_version`, `previous_hash` y `event_hash` agregadas en la migración 058 para el sorteo ceremonial (`hash_chain_version = 1`).
   - La migración 068 reemplaza el `CHECK` constraint para admitir `hash_chain_version = 2` para todos los eventos del sistema, mientras mantiene los registros preexistentes:
     - Eventos históricos sin hash (`hash_chain_version IS NULL`).
     - Eventos de sorteo ceremonial históricos (`hash_chain_version = 1`).
     - Nuevos eventos auditados generales (`hash_chain_version = 2`).
   - Se crea la tabla `general_audit_hash_chain_head` con una única fila (singleton) inicializada con el hash del último evento o con el hash génesis (`'0'.repeat(64)`).

4. **Bloqueo de cuenta OTP en Better Auth:**
   - Se comprobó que Better Auth 1.6.27 implementa por defecto el bloqueo temporal de cuenta (`lockedUntil = Date.now() + 15 * 60 * 1000`) tras 10 intentos fallidos de OTP en `twoFactor.verifyOTP`.
   - Spec 019 incluye una prueba de integración explícita que documenta y verifica este comportamiento sin re-implementar una capa redundante.

5. **Estrategia de reintento ante Deadlock (`40P01`):**
   - El reintento se limita estrictamente a errores con `error.code === '40P01'`.
   - Se realizarán como máximo 2 reintentos (3 intentos totales).
   - Entre intentos se introduce un delay asíncrono aleatorio con jitter: `delay = (2 ** attempt * 25) + Math.random() * 25` ms.
