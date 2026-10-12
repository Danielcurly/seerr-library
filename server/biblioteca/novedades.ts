import TheMovieDb from '@server/api/themoviedb';
import type { TmdbTvDetails } from '@server/api/themoviedb/interfaces';
import { guardarAjuste, leerAjuste } from '@server/biblioteca/ajustes';
import { BibliotecaNovedad } from '@server/biblioteca/entity/BibliotecaNovedad';
import { BibliotecaProgreso } from '@server/biblioteca/entity/BibliotecaProgreso';
import dataSource, { getRepository } from '@server/datasource';
import logger from '@server/logger';

// Novedades de las series que ve cada usuario: con su progreso (hasta donde
// llego, aunque ya se hayan borrado esas temporadas) y las fechas de emision
// de TMDB. Una serie avisa si el usuario llego al menos a la mitad de la
// temporada en la que se quedo, y solo de lo que se ha emitido despues:
// - en su temporada, los episodios emitidos despues de la ultima vez que la vio;
// - las temporadas siguientes, emitidas. Si hace mucho que no la ve, solo si
//   lo nuevo es reciente (no avisa de una serie que dejo hace años).
// Si esta al dia, avisa de lo proximo (episodio o temporada anunciada).

const LABEL = 'Biblioteca';

// Cada cuanto se recalcula (tras la sincronizacion de cada hora)
const CADA_HORAS = 6;
// "Reciente": lo emitido o visto en los ultimos meses
const RECIENTE_MESES = 12;

const sumarMeses = (d: Date, meses: number): Date => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + meses);
  return r;
};

interface Episodio {
  numero: number;
  fecha: Date | null;
}

const fecha = (s?: string | null): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const ultimaFecha = (eps: Episodio[]): Date | null =>
  eps.reduce<Date | null>(
    (m, e) => (e.fecha && (!m || e.fecha > m) ? e.fecha : m),
    null
  );

