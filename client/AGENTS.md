# Frontend Design Brief - Carnavales de Goya 2027

## Alcance y restricciones vigentes

Este documento guía el diseño de experiencia e interfaz del cliente. No autoriza por sí solo cambios de comportamiento: antes de implementar una capacidad nueva se debe cumplir el flujo SDD definido en `../AGENTS.md`.

- **Offline-First:** conexión y sincronización siguen diferidas. Los estados visuales de esta guía pueden diseñarse y prototiparse, pero no habilitan una capacidad operativa hasta contar con una spec aprobada posterior a Spec 005.
- **Inmutabilidad por ítem:** Spec 007 está aprobada. Una decisión que el jurado confirma para un ítem queda inmutable de inmediato. Por ello, "Modificar puntuaciones" solo puede aplicar a ítems aún `PENDING`; no se debe diseñar ni implementar una edición posterior de `SCORED` o `NOT_PRESENTED`.
- **Completitud:** `PENDING` bloquea la confirmación de la planilla y el cierre administrativo. Nunca crear puntajes automáticos, el "5 por equidad", subsanaciones ni una opción `0` en la escala ordinaria.
- **Perfiles Operativos:** Implementados en AdminJudgesPage con creación de perfiles auxiliares (VEEDOR, COMISARIO, SCRUTINEER, ESCRIBANO), invitación por consola/SMTP y aceptación solo password en `#/invitations/operational/accept`.
- **Servidor autoritativo:** los indicadores de UI no sustituyen sesión, 2FA, roles, asignación, integridad ni controles API.

---

Actúa como Principal Product Designer + Senior UX Designer especializado en aplicaciones críticas, sistemas Offline-First e interfaces táctiles.

Usa este brief para diseñar en Figma y, cuando la tarea solicite código, para implementar la experiencia en el cliente React/Vite del **Sistema de Votación Digital - Carnavales de Goya 2027**. Un agente de código no debe afirmar que creó o modificó un archivo de Figma si no cuenta con una integración real para hacerlo.

## Ejecución en el cliente actual

Preservar las rutas existentes y adaptar el diseño progresivamente:

- Login: `#/login`.
- Home del jurado: `#/judge`.
- Planilla del jurado: `#/judge/ballot?ballotId=:ballotId`.
- Personas y accesos: `#/admin/judges`.
- Control de votación: `#/admin/voting`.
- Aceptación de invitación operativa: `#/invitations/operational/accept`.

Antes de modificar una pantalla, leer la spec, clarificaciones, plan, tareas y validación del incremento afectado. Implementar solo los estados que estén aprobados para operación; representar los demás como prototipo, nunca como comportamiento activo.

## 1. Objetivo del producto

El sistema reemplaza las planillas físicas utilizadas por los jurados durante las noches de competencia del Carnaval.

Es una PWA responsive para celulares, tablets y notebooks/desktop. Su contexto principal es el corsódromo: de noche, con ruido, bajo presión, iluminación variable y posible Wi-Fi/internet inestable. El jurado debe concentrarse en la comparsa, no en aprender el software.

**Principio UX:** "La interfaz debe impedir errores sin entorpecer al jurado."

El usuario nunca debe preguntarse:

- ¿Se guardó mi nota?
- ¿Me falta votar algo?
- ¿Tengo Internet?
- ¿Esta planilla ya está cerrada?
- ¿Qué comparsas me faltan?
- ¿Puedo modificar este voto?

Todo debe ser evidente visualmente.

## 2. Estilo visual

Diseñar una interfaz profesional e institucional, no festiva ni infantil. **Dark mode por defecto.**

Inspiración visual:

- Aplicaciones deportivas profesionales.
- Sistemas de control de eventos.
- Dashboards modernos.
- Interfaces táctiles de misión crítica.

Paleta sugerida:

| Uso | Color |
|---|---|
| Background principal | `#090D16` |
| Surface | `#111827` |
| Surface elevada | `#182233` |
| Border | `#293548` |
| Texto principal | `#F8FAFC` |
| Texto secundario | `#94A3B8` |
| Primary | `#3B82F6` |
| Success | `#22C55E` |
| Warning | `#F59E0B` |
| Danger | `#EF4444` |

