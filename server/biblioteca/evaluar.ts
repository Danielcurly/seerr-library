import type { Plazos } from '@server/biblioteca/ajustes';
import {
  guardarAjuste,
  leerAjuste,
  soloAvisar,
} from '@server/biblioteca/ajustes';
import type { MotivoCandidata } from '@server/biblioteca/entity/BibliotecaCandidata';
import { BibliotecaCandidata } from '@server/biblioteca/entity/BibliotecaCandidata';
import type { Actividad } from '@server/biblioteca/entity/BibliotecaElemento';
import { BibliotecaElemento } from '@server/biblioteca/entity/BibliotecaElemento';
import { BibliotecaHistorial } from '@server/biblioteca/entity/BibliotecaHistorial';
import type { TipoMarca } from '@server/biblioteca/entity/BibliotecaMarca';
import { BibliotecaMarca } from '@server/biblioteca/entity/BibliotecaMarca';
import { BibliotecaTemporada } from '@server/biblioteca/entity/BibliotecaTemporada';
import { BibliotecaUsuario } from '@server/biblioteca/entity/BibliotecaUsuario';
import { BibliotecaVisto } from '@server/biblioteca/entity/BibliotecaVisto';
import { getRepository } from '@server/datasource';
import logger from '@server/logger';

// Reglas de la lista de candidatas. Se evalua cada dia y tras cada voto; es
// idempotente: el resultado depende solo del estado de las tablas.

const LABEL = 'Biblioteca';
const DIA = 24 * 60 * 60 * 1000;

const sumarMeses = (d: Date, meses: number): Date => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + meses);
  return r;
};

export const claveUnidad = (embyId: string, temporada: number) =>
  `${embyId}|${temporada}`;

// Pelicula (temporada -1) o temporada de serie (sin especiales)
export interface Unidad {
  elemento: BibliotecaElemento;
  temporada: number;
  tamano: number;
  fechaDescarga: Date;
}

// Lo que necesitan la evaluacion y las vistas de la API
export interface Contexto {
  plazos: Plazos;
  ahora: Date;
  elementos: Map<string, BibliotecaElemento>;
  unidades: Map<string, Unidad>;
  // Temporadas (>= 1) descargadas de cada serie
  temporadasDe: Map<string, number[]>;
  usuarios: Map<number, BibliotecaUsuario>;
  // Usuarios con voto y activos
  votantes: number[];
  // unidad -> userId -> marca
  marcas: Map<string, Map<number, TipoMarca>>;
  // unidad -> usuarios que la han visto
  vistos: Map<string, Set<number>>;
  // unidad -> userId -> ultima vez que la reprodujo
  reproducido: Map<string, Map<number, Date>>;
  candidatas: Map<string, BibliotecaCandidata>;
  // unidad -> lo reproducido por cada cuenta de Emby (tambien las que no estan
  // en Seerr)
  actividad: Map<string, ActividadCuenta[]>;
}

export interface ActividadCuenta {
  ultima: Date | null;
  completa: boolean;
}

const leerActividad = (json: string): ActividadCuenta[] =>
  Object.values(JSON.parse(json || '{}') as Actividad).map((a) => ({
    ultima: a.ultima ? new Date(a.ultima) : null,
    completa: a.completa,
  }));

