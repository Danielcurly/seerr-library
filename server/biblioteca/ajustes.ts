import { BibliotecaAjuste } from '@server/biblioteca/entity/BibliotecaAjuste';
import { getRepository } from '@server/datasource';
import { getSettings } from '@server/lib/settings';

export interface Plazos {
  // Dias que una candidata pasa en la lista antes de borrarse
  listaDias: number;
  // Meses sin verse para entrar como candidata (desde la ultima reproduccion
  // o, si nadie la ha visto, desde la descarga). Tambien: meses sin
  // reproducciones para que una pausa abandonada vuelva a la lista.
  antiguedadMeses: number;
  // Dias sin actividad en Emby para dejar de contar como usuario activo
  actividadDias: number;
  // Meses que dura un "Quiero verla" si no llega a verla
  quieroVerMeses: number;
  // Cuantas entran por antiguedad (C) cada semana, las descargadas antes primero
  cPorSemana: number;
  // Votos de "No me interesa" para entrar como candidata (B)
  votosB: number;
  // Lo mismo que antiguedadMeses para las peliculas con la etiqueta de
  // Radarr configurada (p. ej. lo que se baja solo y nadie pidio)
  antiguedadEtiquetaMeses: number;
}

export interface EstadoSync {
  ultima?: string;
  duracionMs?: number;
  elementos?: number;
  error?: string;
}

export interface EstadoEvaluacion {
  ultima?: string;
  error?: string;
}

// Quien borra lo que vence:
// - avisar: nadie; al vencer el plazo solo se anota en el historial lo que se
//   habria borrado
// - arr: Seerr, pidiendoselo a Radarr/Sonarr (borrador.ts), a la hora indicada
// - externo: un programa externo, por la API de /api/biblioteca/ejecutor
export type ModoEjecucion = 'avisar' | 'arr' | 'externo';

// Que se hace con los torrents de lo que se borra (modo arr, con qBittorrent):
// dejarlos, borrarlos o esperar a que lleguen al ratio o a las horas minimas
export type PoliticaTorrents = 'dejar' | 'borrar' | 'esperar';

export interface ConexionQbittorrent {
  // Vacia: sin conexion (los torrents los gestiona el cliente o los *arr)
  url: string;
  usuario: string;
  contrasena: string;
}

export interface Ejecucion {
  modo: ModoEjecucion;
  // Hora del dia (0-23) a la que borra el modo arr
  hora: number;
  qbittorrent: ConexionQbittorrent;
  torrents: {
    politica: PoliticaTorrents;
    // Con 'esperar': se borra al llegar a cualquiera de los dos (null: no
    // cuenta)
    ratioMinimo: number | null;
    horasMinimas: number | null;
  };
}

export interface EstadoBorrador {
  ultima?: string;
  borrados?: number;
  esperas?: number;
  errores?: number;
  error?: string;
}

export interface EstadoNovedades {
  ultima?: string;
  duracionMs?: number;
  // Series con progreso y novedades calculadas
  series?: number;
  novedades?: number;
  error?: string;
}

// Etiqueta de Radarr cuyas peliculas usan antiguedadEtiquetaMeses; vacia: no
// se usa
export interface EtiquetaRadarr {
  nombre: string;
}

interface AjustesBiblioteca {
  // ids de bibliotecas de Emby incluidas en el sistema
  bibliotecas: string[];
  plazos: Plazos;
  etiquetaRadarr: EtiquetaRadarr;
  sync: EstadoSync;
  evaluacion: EstadoEvaluacion;
  novedades: EstadoNovedades;
  // Cuando entro cada candidata C de los ultimos 7 dias (ISO), para el cupo
  entradasC: string[];
  ejecucion: Ejecucion;
  borrador: EstadoBorrador;
}

export const modoEjecucion = async (): Promise<ModoEjecucion> =>
  (await leerAjuste('ejecucion')).modo;

// Solo avisar: no se borra nada, el historial lo anota como simulacro
export const soloAvisar = async (): Promise<boolean> =>
  (await modoEjecucion()) === 'avisar';

const PLAZOS_POR_DEFECTO: Plazos = {
  listaDias: 30,
  antiguedadMeses: 6,
  actividadDias: 90,
  quieroVerMeses: 6,
  cPorSemana: 10,
  votosB: 3,
  antiguedadEtiquetaMeses: 2,
};

const porDefecto = (): AjustesBiblioteca => ({
  // Por defecto, las bibliotecas que ya escanea Seerr
  bibliotecas: getSettings()
    .jellyfin.libraries.filter((l) => l.enabled)
    .map((l) => l.id),
  plazos: PLAZOS_POR_DEFECTO,
  etiquetaRadarr: { nombre: '' },
  sync: {},
  evaluacion: {},
  novedades: {},
  entradasC: [],
  ejecucion: {
    modo: 'avisar',
    hora: 4,
    qbittorrent: { url: '', usuario: '', contrasena: '' },
    torrents: { politica: 'dejar', ratioMinimo: null, horasMinimas: null },
  },
  borrador: {},
});

export const leerAjuste = async <K extends keyof AjustesBiblioteca>(
  clave: K
): Promise<AjustesBiblioteca[K]> => {
  const fila = await getRepository(BibliotecaAjuste).findOne({
    where: { clave },
  });
  const defecto = porDefecto()[clave];

  if (!fila) {
    return defecto;
  }

  const valor = JSON.parse(fila.valor) as AjustesBiblioteca[K];

  // Claves nuevas de un objeto toman su valor por defecto
  return Array.isArray(defecto) ? valor : { ...defecto, ...valor };
};

export const guardarAjuste = async <K extends keyof AjustesBiblioteca>(
  clave: K,
  valor: AjustesBiblioteca[K]
): Promise<void> => {
  await getRepository(BibliotecaAjuste).save(
    new BibliotecaAjuste({ clave, valor: JSON.stringify(valor) })
  );
};