// Novedades de un usuario en una serie
export const novedadesDe = (
  p: BibliotecaProgreso,
  serie: TmdbTvDetails,
  episodios: Map<number, Episodio[]>,
  hoy: Date
): BibliotecaNovedad[] => {
  const emitido = (e: Episodio) => !!e.fecha && e.fecha <= hoy;
  const punto = p.fechaPunto ? new Date(p.fechaPunto) : null;
  const epsT = episodios.get(p.temporada) ?? [];

  // Vio al menos la mitad de lo que se habia emitido de su temporada (por el
  // episodio al que llego: Emby no marca como vistos todos los que se ven)
  const emitidosEntonces = epsT.filter(
    (e) => e.fecha && e.fecha <= (punto ?? hoy)
  ).length;
  if (Math.max(p.vistosTemporada, p.episodio) * 2 < emitidosEntonces) {
    return [];
  }

  const reciente = sumarMeses(hoy, -RECIENTE_MESES);
  const enganchado = !!punto && punto >= reciente;
  const base = {
    userId: p.userId,
    tmdbId: p.tmdbId,
    tvdbId: p.tvdbId,
    titulo: serie.name || p.titulo,
  };
  const proximo = serie.next_episode_to_air;
  const completa = (temporada: number, eps: Episodio[]) =>
    eps.every(emitido) && proximo?.season_number !== temporada;

  const r: BibliotecaNovedad[] = [];
  const nueva = (temporada: number, nuevos: Episodio[], eps: Episodio[]) => {
    const ultima = ultimaFecha(nuevos);
    if (!enganchado && (!ultima || ultima < reciente)) return;
    const numeros = nuevos.map((e) => e.numero);
    r.push(
      new BibliotecaNovedad({
        ...base,
        tipo: 'nueva',
        temporada,
        desde: Math.min(...numeros),
        hasta: Math.max(...numeros),
        emitidos: eps.filter(emitido).length,
        fecha: ultima,
        completa: completa(temporada, eps),
      })
    );
  };

  // Su temporada: lo emitido despues de la ultima vez que la vio
  let alDia = true;
  const pendientesT = epsT.filter((e) => e.numero > p.episodio && emitido(e));
  if (pendientesT.length) alDia = false;
  if (punto) {
    const nuevos = pendientesT.filter((e) => (e.fecha as Date) > punto);
    if (nuevos.length) nueva(p.temporada, nuevos, epsT);
  }
  // Temporadas siguientes ya emitidas (todas o en parte)
  for (const [temporada, eps] of [...episodios.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    if (temporada <= p.temporada) continue;
    const emitidos = eps.filter(emitido);
    if (!emitidos.length) continue;
    alDia = false;
    nueva(temporada, emitidos, eps);
  }

  // Al dia (o la sigue hace poco) y sin nada nuevo: lo proximo que se emite
  if (!r.length && (alDia || enganchado)) {
    const fechaProximo = fecha(proximo?.air_date);
    if (
      proximo &&
      fechaProximo &&
      fechaProximo > hoy &&
      (proximo.season_number > p.temporada ||
        (proximo.season_number === p.temporada &&
          proximo.episode_number > p.episodio))
    ) {
      r.push(
        new BibliotecaNovedad({
          ...base,
          tipo: 'proxima',
          temporada: proximo.season_number,
          desde: proximo.episode_number,
          hasta: proximo.episode_number,
          emitidos: 0,
          fecha: fechaProximo,
          completa: false,
        })
      );
    } else {
      // Temporada anunciada con fecha, sin episodios todavia
      const anunciada = serie.seasons
        .filter((s) => {
          const estreno = fecha(s.air_date);
          return s.season_number > p.temporada && !!estreno && estreno > hoy;
        })
        .sort((a, b) => a.season_number - b.season_number)[0];
      if (anunciada) {
        r.push(
          new BibliotecaNovedad({
            ...base,
            tipo: 'proxima',
            temporada: anunciada.season_number,
            desde: 1,
            hasta: 1,
            emitidos: 0,
            fecha: fecha(anunciada.air_date),
            completa: false,
          })
        );
      }
    }
  }
  return r;
};

class CalculadorNovedades {
  private ejecutando = false;

  public get running(): boolean {
    return this.ejecutando;
  }

  // Solo si hace mas de unas horas de la ultima vez (o si se fuerza)
  public async siToca(): Promise<void> {
    const ultima = (await leerAjuste('novedades')).ultima;
    if (
      ultima &&
      Date.now() - new Date(ultima).getTime() < CADA_HORAS * 3600 * 1000
    ) {
      return;
    }
    await this.run();
  }

  public async run(): Promise<void> {
    if (this.ejecutando) return;
    this.ejecutando = true;
    const inicio = Date.now();
    try {
      const { series, novedades } = await this.calcular();
      await guardarAjuste('novedades', {
        ultima: new Date().toISOString(),
        duracionMs: Date.now() - inicio,
        series,
        novedades,
      });
      logger.info(
        `Novedades: ${novedades} en ${series} series (${Date.now() - inicio} ms)`,
        { label: LABEL }
      );
    } catch (e) {
      logger.error(`Novedades fallidas: ${e.message}`, { label: LABEL });
      await guardarAjuste('novedades', {
        ...(await leerAjuste('novedades')),
        error: `${new Date().toISOString()}: ${e.message}`,
      });
    } finally {
      this.ejecutando = false;
    }
  }

  private async calcular(): Promise<{ series: number; novedades: number }> {
    const progresos = (
      await getRepository(BibliotecaProgreso).find({
        where: { silenciada: false },
      })
    ).filter((p) => p.temporada >= 1);
    const porSerie = new Map<number, BibliotecaProgreso[]>();
    for (const p of progresos) {
      porSerie.set(p.tmdbId, [...(porSerie.get(p.tmdbId) ?? []), p]);
    }

    const tmdb = new TheMovieDb();
    const hoy = new Date();
    const filas: BibliotecaNovedad[] = [];
    for (const [tmdbId, lista] of porSerie) {
      let serie: TmdbTvDetails;
      try {
        serie = await tmdb.getTvShow({ tvId: tmdbId });
      } catch (e) {
        logger.warn(`Novedades: serie ${tmdbId} no disponible en TMDB`, {
          label: LABEL,
          error: e.message,
        });
        continue;
      }
      // Episodios (con fecha) desde la temporada menos avanzada de sus
      // usuarios; las que aun no se emiten no hace falta pedirlas
      const desde = Math.min(...lista.map((p) => p.temporada));
      const episodios = new Map<number, Episodio[]>();
      for (const t of serie.seasons ?? []) {
        if (t.season_number < Math.max(desde, 1)) continue;
        const estreno = fecha(t.air_date);
        if (!estreno || estreno > hoy) {
          episodios.set(t.season_number, []);
          continue;
        }
        try {
          const detalle = await tmdb.getTvSeason({
            tvId: tmdbId,
            seasonNumber: t.season_number,
          });
          episodios.set(
            t.season_number,
            detalle.episodes.map((e) => ({
              numero: e.episode_number,
              fecha: fecha(e.air_date),
            }))
          );
        } catch {
          episodios.set(t.season_number, []);
        }
      }
      for (const p of lista) {
        filas.push(...novedadesDe(p, serie, episodios, hoy));
      }
    }

    await dataSource.transaction(async (manager) => {
      await manager.clear(BibliotecaNovedad);
      await manager.save(filas, { chunk: 200 });
    });
    return { series: porSerie.size, novedades: filas.length };
  }
}

export const calculadorNovedades = new CalculadorNovedades();
