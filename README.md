# Jev Organizer

Plugin personal de Obsidian que clasifica la nota activa con Jev de TypeSafe y la mueve a una carpeta elegida de tu lista. Interfaz en español. No añade propiedades ni etiquetas; Obsidian puede actualizar los enlaces al mover según tus preferencias.

## Requisitos

- Obsidian **1.11.4 o posterior**, en escritorio. Esta versión mínima permite usar el almacenamiento de secretos de Obsidian.
- Acceso a la API oficial de TypeSafe y una clave con acceso a Jev.
- Conexión a Internet al clasificar. No se necesita un servidor propio.

## Instalación personal

1. Descomprime `jev-organizer-0.2.0.zip`.
2. Copia la carpeta `jev-organizer` dentro de `.obsidian/plugins/` de tu bóveda. Si tu bóveda usa otro directorio de configuración, usa ese directorio en lugar de `.obsidian`.
3. Deben quedar juntos `main.js`, `manifest.json` y `styles.css` dentro de la carpeta del plugin.
4. En Obsidian, permite plugins comunitarios si hace falta, recarga la aplicación y activa **Jev Organizer**.
5. La primera activación crea `Por revisar` en la raíz. Si existe, la reutiliza sin tocar su contenido.

Para actualizar, desactiva el plugin, reemplaza únicamente esos tres archivos y vuelve a activarlo. Conserva `data.json`: contiene tus categorías y ajustes. El ZIP no contiene credenciales ni configuración de ninguna bóveda.

## Configuración

Abre **Ajustes → Jev Organizer**:

1. En **Clave de TypeSafe**, crea o selecciona un secreto con tu clave. Se gestiona mediante SecretStorage de Obsidian. El plugin guarda solo el identificador del secreto en su configuración. No publiques tu clave ni la pegues en notas.
2. Pulsa **Probar conexión**. Esta comprobación consulta los modelos de la cuenta; no envía notas ni garantiza por sí sola acceso a cada versión del modelo.
3. En **Selecciona las carpetas**, marca las casillas de todas las carpetas que quieras incluir. Puedes usar **Seleccionar todas** o **Deseleccionar todas**.
4. Pulsa **Aplicar selección**. Debajo aparecerá una tarjeta por carpeta seleccionada, con su nombre, descripción y ejemplos.
5. Completa la descripción de cada carpeta: qué artículos incluir y cuáles excluir. Las descripciones se guardan al escribir.

La lista incluye las subcarpetas como opciones independientes y excluye la carpeta de revisión. Desmarcar una carpeta la desactiva sin borrar archivos ni descripciones: si la vuelves a seleccionar, recuperas su configuración. El máximo es 254 carpetas seleccionadas; si lo superas, desmarca algunas antes de aplicar. Las categorías anteriores se cargan seleccionadas según su estado actual.

Ejemplo de descripción: «Modelos, agentes y herramientas de inteligencia artificial. Excluir artículos cuyo tema principal sea la organización personal, aunque mencionen IA».

La carpeta de revisión se puede cambiar. **Aplicar** crea la nueva carpeta si hace falta, pero no traslada las notas archivadas anteriormente. No puede ser también una categoría.

El umbral inicial de confianza es **0,80**. Si el resultado queda por debajo o ninguna categoría encaja, se usa la carpeta de revisión. Es una señal del modelo, no una promesa de un 80 % de aciertos. Hay un máximo de 254 categorías activas.

El modelo inicial es `jev-1.13.0`, una versión fija. Puedes cambiarlo en **Avanzado**; `jev-latest` sigue la versión estable más reciente y puede cambiar sus resultados con el tiempo.

## Uso

1. Abre una nota Markdown y escribe tu artículo.
2. Abre la paleta de comandos y ejecuta **Jev Organizer: Clasificar y archivar nota**.
3. El plugin guarda la nota, consulta Jev y la mueve conservando el nombre.
4. La notificación muestra el destino y ofrece **Deshacer**. También puedes ejecutar **Jev Organizer: Deshacer último movimiento**.

Asigna atajos propios desde **Ajustes → Atajos de teclado**. No hay ejecución automática al escribir ni clasificación masiva.

Deshacer conserva las ediciones realizadas después del movimiento. Solo recuerda el último movimiento exitoso de la sesión; se pierde al reiniciar o desactivar el plugin. Se detiene si la nota fue movida o eliminada, si su carpeta original desapareció o si hay otro archivo ocupando el destino de retorno.