No usar colores como único indicador: acompañar siempre color, icono y texto. Usar Inter o una sans-serif equivalente altamente legible. Los botones táctiles tendrán al menos 48px de altura; preferentemente 52-64px en operaciones importantes.

### Referencia visual aprobada - 2026-09-01

Las referencias entregadas para login, confirmación de asignación, votación, revisión y home son la dirección visual vinculante para este cliente:

- Fondo azul noche profundo con una trama de puntos muy tenue; nunca usar fondos claros en el flujo operativo del jurado.
- Superficies azul pizarra delimitadas por bordes gris azulado, sombras discretas y acentos azul lavanda para la acción primaria y la selección.
- Jerarquía compacta: identidad del carnaval arriba, títulos grandes en mayúscula cuando corresponda, etiquetas y metadatos en `ui-monospace` con espaciado amplio.
- En móvil, los puntajes 1 a 10 se muestran en una grilla de dos columnas con controles grandes; la acción `No se presentó` queda separada.
- Home con cards de gran tamaño, estado textual, progreso y acción visible; escritorio puede sumar navegación lateral de comparsas.
- La revisión usa superficies de solo lectura y total destacado. No implementar `Modificar puntuaciones`: una decisión confirmada es inmutable por Spec 007.
- La pantalla de confirmación de asignación es una referencia de contexto visual. No crear un paso de flujo, persistencia ni autorización nueva sin una spec posterior aprobada.

## 3. App shell

Crear una estructura persistente.

```text
[Carnavales 2027]                          [Noche 2]
[Jurado: Vestuario]
```

**Nota:** El indicador de conexión fue retirado de la UI (decisión 2026-09-03). Los fallos de red se gestionan reactivamente al momento del intento; la app opera 100% online.

## 4. Login

Pantalla minimalista:

```text
CARNAVALES
GOYA 2027

Sistema de Jurados

[ Usuario / DNI ]
[ Contraseña ]
[ INGRESAR ]

● Dispositivo conectado
```

Evitar elementos administrativos innecesarios. Después del login no llevar directamente a votar.

## 5. Confirmación de asignación

Mostrar claramente:

```text
NOCHE 2
Sábado 13 de febrero

Jurado
Juan Pérez

Especialidad
VESTUARIO

Comparsas habilitadas
4

[ CONFIRMAR Y COMENZAR ]
```

El objetivo es evitar que un jurado vote accidentalmente en una noche o especialidad incorrecta.

## 6. Home del jurado

Esta es una de las pantallas más importantes.

```text
Buenas noches, Juan
NOCHE 2 · VESTUARIO

████████░░  68%
Comparsas evaluadas: 2 / 4
```

Mostrar cards grandes:

```text
┌──────────────────────────────┐
│ ARA BERÁ                     │
│                              │
│ ● EN PROGRESO                │
│ 8 / 12 ítems                 │
│ ████████░░░░                 │
│                 CONTINUAR →  │
└──────────────────────────────┘

┌──────────────────────────────┐
│ PORAMBÁ                      │
│                              │
│ ○ SIN EMPEZAR                │
│ 0 / 12 ítems                 │
│                  COMENZAR →  │
└──────────────────────────────┘

┌──────────────────────────────┐
│ ITÁ VERÁ                     │
│                              │
│ ✓ CERRADA                    │
│ 🔒 Planilla confirmada       │
└──────────────────────────────┘
```

Estados: `SIN EMPEZAR`, `EN PROGRESO`, `LISTA PARA REVISAR`, `CERRADA`.

Permitir navegación libre entre comparsas mientras las planillas no estén cerradas.

## 7. Pantalla de votación

Debe ser la pantalla con menor carga cognitiva.

```text
← Comparsas

ARA BERÁ
VESTUARIO

Progreso: 6 / 12

DISEÑO E INTERPRETACIÓN

Seleccioná una puntuación

[ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]
[ 6 ] [ 7 ] [ 8 ] [ 9 ] [ 10 ]

                8
            MUY BUENO
```

Los botones deben ser muy grandes. Al seleccionar, la decisión propuesta debe quedar extremadamente clara. No usar un input numérico tradicional como interfaz principal.

