/* Ambientaciones mensuales de Sprinty — configuración central.
   Para cambiar o sumar una temporada, editá solo este archivo:
   - mes: 1–12 (la que se usa automáticamente ese mes, hora de Argentina)
   - nombre / saludo / sub: textos (selector de Ajustes y bienvenida del mes)
   - tinte: color del fondo muy suave detrás de la app (se usa con poca opacidad)
   - tira: fondo CSS de la línea decorativa bajo el encabezado · tiraAlto: su alto
   - icono: ilustración chica (SVG 24×24, solo decorativa)
   - particula: { svg, modo: 'cae' | 'sube' | 'vuela' | 'brilla', cantidad }  (microanimación ocasional)
   Las ilustraciones nunca reemplazan colores de la marca ni de componentes funcionales. */
window.SPRINTY_SEASONS = {
  verano: {
    mes: 1, nombre: 'Verano', saludo: 'Llegó el verano', sub: 'Sol, vacaciones y días largos. Que el roadmap también tenga su pausa.',
    tinte: '#FFC94A', tiraAlto: 3, tira: 'linear-gradient(90deg,#FFC94A,#F2A93B 45%,#4FB3D9)',
    icono: '<svg viewBox="0 0 24 24"><g stroke="#F2A93B" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/></g><circle cx="12" cy="12" r="5" fill="#FFC94A"/><circle cx="10.4" cy="10.5" r="1.5" fill="#FFE39A"/></svg>',
    particula: { modo: 'brilla', cantidad: 12, svg: '<svg viewBox="0 0 12 12"><path d="M6 0l1.4 4.6L12 6l-4.6 1.4L6 12 4.6 7.4 0 6l4.6-1.4Z" fill="#FFC94A"/></svg>' }
  },
  sanvalentin: {
    mes: 2, nombre: 'San Valentín', saludo: 'Febrero, mes del amor', sub: 'Un poco de cariño también para tus iniciativas.',
    tinte: '#F28CA0', tiraAlto: 4, tira: 'radial-gradient(circle at 6px 2px,#F28CA0 1.6px,transparent 2.2px) 0 0/12px 4px,linear-gradient(90deg,#FBD3DB,#F5A9B8)',
    icono: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.7c0 5.5-7.5 10.1-7.5 10.1Z" fill="#E8546B"/><path d="M8.2 9.4a2.1 2.1 0 0 1 2-1.4" stroke="#F7A3B0" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>',
    particula: { modo: 'sube', cantidad: 10, svg: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.7c0 5.5-7.5 10.1-7.5 10.1Z" fill="#F07A8E"/></svg>' }
  },
  otono: {
    mes: 3, nombre: 'Otoño', saludo: 'Empezó el otoño', sub: 'Hojas que caen y planes que se acomodan.',
    tinte: '#D9822B', tiraAlto: 3, tira: 'linear-gradient(90deg,#E9A23B,#D9822B 40%,#A85A23 70%,#E9C46A)',
    icono: '<svg viewBox="0 0 24 24"><path d="M19.5 4.5C11 4.5 5 9 5 15.5c0 1.6.4 2.9 1 4 6.3 0 13.5-4 13.5-15Z" fill="#D9822B"/><path d="M6 19.5c3-4 6.5-7.5 11-11" stroke="#9A5418" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>',
    particula: { modo: 'cae', cantidad: 12, svg: '<svg viewBox="0 0 24 24"><path d="M19.5 4.5C11 4.5 5 9 5 15.5c0 1.6.4 2.9 1 4 6.3 0 13.5-4 13.5-15Z" fill="#D9822B"/><path d="M6 19.5c3-4 6.5-7.5 11-11" stroke="#9A5418" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>' }
  },
  pascuas: {
    mes: 4, nombre: 'Pascuas', saludo: 'Felices Pascuas', sub: 'Abril llega con colores suaves y alguna sorpresa escondida.',
    tinte: '#B8A4E8', tiraAlto: 4, tira: 'repeating-linear-gradient(90deg,#CDBDF2 0 18px,#BFE8DD 18px 36px,#FFE7A3 36px 54px,#FFC9D6 54px 72px)',
    icono: '<svg viewBox="0 0 24 24"><path d="M12 3c3.6 0 6.5 5.3 6.5 10a6.5 6.5 0 0 1-13 0C5.5 8.3 8.4 3 12 3Z" fill="#B8A4E8"/><path d="M6 12.6l2-1.6 2 1.6 2-1.6 2 1.6 2-1.6 2 1.6" stroke="#FFF6C9" stroke-width="1.5" fill="none" stroke-linejoin="round"/><circle cx="9.5" cy="16.3" r="1.1" fill="#9FE0D0"/><circle cx="14.5" cy="16.3" r="1.1" fill="#FFB8C9"/></svg>',
    particula: { modo: 'cae', cantidad: 9, svg: '<svg viewBox="0 0 24 24"><path d="M12 3c3.6 0 6.5 5.3 6.5 10a6.5 6.5 0 0 1-13 0C5.5 8.3 8.4 3 12 3Z" fill="#BFE8DD"/><path d="M6 12.6l2-1.6 2 1.6 2-1.6 2 1.6 2-1.6 2 1.6" stroke="#FFFFFF" stroke-width="1.5" fill="none" stroke-linejoin="round"/></svg>' }
  },
  patrio: {
    mes: 5, nombre: 'Mes patrio', saludo: 'Mayo, mes patrio', sub: 'Escarapela puesta para planificar con orgullo.',
    tinte: '#74ACDF', tiraAlto: 6, tira: 'linear-gradient(180deg,#74ACDF 0 33.3%,#FFFFFF 33.3% 66.6%,#74ACDF 66.6%)',
    icono: '<svg viewBox="0 0 24 24"><path d="M8.6 15.8 7 22l3.1-1.7 1-4.2M15.4 15.8 17 22l-3.1-1.7-1-4.2" fill="#74ACDF"/><circle cx="12" cy="10" r="7.3" fill="#74ACDF"/><circle cx="12" cy="10" r="5" fill="#FFFFFF"/><circle cx="12" cy="10" r="2.6" fill="#74ACDF"/><circle cx="12" cy="10" r="7.3" fill="none" stroke="#5A93C9" stroke-width=".8"/></svg>',
    particula: { modo: 'cae', cantidad: 14, svg: '<svg viewBox="0 0 10 6"><rect width="10" height="2" fill="#74ACDF"/><rect y="2" width="10" height="2" fill="#F4F8FC"/><rect y="4" width="10" height="2" fill="#74ACDF"/></svg>' }
  },
  invierno: {
    mes: 6, nombre: 'Invierno', saludo: 'Llegó el invierno', sub: 'Bufanda, algo caliente y el sprint bien abrigado.',
    tinte: '#7FA6C9', tiraAlto: 3, tira: 'linear-gradient(90deg,#9DB3C8,#7FA6C9 50%,#B7C7D6)',
    icono: '<svg viewBox="0 0 24 24"><path d="M7 15.5a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6 1.3A3.4 3.4 0 0 1 17 15.5Z" fill="#9DB3C8"/><path d="M8.5 18.4l-.8 2M12.5 18.4l-.8 2M16.5 18.4l-.8 2" stroke="#5B8DB8" stroke-width="1.8" stroke-linecap="round"/></svg>',
    particula: { modo: 'cae', cantidad: 16, rapida: true, svg: '<svg viewBox="0 0 6 12"><path d="M3 0C3 3 6 6 6 8.5a3 3 0 0 1-6 0C0 6 3 3 3 0Z" fill="#7FA6C9"/></svg>' }
  },
  vacaciones: {
    mes: 7, nombre: 'Vacaciones de invierno', saludo: 'Vacaciones de invierno', sub: 'Copos de nieve y chocolate caliente. Buen momento para mirar el roadmap con calma.',
    tinte: '#A9C6E3', tiraAlto: 3, tira: 'repeating-linear-gradient(90deg,#DCE9F5 0 10px,#A9C6E3 10px 20px)',
    icono: '<svg viewBox="0 0 24 24"><path d="M8.5 7.4c-.8-1 .8-1.8 0-3M12.5 7.4c-.8-1 .8-1.8 0-3" stroke="#B9C7D6" stroke-width="1.5" stroke-linecap="round" fill="none"/><path d="M16 11.5h1.4a2.3 2.3 0 0 1 0 4.6H16" stroke="#C0704A" stroke-width="1.8" fill="none"/><path d="M5 10h11v6.5A3.5 3.5 0 0 1 12.5 20h-4A3.5 3.5 0 0 1 5 16.5Z" fill="#C0704A"/><path d="M6.5 12.4h8" stroke="#E8B48F" stroke-width="1.2" stroke-linecap="round"/></svg>',
    particula: { modo: 'cae', cantidad: 14, svg: '<svg viewBox="0 0 24 24"><g stroke="#A9C6E3" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.6 12 7l2.5-2.4M9.5 19.4 12 17l2.5 2.4"/></g></svg>' }
  },
  infancias: {
    mes: 8, nombre: 'Día de las Infancias', saludo: 'Feliz Día de las Infancias', sub: 'Globos, juego y colores alegres para el mes.',
    tinte: '#F4A340', tiraAlto: 4, tira: 'repeating-linear-gradient(90deg,#F4A340 0 14px,#5FB8E8 14px 28px,#8FD16A 28px 42px,#E8546B 42px 56px,#B48CE6 56px 70px)',
    icono: '<svg viewBox="0 0 24 24"><path d="M12 17.4c-1 1.5 1 2.6 0 4.1" stroke="#9A9A9A" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M12 2.5c3.6 0 6 2.8 6 6.3 0 4-3.3 7.2-6 7.2s-6-3.2-6-7.2c0-3.5 2.4-6.3 6-6.3Z" fill="#F4A340"/><path d="M11 15.9h2l-.5 1.5h-1Z" fill="#D9822B"/><path d="M9.3 6.5a3 3 0 0 1 2-2" stroke="#FFD49A" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>',
    particula: { modo: 'sube', cantidad: 9, colores: true, svg: '<svg viewBox="0 0 24 24"><path d="M12 17.4c-1 1.5 1 2.6 0 4.1" stroke="#9A9A9A" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M12 2.5c3.6 0 6 2.8 6 6.3 0 4-3.3 7.2-6 7.2s-6-3.2-6-7.2c0-3.5 2.4-6.3 6-6.3Z" fill="#F4A340"/></svg>' }
  },
  primavera: {
    mes: 9, nombre: 'Primavera', saludo: 'Llegó la primavera', sub: 'Flores, mariposas y ganas de arrancar cosas nuevas.',
    tinte: '#F5A3C0', tiraAlto: 4, tira: 'radial-gradient(circle at 8px 2px,#F5A3C0 1.8px,transparent 2.4px) 0 0/16px 4px,linear-gradient(90deg,#CDEBB8,#9ED38A)',
    icono: '<svg viewBox="0 0 24 24"><g fill="#F5A3C0"><circle cx="12" cy="6.5" r="3.5"/><circle cx="17.2" cy="10.3" r="3.5"/><circle cx="15.2" cy="16.4" r="3.5"/><circle cx="8.8" cy="16.4" r="3.5"/><circle cx="6.8" cy="10.3" r="3.5"/></g><circle cx="12" cy="11.8" r="2.8" fill="#FFD25A"/></svg>',
    particula: { modo: 'cae', cantidad: 14, svg: '<svg viewBox="0 0 12 12"><path d="M6 1c3 2 3 7 0 10C3 8 3 3 6 1Z" fill="#F7B3CB"/></svg>' }
  },
  halloween: {
    mes: 10, nombre: 'Halloween', saludo: 'Llegó Halloween', sub: 'Calabazas, murciélagos y ningún deadline que asuste.',
    tinte: '#F08A24', tiraAlto: 4, tira: 'repeating-linear-gradient(90deg,#F08A24 0 16px,#5B4A6E 16px 24px)',
    icono: '<svg viewBox="0 0 24 24"><path d="M12 6.5c-4.7 0-8 2.9-8 6.8S7.3 20.5 12 20.5s8-3.3 8-7.2-3.3-6.8-8-6.8Z" fill="#F08A24"/><path d="M12 6.5c-2 0-3 3-3 7s1 7 3 7 3-3 3-7-1-7-3-7Z" fill="#E2771A"/><path d="M12 6.8c0-1.6.6-2.8 2-3.6" stroke="#5E7A2E" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M8.6 12l1.4 1.2L11.4 12M12.6 12l1.4 1.2 1.4-1.2M9 16c1.8 1.1 4.2 1.1 6 0" stroke="#5A2D0C" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    particula: { modo: 'vuela', cantidad: 6, svg: '<svg viewBox="0 0 24 12"><path d="M12 3c1 0 1.5 1 1.5 2 1.5-2 4-3 6.5-2-1 1-1 2.5 0 3.5-1.5-.3-3 .3-3.5 1.5-1-1-2.5-1.3-3.5 0-.5-.5-.5-.5-1 0-1-1.3-2.5-1-3.5 0-.5-1.2-2-1.8-3.5-1.5 1-1 1-2.5 0-3.5 2.5-1 5 0 6.5 2 0-1 .5-2 1.5-2Z" fill="#5B4A6E"/></svg>' }
  },
  tradicion: {
    mes: 11, nombre: 'Día de la Tradición', saludo: 'Mes de la Tradición', sub: 'Mate en mano, guitarra de fondo y el equipo en ronda.',
    tinte: '#A0703F', tiraAlto: 5, tira: 'linear-gradient(135deg,#B23A3A 25%,transparent 25%) -5px 0/10px 10px,linear-gradient(225deg,#B23A3A 25%,transparent 25%) -5px 0/10px 10px,linear-gradient(315deg,#B23A3A 25%,transparent 25%) 0 0/10px 10px,linear-gradient(45deg,#B23A3A 25%,#F4EBDD 25%) 0 0/10px 10px',
    icono: '<svg viewBox="0 0 24 24"><path d="M13 9.6 16.6 2.6" stroke="#C9CDD2" stroke-width="1.6" stroke-linecap="round"/><path d="M6 10.5c0-1 .8-1.5 1.5-1.5h9c.7 0 1.5.5 1.5 1.5 0 5.5-2.5 10-6 10s-6-4.5-6-10Z" fill="#A0703F"/><path d="M6.4 12.6h11.2" stroke="#7A5129" stroke-width="1.3"/><path d="M6 10h12" stroke="#D6B04C" stroke-width="2" stroke-linecap="round"/><path d="M8 9.3c1.5-1.2 6.5-1.2 8 0" fill="#6F9A3A"/></svg>',
    particula: { modo: 'cae', cantidad: 10, svg: '<svg viewBox="0 0 12 12"><path d="M6 1c3 2 3 7 0 10C3 8 3 3 6 1Z" fill="#7FA34A"/><path d="M6 2v8" stroke="#5E7A2E" stroke-width=".8"/></svg>' }
  },
  navidad: {
    mes: 12, nombre: 'Navidad', saludo: 'Felices fiestas', sub: 'Luces, regalos y un cierre de año bien planificado.',
    tinte: '#E04848', tiraAlto: 8, tira: 'radial-gradient(circle at 6px 4px,#E04848 2.2px,transparent 2.8px) 0 0/36px 8px,radial-gradient(circle at 18px 4px,#F5C342 2.2px,transparent 2.8px) 0 0/36px 8px,radial-gradient(circle at 30px 4px,#3FA06A 2.2px,transparent 2.8px) 0 0/36px 8px',
    icono: '<svg viewBox="0 0 24 24"><path d="m12 2.8 2.5 5.6 6.1.6-4.6 4.1 1.3 6-5.3-3.1-5.3 3.1 1.3-6L3.4 9l6.1-.6Z" fill="#F5C342"/><path d="m12 6.6 1.2 2.7" stroke="#FFE7A0" stroke-width="1.3" stroke-linecap="round"/></svg>',
    particula: { modo: 'brilla', cantidad: 14, svg: '<svg viewBox="0 0 12 12"><path d="M6 0l1.4 4.6L12 6l-4.6 1.4L6 12 4.6 7.4 0 6l4.6-1.4Z" fill="#F5C342"/></svg>' }
  }
};