## Comportamiento ante errores

- Si editas o mueves la nota mientras Jev responde, o cambias la configuración, el movimiento se cancela. Ejecuta el comando de nuevo.
- Si existe un archivo con el mismo nombre en el destino, no se sobrescribe ni se renombra automáticamente.
- Si la nota ya está en la carpeta correcta, permanece ahí.
- Una categoría cuya carpeta desapareció debe corregirse o desactivarse en ajustes. Los cambios de nombre de carpetas realizados mientras el plugin está activo actualizan las rutas configuradas, incluidos sus descendientes.
- La carpeta de revisión se recrea cuando se necesita. Si un archivo ocupa su ruta, se informa del conflicto.
- Sin conexión, con clave inválida, respuesta inesperada o nota que exceda el contexto de Jev, el archivo permanece en su ubicación. No se recorta el contenido ni se utiliza revisión como destino de errores técnicos.
- La consulta tiene un plazo de 30 segundos y un máximo de un reintento por errores HTTP transitorios. Las respuestas tardías no mueven archivos. El transporte de Obsidian puede completar en segundo plano una solicitud ya enviada; desactivar el plugin no recupera datos enviados a TypeSafe.
- Los enlaces se gestionan con la API de Obsidian y respetan tu ajuste de actualización automática de enlaces internos. Si lo tienes desactivado, no se garantiza su actualización.

## Datos enviados y almacenados

Se envían a `https://api.typesafe.ai` el título, Markdown completo (incluidas las propiedades existentes), nombres, descripciones y ejemplos de las categorías habilitadas. No se leen otras notas para dar contexto y no se expanden enlaces ni adjuntos. No se envían las rutas de las categorías. El servicio puede cobrar por las consultas según tu cuenta.

El plugin no tiene telemetría ni registra cuerpos de notas, claves o respuestas de la API. Las categorías se guardan por bóveda mediante la configuración de plugins. La clave se administra con el almacén de secretos de Obsidian; revisa sus opciones de almacenamiento y sincronización, ya que el plugin no añade cifrado propio.

## Desarrollo

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run package
```

`npm run dev` recompila al cambiar archivos. El empaquetado genera `release/jev-organizer-0.2.0.zip` y su SHA-256. El script de ZIP usa `/usr/bin/zip` y se ha preparado para macOS, el entorno de desarrollo de este proyecto. El plugin compilado no depende de ese comando.

La lógica se divide en configuración, contrato de decisión, cliente HTTP, coordinación del movimiento e integración con Obsidian. Las pruebas usan transportes y una bóveda simulados; no consumen la API ni modifican tus notas.

## Evaluación de clasificación

Se incluye `tests/evaluation-cases.json` con 24 ejemplos sintéticos en español: sirve para probar la conexión y detectar errores evidentes, no para medir precisión con artículos reales. Para evaluarlos, define `TYPESAFE_API_KEY` en el entorno y ejecuta:

```sh
npm run evaluate
```

No guardes la clave en el repositorio. El evaluador no carga archivos `.env`, no imprime claves o artículos y requiere una clave explícita. Envía los ejemplos al servicio y genera `release/evaluation-report.json` con identificadores, categorías y métricas.

Para evaluar artículos propios, crea fuera del repositorio un JSON con la misma estructura (`categories`, `cases` con `id`, `title`, `markdown`, `expected`) y ejecuta `npm run evaluate -- /ruta/absoluta/casos.json`. Usa al menos 20 artículos con categorías esperadas definidas antes de consultar. El identificador `needs-review` representa casos ambiguos o sin categoría. Puedes establecer `JEV_MODEL` y `JEV_THRESHOLD` en el entorno para comparar configuraciones.

La evaluación en vivo y la prueba visual en una bóveda real requieren tu acceso y configuración. Consulta `TESTING.md` para distinguir las comprobaciones automatizadas de las pendientes.

## Referencias

- [API oficial de TypeSafe](https://docs.typesafe.ai/api)
- [Confianza de Jev](https://docs.typesafe.ai/confidence)
- [Modelos e idiomas](https://docs.typesafe.ai/models)
- [API pública de Obsidian](https://github.com/obsidianmd/obsidian-api)
