# iconruler

Herramienta web para generar, de una sola vez, todo el set de íconos que necesita un sitio: favicons, apple-touch-icon, íconos de Android y el `site.webmanifest`. Subís un logo `.png`, elegís (o arrastrás) el archivo, y descargás todo listo para pegar en el `<head>` de tu proyecto.

Sin backend, sin subir la imagen a ningún servidor: todo el recorte y el escalado corre en el navegador, con Canvas API.

## Qué genera

A partir de un único logo en PNG:

| Archivo                        | Tamaño     | Uso                                  |
|---------------------------------|------------|---------------------------------------|
| `favicon-16x16.png`             | 16×16      | Pestaña del navegador (chica)         |
| `favicon-32x32.png`             | 32×32      | Pestaña del navegador / barra         |
| `apple-touch-icon.png`          | 180×180    | iOS, al agregar el sitio a inicio     |
| `android-chrome-192x192.png`    | 192×192    | Android / manifest                    |
| `android-chrome-512x512.png`    | 512×512    | Android / splash screen               |
| `favicon.ico`                   | 16/32/48   | Compatibilidad con navegadores viejos |
| `site.webmanifest`              | —          | Metadata de PWA / instalación         |

Además genera el snippet HTML listo para copiar y pegar en el `<head>`:

```html
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```

## Cómo funciona

1. **Drag & drop o selección de archivo** — validación de que sea un `.png`.
2. **Centrado sin deformar** — si el logo no es cuadrado, se centra sobre un lienzo transparente cuadrado antes de escalar, para que ningún ícono salga estirado.
3. **Escalado en pasos** — el resize se hace reduciendo de a mitades (no en un único salto), para que los tamaños chicos (16px) no salgan pixelados si el logo original es muy grande.
4. **Empaquetado** — todos los archivos se comprimen en un `.zip` con [JSZip](https://stuk.github.io/jszip/) y se descargan con un solo click.

## Uso

No requiere instalación ni build. Cloná el repo y abrí `index.html`, o serví la carpeta con cualquier servidor estático:

```bash
git clone https://github.com/tu-usuario/iconruler.git
cd iconruler
python3 -m http.server 8000
# abrir http://localhost:8000
```

También podés deployarlo tal cual en GitHub Pages, Netlify, Vercel o cualquier hosting estático.

## Stack

- HTML, CSS y JavaScript vanilla (sin frameworks, sin build).
- [JSZip](https://stuk.github.io/jszip/) (vía CDN) para empaquetar la descarga.
- Canvas API del navegador para el escalado de imágenes.

## Estructura del proyecto

```
iconruler/
├── index.html
├── style.css
└── script.js
```

## Licencia

MIT — usalo, modificalo y compartilo libremente.