export const cargarContexto = async (): Promise<Contexto> => {
  const ahora = new Date();
  const plazos = await leerAjuste('plazos');
  const incluidas = await leerAjuste('bibliotecas');

  const elementos = new Map(
    (await getRepository(BibliotecaElemento).find())
      .filter((e) => incluidas.includes(e.bibliotecaId))
      .map((e) => [e.embyId, e])
  );

  const unidades = new Map<string, Unidad>();
  const temporadasDe = new Map<string, number[]>();
  const actividad = new Map<string, ActividadCuenta[]>();
  for (const e of elementos.values()) {
    if (e.tipo === 'movie') {
      actividad.set(claveUnidad(e.embyId, -1), leerActividad(e.actividad));
      unidades.set(claveUnidad(e.embyId, -1), {
        elemento: e,
        temporada: -1,
        tamano: e.tamano,
        fechaDescarga: e.fechaDescarga,
      });
    }
  }
  const temporadas = await getRepository(BibliotecaTemporada).find();
  for (const t of temporadas) {
    const e = elementos.get(t.embyId);
    if (!e || t.numero < 1) continue;
    actividad.set(claveUnidad(e.embyId, t.numero), leerActividad(t.actividad));
    unidades.set(claveUnidad(e.embyId, t.numero), {
      elemento: e,
      temporada: t.numero,
      tamano: t.tamano,
      fechaDescarga: t.fechaDescarga,
    });
    temporadasDe.set(e.embyId, [
      ...(temporadasDe.get(e.embyId) ?? []),
      t.numero,
    ]);
  }
  for (const lista of temporadasDe.values()) lista.sort((a, b) => a - b);

  const usuarios = new Map(
    (await getRepository(BibliotecaUsuario).find()).map((u) => [u.userId, u])
  );
  const limiteActividad = ahora.getTime() - plazos.actividadDias * DIA;
  const votantes = [...usuarios.values()]
    .filter(
      (u) =>
        u.tieneVoto &&
        u.ultimaActividad &&
        new Date(u.ultimaActividad).getTime() >= limiteActividad
    )
    .map((u) => u.userId);

  const marcas = new Map<string, Map<number, TipoMarca>>();
  for (const m of await getRepository(BibliotecaMarca).find()) {
    const k = claveUnidad(m.embyId, m.temporada);
    const porUsuario = marcas.get(k) ?? new Map<number, TipoMarca>();
    porUsuario.set(m.userId, m.tipo);
    marcas.set(k, porUsuario);
  }

  const vistos = new Map<string, Set<number>>();
  const reproducido = new Map<string, Map<number, Date>>();
  for (const v of await getRepository(BibliotecaVisto).find()) {
    if (v.ultimaReproduccion) {
      const k = claveUnidad(v.embyId, v.temporada);
      const porUsuario = reproducido.get(k) ?? new Map<number, Date>();
      porUsuario.set(v.userId, new Date(v.ultimaReproduccion));
      reproducido.set(k, porUsuario);
    }
    if (v.visto) {
      const k = claveUnidad(v.embyId, v.temporada);
      vistos.set(k, (vistos.get(k) ?? new Set()).add(v.userId));
    }
  }

  const candidatas = new Map(
    (await getRepository(BibliotecaCandidata).find()).map((c) => [
      claveUnidad(c.embyId, c.temporada),
      c,
    ])
  );

  return {
    plazos,
    ahora,
    elementos,
    unidades,
    temporadasDe,
    usuarios,
    votantes,
    marcas,
    vistos,
    reproducido,
    candidatas,
    actividad,
  };
};

// Algun "Guardar" o "Quiero verla" vigente la protege
export const protegida = (ctx: Contexto, clave: string): boolean => {
  for (const tipo of ctx.marcas.get(clave)?.values() ?? []) {
    if (tipo === 'guardar' || tipo === 'quiero_ver') return true;
  }
  return false;
};

// Por que entraria hoy en la lista (null si no entra)
export const motivoHoy = (
  ctx: Contexto,
  clave: string,
  u: Unidad
): { motivo: MotivoCandidata; pedidoPor: number[] } | null => {
  const marcas = ctx.marcas.get(clave) ?? new Map<number, TipoMarca>();

  // A: alguien con voto pidio borrarla
  const pedidoPor = [...marcas.entries()]
    .filter(
      ([userId, tipo]) =>
        tipo === 'borrar' && ctx.usuarios.get(userId)?.tieneVoto
    )
    .map(([userId]) => userId);
  if (pedidoPor.length) {
    return { motivo: 'A', pedidoPor };
  }

  // B: varios con voto dicen "No me interesa"
  const votosB = [...marcas.entries()]
    .filter(
      ([userId, tipo]) =>
        tipo === 'no_interesa' && ctx.usuarios.get(userId)?.tieneVoto
    )
    .map(([userId]) => userId);
  if (votosB.length >= ctx.plazos.votosB) {
    return { motivo: 'B', pedidoPor: votosB };
  }

  // C: lleva meses sin verse, desde la ultima reproduccion o, si nadie la ha
  // visto, desde que se descargo. En series cuenta cualquier episodio. Las
  // peliculas con la etiqueta de Radarr de los ajustes, con su propio plazo.
  const limite = sumarMeses(
    ctx.ahora,
    -(u.elemento.conEtiqueta
      ? ctx.plazos.antiguedadEtiquetaMeses
      : ctx.plazos.antiguedadMeses)
  );
  const ultima = u.elemento.ultimaReproduccion;
  const sinVerseDesde =
    ultima && new Date(ultima) > new Date(u.fechaDescarga)
      ? new Date(ultima)
      : new Date(u.fechaDescarga);
  if (sinVerseDesde < limite) {
    return { motivo: 'C', pedidoPor: [] };
  }

  return null;
};

