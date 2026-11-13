# Figuras del documento técnico

Fuentes editables de las figuras del documento técnico. Cada imagen se genera a partir de su HTML, así que para cambiar un diagrama se edita el HTML y se vuelve a generar. Nadie tiene que redibujarlo a mano.

| Figura | Fuente | Imagen |
|---|---|---|
| Figura 1. Arquitectura desplegada | `figura1-arquitectura.html` | `figura1-arquitectura.png` / `.jpg` |
| Figura 2. Modelo entidad-relación (14 tablas) | `figura2-modelo-datos.html` | `figura2-modelo-datos.png` / `.jpg` |

## Regenerar las imágenes

Desde la raíz del repositorio, en PowerShell (usa el Electron que ya trae la app, sin instalar nada):

```
$env:ELECTRON_RUN_AS_NODE = $null
app-inicio-windows\node_modules\.bin\electron docs\Hito2\figuras\capturar.cjs
```

También se pueden abrir los HTML en el navegador para revisarlos.

## Mantenerlas al día

- La Figura 2 debe coincidir con `db/init.sql`. Si una migración agrega o cambia una tabla, hay que actualizar el HTML.
- Las flechas se dibujan solas desde cada llave foránea (`link(...)` al final del HTML): basta agregar una línea por relación nueva.
