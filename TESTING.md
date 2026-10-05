# Estado de validación

## Verificado automáticamente

- `npm run build`: comprobación TypeScript estricta y bundle de producción correctos.
- `npm test`: **40 pruebas aprobadas**, repartidas en 28 pruebas de lógica/cliente, 8 pruebas del adaptador Obsidian con bóveda simulada y 4 de selección múltiple y conservación de configuración.
- Clasificación por lista cerrada, umbral exacto, categoría desconocida, distribución inválida y límite de categorías.
- Guardado del contenido actual antes de clasificar, creación inicial idempotente de revisión y protección de archivos que ocupan esa ruta.
- Cancelación ante cambios del texto, ruta, configuración, revisión o desactivación del plugin mientras responde Jev.
- Colisiones, carpetas inexistentes, regreso a la raíz, conservación de ediciones al deshacer y archivos movidos externamente.
- Prueba de conexión sin texto de notas, autenticación inválida, reintento limitado, Retry-After y descarte de respuestas tardías.
- Persistencia de referencias a secretos sin guardar la clave en los ajustes.

Las pruebas no hacen llamadas reales a TypeSafe. La bóveda simulada comprueba cómo usa el plugin la API pública, pero no reproduce todo el comportamiento interno ni la interfaz de Obsidian.

## Pendiente de validación en la aplicación

Usar Obsidian 1.11.4 o posterior y una bóveda de prueba con copias de notas:

1. Instalar el ZIP y activar el plugin. Verificar que aparece `Por revisar` una sola vez y que la pantalla de ajustes funciona con temas claro y oscuro.
2. Crear o seleccionar el secreto de TypeSafe, probar conexión y configurar dos carpetas con descripciones.
3. Clasificar una nota que todavía tenga cambios recientes y comprobar que el texto completo se conserva.
4. Repetir con otra nota enlazada a ella, comprobando los enlaces con la opción de actualización automática habilitada y deshabilitada.
5. Editar una nota inmediatamente después de iniciar la consulta. Debe detenerse el movimiento.
6. Clasificar contenido que no corresponda a ninguna categoría y confirmar el destino de revisión.
7. Probar una colisión de nombre, deshacer después de editar y desactivar el plugin durante una consulta.
8. Reiniciar Obsidian y comprobar categorías, referencia al secreto y ausencia de historial de deshacer de la sesión anterior.

No se ha instalado el plugin en ninguna bóveda personal ni se ha realizado esta prueba visual en Obsidian.

## Evaluación de Jev

`tests/evaluation-cases.json` contiene **24 ejemplos sintéticos en español**, etiquetados previamente, para una primera prueba. El evaluador reutiliza la construcción de solicitudes, validación y reglas de destino del plugin.

No se ha ejecutado la evaluación en vivo: no se ha proporcionado una clave a este proyecto. No hay cifras de precisión verificadas. Los ejemplos sintéticos tampoco sustituyen la evaluación acordada con al menos 20 artículos reales y categorías esperadas definidas por el usuario.

Después de configurar acceso, seguir el procedimiento de `README.md`. Revisar aciertos, envíos a revisión, errores de clasificación y errores técnicos por separado. Ajustar descripciones y umbral con un conjunto de desarrollo, y verificar el resultado en artículos distintos antes de confiar en movimientos frecuentes.

## Versión 0.2.0

Selección múltiple con casillas, seleccionar/deseleccionar todas y aplicación explícita. Pruebas de preservación de descripciones e identificadores, subcarpetas independientes, carpetas eliminadas durante la selección y límite de 254 categorías. La interfaz nueva aún requiere comprobación visual dentro de Obsidian. El usuario confirmó que la versión 0.1.0 funciona en su instalación.

## Versión 0.2.1 — preparación del catálogo

`npm run check` pasa: lint oficial sin errores, compilación, 40 pruebas y validación de metadatos/archivos de release. Quedan dos advertencias de compatibilidad: API de ajustes anterior para Obsidian 1.11.4 y tooltip del deslizador. El cliente compartido con el evaluador Node usa temporizadores portables; esa recomendación del linter se desactiva solo para ese archivo.

Se sustituyó el tipado inseguro de respuestas por validación explícita y se usan encabezados nativos en ajustes. No se ha realizado una nueva prueba visual de 0.2.1 ni se afirma aprobación por el catálogo. El workflow de CI repite las comprobaciones sin claves ni llamadas a TypeSafe.
