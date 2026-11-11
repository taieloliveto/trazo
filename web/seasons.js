/* Ambientaciones mensuales de Sprinty — configuración central.
   Para cambiar o sumar una temporada, editá solo este archivo:
   - mes: 1–12 (la que se usa automáticamente ese mes, hora de Argentina). 0 = solo se elige a mano en Ajustes.
   - nombre / saludo / sub: textos (selector de Ajustes y bienvenida del mes)
   - tinte: color del fondo muy suave detrás de la app (se usa con poca opacidad)
   - tira: dibujo de la guirnalda/borde bajo el encabezado (SVG que se repite) · tiraAlto: su alto en px
   - icono: ilustración chica (SVG 24×24, solo decorativa)
   - particulas: grupos de microanimación ocasional: { modo: 'cae' | 'sube' | 'vuela' | 'brilla', cantidad, tam: [min, max] px, svgs: [...] }
   Las ilustraciones nunca reemplazan colores de la marca ni de componentes funcionales. */
(() => {
  const url = s => `url("data:image/svg+xml,${encodeURIComponent(s.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}")`;
  const K = 1.35;      // escala de los bordes: subila o bajala para que se noten más o menos
  const tira = (svg, w, h) => `${url(svg)} 0 0/${(w * K).toFixed(1)}px ${(h * K).toFixed(1)}px repeat-x`;

  /* Ilustraciones reutilizadas */
  const SOL = '<svg viewBox="0 0 24 24"><g stroke="#F2A93B" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/></g><circle cx="12" cy="12" r="5" fill="#FFC94A"/><circle cx="10.4" cy="10.5" r="1.5" fill="#FFE39A"/></svg>';
  const DESTELLO = c => `<svg viewBox="0 0 12 12"><path d="M6 0l1.4 4.6L12 6l-4.6 1.4L6 12 4.6 7.4 0 6l4.6-1.4Z" fill="${c}"/></svg>`;
  const CORAZON = c => `<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.7c0 5.5-7.5 10.1-7.5 10.1Z" fill="${c}"/></svg>`;
  const HOJA = (c, v) => `<svg viewBox="0 0 24 24"><path d="M19.5 4.5C11 4.5 5 9 5 15.5c0 1.6.4 2.9 1 4 6.3 0 13.5-4 13.5-15Z" fill="${c}"/><path d="M6 19.5c3-4 6.5-7.5 11-11" stroke="${v}" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>`;
  const HUEVO = (c, d) => `<svg viewBox="0 0 24 24"><path d="M12 3c3.6 0 6.5 5.3 6.5 10a6.5 6.5 0 0 1-13 0C5.5 8.3 8.4 3 12 3Z" fill="${c}"/><path d="M6 12.6l2-1.6 2 1.6 2-1.6 2 1.6 2-1.6 2 1.6" stroke="${d}" stroke-width="1.5" fill="none" stroke-linejoin="round"/></svg>`;
  const COPO = c => `<svg viewBox="0 0 24 24"><g stroke="${c}" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.6 12 7l2.5-2.4M9.5 19.4 12 17l2.5 2.4"/></g></svg>`;
  const GLOBO = c => `<svg viewBox="0 0 24 24"><path d="M12 17.4c-1 1.5 1 2.6 0 4.1" stroke="#9A9A9A" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M12 2.5c3.6 0 6 2.8 6 6.3 0 4-3.3 7.2-6 7.2s-6-3.2-6-7.2c0-3.5 2.4-6.3 6-6.3Z" fill="${c}"/><path d="M9.3 6.5a3 3 0 0 1 2-2" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`;
  const FLOR1 = '<svg viewBox="0 0 24 24"><g fill="#F5A3C0"><circle cx="12" cy="6.5" r="3.5"/><circle cx="17.2" cy="10.3" r="3.5"/><circle cx="15.2" cy="16.4" r="3.5"/><circle cx="8.8" cy="16.4" r="3.5"/><circle cx="6.8" cy="10.3" r="3.5"/></g><circle cx="12" cy="11.8" r="2.8" fill="#FFD25A"/></svg>';
  const FLOR2 = '<svg viewBox="0 0 24 24"><g fill="#FFFFFF" stroke="#E6E1D8" stroke-width=".6"><ellipse cx="12" cy="5.5" rx="2.2" ry="4"/><ellipse cx="12" cy="18.5" rx="2.2" ry="4"/><ellipse cx="5.5" cy="12" rx="4" ry="2.2"/><ellipse cx="18.5" cy="12" rx="4" ry="2.2"/><ellipse cx="7.4" cy="7.4" rx="2.2" ry="4" transform="rotate(-45 7.4 7.4)"/><ellipse cx="16.6" cy="16.6" rx="2.2" ry="4" transform="rotate(-45 16.6 16.6)"/><ellipse cx="16.6" cy="7.4" rx="2.2" ry="4" transform="rotate(45 16.6 7.4)"/><ellipse cx="7.4" cy="16.6" rx="2.2" ry="4" transform="rotate(45 7.4 16.6)"/></g><circle cx="12" cy="12" r="3.2" fill="#F5C342"/></svg>';
  const FLOR3 = '<svg viewBox="0 0 24 24"><path d="M12 20.5V13" stroke="#6FA84A" stroke-width="1.6" stroke-linecap="round"/><path d="M12 15.5c-2-.2-3.2-1.4-3.4-3.2 2 .2 3.2 1.4 3.4 3.2Z" fill="#7DB858"/><path d="M6.5 5.5 9 7.6 12 4l3 3.6 2.5-2.1V9a5.5 5.5 0 0 1-11 0Z" fill="#B48CE6"/><path d="M9 7.6 12 4l3 3.6" fill="#C9A8F0"/></svg>';
  const CALABAZA = '<svg viewBox="0 0 24 24"><path d="M12 6.5c-4.7 0-8 2.9-8 6.8S7.3 20.5 12 20.5s8-3.3 8-7.2-3.3-6.8-8-6.8Z" fill="#F08A24"/><path d="M12 6.5c-2 0-3 3-3 7s1 7 3 7 3-3 3-7-1-7-3-7Z" fill="#E2771A"/><path d="M12 6.8c0-1.6.6-2.8 2-3.6" stroke="#5E7A2E" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M8.6 12l1.4 1.2L11.4 12M12.6 12l1.4 1.2 1.4-1.2M9 16c1.8 1.1 4.2 1.1 6 0" stroke="#5A2D0C" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
  const MURCIELAGO = '<svg viewBox="0 0 24 12"><path d="M12 3c1 0 1.5 1 1.5 2 1.5-2 4-3 6.5-2-1 1-1 2.5 0 3.5-1.5-.3-3 .3-3.5 1.5-1-1-2.5-1.3-3.5 0-.5-.5-.5-.5-1 0-1-1.3-2.5-1-3.5 0-.5-1.2-2-1.8-3.5-1.5 1-1 1-2.5 0-3.5 2.5-1 5 0 6.5 2 0-1 .5-2 1.5-2Z" fill="#5B4A6E"/></svg>';
  const MATE = '<svg viewBox="0 0 24 24"><path d="M13 9.6 16.6 2.6" stroke="#B8BEC6" stroke-width="1.6" stroke-linecap="round"/><path d="M6 10.5c0-1 .8-1.5 1.5-1.5h9c.7 0 1.5.5 1.5 1.5 0 5.5-2.5 10-6 10s-6-4.5-6-10Z" fill="#A0703F"/><path d="M6.4 12.6h11.2" stroke="#7A5129" stroke-width="1.3"/><path d="M6 10h12" stroke="#D6B04C" stroke-width="2" stroke-linecap="round"/><path d="M8 9.3c1.5-1.2 6.5-1.2 8 0" fill="#6F9A3A"/></svg>';
  const YERBA1 = '<svg viewBox="0 0 10 10"><path d="M2 3.5 6.5 1.5 8.5 5 5 8.5 1.5 7Z" fill="#7FA34A"/></svg>';
  const YERBA2 = '<svg viewBox="0 0 10 10"><path d="M1.5 6 4 2l4.5 1.5-1 4.5-4 .5Z" fill="#9BB85E"/></svg>';
  const YERBA3 = '<svg viewBox="0 0 10 10"><path d="M3 1.5h3l2 3-3 4-3.5-2Z" fill="#5E7A2E"/></svg>';
  const BANDERITA = '<svg viewBox="0 0 24 24"><path d="M5 3v18" stroke="#8C7B6A" stroke-width="1.6" stroke-linecap="round"/><g transform="translate(6 4)"><rect width="14" height="1.84" fill="#E40303"/><rect y="1.84" width="14" height="1.84" fill="#FF8C00"/><rect y="3.68" width="14" height="1.84" fill="#FFED00"/><rect y="5.52" width="14" height="1.84" fill="#008026"/><rect y="7.36" width="14" height="1.84" fill="#004DFF"/><rect y="9.2" width="14" height="1.84" fill="#750787"/></g></svg>';
  const CORAZON_ARCOIRIS = '<svg viewBox="0 0 24 24"><defs><clipPath id="sprh"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.7c0 5.5-7.5 10.1-7.5 10.1Z"/></clipPath></defs><g clip-path="url(#sprh)"><rect y="6" width="24" height="2.6" fill="#E40303"/><rect y="8.6" width="24" height="2.4" fill="#FF8C00"/><rect y="11" width="24" height="2.4" fill="#FFED00"/><rect y="13.4" width="24" height="2.4" fill="#008026"/><rect y="15.8" width="24" height="2.4" fill="#004DFF"/><rect y="18.2" width="24" height="3" fill="#750787"/></g></svg>';

  const S = window.SPRINTY_SEASONS = {
    verano: {
      mes: 1, nombre: 'Verano', saludo: 'Llegó el verano', sub: 'Sol, vacaciones y días largos. Que el roadmap también tenga su pausa.',
      tinte: '#FFC94A', tiraAlto: 12,
      tira: tira('<svg viewBox="0 0 32 12"><path d="M0 6c4 0 4-4 8-4s4 4 8 4 4-4 8-4 4 4 8 4v6H0Z" fill="#4FB3D9" fill-opacity=".85"/><path d="M0 9c4 0 4-3 8-3s4 3 8 3 4-3 8-3 4 3 8 3v3H0Z" fill="#F3DCA4"/></svg>', 32, 12),
      icono: SOL,
      particulas: [{ modo: 'brilla', cantidad: 12, tam: [10, 18], svgs: [DESTELLO('#FFC94A'), DESTELLO('#F2A93B')] }]
    },
    sanvalentin: {
      mes: 2, nombre: 'San Valentín', saludo: 'Febrero, mes del amor', sub: 'Un poco de cariño también para tus iniciativas.',
      tinte: '#F28CA0', tiraAlto: 14,
      tira: tira(`<svg viewBox="0 0 44 14">${CORAZON('#E8546B').replace('<svg viewBox="0 0 24 24">', '<g transform="translate(2 -1.5) scale(.62)">').replace('</svg>', '</g>')}${CORAZON('#F7A3B0').replace('<svg viewBox="0 0 24 24">', '<g transform="translate(24 0) scale(.55)">').replace('</svg>', '</g>')}</svg>`, 44, 14),
      icono: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.7c0 5.5-7.5 10.1-7.5 10.1Z" fill="#E8546B"/><path d="M8.2 9.4a2.1 2.1 0 0 1 2-1.4" stroke="#F7A3B0" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>',
      particulas: [{ modo: 'sube', cantidad: 10, tam: [12, 22], svgs: [CORAZON('#F07A8E'), CORAZON('#E8546B'), CORAZON('#F7A3B0')] }]
    },
    otono: {
      mes: 3, nombre: 'Otoño', saludo: 'Empezó el otoño', sub: 'Hojas que caen y planes que se acomodan.',
      tinte: '#D9822B', tiraAlto: 14,
      tira: tira(`<svg viewBox="0 0 60 14">${[['#D9822B', '#9A5418', 0, -20], ['#E9B840', '#A87B1E', 20, 15], ['#A85A23', '#6E3812', 40, -5]].map(([c, v, x, r]) => HOJA(c, v).replace('<svg viewBox="0 0 24 24">', `<g transform="translate(${x + 2} 0) rotate(${r} 7 7) scale(.58)">`).replace('</svg>', '</g>')).join('')}</svg>`, 60, 14),
      icono: HOJA('#D9822B', '#9A5418'),
      particulas: [{ modo: 'cae', cantidad: 14, tam: [12, 22], svgs: [HOJA('#D9822B', '#9A5418'), HOJA('#E9B840', '#A87B1E'), HOJA('#A85A23', '#6E3812')] }]
    },
    pascuas: {
      mes: 4, nombre: 'Pascuas', saludo: 'Felices Pascuas', sub: 'Abril llega con colores suaves y alguna sorpresa escondida.',
      tinte: '#B8A4E8', tiraAlto: 14,
      tira: tira(`<svg viewBox="0 0 48 14">${HUEVO('#B8A4E8', '#FFF6C9').replace('<svg viewBox="0 0 24 24">', '<g transform="translate(4 0) scale(.58)">').replace('</svg>', '</g>')}${HUEVO('#9FE0D0', '#FFFFFF').replace('<svg viewBox="0 0 24 24">', '<g transform="translate(28 0) scale(.58)">').replace('</svg>', '</g>')}</svg>`, 48, 14),
      icono: '<svg viewBox="0 0 24 24"><path d="M12 3c3.6 0 6.5 5.3 6.5 10a6.5 6.5 0 0 1-13 0C5.5 8.3 8.4 3 12 3Z" fill="#B8A4E8"/><path d="M6 12.6l2-1.6 2 1.6 2-1.6 2 1.6 2-1.6 2 1.6" stroke="#FFF6C9" stroke-width="1.5" fill="none" stroke-linejoin="round"/><circle cx="9.5" cy="16.3" r="1.1" fill="#9FE0D0"/><circle cx="14.5" cy="16.3" r="1.1" fill="#FFB8C9"/></svg>',
      particulas: [{ modo: 'cae', cantidad: 10, tam: [12, 20], svgs: [HUEVO('#BFE8DD', '#FFFFFF'), HUEVO('#FFC9D6', '#FFFFFF'), HUEVO('#CDBDF2', '#FFF6C9')] }]
    },
    patrio: {
      mes: 5, nombre: 'Mes patrio', saludo: 'Mayo, mes patrio', sub: 'Escarapela puesta para planificar con orgullo.',
      tinte: '#74ACDF', tiraAlto: 12,
      tira: tira('<svg viewBox="0 0 40 12"><rect width="40" height="4" fill="#74ACDF"/><rect y="4" width="40" height="4" fill="#FFFFFF"/><rect y="8" width="40" height="4" fill="#74ACDF"/><circle cx="20" cy="6" r="1.7" fill="#F6B40E"/></svg>', 40, 12),
      icono: '<svg viewBox="0 0 24 24"><path d="M8.6 15.8 7 22l3.1-1.7 1-4.2M15.4 15.8 17 22l-3.1-1.7-1-4.2" fill="#74ACDF"/><circle cx="12" cy="10" r="7.3" fill="#74ACDF"/><circle cx="12" cy="10" r="5" fill="#FFFFFF"/><circle cx="12" cy="10" r="2.6" fill="#74ACDF"/><circle cx="12" cy="10" r="7.3" fill="none" stroke="#5A93C9" stroke-width=".8"/></svg>',
      particulas: [{ modo: 'cae', cantidad: 14, tam: [10, 16], svgs: ['<svg viewBox="0 0 10 6"><rect width="10" height="2" fill="#74ACDF"/><rect y="2" width="10" height="2" fill="#F4F8FC"/><rect y="4" width="10" height="2" fill="#74ACDF"/></svg>'] }]
    },
    pride: {
      mes: 6, nombre: 'Mes del Orgullo', saludo: 'Junio, mes del Orgullo', sub: 'Celebramos la diversidad: que cada persona del equipo se sienta en casa.',
      tinte: '#B48CE6', tiraAlto: 12,
      tira: 'linear-gradient(180deg,#E40303 0 16.66%,#FF8C00 16.66% 33.33%,#FFED00 33.33% 50%,#008026 50% 66.66%,#004DFF 66.66% 83.33%,#750787 83.33%)',
      icono: CORAZON_ARCOIRIS,
      particulas: [{ modo: 'cae', cantidad: 12, tam: [16, 24], svgs: [BANDERITA] }]
    },
    vacaciones: {
      mes: 7, nombre: 'Vacaciones de invierno', saludo: 'Vacaciones de invierno', sub: 'Copos de nieve y chocolate caliente. Buen momento para mirar el roadmap con calma.',
      tinte: '#A9C6E3', tiraAlto: 14,
      tira: tira(`<svg viewBox="0 0 36 14">${COPO('#A9C6E3').replace('<svg viewBox="0 0 24 24">', '<g transform="translate(2 1) scale(.5)">').replace('</svg>', '</g>')}${COPO('#7FA6C9').replace('<svg viewBox="0 0 24 24">', '<g transform="translate(21 3) scale(.38)">').replace('</svg>', '</g>')}</svg>`, 36, 14),
      icono: '<svg viewBox="0 0 24 24"><path d="M8.5 7.4c-.8-1 .8-1.8 0-3M12.5 7.4c-.8-1 .8-1.8 0-3" stroke="#B9C7D6" stroke-width="1.5" stroke-linecap="round" fill="none"/><path d="M16 11.5h1.4a2.3 2.3 0 0 1 0 4.6H16" stroke="#C0704A" stroke-width="1.8" fill="none"/><path d="M5 10h11v6.5A3.5 3.5 0 0 1 12.5 20h-4A3.5 3.5 0 0 1 5 16.5Z" fill="#C0704A"/><path d="M6.5 12.4h8" stroke="#E8B48F" stroke-width="1.2" stroke-linecap="round"/></svg>',
      particulas: [{ modo: 'cae', cantidad: 16, tam: [10, 20], svgs: [COPO('#A9C6E3'), COPO('#C9DCEE')] }]
    },
    infancias: {
      mes: 8, nombre: 'Día de las Infancias', saludo: 'Feliz Día de las Infancias', sub: 'Globos, juego y colores alegres para el mes.',
      tinte: '#F4A340', tiraAlto: 14,
      tira: tira('<svg viewBox="0 0 80 14"><path d="M0 1.5Q40 4 80 1.5" stroke="#9A9A9A" stroke-width="1" fill="none"/><path d="M2 2h14l-7 11Z" fill="#F4A340"/><path d="M22 2.6h14l-7 11Z" fill="#5FB8E8"/><path d="M42 2.8h14l-7 11Z" fill="#8FD16A"/><path d="M62 2.4h14l-7 11Z" fill="#E8546B"/></svg>', 80, 14),
      icono: '<svg viewBox="0 0 24 24"><path d="M12 17.4c-1 1.5 1 2.6 0 4.1" stroke="#9A9A9A" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M12 2.5c3.6 0 6 2.8 6 6.3 0 4-3.3 7.2-6 7.2s-6-3.2-6-7.2c0-3.5 2.4-6.3 6-6.3Z" fill="#F4A340"/><path d="M11 15.9h2l-.5 1.5h-1Z" fill="#D9822B"/><path d="M9.3 6.5a3 3 0 0 1 2-2" stroke="#FFD49A" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>',
      particulas: [{ modo: 'sube', cantidad: 10, tam: [16, 26], svgs: [GLOBO('#F4A340'), GLOBO('#5FB8E8'), GLOBO('#8FD16A'), GLOBO('#E8546B'), GLOBO('#B48CE6')] }]
    },
    primavera: {
      mes: 9, nombre: 'Primavera', saludo: 'Llegó la primavera', sub: 'Flores, mariposas y ganas de arrancar cosas nuevas.',
      tinte: '#F5A3C0', tiraAlto: 14,
      tira: tira(`<svg viewBox="0 0 60 14"><path d="M0 12.5h60" stroke="#9ED38A" stroke-width="1.5"/>${[FLOR1, FLOR2, FLOR3].map((f, i) => f.replace('<svg viewBox="0 0 24 24">', `<g transform="translate(${i * 20 + 3} 0) scale(.56)">`).replace('</svg>', '</g>')).join('')}</svg>`, 60, 14),
      icono: FLOR1,
      particulas: [{ modo: 'cae', cantidad: 15, tam: [12, 22], svgs: [FLOR1, FLOR2, FLOR3] }]
    },
    halloween: {
      mes: 10, nombre: 'Halloween', saludo: 'Llegó Halloween', sub: 'Calabazas, murciélagos y ningún deadline que asuste.',
      tinte: '#F08A24', tiraAlto: 14,
      tira: tira(`<svg viewBox="0 0 52 14">${CALABAZA.replace('<svg viewBox="0 0 24 24">', '<g transform="translate(3 -1) scale(.62)">').replace('</svg>', '</g>')}${MURCIELAGO.replace('<svg viewBox="0 0 24 12">', '<g transform="translate(26 2) scale(.95)">').replace('</svg>', '</g>')}</svg>`, 52, 14),
      icono: CALABAZA,
      particulas: [{ modo: 'vuela', cantidad: 5, tam: [26, 30], svgs: [MURCIELAGO] }, { modo: 'cae', cantidad: 7, tam: [14, 22], svgs: [CALABAZA] }]
    },
    tradicion: {
      mes: 11, nombre: 'Día de la Tradición', saludo: 'Mes de la Tradición', sub: 'Mate en mano, guitarra de fondo y el equipo en ronda.',
      tinte: '#A0703F', tiraAlto: 16,
      /* guarda gaucha (pampa): franja crema con rombos y triángulos escalonados rojo y negro */
      tira: tira('<svg viewBox="0 0 32 16"><rect width="32" height="16" fill="#F2E8D5"/><rect width="32" height="2" fill="#2B1D16"/><rect y="14" width="32" height="2" fill="#2B1D16"/><path d="M0 14V9h2V7h2V5h2V3h4v2h2v2h2v2h2v5Z" fill="#A8231F"/><path d="M16 2v5h2v2h2v2h2v2h4v-2h2V9h2V7h2V2Z" fill="#2B1D16"/><path d="M8 6.5 10.5 9 8 11.5 5.5 9Z" fill="#F2E8D5"/><path d="M24 4.5 26.5 7 24 9.5 21.5 7Z" fill="#A8231F"/><rect x="7.2" y="8.2" width="1.6" height="1.6" fill="#2B1D16"/></svg>', 32, 16),
      icono: MATE,
      particulas: [{ modo: 'cae', cantidad: 6, tam: [18, 26], svgs: [MATE] }, { modo: 'cae', cantidad: 18, tam: [5, 9], svgs: [YERBA1, YERBA2, YERBA3] }]
    },
    navidad: {
      mes: 12, nombre: 'Navidad', saludo: 'Felices fiestas', sub: 'Luces, regalos y un cierre de año bien planificado.',
      tinte: '#E04848', tiraAlto: 18,
      /* guirnalda de bombitas de árbol colgando */
      tira: tira('<svg viewBox="0 0 60 18"><path d="M0 2Q15 6 30 2T60 2" stroke="#2F7D4F" stroke-width="2" fill="none"/><path d="M8 3.6v2.4" stroke="#B9A06A" stroke-width=".8"/><rect x="6.6" y="5.4" width="2.8" height="2" rx=".5" fill="#C9A54A"/><circle cx="8" cy="11.6" r="4.6" fill="#D93838"/><circle cx="6.6" cy="10.2" r="1.2" fill="#FFFFFF" fill-opacity=".6"/><path d="M28 2v4" stroke="#B9A06A" stroke-width=".8"/><rect x="26.6" y="5.4" width="2.8" height="2" rx=".5" fill="#C9A54A"/><circle cx="28" cy="11.6" r="4.6" fill="#F5C342"/><circle cx="26.6" cy="10.2" r="1.2" fill="#FFFFFF" fill-opacity=".6"/><path d="M48 3.6v2.4" stroke="#B9A06A" stroke-width=".8"/><rect x="46.6" y="5.4" width="2.8" height="2" rx=".5" fill="#C9A54A"/><circle cx="48" cy="11.6" r="4.6" fill="#2F9E62"/><circle cx="46.6" cy="10.2" r="1.2" fill="#FFFFFF" fill-opacity=".6"/></svg>', 60, 18),
      icono: '<svg viewBox="0 0 24 24"><path d="m12 2.8 2.5 5.6 6.1.6-4.6 4.1 1.3 6-5.3-3.1-5.3 3.1 1.3-6L3.4 9l6.1-.6Z" fill="#F5C342"/><path d="m12 6.6 1.2 2.7" stroke="#FFE7A0" stroke-width="1.3" stroke-linecap="round"/></svg>',
      particulas: [{ modo: 'brilla', cantidad: 14, tam: [10, 18], svgs: [DESTELLO('#F5C342'), DESTELLO('#FFE7A0')] }]
    },
    invierno: {
      mes: 0, nombre: 'Invierno', saludo: 'Llegó el invierno', sub: 'Bufanda, algo caliente y el sprint bien abrigado.',
      tinte: '#7FA6C9', tiraAlto: 14,
      tira: tira(`<svg viewBox="0 0 30 14"><path d="M0 12.5h30" stroke="#C9DCEE" stroke-width="2"/>${COPO('#9DB3C8').replace('<svg viewBox="0 0 24 24">', '<g transform="translate(8 0) scale(.5)">').replace('</svg>', '</g>')}</svg>`, 30, 14),
      icono: COPO('#7FA6C9'),
      particulas: [{ modo: 'cae', cantidad: 18, tam: [10, 20], svgs: [COPO('#A9C6E3'), COPO('#C9DCEE'), COPO('#9DB3C8')] }]
    }
  };
  for (const t of Object.values(S)) t.tiraAlto = Math.round(t.tiraAlto * K);
})();
