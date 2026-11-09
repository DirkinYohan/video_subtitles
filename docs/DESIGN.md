# Sistema de diseño

Cómo está construida la interfaz de IA Doblaje y qué reglas mantienen la
coherencia. Todo sale de `app/globals.css`; ningún componente usa un color
literal.

## Principio

La interfaz es una herramienta de trabajo, no una pieza de marketing. La
jerarquía se construye con **tipografía, espacio y contraste**, no con color ni
adornos. El color aparece sólo donde significa algo: una acción, un estado.

## Tokens

Definidos en `@theme` y resueltos por tema. Los componentes usan la utilidad
(`bg-surface`, `text-ink-2`), nunca el valor.

| Grupo | Tokens | Uso |
|---|---|---|
| Superficies | `paper`, `surface`, `surface-2` | Fondo de página, tarjetas, relleno hundido |
| Texto | `ink`, `ink-2`, `muted`, `subtle` | Primario, secundario, terciario |
| Trazos | `line`, `line-strong` | Bordes y divisores |
| Principal | `primary`, `primary-hover`, `on-primary` | Botón principal y selección: tinta sobre papel (`#111113`; `#ededef` en oscuro) |
| Acento | `accent`, `accent-strong`, `accent-soft`, `on-accent` | Único acento: cobalto (`#2f5bea`; `#7896ff` en oscuro) |
| Estados | `ok`, `warn`, `danger` (+ sus tintes) | Éxito, aviso, error |
| Velo | `scrim`, `scrim-strong` | Superponer sobre imagen **siempre oscuro** |
| Navegación | `nav`, `nav-active` | Control segmentado |
| Escenario | `stage` | Fondo del vídeo |

### Reglas que evitan fallos reales

- **`ink` invierte entre temas.** En oscuro es casi blanco. Por eso existe
  `scrim`: usarlo como fondo (chips sobre miniatura, subtítulo, velo del modal)
  con `ink` vuelve la superficie blanca justo en modo oscuro.
- **`nav-active` es un token propio.** La relación de luminosidad entre
  `surface` y `surface-2` se invierte según el tema, así que reutilizarlas para
  el elemento activo lo dejaba más oscuro que su contenedor en oscuro.
- **Un solo acento.** Los estados semánticos son familias distintas para que
  nunca se confundan con una acción.
- **Sin degradados ni halos.** La paleta es grafito neutro. El botón principal
  es monocromo (`primary`); el acento cobalto queda para lo que está activo o
  avanza: progreso, cabezal, frase activa, foco, enlaces y reproducir.
- **El escenario siempre es oscuro.** La vista previa del reproductor
  (`components/CaptionPreview.tsx`, `.preview-scene`) y la celda de sincronía de
  la portada usan `stage` en los dos temas, como el propio reproductor.

## Tipografía

Geist y Geist Mono vía `next/font`. Cifras tabulares en `.tabular` /
`data-numeric`; los códigos de tiempo y de formato van en `font-mono`.

- Títulos: `font-semibold`, tracking negativo según tamaño (`-0.02em` a
  `-0.04em` en la portada), `leading` ajustado.
- Cuerpo: `text-sm`/`text-base` con `leading-6`.
- Nunca se usan etiquetas en mayúsculas con tracking amplio por encima de un
  título: el encabezado se sostiene solo.

## Radios

Una sola escala, documentada en el token:

| Token | Valor | Uso |
|---|---|---|
| `rounded-sm` | 6px | Etiquetas de estado |
| `rounded-md` | 8px | Controles compactos |
| `rounded-lg` | 10px | Botones y campos |
| `rounded-xl` | 14px | Miniaturas, menús flotantes |
| `rounded-2xl` | 18px | Tarjetas, diálogos y reproductor |

Las píldoras (`rounded-full`) son para filtros y selección de idioma.

## Elevación

Se declara **una vez**: borde *o* sombra, nunca ambos.

- Tarjetas y paneles: sólo `border border-line`, sin sombra.
- Proyectos: miniatura con anillo interior y texto debajo, sin tarjeta.
- Botón principal: `--shadow-button`, luz interior arriba y sombra corta.
- Elementos flotantes (menús, diálogos): `--shadow-float` / `--shadow-dialog`,
  que ya incluyen un anillo de 1 px; nunca se suma `border`.
- Las sombras están tintadas al fondo; no hay halos de color.

## Movimiento

| Token | Curva |
|---|---|
| `--ease-out-quart` | `cubic-bezier(0.23, 1, 0.32, 1)` — lo que entra, lo que responde |
| `--ease-in-out-quart` | `cubic-bezier(0.77, 0, 0.175, 1)` — lo que se mueve en pantalla |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` |

- Pulsación: `scale(0.97)`, 120 ms. Nunca desplazamiento.
- Entrada de pantalla: `.enter` (subida de 10 px + opacidad, 560 ms). El
  contenedor principal la repite al cambiar de ruta.
- Listas: `.enter-stagger`, cada elemento 45 ms después del anterior (tope 8).
- Carga: `.skeleton`, brillo que recorre la forma del contenido real.
- Sólo se anima lo poco frecuente (entrar en una pantalla, una tarjeta bajo el
  cursor). Nada que se repita cientos de veces al día.
- Entradas de superficies flotantes con `@starting-style`, sin JavaScript.
- Toda animación queda anulada bajo `prefers-reduced-motion`.

## Detalles del navegador

También llevan el diseño: `::selection`, `caret-color`, `accent-color`, barra
de desplazamiento, anillo de foco y `text-underline-offset`.

## Accesibilidad

- Contraste verificado con `tools/audit_visual.py` (mínimo 4.5:1 en texto).
- Foco visible en todo control; `focus-visible` con halo propio.
- Salto al contenido como primera parada del tabulador.
- `prefers-reduced-motion`, `prefers-reduced-transparency` y
  `prefers-contrast` atendidos.

## Verificación

```text
npm run verify                          # tipos, lint, tests y build

python tools/screenshots.py             # capturas por ruta, tema y tamaño
python tools/audit_visual.py            # estilos, contraste y desbordes
```

Las capturas se revisan a ojo: una pantalla no está terminada porque compile.
