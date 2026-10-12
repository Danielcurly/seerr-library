import type { Ejecucion } from '@server/biblioteca/ajustes';
import { guardarAjuste, leerAjuste } from '@server/biblioteca/ajustes';
import {
  RadarrBiblioteca,
  SonarrBiblioteca,
  temporadaDe,
} from '@server/biblioteca/arr';
import type {
  CuerpoResultado,
  ElementoBorrar,
} from '@server/biblioteca/ejecutor';
import {
  anotarResultado,
  elementosParaBorrar,
} from '@server/biblioteca/ejecutor';
import type { TorrentQbt } from '@server/biblioteca/qbittorrent';
import {
  QBittorrent,
  segundosCompartiendo,
} from '@server/biblioteca/qbittorrent';
import { MediaStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

const LABEL = 'Biblioteca';
const HORA = 60 * 60 * 1000;

// Lo que hay que hacer con un elemento vencido, o por que no se puede todavia
type Plan =
  | { error: string }
  | { espera: Date; mensaje: string }
  | {
      ejecutar: () => Promise<void>;
      torrents: { conFicheros: string[]; sinFicheros: string[] };
      // Torrents que se quedan (politica 'dejar' o llevan otras temporadas)
      seQuedan: number;
      // Ya no queda nada en Radarr/Sonarr: se quita la ficha de Seerr
      sinFicheros: boolean;
    };

// Una ruta dentro de otra (o la misma)
const dentro = (ruta: string, carpeta: string): boolean => {
  const n = (r: string) => r.replace(/\\/g, '/').replace(/\/+$/, '');
  return n(ruta) === n(carpeta) || n(ruta).startsWith(n(carpeta) + '/');
};

const corto = (texto: string, max = 60) =>
  texto.length > max ? texto.slice(0, max - 1) + '…' : texto;

// Borrado de lo vencido sin programas externos (modo arr): Radarr borra la
// pelicula; Sonarr, los ficheros de la temporada, y deja de seguirla. Con
// qBittorrent configurado, sus torrents se dejan, se borran o se espera a que
// lleguen al ratio o a las horas minimas.
class BorradorBiblioteca {
  public running = false;

  public async run(): Promise<void> {
    if (this.running) return;
    const ajustes = await leerAjuste('ejecucion');
    if (ajustes.modo !== 'arr') return;
    this.running = true;
    const estado = { borrados: 0, esperas: 0, errores: 0 };
    try {
      const ahora = new Date();
      const elementos = (await elementosParaBorrar()).filter(
        // Se espera a la fecha que se calculo; con solo ratio, se vuelve a
        // mirar cada dia
        (el) =>
          el.ejecucion !== 'espera' ||
          !el.esperaHasta ||
          new Date(el.esperaHasta) <= ahora
      );
      for (const el of elementos) {
        const r = await this.borrar(el, ajustes);
        estado[
          r.resultado === 'borrado'
            ? 'borrados'
            : r.resultado === 'espera'
              ? 'esperas'
              : 'errores'
        ]++;
        const anotado = await anotarResultado({ id: el.id, ...r }, 'arr');
        if (anotado.error) {
          logger.warn(`${el.titulo}: ${anotado.error}`, { label: LABEL });
        }
      }
      logger.info(
        `Borrado de vencidas: ${estado.borrados} borradas, ${estado.esperas} en espera, ${estado.errores} con error`,
        { label: LABEL }
      );
      await guardarAjuste('borrador', {
        ultima: new Date().toISOString(),
        ...estado,
      });
    } catch (e) {
      logger.error(`Borrado de vencidas fallido: ${e.message}`, {
        label: LABEL,
      });
      await guardarAjuste('borrador', {
        ultima: new Date().toISOString(),
        ...estado,
        error: e.message,
      });
    } finally {
      this.running = false;
    }
  }

  private async borrar(
    el: ElementoBorrar,
    ajustes: Ejecucion
  ): Promise<Omit<CuerpoResultado, 'id'>> {
    try {
      const plan = await this.planear(el, ajustes);
      if ('error' in plan) return { resultado: 'error', mensaje: plan.error };
      if ('espera' in plan) {
        return {
          resultado: 'espera',
          hasta: plan.espera.toISOString(),
          mensaje: plan.mensaje,
        };
      }
      await plan.ejecutar();

      const notas: string[] = [];
      const borradosT =
        plan.torrents.conFicheros.length + plan.torrents.sinFicheros.length;
      if (borradosT) notas.push(`${borradosT} torrent(s) removed`);
      if (plan.seQuedan) notas.push(`${plan.seQuedan} torrent(s) kept`);
      return {
        resultado: 'borrado',
        mensaje: notas.length ? notas.join(' · ') : undefined,
      };
    } catch (e) {
      return {
        resultado: 'error',
        mensaje: `Removal failed: ${e.message}`.slice(0, 500),
      };
    }
  }

  private async planear(el: ElementoBorrar, ajustes: Ejecucion): Promise<Plan> {
    const settings = getSettings();
    const pelicula = el.tipo === 'movie';
    const arrId = pelicula ? el.radarrId : el.sonarrId;
    const app = pelicula ? 'Radarr' : 'Sonarr';
    if (!arrId) return { error: `Not found in ${app}` };
    const servidor = (pelicula ? settings.radarr : settings.sonarr).find(
      (s) => s.id === el.arrServidor
    );
    if (!servidor) {
      return { error: `Its ${app} server is no longer configured` };
    }
    const conexion = {
      apiKey: servidor.apiKey,
      url: RadarrBiblioteca.buildUrl(servidor, '/api/v3'),
    };
    const n = el.temporada;

    // Comprobaciones y lo que se borrara en Radarr/Sonarr
    let ruta: string;
    // downloadId -> temporadas que trajo (peliculas: vacio)
    const descargas = new Map<string, Set<number>>();
    let quedanTemporadas = new Set<number>();
    let borrarArr: () => Promise<void>;
    if (pelicula) {
      const radarr = new RadarrBiblioteca(conexion);
      const obj = await radarr.pelicula(arrId);
      if (el.tmdbId && obj.tmdbId !== el.tmdbId) {
        return { error: `${app} does not match the library (${obj.path})` };
      }
      ruta = obj.path;
      const enCola = (await radarr.cola()).find((r) => r.movieId === arrId);
      if (enCola) {
        return {
          error: `A download is in progress (${corto(enCola.title ?? '?')})`,
        };
      }
      for (const h of await radarr.historial(arrId)) {
        if (h.downloadId) descargas.set(h.downloadId.toLowerCase(), new Set());
      }
      borrarArr = () => radarr.borrarPelicula(arrId);
    } else {
      const sonarr = new SonarrBiblioteca(conexion);
      const obj = await sonarr.serie(arrId);
      if (el.tvdbId && obj.tvdbId !== el.tvdbId) {
        return { error: `${app} does not match the library (${obj.path})` };
      }
      ruta = obj.path ?? '';
      const enCola = (await sonarr.cola()).find(
        (r) => r.seriesId === arrId && temporadaDe(r) === n
      );
      if (enCola) {
        return {
          error: `A download is in progress (${corto(enCola.title ?? '?')})`,
        };
      }
      for (const h of await sonarr.historial(arrId)) {
        const t = temporadaDe(h);
        if (!h.downloadId || t === undefined) continue;
        const id = h.downloadId.toLowerCase();
        descargas.set(id, (descargas.get(id) ?? new Set()).add(t));
      }
      const ficheros = await sonarr.ficheros(arrId);
      const borrarIds = ficheros
        .filter((f) => f.seasonNumber === n)
        .map((f) => f.id);
      quedanTemporadas = new Set(
        ficheros.filter((f) => f.seasonNumber !== n).map((f) => f.seasonNumber)
      );
      borrarArr = async () => {
        if (borrarIds.length) await sonarr.borrarFicheros(borrarIds);
        // Se vuelve a leer: borrar ficheros cambia la serie
        const serie = await sonarr.serie(arrId);
        for (const t of serie.seasons) {
          if (t.seasonNumber === n) t.monitored = false;
        }
        // La temporada mas reciente: se deja de seguir la serie (las nuevas se
        // piden desde Novedades)
        if (el.ultimaTemporada) serie.monitored = false;
        await sonarr.guardarSerie(serie);
        await sonarr.dejarDeSeguirTemporada(arrId, n);
      };
    }
    const sinFicheros = pelicula || quedanTemporadas.size === 0;

    // Torrents
    const torrents = {
      conFicheros: [] as string[],
      sinFicheros: [] as string[],
    };
    let seQuedan = 0;
    let qbt: QBittorrent | null = null;
    const politica = ajustes.torrents.politica;
    if (ajustes.qbittorrent.url && descargas.size) {
      if (politica === 'dejar') {
        seQuedan = descargas.size;
      } else {
        qbt = new QBittorrent(ajustes.qbittorrent);
        await qbt.entrar();
        let espera: Date | null = null;
        const lista: TorrentQbt[] = await qbt.torrents([...descargas.keys()]);
        for (const t of lista) {
          const temporadas = descargas.get(t.hash.toLowerCase()) ?? new Set();
          // Lleva otras temporadas que siguen en la biblioteca
          if ([...temporadas].some((x) => x !== n && quedanTemporadas.has(x))) {
            seQuedan++;
            continue;
          }
          if (t.progress < 1) {
            return {
              error: `Its torrent is still downloading (${corto(t.name)})`,
            };
          }
          if (politica === 'esperar') {
            const hasta = this.esperaTorrent(t, ajustes.torrents);
            if (hasta && (!espera || hasta > espera)) espera = hasta;
          }
          // Si comparte desde la propia biblioteca, Radarr/Sonarr ya borran
          // los ficheros: solo se quita el torrent
          const cp = t.content_path ?? '';
          const desdeBiblioteca =
            !!ruta && !!cp && (dentro(cp, ruta) || dentro(ruta, cp));
          (desdeBiblioteca ? torrents.sinFicheros : torrents.conFicheros).push(
            t.hash
          );
        }
        if (espera) {
          return {
            espera,
            mensaje:
              'Waiting for its torrents to reach the minimum seeding goal',
          };
        }
      }
    }

    const ejecutar = async () => {
      await borrarArr();
      if (qbt) {
        await qbt.borrar(torrents.conFicheros, true);
        await qbt.borrar(torrents.sinFicheros, false);
      }
      if (sinFicheros && el.tmdbId) {
        await this.quitarFicha(
          el.tmdbId,
          pelicula ? MediaType.MOVIE : MediaType.TV
        );
      }
    };
    return { ejecutar, torrents, seQuedan, sinFicheros };
  }

  // Hasta cuando hay que esperar a un torrent (null: ya puede borrarse). Vale
  // con llegar a uno de los dos minimos.
  private esperaTorrent(
    t: TorrentQbt,
    minimos: Ejecucion['torrents']
  ): Date | null {
    const { ratioMinimo, horasMinimas } = minimos;
    if (ratioMinimo === null && horasMinimas === null) return null;
    const segundos = segundosCompartiendo(t);
    if (ratioMinimo !== null && t.ratio >= ratioMinimo) return null;
    if (horasMinimas !== null && segundos >= horasMinimas * 3600) return null;
    // Con horas, lo que falta; con solo ratio, se vuelve a mirar en un dia
    return new Date(
      Date.now() +
        (horasMinimas !== null
          ? Math.max(HORA, horasMinimas * HORA - segundos * 1000)
          : 24 * HORA)
    );
  }

  // Sin ficha, se puede volver a pedir (como al borrarla desde Seerr)
  private async quitarFicha(tmdbId: number, tipo: MediaType): Promise<void> {
    const repo = getRepository(Media);
    const media = await repo.findOne({ where: { tmdbId, mediaType: tipo } });
    if (!media) return;
    if (media.status === MediaStatus.BLOCKLISTED) {
      media.resetServiceData();
      await repo.save(media);
    } else {
      await repo.remove(media);
    }
  }
}

export const borradorBiblioteca = new BorradorBiblioteca();
