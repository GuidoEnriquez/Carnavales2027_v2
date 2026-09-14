# Spec 029 — Usuarios del seed de desarrollo

> Antecedente histórico: por pedido de producto del 2026-09-14, Spec030/T04
> retira este fixture básico y sus comandos; la capacidad se conserva en el
> único seed integral `seed:event:full`. Las validaciones previas son históricas.

## Fuente y alcance

Solicitud del responsable del proyecto (2026-09-14): incluir en el seed
permanente un ADMIN, tres jurados y un ESCRIBANO para probar escrutinio.
Alcance autorizado: cuentas de desarrollo/test y composición con el catálogo
de rubros existente. Implementación previa en revisión; no constituye evidencia
de cierre hasta completar `validation.md`.

- **RF-DEMO-01:** el comando de seed completo crea/reutiliza el ADMIN identificado
  por `SEED_ADMIN_EMAIL`, tres cuentas JUDGE y una ESCRIBANO, con perfiles
  registrados y roles separados. No selecciona un ADMIN arbitrario de la BD.
- **RF-DEMO-02:** una contraseña común sencilla, de 8–128 caracteres, se recibe
  por `SEED_DEMO_PASSWORD` o `SEED_ADMIN_PASSWORD`; nunca se versiona ni imprime.
  Better Auth crea/verifica credenciales. Solo perfiles del fixture comprobados
  pueden sincronizar su contraseña; un cambio revoca sesiones previas.
- **RF-DEMO-03:** repetir el seed, incluso concurrentemente, conserva IDs y
  cantidades. Reintentar un alta interrumpida con perfil INVITED usa reemisión
  y aceptación existentes. Suspensiones y conflictos de identidad se rechazan.
- **RF-DEMO-04:** las cuentas completan login y OTP real; ADMIN no hereda
  ESCRIBANO, los jurados requieren asignación para votar. No se fabrican
  sesiones, secretos 2FA compartidos, votos ni resultados liberados.
- **RF-DEMO-05:** `seed:test`/`db:seed:rubrics` compone Goya, catálogo/comparsas
  y usuarios. Configuración y entorno se validan antes de migrar/escribir.
  Solo `development` y `test` son admitidos; no se activa al arrancar producción.

Se preservan Spec-002/RF-25, RF-28–32; Spec-008/RF-65 y la segregación de
Specs 010/015. No se cambia el comportamiento HTTP ni las reglas de cómputo.