La selección debe abrir el modal de confirmación por ítem exigido por Spec 007. Solo después de confirmarla queda persistida e inmutable.

## 8. Regla del cero

El `0` no debe aparecer junto a `1-10` como si fuese una puntuación. Crear la acción secundaria:

```text
[ NO SE PRESENTÓ ]
```

Al tocarla, mostrar:

```text
¿El rubro no se presentó?

Esta opción registra 0 puntos y debe utilizarse únicamente
cuando el rubro correspondiente no fue presentado.

[ CANCELAR ]
[ CONFIRMAR 0 - NO SE PRESENTÓ ]
```

Debe ser visualmente diferente de una puntuación normal y, al confirmarla, deja el ítem `NOT_PRESENTED` e inmutable.

## 9. Navegación entre ítems

Parte inferior:

```text
[ ← ANTERIOR ]                          [ SIGUIENTE → ]
```

El feedback de guardado debe ser pequeño y no modal:

```text
✓ Guardado en este dispositivo
↻ Sincronizando...
```

Nunca mostrar modales de "Guardado correctamente". El guardado debe sentirse automático.

## 10. Offline-First

**Estado de diseño futuro:** mientras Offline-First esté diferido, estos estados son solo material de prototipo y no comportamiento operativo.

Si se pierde Internet, el diseño previsto no debe bloquear la pantalla:

```text
● OFFLINE
Podés continuar votando. Tus votos están guardados en este dispositivo.
```

Al recuperar conexión:

```text
↻ Sincronizando 3 cambios
✓ Todo sincronizado
```

El jurado no debe realizar una acción manual para recuperar sincronización normal.

## 11. Prevención de omisiones

Una planilla no puede confirmarse si existen ítems `PENDING`. Al intentar revisar o cerrar, detectar todos los faltantes:

```text
┌──────────────────────────────────┐
│ FALTAN PUNTUACIONES              │
│                                  │
│ Antes de cerrar Ara Berá         │
│ completá estos ítems:            │
│                                  │
│ ! Calidad del vestuario          │
│ ! Terminación                    │
│ ! Originalidad                   │
│                                  │
│ 3 ítems pendientes               │
│                                  │
│ [ VOLVER Y COMPLETAR ]           │
└──────────────────────────────────┘
```

Cada ítem debe ser pulsable para navegar directamente al faltante. No completar automáticamente ningún voto ni usar `5` para subsanar una omisión.

## 12. Revisión de planilla

Cuando todos los ítems estén completos, mostrar una revisión de solo lectura:

```text
ARA BERÁ
REVISIÓN FINAL

Diseño e interpretación          8
Calidad                           9
Originalidad                      7
Terminación                       8
Armonía                           9

----------------------------------
TOTAL
83 puntos
```

La revisión debe distinguir claramente `SCORED`, `NOT_PRESENTED` y `PENDING`. Por Spec 007, no ofrecer `MODIFICAR PUNTUACIONES` para decisiones confirmadas; la cancelación solo es posible antes de confirmar cada ítem en su modal.

## 13. Confirmación crítica

Botón principal:

```text
[ CONFIRMAR PLANILLA ]
```

No cerrar inmediatamente. Mostrar un modal crítico:

```text
CONFIRMAR PLANILLA

Estás por cerrar definitivamente la evaluación de:
ARA BERÁ

Total: 83 puntos

Una vez confirmada, esta planilla no podrá modificarse.

[ CANCELAR ]
[ CONFIRMAR Y CERRAR ]
```

Evitar botones juntos que puedan generar errores táctiles.

## 14. Planilla cerrada

Después de confirmar:

```text
✓ PLANILLA CONFIRMADA
ARA BERÁ
83 puntos
🔒 Evaluación cerrada
Confirmada: 23:41
✓ Sincronizada con servidor

[ VOLVER A COMPARSAS ]
```

Cambiar visualmente a lectura. Eliminar controles de edición; no mostrar inputs deshabilitados como si aún fuese editable.

## 15. Cierre de la noche

El diseño futuro del home puede representar progreso completo:

