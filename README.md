# Trazo

Plataforma para planificar proyectos: cargás iniciativas con deadline, estado y prioridad, y las planificás en un roadmap **por equipo o persona**, arrastrando barras de tiempo. Es una web instalable (PWA) que funciona en la compu y en el celular, con cuenta propia y sincronización.

## Qué incluye (MVP)

| | |
|---|---|
| **Cuenta** | Email + contraseña (mismo esquema que Foco y Compras). Los datos se guardan en el dispositivo y en la nube, y se combinan entre dispositivos. |
| **Introducción** | 4 pasos la primera vez. Al final: *Crear mi primer proyecto* o *Explorar un proyecto de ejemplo*. Se vuelve a ver desde Ajustes. |
| **Proyectos** | Elegir, crear (nombre + emoji), editar, eliminar. Cada tarjeta muestra el avance por estado y el próximo deadline. |
| **Iniciativas** | Carga rápida con deadline, estado y prioridad (Urgente, Alta, Media, Baja). Se editan desde la tabla. Filtro por estado, orden por carga, prioridad, deadline o estado. Ficha con enlace y notas. Deadlines vencidos en rojo, próximos en naranja. |
| **Estados** | Vienen Por hacer, En curso, Finalizado y Bloqueado. Se pueden agregar, renombrar, recolorear, reordenar y eliminar. "Terminado" marca cuáles cierran una iniciativa. |
| **Equipos / personas** | Por proyecto, con color. La pestaña muestra qué tiene cada uno en curso y qué sigue. |
| **Roadmap** | Dividido por mes; cada mes por quincena, semana (S1–S4) o día. Arrastrar sobre una fila crea un plazo y le asignás equipo y etiqueta (ej. QA, IMPLE). Se mueve arrastrando y se estira desde los bordes. Muestra hoy y los deadlines. Se agrupa por iniciativa o por equipo. Teclado: flechas mueven el plazo, Mayús + flechas cambian el final. |
| **Exportar** | Iniciativas del proyecto a CSV (abre en Excel) y todo en JSON. |

## Cómo está armado

```
trazo/
├── web/       La app (HTML/CSS/JS sin build). Es lo que va a Vercel.
├── server/    API en Cloudflare Worker + KV: cuentas y sincronización.
├── shared/    Lógica de combinación de datos (una sola fuente para app y servidor).
└── scripts/   setup-server.sh, íconos, pruebas.
```

Usa **su propio** servidor y KV (`trazo-server`), separado de Foco y Compras.

## Publicar

1. **Servidor:** en la Terminal, dentro de la carpeta del proyecto: `sh scripts/setup-server.sh`. Al final abrí `https://trazo-server.TU-USUARIO.workers.dev/health` (debe decir `{"ok":true}`). Si la dirección no coincide con `web/config.js`, corregila ahí.
2. **App:** nuevo proyecto en Vercel desde este repositorio, con **Root Directory = `web`** y sin comando de build.

## Pruebas

```bash
npm run sync-shared     # tras editar shared/merge.js
node scripts/test.mjs   # 11 pruebas: datos y servidor
node scripts/e2e.mjs    # 23 pasos en un navegador real (capturas en .shots/)
```
