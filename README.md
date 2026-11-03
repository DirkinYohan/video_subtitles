# IA Doblaje · frontend

Aplicación web (Next.js) para subir vídeos, ver los subtítulos generados en
vivo, editarlos y exportarlos. El backend está en el repositorio
[IA-Doblaje](https://github.com/DirkinYohan/IA-Doblaje).

## Desarrollo local

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. Con el backend corriendo en el puerto 8000 no
hace falta configurar nada (los valores por defecto están en `.env.example`).

```bash
npm run verify
```

comprueba tipos, lint, pruebas y la compilación de producción.

## Desplegar en Vercel

1. Importa este repositorio en <https://vercel.com/new> (Vercel detecta
   Next.js solo).
2. Añade una variable de entorno:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | URL pública del backend en Render, sin `/` al final |

3. Pulsa **Deploy**.

La guía completa, con el backend en Render y cómo conectarlos, está en
[DEPLOY.md del backend](https://github.com/DirkinYohan/IA-Doblaje/blob/main/DEPLOY.md).