```text
ARA BERÁ       ✓
PORAMBÁ        ✓
ITÁ VERÁ       ✓
AYMARÁ         ✓

4 / 4 comparsas
✓ Todas las planillas están cerradas.
```

El flujo operativo `FINALIZAR NOCHE` debe ajustarse a una spec aprobada antes de implementarse. Si se prototipa:

```text
FINALIZAR PARTICIPACIÓN

Confirmaste todas tus planillas.
Al finalizar la noche ya no tendrás evaluaciones pendientes.

[ VOLVER ]
[ FINALIZAR ]
```

## 16. Casos excepcionales

Diseñar estados específicos para:

1. Sin conexión.
2. Sincronización pendiente.
3. Error de sincronización.
4. Sesión expirada.
5. Jurado reemplazado durante la noche.
6. Planilla bloqueada por Escribano/Administrador.
7. Comparsa que no se presentó.
8. Rubro que no se presentó.
9. Intento de cerrar una planilla incompleta.
10. Voto local pendiente de sincronización.
11. Servidor temporalmente inaccesible.

Nunca perder el voto ingresado por el jurado. Los estados de offline, sincronización y bloqueo administrativo requieren spec antes de ser operativos.

## 17. Responsive

Crear tres variantes:

| Variante | Frame |
|---|---|
| Mobile | 390 x 844 |
| Tablet | 768 x 1024 |
| Desktop | 1440 x 900 |

Mobile usa una columna. Tablet puede incorporar navegación lateral. Desktop debe usar una sidebar de comparsas, no ser un mobile gigante:

```text
┌────────────────┬─────────────────────────────┐
│ NOCHE 2        │ ARA BERÁ                    │
│ Comparsas      │ VESTUARIO                   │
│ ● Ara Berá     │ Diseño e interpretación     │
│ ○ Porambá      │                             │
│ ✓ Itá Verá     │ 1 2 3 4 5                  │
│ ○ Aymará       │ 6 7 8 9 10                 │
│                │ ✓ Guardado                  │
└────────────────┴─────────────────────────────┘
```

## 18. Design system

Crear componentes Figma reutilizables:

- `Button`
- `ScoreButton`
- `ComparsaCard`
- `StatusBadge`
- `ConnectionBadge`
- `ProgressBar`
- `VotingItem`
- `ScoreSummary`
- `Modal`
- `Alert`
- `BottomNavigation`
- `Sidebar`
- `Header`
- `SyncStatus`
- `LockedSheet`
- `NotPresentedButton`

Crear variantes `default`, `hover`, `pressed`, `selected`, `disabled`, `warning`, `error`, `success`, `offline` y `locked` cuando correspondan.

## 19. Prototipo

Crear conexiones navegables en Figma para demostrar:

```text
Login
↓
Confirmar noche
↓
Home
↓
Seleccionar comparsa
↓
Votar
↓
Cambiar de ítem
↓
Detectar faltantes
↓
Completar faltantes
↓
Revisar
↓
Confirmar
↓
Planilla bloqueada
↓
Volver al Home
↓
Completar todas las comparsas
↓
Finalizar noche
```

Crear además un segundo flujo de prototipo futuro:

```text
Votando
↓
Se pierde Internet
↓
Continuar votando
↓
Voto guardado localmente
↓
Regresa Internet
↓
Sincronización automática
↓
Voto sincronizado
```

## 20. Principios UX obligatorios

1. No depender de Internet para ingresar una nota cuando Offline-First sea una capacidad aprobada.
2. No permitir cerrar una planilla con `PENDING`.
3. No inventar ni completar automáticamente notas faltantes.
4. Diferenciar claramente `SCORED`, `NOT_PRESENTED` y `PENDING`.
5. Un voto confirmado debe verse inmutable.
6. Las acciones irreversibles requieren confirmación explícita.
7. Reducir al mínimo la escritura manual.
8. Priorizar controles táctiles.
9. Mantener visible el estado de conectividad.
10. Mantener visible el progreso.
11. Permitir navegación libre antes del cierre.
12. Evitar modales innecesarios.
13. Usar modales únicamente para errores, faltantes y operaciones irreversibles.
14. Diseñar para operación nocturna y bajo presión.
15. Hacer la interfaz comprensible sin capacitación extensa.
