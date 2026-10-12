import defineMessages from '@app/utils/defineMessages';
import type { IntlShape } from 'react-intl';

// Tipos y textos compartidos de las pestañas de la Biblioteca.

export type MiEstado = 'visto' | 'empezado' | 'no';

export type TipoMarca = 'borrar' | 'no_interesa' | 'quiero_ver' | 'guardar';

export type MotivoCandidata = 'A' | 'B' | 'C' | 'F';

export interface CandidataBiblioteca {
  temporada: number;
  motivo: MotivoCandidata;
  pedidoPor: string[];
  estado: 'lista' | 'listo';
  entrada: string;
  vence: string;
  tamano: number;
  // Alguien la esta viendo: cuenta atras parada
  pausada: boolean;
  // El ejecutor espera (p. ej. a que sus torrents cumplan el mínimo de siembra)
  esperaHasta: string | null;
}

export interface ElementoBiblioteca {
  embyId: string;
  tipo: 'movie' | 'tv';
  tmdbId: number | null;
  tvdbId: number | null;
  mediaId: number | null;
  bibliotecaId: string;
  titulo: string;
  anio: number | null;
  fechaEstreno: string | null;
  generos: string[];
  fechaDescarga: string;
  tamano: number;
  ultimaReproduccion: string | null;
  miEstado: MiEstado;
  temporadas?: { total: number; vistas: number };
  numerosTemporada: number[];
  temporadasVistas: number[];
  misMarcas: { temporada: number; tipo: TipoMarca }[];
  guardada: boolean;
  candidatas: CandidataBiblioteca[];
  gestionado: boolean;
  // Película con la etiqueta de Radarr de los ajustes
  conEtiqueta: boolean;
}

export interface EstadoBiblioteca {
  modulo: string;
  version: string;
  simulacro: boolean;
  tutorialPendiente: boolean;
  usuario: {
    id: number;
    nombre: string;
    admin: boolean;
    tieneVoto: boolean;
    puedeGuardar: boolean;
    activo: boolean;
  };
  pendientes: number;
  plazos: {
    listaDias: number;
    antiguedadMeses: number;
    actividadDias: number;
    quieroVerMeses: number;
    cPorSemana: number;
    votosB: number;
    antiguedadEtiquetaMeses: number;
  };
}

// Novedades de las series que veo
export interface TemporadaNovedad {
  temporada: number;
  desde: number;
  hasta: number;
  emitidos: number;
  completa: boolean;
  descargados: number;
  pedida: boolean;
  esperando: boolean;
}

export interface NovedadSerie {
  tmdbId: number;
  tvdbId: number | null;
  titulo: string;
  mediaId: number | null;
  embyUrl: string | null;
  fecha: string | null;
  temporadas: TemporadaNovedad[];
}

export interface ProximaSerie {
  tmdbId: number;
  tvdbId: number | null;
  titulo: string;
  mediaId: number | null;
  temporada: number;
  episodio: number;
  fecha: string | null;
}

export interface NovedadesRespuesta {
  nuevas: NovedadSerie[];
  proximas: ProximaSerie[];
  calculada: string | null;
}

export interface PaginaBiblioteca {
  pageInfo: {
    pagina: number;
    paginas: number;
    porPagina: number;
    total: number;
  };
  resultados: ElementoBiblioteca[];
}

export interface FiltrosBiblioteca {
  bibliotecas: { id: string; nombre: string }[];
  generos: string[];
}

