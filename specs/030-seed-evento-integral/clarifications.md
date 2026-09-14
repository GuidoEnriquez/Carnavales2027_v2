# Equivalencias y diferencias — Spec 030

1. PostgreSQL + pg SQL directo, JS/ESM, sin ORM/TypeScript en API. Reutilizar.
2. READY se representa CONFIGURING + readiness true; SCHEDULED de jornada
   equivale a night.DRAFT. Asignación confirmada = PRIMARY/ACTIVE. No estados nuevos.
3. ADMIN abre evento, cambia la jornada DRAFT→OPEN y abre su votación por los
   endpoints vigentes. Las otras jornadas conservan DRAFT y ninguna planilla.
   No se crea una regla global de exclusión entre ventanas ya abiertas.
4. Ballot es jurado+noche (contiene todas las comparsas). Se crea al abrir
   votación; el seed conserva cero filas. Los estados PENDING/NULL se generan
   por el servicio al abrir, no por INSERT de votos en el seed.
5. Comparsa no tiene code: códigos TEST-* quedan como claves del fixture;
   la BD usa UUIDs por evento con nombres Ará Porá, Imperio del Sur, etc.
   Códigos JURY-* identifican correos ficticios estables y asignaciones;
   la especialidad está en asignación, nunca en perfil global de jurado.
6. Rubric.type gobierna Mejor Comparsa; no duplicar countsTowardComparsa.
   No tabla comparsa/rubro: cobertura por evento, siete por 25. Los rubros
   aleatorios quedan sin nominaciones; el generador actual materializa todos
   los ítems activos por comparsa, no un circuito de candidatos individuales.
7. Mantener ítems integrales y especialidades del catálogo de testing
   aprobado por producto en la conversación anterior; no son planilla oficial.
8. Extensión mínima: night_troupe_schedule.scheduled_at (TIMESTAMPTZ),
   scheduled_timezone (zona IANA) y order_source. Opcionales para historia,
   únicamente descriptivos, sin activar límites horarios ni retrasos automáticos.
   El horario pertenece a la participación, no al puesto; reordenar no lo
   recalcula. Corregir cronograma general desde UI queda fuera de este seed.
9. No campos de evento para slug/año/metadata: usar configuration_seed como
   identidad y audit_event como procedencia, con definición versionada en JS.
10. No catálogo de penalizaciones: troupe_penalty almacena puntos ENTEROS
    aplicados al total, sin unidad MINUTE ni deducción de rubro. No cargar
    reglas 0.50 ni penalizaciones sobre Batería que contradigan Spec014/RF118.
11. Offline sigue diferido por Specs005/012. Los incidentes locales/sync del
    pedido no pueden probarse como capacidad operativa. UUIDs/updated_at y
    revisiones de ballots conservan sus defaults; no inventar syncStatus.
12. ESCRIBANO/VEEDOR son roles globales: ven las tres jornadas según sus
    permisos existentes, sin nueva tabla de membresía ni permisos JUDGE.
13. No suplentes ni reemplazos activos. Para probar suplencia priorizada,
    ADMIN deberá reservar suplente y ampliar cuota antes de abrir (Spec013).
14. **[NECESITA ACLARACIÓN]** El motor de desempate actual identifica Mejor
    Batería con `rubricCode === 'BATERIA'` (`results-service.js:272`); el catálogo
    solicitado usa `BATERIA_COMPARSA`. No se cambia el código reglamentario del
    fixture ni se añade un alias hardcodeado al cálculo. La selección configurable
    del rubro para ese criterio requiere un incremento de resultados. Este
    fixture no valida dicho desempate; el resto de su configuración sí se valida.

15. El pedido de eliminar seeds anteriores autoriza retirar sus scripts,
    fixtures, aliases y tests específicos. Se conservan auxiliares internos
    del único seed integral (catálogo, identidades, persistencia de rubros).
    No implica eliminar eventos, usuarios ni votos ya almacenados. Los RF de
    configuración inicial permanecen cubiertos por el seed integral.
