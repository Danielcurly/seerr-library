import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { guardarAjuste, leerAjuste } from '@server/biblioteca/ajustes';
import type { EmbyElemento } from '@server/biblioteca/emby';
import EmbyBiblioteca from '@server/biblioteca/emby';
import type { Actividad } from '@server/biblioteca/entity/BibliotecaElemento';
import { BibliotecaElemento } from '@server/biblioteca/entity/BibliotecaElemento';
import { BibliotecaProgreso } from '@server/biblioteca/entity/BibliotecaProgreso';
import { BibliotecaTemporada } from '@server/biblioteca/entity/BibliotecaTemporada';
import { BibliotecaUsuario } from '@server/biblioteca/entity/BibliotecaUsuario';
import { BibliotecaVisto } from '@server/biblioteca/entity/BibliotecaVisto';
import dataSource, { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { getHostname } from '@server/utils/getHostname';
import axios from 'axios';
import { IsNull, Not } from 'typeorm';

// Foto de las bibliotecas incluidas: catalogo (Emby), tamano (Radarr/Sonarr) y
// lo visto por cada usuario de Seerr. Solo lee de Emby y de las *arr.

const LABEL = 'Biblioteca';

// Donde esta en Radarr/Sonarr (para que el ejecutor la borre)
interface EnArr {
  id: number;
  servidor: number;
  ruta: string | null;
  // Servidor 4K: solo se usa si no esta en uno normal
  es4k: boolean;
}

const preferirArr = (actual: EnArr | undefined, nuevo: EnArr): EnArr =>
  !actual || (actual.es4k && !nuevo.es4k) ? nuevo : actual;

interface TamanoSerie {
  arr: EnArr;
  total: number;
  temporadas: Map<number, number>;
}

// Episodio mas avanzado que ha visto (o empezado) un usuario de una serie
interface Punto {
  temporada: number;
  episodio: number;
  fecha: Date | null;
}

const masAvanzado = (a: Punto, b: Punto): number =>
  a.temporada - b.temporada || a.episodio - b.episodio;

const fecha = (s?: string): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const masReciente = (a: Date | null, b: Date | null): Date | null =>
  !a ? b : !b ? a : a > b ? a : b;

const masAntigua = (a: Date, b?: Date): Date => (b && b < a ? b : a);

// Importaciones de Radarr/Sonarr (eventType downloadFolderImported), desde
// siempre. Sirven para saber cuando llego cada fichero por primera vez: Emby
// da otra fecha de alta cuando una mejora de calidad cambia el fichero.
interface Importacion {
  date: string;
  movieId?: number;
  seriesId?: number;
  episode?: { seasonNumber: number; episodeNumber: number };
}

const importaciones = async (
  url: string,
  apiKey: string,
  conEpisodio: boolean
): Promise<Importacion[]> => {
  const r = await axios.get<Importacion[]>(`${url}/history/since`, {
    headers: { 'X-Api-Key': apiKey },
    params: {
      date: '2000-01-01T00:00:00Z',
      eventType: 'downloadFolderImported',
      ...(conEpisodio ? { includeEpisode: true } : {}),
    },
    timeout: 120000,
  });
  return r.data;
};

const claveEpisodio = (
  id: string,
  temporada: number,
  episodio: number
): string => `${id}|${temporada}|${episodio}`;

const entero = (s?: string): number | null => {
  const n = s ? parseInt(s, 10) : NaN;
  return isNaN(n) ? null : n;
};

const claveTemporada = (serie: string, numero: number) => `${serie}|${numero}`;

class SincronizadorBiblioteca {
  private ejecutando = false;

  public get running(): boolean {
    return this.ejecutando;
  }

  public async run(): Promise<void> {
    if (this.ejecutando) {
      return;
    }
    this.ejecutando = true;
    const inicio = Date.now();

    try {
      const elementos = await this.sincronizar();
      await guardarAjuste('sync', {
        ultima: new Date().toISOString(),
        duracionMs: Date.now() - inicio,
        elementos,
      });
      logger.info(
        `Sincronizacion terminada: ${elementos} elementos en ${Date.now() - inicio} ms`,
        { label: LABEL }
      );
    } catch (e) {
      logger.error(`Sincronizacion fallida: ${e.message}`, { label: LABEL });
      await guardarAjuste('sync', {
        ...(await leerAjuste('sync')),
        error: `${new Date().toISOString()}: ${e.message}`,
      });
    } finally {
      this.ejecutando = false;
    }
  }

  private async sincronizar(): Promise<number> {
    const settings = getSettings();
    const admin = await getRepository(User).findOne({
      where: { id: 1 },
      select: ['id', 'jellyfinUserId', 'jellyfinDeviceId'],
    });
    const emby = new EmbyBiblioteca(
      getHostname(),
      settings.jellyfin.apiKey,
      admin?.jellyfinDeviceId
    );
    if (admin?.jellyfinUserId) {
      emby.setUserId(admin.jellyfinUserId);
    }

    const incluidas = await leerAjuste('bibliotecas');

    // --- Catalogo y episodios descargados -------------------------------
    const elementos = new Map<string, BibliotecaElemento>();
    const episodiosEmby: EmbyElemento[] = [];

    for (const bibliotecaId of incluidas) {
      const catalogo = await emby.catalogo(bibliotecaId);
      for (const item of catalogo) {
        const alta = fecha(item.DateCreated) ?? new Date(0);
        elementos.set(
          item.Id,
          new BibliotecaElemento({
            embyId: item.Id,
            tipo: item.Type === 'Movie' ? 'movie' : 'tv',
            tmdbId: entero(item.ProviderIds?.Tmdb),
            tvdbId: entero(item.ProviderIds?.Tvdb),
            mediaId: null,
            bibliotecaId,
            titulo: item.Name,
            tituloOrden: (item.SortName ?? item.Name).toLowerCase(),
            anio: item.ProductionYear ?? null,
            fechaEstreno:
              fecha(item.PremiereDate) ??
              (item.ProductionYear
                ? new Date(Date.UTC(item.ProductionYear, 0, 1))
                : null),
            generos: JSON.stringify(item.Genres ?? []),
            fechaAlta: alta,
            fechaDescarga: alta,
            tamano: 0,
            ultimaReproduccion: null,
            gestionado: false,
            conEtiqueta: false,
            arrId: null,
            arrServidor: null,
            ruta: null,
            actividad: '{}',
          })
        );
      }

      if (!catalogo.some((i) => i.Type === 'Series')) {
        continue;
      }
      episodiosEmby.push(...(await emby.episodios(bibliotecaId)));
    }

    // --- Enlace con Seerr ------------------------------------------------
    const medias = await getRepository(Media).find({
      select: ['id', 'tmdbId', 'tvdbId', 'mediaType', 'jellyfinMediaId'],
    });
    const porEmby = new Map<string, Media>();
    const porTmdb = new Map<string, Media>();
    for (const m of medias) {
      if (m.jellyfinMediaId) porEmby.set(m.jellyfinMediaId, m);
      porTmdb.set(`${m.mediaType}|${m.tmdbId}`, m);
    }
    for (const e of elementos.values()) {
      const m =
        porEmby.get(e.embyId) ??
        (e.tmdbId ? porTmdb.get(`${e.tipo}|${e.tmdbId}`) : undefined);
      if (m) {
        e.mediaId = m.id;
        e.tmdbId = e.tmdbId ?? m.tmdbId;
        e.tvdbId = e.tvdbId ?? m.tvdbId ?? null;
      }
    }

    // --- Tamano en disco (Radarr / Sonarr) ---------------------------------
    const tamPeliculas = new Map<number, number>();
    const arrPeliculas = new Map<number, EnArr>();
    // tmdb -> primera importacion
    const primeraPelicula = new Map<number, Date>();
    // tmdb de las peliculas con la etiqueta de Radarr de los ajustes
    const conEtiqueta = new Set<number>();
    const nombreEtiqueta = (await leerAjuste('etiquetaRadarr')).nombre
      .trim()
      .toLowerCase();
    for (const server of settings.radarr) {
      const url = RadarrAPI.buildUrl(server, '/api/v3');
      const radarr = new RadarrAPI({ apiKey: server.apiKey, url });
      const tmdbDe = new Map<number, number>();
      const etiqueta = nombreEtiqueta
        ? (await radarr.getTags()).find(
            (tag) => tag.label.toLowerCase() === nombreEtiqueta
          )?.id
        : undefined;
      for (const p of await radarr.getMovies()) {
        if (etiqueta !== undefined && p.tags?.includes(etiqueta)) {
          conEtiqueta.add(p.tmdbId);
        }
        const tam = (p as unknown as { sizeOnDisk?: number }).sizeOnDisk ?? 0;
        tamPeliculas.set(p.tmdbId, (tamPeliculas.get(p.tmdbId) ?? 0) + tam);
        tmdbDe.set(p.id, p.tmdbId);
        arrPeliculas.set(
          p.tmdbId,
          preferirArr(arrPeliculas.get(p.tmdbId), {
            id: p.id,
            servidor: server.id,
            ruta: (p as unknown as { path?: string }).path ?? null,
            es4k: server.is4k,
          })
        );
      }
      try {
        for (const h of await importaciones(url, server.apiKey, false)) {
          const tmdb = h.movieId ? tmdbDe.get(h.movieId) : undefined;
          const d = fecha(h.date);
          if (!tmdb || !d) continue;
          primeraPelicula.set(tmdb, masAntigua(d, primeraPelicula.get(tmdb)));
        }
      } catch (e) {
        logger.warn(`Historial de Radarr no disponible: ${e.message}`, {
          label: LABEL,
        });
      }
    }
    const tamSeriesTvdb = new Map<number, TamanoSerie>();
    const tamSeriesTmdb = new Map<number, TamanoSerie>();
    // "tvdb:<id>|T|E" y "tmdb:<id>|T|E" -> primera importacion del episodio
    const primeraEpisodio = new Map<string, Date>();
    for (const server of settings.sonarr) {
      const url = SonarrAPI.buildUrl(server, '/api/v3');
      const sonarr = new SonarrAPI({ apiKey: server.apiKey, url });
      const idsDe = new Map<number, string[]>();
      for (const s of await sonarr.getSeries()) {
        const tmdbSerie = (s as unknown as { tmdbId?: number }).tmdbId;
        if (s.id !== undefined)
          idsDe.set(s.id, [
            ...(s.tvdbId ? [`tvdb:${s.tvdbId}`] : []),
            ...(tmdbSerie ? [`tmdb:${tmdbSerie}`] : []),
          ]);
        const arr: EnArr = {
          id: s.id ?? 0,
          servidor: server.id,
          ruta: (s as unknown as { path?: string }).path ?? null,
          es4k: server.is4k,
        };
        const anterior = tamSeriesTvdb.get(s.tvdbId);
        if (anterior && preferirArr(anterior.arr, arr) === anterior.arr) {
          continue;
        }
        const tam: TamanoSerie = {
          arr,
          total: s.statistics?.sizeOnDisk ?? 0,
          temporadas: new Map(
            s.seasons.map((t) => [
              t.seasonNumber,
              t.statistics?.sizeOnDisk ?? 0,
            ])
          ),
        };
        tamSeriesTvdb.set(s.tvdbId, tam);
        if (tmdbSerie) tamSeriesTmdb.set(tmdbSerie, tam);
      }
      try {
        for (const h of await importaciones(url, server.apiKey, true)) {
          const d = fecha(h.date);
          if (!d || !h.seriesId || !h.episode) continue;
          for (const id of idsDe.get(h.seriesId) ?? []) {
            const k = claveEpisodio(
              id,
              h.episode.seasonNumber,
              h.episode.episodeNumber
            );
            primeraEpisodio.set(k, masAntigua(d, primeraEpisodio.get(k)));
          }
        }
      } catch (e) {
        logger.warn(`Historial de Sonarr no disponible: ${e.message}`, {
          label: LABEL,
        });
      }
    }

    // Peliculas: la mas antigua entre el alta en Emby y la primera importacion
    for (const e of elementos.values()) {
      if (e.tipo !== 'movie' || !e.tmdbId) continue;
      e.fechaDescarga = masAntigua(e.fechaAlta, primeraPelicula.get(e.tmdbId));
    }

    // Temporadas: episodios descargados y fecha del mas reciente (cada uno con
    // la mas antigua entre su alta en Emby y su primera importacion)
    const temporadas = new Map<
      string,
      { serie: string; numero: number; episodios: Set<string>; fecha: Date }
    >();
    for (const ep of episodiosEmby) {
      if (!ep.SeriesId || ep.ParentIndexNumber === undefined) continue;
      const serie = elementos.get(ep.SeriesId);
      if (!serie) continue;
      let llegada = fecha(ep.DateCreated) ?? new Date(0);
      if (ep.IndexNumber !== undefined) {
        for (const id of [
          ...(serie.tvdbId ? [`tvdb:${serie.tvdbId}`] : []),
          ...(serie.tmdbId ? [`tmdb:${serie.tmdbId}`] : []),
        ]) {
          llegada = masAntigua(
            llegada,
            primeraEpisodio.get(
              claveEpisodio(id, ep.ParentIndexNumber, ep.IndexNumber)
            )
          );
        }
      }
      const clave = claveTemporada(ep.SeriesId, ep.ParentIndexNumber);
      const t = temporadas.get(clave) ?? {
        serie: ep.SeriesId,
        numero: ep.ParentIndexNumber,
        episodios: new Set<string>(),
        fecha: llegada,
      };
      t.episodios.add(ep.Id);
      if (llegada > t.fecha) t.fecha = llegada;
      temporadas.set(clave, t);
    }

    // Series: descarga = el episodio que llego mas tarde
    const conEpisodios = new Set<string>();
    for (const t of temporadas.values()) {
      const serie = elementos.get(t.serie);
      if (!serie) continue;
      if (!conEpisodios.has(t.serie) || t.fecha > serie.fechaDescarga) {
        serie.fechaDescarga = t.fecha;
      }
      conEpisodios.add(t.serie);
    }
    const tamanoSerie = (e: BibliotecaElemento) =>
      (e.tvdbId ? tamSeriesTvdb.get(e.tvdbId) : undefined) ??
      (e.tmdbId ? tamSeriesTmdb.get(e.tmdbId) : undefined);
    for (const e of elementos.values()) {
      const arr =
        e.tipo === 'movie'
          ? e.tmdbId
            ? arrPeliculas.get(e.tmdbId)
            : undefined
          : tamanoSerie(e)?.arr;
      e.arrId = arr?.id ?? null;
      e.arrServidor = arr?.servidor ?? null;
      e.ruta = arr?.ruta ?? null;
      if (e.tipo === 'movie') {
        e.gestionado = !!e.tmdbId && tamPeliculas.has(e.tmdbId);
        e.tamano = (e.tmdbId ? tamPeliculas.get(e.tmdbId) : 0) ?? 0;
        e.conEtiqueta = !!e.tmdbId && conEtiqueta.has(e.tmdbId);
      } else {
        const serie = tamanoSerie(e);
        e.gestionado = !!serie;
        e.tamano = serie?.total ?? 0;
      }
    }

    // --- Usuarios y lo reproducido ---------------------------------------
    const seerrUsers = await getRepository(User).find({
      where: { jellyfinUserId: Not(IsNull()) },
      select: ['id', 'jellyfinUserId'],
    });
    const seerrPorEmby = new Map(
      seerrUsers.map((u) => [u.jellyfinUserId as string, u.id])
    );
    const usuariosEmby = await emby.usuariosEmby();

    const repoUsuario = getRepository(BibliotecaUsuario);
    const existentes = new Map(
      (await repoUsuario.find()).map((u) => [u.userId, u])
    );
    // Nuevos, con voto; en los existentes solo se tocan los datos de Emby (el
    // resto puede cambiar mientras se sincroniza)
    const usuariosNuevos: BibliotecaUsuario[] = [];
    const datosEmby: {
      userId: number;
      embyUserId: string;
      ultimaActividad: Date | null;
    }[] = [];
    for (const ue of usuariosEmby) {
      const userId = seerrPorEmby.get(ue.Id);
      if (!userId) continue;
      const datos = {
        userId,
        embyUserId: ue.Id,
        ultimaActividad: fecha(ue.LastActivityDate),
      };
      if (existentes.has(userId)) {
        datosEmby.push(datos);
      } else {
        usuariosNuevos.push(
          new BibliotecaUsuario({
            ...datos,
            tieneVoto: true,
            puedeGuardar: true,
            tutorialVisto: null,
          })
        );
      }
    }

    // visto: userId|embyId|temporada -> fila
    const vistos = new Map<string, BibliotecaVisto>();
    // Series: userId|embyId -> episodio mas avanzado, y userId|embyId|T ->
    // episodios vistos enteros de cada temporada (para las novedades)
    const puntos = new Map<string, Punto>();
    const vistosPorTemporada = new Map<string, Set<number>>();
    // episodios vistos por usuario y temporada
    const episodiosVistos = new Map<string, Set<string>>();
    // Cualquier cuenta de Emby (tambien las que no estan en Seerr): pelicula
    // (embyId) o serie|temporada -> cuenta -> ultima vez y lo visto
    const actividad = new Map<
      string,
      Map<string, { ultima: Date | null; completa: boolean; eps: Set<string> }>
    >();

    const anotar = (
      embyUserId: string,
      userId: number | undefined,
      item: EmbyElemento,
      jugado: boolean
    ) => {
      const cuando = fecha(item.UserData?.LastPlayedDate);
      const raiz = item.Type === 'Movie' ? item.Id : item.SeriesId;
      const elemento = raiz ? elementos.get(raiz) : undefined;
      if (!elemento) return;
      // Ultima reproduccion de cualquier usuario de Emby
      elemento.ultimaReproduccion = masReciente(
        elemento.ultimaReproduccion,
        cuando
      );

      const temporada =
        item.Type === 'Movie'
          ? BibliotecaVisto.PELICULA
          : (item.ParentIndexNumber ?? null);
      if (temporada === null) return;
      if (
        userId !== undefined &&
        item.Type === 'Episode' &&
        temporada >= 1 &&
        item.IndexNumber !== undefined
      ) {
        const claveSerie = `${userId}|${elemento.embyId}`;
        const punto = {
          temporada,
          episodio: item.IndexNumber,
          fecha: cuando,
        };
        const antes = puntos.get(claveSerie);
        if (!antes || masAvanzado(punto, antes) > 0) {
          puntos.set(claveSerie, punto);
        } else if (masAvanzado(punto, antes) === 0) {
          antes.fecha = masReciente(antes.fecha, cuando);
        }
        if (jugado) {
          const k = `${claveSerie}|${temporada}`;
          vistosPorTemporada.set(
            k,
            (vistosPorTemporada.get(k) ?? new Set()).add(item.IndexNumber)
          );
        }
      }
      if (
        item.Type === 'Episode' &&
        !temporadas.has(claveTemporada(elemento.embyId, temporada))
      ) {
        return;
      }

      const claveAct =
        item.Type === 'Movie'
          ? elemento.embyId
          : claveTemporada(elemento.embyId, temporada);
      const porCuenta = actividad.get(claveAct) ?? new Map();
      const act = porCuenta.get(embyUserId) ?? {
        ultima: null,
        completa: false,
        eps: new Set<string>(),
      };
      act.ultima = masReciente(act.ultima, cuando);
      if (jugado) {
        if (item.Type === 'Movie') act.completa = true;
        else act.eps.add(item.Id);
      }
      porCuenta.set(embyUserId, act);
      actividad.set(claveAct, porCuenta);

      if (userId === undefined) return;
      const clave = `${userId}|${elemento.embyId}|${temporada}`;
      const fila =
        vistos.get(clave) ??
        new BibliotecaVisto({
          userId,
          embyId: elemento.embyId,
          temporada,
          visto: false,
          episodiosVistos: 0,
          ultimaReproduccion: null,
        });
      fila.ultimaReproduccion = masReciente(fila.ultimaReproduccion, cuando);
      if (jugado) {
        if (item.Type === 'Movie') {
          fila.visto = true;
        } else {
          const set = episodiosVistos.get(clave) ?? new Set<string>();
          set.add(item.Id);
          episodiosVistos.set(clave, set);
        }
      }
      vistos.set(clave, fila);
    };

    for (const ue of usuariosEmby) {
      const userId = seerrPorEmby.get(ue.Id);
      for (const bibliotecaId of incluidas) {
        for (const item of await emby.reproducidos(
          ue.Id,
          bibliotecaId,
          'IsPlayed'
        )) {
          anotar(ue.Id, userId, item, true);
        }
        for (const item of await emby.reproducidos(
          ue.Id,
          bibliotecaId,
          'IsResumable'
        )) {
          anotar(ue.Id, userId, item, false);
        }
      }
    }

    for (const [clave, fila] of vistos) {
      if (fila.temporada === BibliotecaVisto.PELICULA) continue;
      const vistosTemporada = episodiosVistos.get(clave)?.size ?? 0;
      const total =
        temporadas.get(claveTemporada(fila.embyId, fila.temporada))?.episodios
          .size ?? 0;
      fila.episodiosVistos = vistosTemporada;
      fila.visto = total > 0 && vistosTemporada >= total;
    }

    const aJson = (
      porCuenta: Map<
        string,
        { ultima: Date | null; completa: boolean }
      > = new Map()
    ): string => {
      const r: Actividad = {};
      for (const [cuenta, a] of porCuenta) {
        r[cuenta] = {
          ultima: a.ultima ? a.ultima.toISOString() : null,
          completa: a.completa,
        };
      }
      return JSON.stringify(r);
    };
    for (const e of elementos.values()) {
      if (e.tipo === 'movie') e.actividad = aJson(actividad.get(e.embyId));
    }

    const filasTemporada: BibliotecaTemporada[] = [];
    for (const t of temporadas.values()) {
      const serie = elementos.get(t.serie);
      if (!serie) continue;
      const porCuenta = actividad.get(claveTemporada(t.serie, t.numero));
      for (const a of porCuenta?.values() ?? []) {
        a.completa = t.episodios.size > 0 && a.eps.size >= t.episodios.size;
      }
      filasTemporada.push(
        new BibliotecaTemporada({
          embyId: t.serie,
          numero: t.numero,
          episodios: t.episodios.size,
          tamano: tamanoSerie(serie)?.temporadas.get(t.numero) ?? 0,
          fechaDescarga: t.fecha,
          actividad: aJson(porCuenta),
        })
      );
    }

    // --- Escritura: las tablas de la foto se rehacen enteras ---------------
    await dataSource.transaction(async (manager) => {
      await manager.clear(BibliotecaVisto);
      await manager.clear(BibliotecaTemporada);
      await manager.clear(BibliotecaElemento);
      await manager.save([...elementos.values()], { chunk: 200 });
      await manager.save(filasTemporada, { chunk: 200 });
      await manager.save([...vistos.values()], { chunk: 200 });
      await manager.save(usuariosNuevos, { chunk: 200 });
      for (const u of datosEmby) {
        await manager.update(
          BibliotecaUsuario,
          { userId: u.userId },
          { embyUserId: u.embyUserId, ultimaActividad: u.ultimaActividad }
        );
      }
    });

    await this.guardarProgreso(elementos, puntos, vistosPorTemporada);

    return elementos.size;
  }

  // El progreso de cada usuario en cada serie solo avanza: si se borran las
  // temporadas que vio, se recuerda hasta donde llego
  private async guardarProgreso(
    elementos: Map<string, BibliotecaElemento>,
    puntos: Map<string, Punto>,
    vistosPorTemporada: Map<string, Set<number>>
  ): Promise<void> {
    const repo = getRepository(BibliotecaProgreso);
    const existentes = new Map(
      (await repo.find()).map((p) => [`${p.userId}|${p.tmdbId}`, p])
    );
    const cambios = new Map<string, BibliotecaProgreso>();
    for (const [clave, punto] of puntos) {
      const [userId, embyId] = clave.split('|');
      const serie = elementos.get(embyId);
      if (!serie?.tmdbId) continue;
      const k = `${userId}|${serie.tmdbId}`;
      const vistos =
        vistosPorTemporada.get(`${clave}|${punto.temporada}`)?.size ?? 0;
      // Una serie puede estar en dos bibliotecas: gana la mas avanzada
      const fila =
        cambios.get(k) ??
        existentes.get(k) ??
        new BibliotecaProgreso({
          userId: Number(userId),
          tmdbId: serie.tmdbId,
          temporada: 0,
          episodio: 0,
          vistosTemporada: 0,
          fechaPunto: null,
          silenciada: false,
        });
      fila.tvdbId = serie.tvdbId;
      fila.titulo = serie.titulo;
      const comparado = masAvanzado(punto, {
        temporada: fila.temporada,
        episodio: fila.episodio,
        fecha: null,
      });
      if (comparado > 0) {
        fila.temporada = punto.temporada;
        fila.episodio = punto.episodio;
        fila.fechaPunto = punto.fecha;
        fila.vistosTemporada = vistos;
      } else if (comparado === 0) {
        fila.fechaPunto = masReciente(
          fila.fechaPunto ? new Date(fila.fechaPunto) : null,
          punto.fecha
        );
        fila.vistosTemporada = Math.max(fila.vistosTemporada, vistos);
      } else if (punto.temporada === fila.temporada) {
        fila.vistosTemporada = Math.max(fila.vistosTemporada, vistos);
      }
      cambios.set(k, fila);
    }
    await repo.save([...cambios.values()], { chunk: 200 });
  }
}

export const sincronizadorBiblioteca = new SincronizadorBiblioteca();