export const messages = defineMessages('components.Biblioteca.comun', {
  titles: '{count, plural, one {# title} other {# titles}}',
  seasonShort: 'S{season}',
  markRemove: 'Removal requested',
  markNotInterested: 'Not interested',
  markWatchLater: 'Watch later',
  markKeep: 'Kept',
  paused: 'Paused: currently being watched',
  readyForRemoval: 'Ready for removal',
  scheduledSeeding: 'Removal on {date} (still seeding)',
  removalIn:
    '{days, plural, =0 {Removal today} one {Removal tomorrow} other {Removal in # days}}',
  reasonRequested: 'Removal requested by {names}',
  reasonNotInterested: 'Not interested: {names}',
  reasonNotWatchedSince: 'Not watched since {date}',
  reasonNeverWatched: 'Not watched since it was downloaded',
  reasonAdmin: 'Added by an administrator',
  genreAction: 'Action',
  genreActionAdventure: 'Action & Adventure',
  genreAdventure: 'Adventure',
  genreAnimation: 'Animation',
  genreAnime: 'Anime',
  genreBiography: 'Biography',
  genreChildren: 'Children',
  genreComedy: 'Comedy',
  genreCrime: 'Crime',
  genreDocumentary: 'Documentary',
  genreDrama: 'Drama',
  genreFamily: 'Family',
  genreFantasy: 'Fantasy',
  genreHistory: 'History',
  genreHorror: 'Horror',
  genreKids: 'Kids',
  genreMiniSeries: 'Mini-Series',
  genreMusic: 'Music',
  genreMusical: 'Musical',
  genreMystery: 'Mystery',
  genreNews: 'News',
  genreReality: 'Reality',
  genreRomance: 'Romance',
  genreSciFiFantasy: 'Sci-Fi & Fantasy',
  genreScienceFiction: 'Science Fiction',
  genreSoap: 'Soap',
  genreSport: 'Sport',
  genreSuspense: 'Suspense',
  genreTalk: 'Talk',
  genreThriller: 'Thriller',
  genreTVMovie: 'TV Movie',
  genreWar: 'War',
  genreWarPolitics: 'War & Politics',
  genreWestern: 'Western',
  genreFood: 'Food',
  genreIndie: 'Indie',
  genreMartialArts: 'Martial Arts',
  genreTravel: 'Travel',
});

type ClaveMensaje = keyof typeof messages;

// Jellyfin/Emby devuelve los géneros de TMDB en inglés (a veces ya traducidos
// al español): cada uno a su mensaje, por su nombre en inglés
const GENEROS: Record<string, ClaveMensaje> = {
  Action: 'genreAction',
  'Action & Adventure': 'genreActionAdventure',
  Adventure: 'genreAdventure',
  Animation: 'genreAnimation',
  Anime: 'genreAnime',
  Biography: 'genreBiography',
  Children: 'genreChildren',
  Comedy: 'genreComedy',
  Crime: 'genreCrime',
  Documentary: 'genreDocumentary',
  Drama: 'genreDrama',
  Family: 'genreFamily',
  Fantasy: 'genreFantasy',
  History: 'genreHistory',
  Horror: 'genreHorror',
  Kids: 'genreKids',
  'Mini-Series': 'genreMiniSeries',
  Music: 'genreMusic',
  Musical: 'genreMusical',
  Mystery: 'genreMystery',
  News: 'genreNews',
  Reality: 'genreReality',
  Romance: 'genreRomance',
  'Sci-Fi & Fantasy': 'genreSciFiFantasy',
  'Science Fiction': 'genreScienceFiction',
  Soap: 'genreSoap',
  Sport: 'genreSport',
  Suspense: 'genreSuspense',
  Talk: 'genreTalk',
  Thriller: 'genreThriller',
  'TV Movie': 'genreTVMovie',
  War: 'genreWar',
  'War & Politics': 'genreWarPolitics',
  Western: 'genreWestern',
  Food: 'genreFood',
  Indie: 'genreIndie',
  'Martial Arts': 'genreMartialArts',
  Travel: 'genreTravel',
  // Nombres que el servidor de medios ya da en español
  Acción: 'genreAction',
  'Acción y aventura': 'genreActionAdventure',
  Aventura: 'genreAdventure',
  Animación: 'genreAnimation',
  Biografía: 'genreBiography',
  Infantil: 'genreKids',
  Comedia: 'genreComedy',
  Crimen: 'genreCrime',
  Documental: 'genreDocumentary',
  Familia: 'genreFamily',
  Fantasía: 'genreFantasy',
  Historia: 'genreHistory',
  Terror: 'genreHorror',
  Miniserie: 'genreMiniSeries',
  Música: 'genreMusic',
  Misterio: 'genreMystery',
  Noticias: 'genreNews',
  'Ciencia ficción y fantasía': 'genreSciFiFantasy',
  'Ciencia ficción': 'genreScienceFiction',
  Telenovela: 'genreSoap',
  Deporte: 'genreSport',
  'Película de TV': 'genreTVMovie',
  Bélica: 'genreWar',
  'Bélica y política': 'genreWarPolitics',
};

