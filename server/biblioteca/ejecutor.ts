import type { ModoEjecucion } from '@server/biblioteca/ajustes';
import { modoEjecucion } from '@server/biblioteca/ajustes';
import { BibliotecaCandidata } from '@server/biblioteca/entity/BibliotecaCandidata';
import type { TipoHistorial } from '@server/biblioteca/entity/BibliotecaHistorial';
import { BibliotecaHistorial } from '@server/biblioteca/entity/BibliotecaHistorial';
import { BibliotecaMarca } from '@server/biblioteca/entity/BibliotecaMarca';
import {
  cargarContexto,
  claveUnidad,
  evaluadorBiblioteca,
} from '@server/biblioteca/evaluar';
import { getRepository } from '@server/datasource';
import { getSettings } from '@server/lib/settings';
import { Router } from 'express';

// API para un programa externo que ejecute los borrados (modo externo), en
// /api/biblioteca/ejecutor. Solo con la API key de Seerr (cabecera X-Api-Key).
// En los otros modos se puede consultar, pero no confirmar borrados. El
// borrador interno (modo arr) usa las mismas funciones.
const ejecutorRoutes = Router();

ejecutorRoutes.use((req, res, next) => {
  if (req.header('X-API-Key') !== getSettings().main.apiKey) {
    return res.status(403).json({ error: 'Requires the Seerr API key' });
  }
  next();
});

// Lo que vencio y espera a que se borre (sin las que alguien esta viendo)
export const elementosParaBorrar = async () => {
  await evaluadorBiblioteca.run();
  const ctx = await cargarContexto();

  const elementos = [...ctx.candidatas.values()]
    .filter((c) => c.estado === 'listo' && !c.pausadaDesde)
    .map((c) => {
      const u = ctx.unidades.get(claveUnidad(c.embyId, c.temporada));
      if (!u) return null;
      const e = u.elemento;
      return {
        id: c.id,
        embyId: e.embyId,
        tipo: e.tipo,
        titulo: e.titulo,
        // -1: pelicula; si no, temporada de la serie
        temporada: c.temporada,
        // Es la temporada mas reciente que hay en el disco: al borrarla, se
        // deja de seguir la serie en Sonarr (si alguien quiere las nuevas, las
        // pedira desde Novedades)
        ultimaTemporada:
          e.tipo === 'tv' &&
          c.temporada === Math.max(...(ctx.temporadasDe.get(e.embyId) ?? [])),
        motivo: c.motivo,
        vence: c.vence,
        tamano: u.tamano,
        tmdbId: e.tmdbId,
        tvdbId: e.tvdbId,
        radarrId: e.tipo === 'movie' ? e.arrId : null,
        sonarrId: e.tipo === 'tv' ? e.arrId : null,
        // id del servidor de Radarr/Sonarr en los ajustes de Seerr
        arrServidor: e.arrServidor,
        ruta: e.ruta,
        ejecucion: c.ejecucion,
        esperaHasta: c.esperaHasta,
        nota: c.nota,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  return elementos;
};

export type ElementoBorrar = Awaited<
  ReturnType<typeof elementosParaBorrar>
>[number];

ejecutorRoutes.get('/borrar', async (_req, res) => {
  const modo = await modoEjecucion();
  const elementos = await elementosParaBorrar();
  return res.status(200).json({
    modo,
    // Compatibilidad: quien solo mira modoPrueba no borra fuera del modo
    // externo
    modoPrueba: modo !== 'externo',
    elementos,
  });
});

export interface CuerpoResultado {
  id?: number;
  resultado?: 'borrado' | 'espera' | 'error';
  // espera: hasta cuando hay que seguir compartiendo (ISO)
  hasta?: string;
  mensaje?: string;
}

interface Respuesta {
  status: number;
  error?: string;
}

// Anota lo que paso al intentar borrar una candidata. origen: el modo de quien
// borra; un borrado solo se acepta si es el modo activo.
export const anotarResultado = async (
  cuerpo: CuerpoResultado,
  origen: ModoEjecucion
): Promise<Respuesta> => {
  const repo = getRepository(BibliotecaCandidata);
  const c = await repo.findOne({ where: { id: Number(cuerpo.id) || 0 } });
  if (!c) return { status: 404, error: 'Not pending removal' };
  if (c.estado !== 'listo' || c.pausadaDesde) {
    return {
      status: 409,
      error: 'No longer ready for removal (kept or being watched)',
    };
  }
  const ctx = await cargarContexto();
  const u = ctx.unidades.get(claveUnidad(c.embyId, c.temporada));
  const mensaje =
    typeof cuerpo.mensaje === 'string' ? cuerpo.mensaje.slice(0, 2000) : null;

  const anotar = (tipo: TipoHistorial, simulacro = false) =>
    getRepository(BibliotecaHistorial).save(
      new BibliotecaHistorial({
        tipo,
        embyId: c.embyId,
        temporada: c.temporada,
        titulo: u?.elemento.titulo ?? c.embyId,
        tamano: u?.tamano ?? 0,
        motivo: c.motivo,
        nota: mensaje,
        simulacro,
      })
    );

  switch (cuerpo.resultado) {
    case 'borrado': {
      const modo = await modoEjecucion();
      if (modo !== origen) {
        return {
          status: 409,
          error: `Mode ${modo}: removals are not expected from this executor`,
        };
      }
      await anotar('borrado');
      await repo.remove(c);
      // Sus votos ya no sirven (si se vuelve a descargar, empieza de cero)
      await getRepository(BibliotecaMarca).delete({
        embyId: c.embyId,
        temporada: c.temporada,
      });
      return { status: 204 };
    }
    case 'espera': {
      const hasta = cuerpo.hasta ? new Date(cuerpo.hasta) : null;
      if (!hasta || isNaN(hasta.getTime())) {
        return { status: 400, error: 'hasta is not valid' };
      }
      const cambio =
        c.ejecucion !== 'espera' ||
        !c.esperaHasta ||
        new Date(c.esperaHasta).getTime() !== hasta.getTime();
      c.ejecucion = 'espera';
      c.esperaHasta = hasta;
      c.nota = mensaje;
      await repo.save(c);
      if (cambio) await anotar('espera');
      return { status: 204 };
    }
    case 'error': {
      const cambio = c.ejecucion !== 'error' || c.nota !== mensaje;
      c.ejecucion = 'error';
      c.esperaHasta = null;
      c.nota = mensaje;
      await repo.save(c);
      if (cambio) await anotar('error');
      return { status: 204 };
    }
    default:
      return { status: 400, error: 'resultado is not valid' };
  }
};

ejecutorRoutes.post('/resultado', async (req, res) => {
  const r = await anotarResultado(req.body as CuerpoResultado, 'externo');
  return r.error
    ? res.status(r.status).json({ error: r.error })
    : res.status(r.status).send();
});

export default ejecutorRoutes;
