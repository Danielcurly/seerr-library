// Capturas del tutorial (public/biblioteca/tutorial/<idioma>), con las zonas
// que se resaltan en % de la imagen. Hechas con un usuario de demostracion; hay
// un juego por idioma porque las capturas llevan texto.

export interface Zona {
  n: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Captura {
  src: string;
  ancho: number;
  alto: number;
  zonas: Zona[];
}

type Juego = Record<string, { escritorio: Captura; movil: Captura }>;

const EN: Juego = {
  menu: {
    escritorio: {
      src: '/biblioteca/tutorial/en/escritorio-1-menu.webp',
      ancho: 1280,
      alto: 800,
      zonas: [{ n: 1, x: 0.9, y: 45.5, w: 18, h: 6 }],
    },
    movil: {
      src: '/biblioteca/tutorial/en/movil-1-menu.webp',
      ancho: 780,
      alto: 1688,
      zonas: [{ n: 1, x: 86.7, y: 94.8, w: 8.2, h: 3.8 }],
    },
  },
  explorar: {
    escritorio: {
      src: '/biblioteca/tutorial/en/escritorio-2-explorar.webp',
      ancho: 1280,
      alto: 800,
      zonas: [
        { n: 1, x: 20.9, y: 23.8, w: 36.9, h: 7.8 },
        { n: 2, x: 20.9, y: 35.6, w: 76.6, h: 11.5 },
      ],
    },
    movil: {
      src: '/biblioteca/tutorial/en/movil-2-explorar.webp',
      ancho: 780,
      alto: 1520,
      zonas: [
        { n: 1, x: 3.1, y: 25, w: 93.8, h: 6.6 },
        { n: 2, x: 3.1, y: 35.8, w: 93.8, h: 44.7 },
      ],
    },
  },
  botones: {
    escritorio: {
      src: '/biblioteca/tutorial/en/escritorio-3-botones.webp',
      ancho: 1280,
      alto: 560,
      zonas: [{ n: 1, x: 60.3, y: 45.7, w: 11.6, h: 7.1 }],
    },
    movil: {
      src: '/biblioteca/tutorial/en/movil-3-botones.webp',
      ancho: 780,
      alto: 1040,
      zonas: [{ n: 1, x: 51, y: 62.7, w: 37.9, h: 7.7 }],
    },
  },
  sevan: {
    escritorio: {
      src: '/biblioteca/tutorial/en/escritorio-4-sevan.webp',
      ancho: 1280,
      alto: 800,
      zonas: [
        { n: 1, x: 20.9, y: 48.1, w: 78.1, h: 7 },
        { n: 2, x: 20.9, y: 59.1, w: 78.1, h: 7 },
      ],
    },
    movil: {
      src: '/biblioteca/tutorial/en/movil-4-sevan.webp',
      ancho: 780,
      alto: 1520,
      zonas: [
        { n: 1, x: 3.1, y: 64.7, w: 93.8, h: 7.4 },
        { n: 2, x: 3.1, y: 76.3, w: 93.8, h: 7.4 },
      ],
    },
  },
  cuenta: {
    escritorio: {
      src: '/biblioteca/tutorial/en/escritorio-5-cuenta.webp',
      ancho: 1280,
      alto: 600,
      zonas: [
        { n: 1, x: 20.9, y: 79, w: 9.3, h: 3.8 },
        { n: 2, x: 20.9, y: 72.3, w: 5.9, h: 6.7 },
      ],
    },
    movil: {
      src: '/biblioteca/tutorial/en/movil-5-cuenta.webp',
      ancho: 780,
      alto: 1120,
      zonas: [
        { n: 1, x: 3.1, y: 51, w: 30.4, h: 4.1 },
        { n: 2, x: 3.1, y: 43.8, w: 19.5, h: 7.1 },
      ],
    },
  },
  temporadas: {
    escritorio: {
      src: '/biblioteca/tutorial/en/escritorio-6-temporadas.webp',
      ancho: 1280,
      alto: 800,
      zonas: [{ n: 1, x: 20.9, y: 54.1, w: 7.5, h: 4.5 }],
    },
    movil: {
      src: '/biblioteca/tutorial/en/movil-6-temporadas.webp',
      ancho: 780,
      alto: 1520,
      zonas: [{ n: 1, x: 3.1, y: 61.7, w: 24.7, h: 4.7 }],
    },
  },
  descubrir: {
    escritorio: {
      src: '/biblioteca/tutorial/en/escritorio-7-descubrir.webp',
      ancho: 1280,
      alto: 600,
      zonas: [{ n: 1, x: 20.9, y: 14, w: 78.1, h: 66.7 }],
    },
    movil: {
      src: '/biblioteca/tutorial/en/movil-7-descubrir.webp',
      ancho: 780,
      alto: 1280,
      zonas: [{ n: 1, x: 3.1, y: 13.1, w: 96.9, h: 53.8 }],
    },
  },
  novedades: {
    escritorio: {
      src: '/biblioteca/tutorial/en/escritorio-8-novedades.webp',
      ancho: 1280,
      alto: 800,
      zonas: [
        { n: 1, x: 28, y: 23.8, w: 8.7, h: 7.8 },
        { n: 2, x: 20.9, y: 85.6, w: 9.7, h: 5 },
        { n: 3, x: 47.2, y: 85.6, w: 9.7, h: 5 },
      ],
    },
    movil: {
      src: '/biblioteca/tutorial/en/movil-8-novedades.webp',
      ancho: 780,
      alto: 1520,
      zonas: [
        { n: 2, x: 3.1, y: 46.8, w: 36.7, h: 5.3 },
        { n: 3, x: 3.1, y: 92.6, w: 36.7, h: 5.3 },
      ],
    },
  },
  lomio: {
    escritorio: {
      src: '/biblioteca/tutorial/en/escritorio-9-lomio.webp',
      ancho: 1280,
      alto: 800,
      zonas: [
        { n: 1, x: 50.7, y: 23.8, w: 7.2, h: 7.8 },
        { n: 2, x: 20.9, y: 17, w: 10, h: 4.8 },
      ],
    },
    movil: {
      src: '/biblioteca/tutorial/en/movil-9-lomio.webp',
      ancho: 780,
      alto: 1520,
      zonas: [
        { n: 1, x: 3.1, y: 25, w: 93.8, h: 6.6 },
        { n: 2, x: 3.1, y: 17.9, w: 33, h: 5 },
      ],
    },
  },
};

const ES: Juego = {
  menu: {
    escritorio: {
      src: '/biblioteca/tutorial/es/escritorio-1-menu.webp',
      ancho: 1280,
      alto: 800,
      zonas: [{ n: 1, x: 0.9, y: 45.5, w: 18, h: 6 }],
    },
    movil: {
      src: '/biblioteca/tutorial/es/movil-1-menu.webp',
      ancho: 780,
      alto: 1688,
      zonas: [{ n: 1, x: 86.7, y: 94.8, w: 8.2, h: 3.8 }],
    },
  },
  explorar: {
    escritorio: {
      src: '/biblioteca/tutorial/es/escritorio-2-explorar.webp',
      ancho: 1280,
      alto: 800,
      zonas: [
        { n: 1, x: 20.9, y: 23.8, w: 39.1, h: 7.8 },
        { n: 2, x: 20.9, y: 35.6, w: 63.2, h: 11.5 },
      ],
    },
    movil: {
      src: '/biblioteca/tutorial/es/movil-2-explorar.webp',
      ancho: 780,
      alto: 1520,
      zonas: [
        { n: 1, x: 3.1, y: 25, w: 93.8, h: 6.6 },
        { n: 2, x: 3.1, y: 35.8, w: 93.8, h: 44.7 },
      ],
    },
  },
  botones: {
    escritorio: {
      src: '/biblioteca/tutorial/es/escritorio-3-botones.webp',
      ancho: 1280,
      alto: 560,
      zonas: [{ n: 1, x: 60.3, y: 45.7, w: 11.6, h: 7.1 }],
    },
    movil: {
      src: '/biblioteca/tutorial/es/movil-3-botones.webp',
      ancho: 780,
      alto: 1040,
      zonas: [{ n: 1, x: 51, y: 62.7, w: 37.9, h: 7.7 }],
    },
  },
  sevan: {
    escritorio: {
      src: '/biblioteca/tutorial/es/escritorio-4-sevan.webp',
      ancho: 1280,
      alto: 800,
      zonas: [
        { n: 1, x: 20.9, y: 51.1, w: 78.1, h: 7 },
        { n: 2, x: 20.9, y: 62.1, w: 78.1, h: 7 },
      ],
    },
    movil: {
      src: '/biblioteca/tutorial/es/movil-4-sevan.webp',
      ancho: 780,
      alto: 1520,
      zonas: [
        { n: 1, x: 3.1, y: 61.6, w: 93.8, h: 7.4 },
        { n: 2, x: 3.1, y: 73.2, w: 93.8, h: 7.4 },
      ],
    },
  },
  cuenta: {
    escritorio: {
      src: '/biblioteca/tutorial/es/escritorio-5-cuenta.webp',
      ancho: 1280,
      alto: 600,
      zonas: [
        { n: 1, x: 20.9, y: 82.3, w: 9.3, h: 3.8 },
        { n: 2, x: 20.9, y: 75.7, w: 5.9, h: 6.7 },
      ],
    },
    movil: {
      src: '/biblioteca/tutorial/es/movil-5-cuenta.webp',
      ancho: 780,
      alto: 1120,
      zonas: [
        { n: 1, x: 3.1, y: 51, w: 30.5, h: 4.1 },
        { n: 2, x: 3.1, y: 43.8, w: 19.5, h: 7.1 },
      ],
    },
  },
  temporadas: {
    escritorio: {
      src: '/biblioteca/tutorial/es/escritorio-6-temporadas.webp',
      ancho: 1280,
      alto: 800,
      zonas: [{ n: 1, x: 20.9, y: 54.1, w: 7.5, h: 4.5 }],
    },
    movil: {
      src: '/biblioteca/tutorial/es/movil-6-temporadas.webp',
      ancho: 780,
      alto: 1520,
      zonas: [{ n: 1, x: 3.1, y: 61.7, w: 24.7, h: 4.7 }],
    },
  },
  descubrir: {
    escritorio: {
      src: '/biblioteca/tutorial/es/escritorio-7-descubrir.webp',
      ancho: 1280,
      alto: 600,
      zonas: [{ n: 1, x: 20.9, y: 14, w: 78.1, h: 66.7 }],
    },
    movil: {
      src: '/biblioteca/tutorial/es/movil-7-descubrir.webp',
      ancho: 780,
      alto: 1280,
      zonas: [{ n: 1, x: 3.1, y: 13.1, w: 96.9, h: 53.8 }],
    },
  },
  novedades: {
    escritorio: {
      src: '/biblioteca/tutorial/es/escritorio-8-novedades.webp',
      ancho: 1280,
      alto: 800,
      zonas: [
        { n: 1, x: 28.4, y: 23.8, w: 7.2, h: 7.8 },
        { n: 2, x: 20.9, y: 85.6, w: 9.7, h: 5 },
        { n: 3, x: 47.2, y: 85.6, w: 9.7, h: 5 },
      ],
    },
    movil: {
      src: '/biblioteca/tutorial/es/movil-8-novedades.webp',
      ancho: 780,
      alto: 1520,
      zonas: [
        { n: 2, x: 3.1, y: 46.8, w: 36.7, h: 5.3 },
        { n: 3, x: 3.1, y: 92.6, w: 36.7, h: 5.3 },
      ],
    },
  },
  lomio: {
    escritorio: {
      src: '/biblioteca/tutorial/es/escritorio-9-lomio.webp',
      ancho: 1280,
      alto: 800,
      zonas: [
        { n: 1, x: 52.5, y: 23.8, w: 7.6, h: 7.8 },
        { n: 2, x: 20.9, y: 17, w: 10.9, h: 4.8 },
      ],
    },
    movil: {
      src: '/biblioteca/tutorial/es/movil-9-lomio.webp',
      ancho: 780,
      alto: 1520,
      zonas: [
        { n: 1, x: 3.1, y: 25, w: 93.8, h: 6.6 },
        { n: 2, x: 3.1, y: 17.9, w: 35.7, h: 5 },
      ],
    },
  },
};

// El espanol tiene sus capturas; el resto de idiomas usa las de ingles
export const capturasDe = (locale: string): Juego =>
  locale.toLowerCase().startsWith('es') ? ES : EN;