export const nombreGenero = (intl: IntlShape, g: string): string => {
  const clave = GENEROS[g];
  return clave ? intl.formatMessage(messages[clave]) : g;
};

// Los géneros que se muestran igual (el mismo en inglés y en español, o dos
// que se traducen igual) se agrupan; el filtro envía todos los originales
// separados por |
export const agruparGeneros = (
  intl: IntlShape,
  generos: string[]
): { valor: string; nombre: string }[] => {
  const grupos = new Map<string, string[]>();
  for (const g of generos) {
    const nombre = nombreGenero(intl, g);
    grupos.set(nombre, [...(grupos.get(nombre) ?? []), g]);
  }
  return [...grupos.entries()]
    .map(([nombre, gs]) => ({ valor: gs.sort().join('|'), nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, intl.locale));
};

export const textoTitulos = (intl: IntlShape, n: number): string =>
  intl.formatMessage(messages.titles, { count: n });

// "T3" / "S3"
export const temporadaCorta = (intl: IntlShape, t: number): string =>
  t < 0 ? '' : intl.formatMessage(messages.seasonShort, { season: t });

export const formatoTamano = (intl: IntlShape, bytes: number): string => {
  if (!bytes) return '';
  const gb = bytes / 1024 ** 3;
  return gb >= 1
    ? `${intl.formatNumber(gb, { maximumFractionDigits: 1 })} GB`
    : `${intl.formatNumber(Math.round(bytes / 1024 ** 2))} MB`;
};

export const formatoFecha = (intl: IntlShape, iso: string | null): string =>
  iso
    ? intl.formatDate(iso, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

export const formatoFechaHora = (intl: IntlShape, iso: string): string =>
  `${formatoFecha(intl, iso)} ${intl.formatTime(iso, {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

const MENSAJE_MARCA: Record<TipoMarca, ClaveMensaje> = {
  borrar: 'markRemove',
  no_interesa: 'markNotInterested',
  quiero_ver: 'markWatchLater',
  guardar: 'markKeep',
};

export const textoMarca = (intl: IntlShape, tipo: TipoMarca): string =>
  intl.formatMessage(messages[MENSAJE_MARCA[tipo]]);

export const diasHasta = (iso: string): number =>
  Math.max(Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000), 0);

// "Se borra en 12 días" / "En pausa..." / "Listo para borrar"
export const textoCuentaAtras = (
  intl: IntlShape,
  c: CandidataBiblioteca
): string => {
  if (c.pausada) return intl.formatMessage(messages.paused);
  if (c.estado === 'listo') {
    return c.esperaHasta
      ? intl.formatMessage(messages.scheduledSeeding, {
          date: formatoFecha(intl, c.esperaHasta),
        })
      : intl.formatMessage(messages.readyForRemoval);
  }
  return intl.formatMessage(messages.removalIn, { days: diasHasta(c.vence) });
};

// En pausa en amarillo; la cuenta atrás, en rojo
export const claseCuentaAtras = (c: CandidataBiblioteca): string =>
  c.pausada ? 'text-yellow-400' : 'text-red-400';

export const textoMotivo = (
  intl: IntlShape,
  c: CandidataBiblioteca,
  ultimaReproduccion: string | null
): string => {
  const names = intl.formatList(c.pedidoPor, { type: 'conjunction' });
  switch (c.motivo) {
    case 'A':
      return intl.formatMessage(messages.reasonRequested, { names });
    case 'B':
      return intl.formatMessage(messages.reasonNotInterested, { names });
    case 'C':
      return ultimaReproduccion
        ? intl.formatMessage(messages.reasonNotWatchedSince, {
            date: formatoFecha(intl, ultimaReproduccion),
          })
        : intl.formatMessage(messages.reasonNeverWatched);
    default:
      return intl.formatMessage(messages.reasonAdmin);
  }
};