export interface ResumenEvaluacion {
  enLista: number;
  nuevas: number;
  salvadas: number;
  vencidas: number;
  // Cumplen C pero esperan su turno por el cupo semanal
  esperandoC: number;
  // Alguien las esta viendo: cuenta atras parada
  pausadas: number;
}

class Evaluador {
  private cola: Promise<unknown> = Promise.resolve();

  // Las evaluaciones se encadenan: nunca dos a la vez
  public run(): Promise<ResumenEvaluacion> {
    const r = this.cola.then(() => this.evaluar());
    this.cola = r.catch(() => undefined);
    return r;
  }

  private async evaluar(): Promise<ResumenEvaluacion> {
    try {
      const resumen = await this.evaluarSinRegistro();
      await guardarAjuste('evaluacion', { ultima: new Date().toISOString() });
      return resumen;
    } catch (e) {
      logger.error(`Evaluacion fallida: ${e.message}`, { label: LABEL });
      await guardarAjuste('evaluacion', {
        ...(await leerAjuste('evaluacion')),
        error: `${new Date().toISOString()}: ${e.message}`,
      });
      throw e;
    }
  }

  private async evaluarSinRegistro(): Promise<ResumenEvaluacion> {
    const repoMarca = getRepository(BibliotecaMarca);
    const repoCandidata = getRepository(BibliotecaCandidata);
    const repoHistorial = getRepository(BibliotecaHistorial);
    let ctx = await cargarContexto();

    // 1. "Quiero verla" cumplidos (la vio despues de marcarla) o caducados
    const caducaQuiero = sumarMeses(ctx.ahora, -ctx.plazos.quieroVerMeses);
    const quieros = await repoMarca.find({ where: { tipo: 'quiero_ver' } });
    const cumplidos = quieros.filter((m) => {
      const clave = claveUnidad(m.embyId, m.temporada);
      const ultima = ctx.reproducido.get(clave)?.get(m.userId);
      const vista =
        !!ctx.vistos.get(clave)?.has(m.userId) &&
        !!ultima &&
        ultima > new Date(m.createdAt);
      return vista || new Date(m.createdAt) < caducaQuiero;
    });
    if (cumplidos.length) {
      await repoMarca.remove(cumplidos);
      ctx = await cargarContexto();
    }

    const resumen: ResumenEvaluacion = {
      enLista: 0,
      nuevas: 0,
      salvadas: 0,
      vencidas: 0,
      esperandoC: 0,
      pausadas: 0,
    };
    const prueba = await soloAvisar();
    const limiteAbandono = sumarMeses(ctx.ahora, -ctx.plazos.antiguedadMeses);

    // 2. Candidatas existentes
    for (const [clave, c] of ctx.candidatas) {
      const u = ctx.unidades.get(clave);
      // Ya no esta (borrada de verdad o biblioteca excluida)
      if (!u) {
        await repoCandidata.remove(c);
        ctx.candidatas.delete(clave);
        continue;
      }
      const salvar = async () => {
        await repoCandidata.remove(c);
        ctx.candidatas.delete(clave);
        resumen.salvadas++;
      };
      // Hasta que se ejecute el borrado aun se puede salvar
      if (protegida(ctx, clave)) {
        await salvar();
        continue;
      }
      // Entro por votos que ya no se mantienen. Si solo le queda la antiguedad
      // (C), sale y vuelve por la cola semanal de C. Quien la pidio o voto
      // puede cambiar (A <-> B): conserva su plazo. Vencida, ya no cambia.
      const porVotos = c.motivo === 'A' || c.motivo === 'B';
      if (porVotos && c.estado === 'lista') {
        const hoy = motivoHoy(ctx, clave, u);
        if (!hoy || hoy.motivo === 'C') {
          await salvar();
          continue;
        }
        c.motivo = hoy.motivo;
        c.pedidoPor = JSON.stringify(hoy.pedidoPor);
      }

      // Lo reproducido despues de entrar en la lista (cualquier cuenta de Emby)
      const despues = (ctx.actividad.get(clave) ?? []).filter(
        (a) => a.ultima && a.ultima > new Date(c.entrada)
      );
      // Series: quien la empezo y no la ha terminado
      const viendo =
        u.temporada === -1 ? [] : despues.filter((a) => !a.completa);
      const viendoAhora = viendo.filter(
        (a) => (a.ultima as Date) >= limiteAbandono
      );
      if (viendoAhora.length) {
        // La cuenta atras se para hasta que la termine
        if (!c.pausadaDesde) c.pausadaDesde = ctx.ahora;
        c.estado = 'lista';
        resumen.pausadas++;
        await repoCandidata.save(c);
        continue;
      }
      // Por antiguedad: si alguien la ha visto entera, ya no lleva tiempo sin
      // verse
      if (c.motivo === 'C' && despues.some((a) => a.completa)) {
        await salvar();
        continue;
      }
      if (c.pausadaDesde) {
        if (viendo.length) {
          // La dejaron a medias hace meses: vuelve con el plazo completo
          c.entrada = ctx.ahora;
          c.vence = new Date(ctx.ahora.getTime() + ctx.plazos.listaDias * DIA);
        } else {
          // La terminaron: sigue donde iba
          c.vence = new Date(
            new Date(c.vence).getTime() +
              (ctx.ahora.getTime() - new Date(c.pausadaDesde).getTime())
          );
        }
        c.pausadaDesde = null;
      }

      if (c.estado === 'lista' && new Date(c.vence) <= ctx.ahora) {
        c.estado = 'listo';
        resumen.vencidas++;
        // Solo avisar: se anota aqui lo que se habria borrado; si no, se anota
        // al borrarla
        if (prueba) {
          await repoHistorial.save(
            new BibliotecaHistorial({
              tipo: 'borrado',
              embyId: u.elemento.embyId,
              temporada: u.temporada,
              titulo: u.elemento.titulo,
              tamano: u.tamano,
              motivo: c.motivo,
              simulacro: true,
            })
          );
        }
      }
      await repoCandidata.save(c);
    }

    // 3. Nuevas candidatas. A y B entran todas; C (antiguedad) con cupo
    // semanal, lo descargado antes primero, para no llenar la lista de golpe.
    const nuevaCandidata = async (
      clave: string,
      u: Unidad,
      hoy: { motivo: MotivoCandidata; pedidoPor: number[] }
    ) => {
      const c = await repoCandidata.save(
        new BibliotecaCandidata({
          embyId: u.elemento.embyId,
          temporada: u.temporada,
          motivo: hoy.motivo,
          pedidoPor: JSON.stringify(hoy.pedidoPor),
          estado: 'lista',
          entrada: ctx.ahora,
          vence: new Date(ctx.ahora.getTime() + ctx.plazos.listaDias * DIA),
        })
      );
      ctx.candidatas.set(clave, c);
      resumen.nuevas++;
    };
    const esperandoC: [string, Unidad][] = [];
    for (const [clave, u] of ctx.unidades) {
      if (ctx.candidatas.has(clave)) continue;
      if (!u.elemento.gestionado || protegida(ctx, clave)) continue;
      const hoy = motivoHoy(ctx, clave, u);
      if (!hoy) continue;
      if (hoy.motivo === 'C') {
        esperandoC.push([clave, u]);
      } else {
        await nuevaCandidata(clave, u, hoy);
      }
    }
    const haceUnaSemana = ctx.ahora.getTime() - 7 * DIA;
    const entradasC = (await leerAjuste('entradasC')).filter(
      (d) => new Date(d).getTime() > haceUnaSemana
    );
    const cupo = Math.max(ctx.plazos.cPorSemana - entradasC.length, 0);
    esperandoC.sort(
      (a, b) =>
        new Date(a[1].fechaDescarga).getTime() -
        new Date(b[1].fechaDescarga).getTime()
    );
    for (const [clave, u] of esperandoC.slice(0, cupo)) {
      await nuevaCandidata(clave, u, { motivo: 'C', pedidoPor: [] });
      entradasC.push(ctx.ahora.toISOString());
    }
    await guardarAjuste('entradasC', entradasC);
    resumen.esperandoC = Math.max(esperandoC.length - cupo, 0);
    resumen.enLista = [...ctx.candidatas.values()].filter(
      (c) => c.estado === 'lista'
    ).length;

    logger.info(
      `Evaluacion: ${resumen.enLista} en lista (${resumen.nuevas} nuevas, ${resumen.salvadas} salvadas, ${resumen.vencidas} vencidas, ${resumen.pausadas} en pausa, ${resumen.esperandoC} por antiguedad esperando turno)`,
      { label: LABEL }
    );
    return resumen;
  }
}

export const evaluadorBiblioteca = new Evaluador();
