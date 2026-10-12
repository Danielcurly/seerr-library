import type {
  Ejecucion,
  ModoEjecucion,
  Plazos,
  PoliticaTorrents,
} from '@server/biblioteca/ajustes';
import {
  guardarAjuste,
  leerAjuste,
  soloAvisar,
} from '@server/biblioteca/ajustes';
import { borradorBiblioteca } from '@server/biblioteca/borrador';
import ejecutorRoutes from '@server/biblioteca/ejecutor';
import EmbyBiblioteca from '@server/biblioteca/emby';
import type {
  BibliotecaCandidata,
  EstadoCandidata,
  MotivoCandidata,
} from '@server/biblioteca/entity/BibliotecaCandidata';
import { BibliotecaCandidata as Candidata } from '@server/biblioteca/entity/BibliotecaCandidata';
import { BibliotecaElemento } from '@server/biblioteca/entity/BibliotecaElemento';
import type { TipoHistorial } from '@server/biblioteca/entity/BibliotecaHistorial';
import { BibliotecaHistorial } from '@server/biblioteca/entity/BibliotecaHistorial';
import type { TipoMarca } from '@server/biblioteca/entity/BibliotecaMarca';
import {
  BibliotecaMarca,
  TIPOS_MARCA,
} from '@server/biblioteca/entity/BibliotecaMarca';
import { BibliotecaNovedad } from '@server/biblioteca/entity/BibliotecaNovedad';
import { BibliotecaProgreso } from '@server/biblioteca/entity/BibliotecaProgreso';
import { BibliotecaTemporada } from '@server/biblioteca/entity/BibliotecaTemporada';
import { BibliotecaUsuario } from '@server/biblioteca/entity/BibliotecaUsuario';
import { BibliotecaVisto } from '@server/biblioteca/entity/BibliotecaVisto';
import type { Contexto } from '@server/biblioteca/evaluar';
import {
  cargarContexto,
  claveUnidad,
  evaluadorBiblioteca,
} from '@server/biblioteca/evaluar';
import { calculadorNovedades } from '@server/biblioteca/novedades';
import { QBittorrent } from '@server/biblioteca/qbittorrent';
import { sincronizadorBiblioteca } from '@server/biblioteca/sync';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { checkUser, isAuthenticated } from '@server/middleware/auth';
import { getAppVersion } from '@server/utils/appVersion';
import { getHostname } from '@server/utils/getHostname';
import type { Request } from 'express';
import { Router } from 'express';
import { In, IsNull, Not } from 'typeorm';

// API del modulo Biblioteca, montada en /api/biblioteca antes del validador
// OpenAPI de Seerr (que solo conoce /api/v1).
const bibliotecaRoutes = Router();

bibliotecaRoutes.use(checkUser);
bibliotecaRoutes.use(isAuthenticated());

// Ejecutor externo (solo con la API key)
bibliotecaRoutes.use('/ejecutor', ejecutorRoutes);

const DIA = 24 * 60 * 60 * 1000;

type MiEstado = 'visto' | 'empezado' | 'no';

interface CandidataVista {
  temporada: number;
  motivo: MotivoCandidata;
  pedidoPor: string[];
  estado: EstadoCandidata;
  entrada: Date;
  vence: Date;
  tamano: number;
  // Alguien la esta viendo: cuenta atras parada
  pausada: boolean;
  // El ejecutor espera hasta esta fecha (p. ej. tiempo minimo de siembra)
  esperaHasta: Date | null;
}

interface ElementoVista {
  embyId: string;
  tipo: 'movie' | 'tv';
  tmdbId: number | null;
  tvdbId: number | null;
  mediaId: number | null;
  bibliotecaId: string;
  titulo: string;
  anio: number | null;
  fechaEstreno: Date | null;
  generos: string[];
  fechaDescarga: Date;
  tamano: number;
  ultimaReproduccion: Date | null;
  miEstado: MiEstado;
  // Series: temporadas descargadas (sin especiales) y las que he visto
  temporadas?: { total: number; vistas: number };
  // Temporadas descargadas (series) para elegir a cuales aplicar una marca
  numerosTemporada: number[];
  temporadasVistas: number[];
  // Mis marcas: pelicula = temporada -1
  misMarcas: { temporada: number; tipo: TipoMarca }[];
  // Alguien la ha guardado (alguna temporada, en series)
  guardada: boolean;
  // En la lista (en series, las temporadas que lo estan)
  candidatas: CandidataVista[];
  gestionado: boolean;
  // Pelicula con la etiqueta de Radarr de los ajustes
  conEtiqueta: boolean;
}

// Usuario del modulo: voto y permiso de guardar (el admin siempre puede)
const miUsuario = async (
  req: Request
): Promise<{ tieneVoto: boolean; puedeGuardar: boolean; admin: boolean }> => {
  const admin = req.user?.hasPermission(Permission.ADMIN) ?? false;
  const fila = req.user
    ? await getRepository(BibliotecaUsuario).findOne({
        where: { userId: req.user.id },
      })
    : null;
  return {
    admin,
    tieneVoto: !!fila?.tieneVoto,
    puedeGuardar: admin || (!!fila?.tieneVoto && !!fila?.puedeGuardar),
  };
};

const nombresUsuarios = async (): Promise<Map<number, string>> =>
  new Map((await getRepository(User).find()).map((u) => [u.id, u.displayName]));

const candidataVista = (
  c: BibliotecaCandidata,
  ctx: Contexto,
  nombres: Map<number, string>
): CandidataVista => ({
  temporada: c.temporada,
  motivo: c.motivo,
  pedidoPor: (JSON.parse(c.pedidoPor) as number[]).map(
    (id) => nombres.get(id) ?? `#${id}`
  ),
  estado: c.estado,
  entrada: c.entrada,
  vence: c.vence,
  tamano: ctx.unidades.get(claveUnidad(c.embyId, c.temporada))?.tamano ?? 0,
  pausada: !!c.pausadaDesde,
  esperaHasta: c.ejecucion === 'espera' ? c.esperaHasta : null,
});

// Estado de visto, marcas y lista de un usuario para un conjunto de elementos
const vistaDeElementos = async (
  elementos: BibliotecaElemento[],
  userId: number,
  ctx: Contexto,
  nombres: Map<number, string>
): Promise<ElementoVista[]> => {
  const ids = elementos.map((e) => e.embyId);
  const vistos = ids.length
    ? await getRepository(BibliotecaVisto).find({
        where: { userId, embyId: In(ids) },
      })
    : [];
  const misVistos = new Map<string, BibliotecaVisto[]>();
  for (const v of vistos) {
    misVistos.set(v.embyId, [...(misVistos.get(v.embyId) ?? []), v]);
  }

  return elementos.map((e) => {
    const mios = misVistos.get(e.embyId) ?? [];
    let miEstado: MiEstado = mios.length ? 'empezado' : 'no';
    let resumenTemporadas: ElementoVista['temporadas'];
    const numeros =
      e.tipo === 'movie' ? [-1] : (ctx.temporadasDe.get(e.embyId) ?? []);
    const temporadasVistas = mios
      .filter((v) => v.visto && v.temporada > 0)
      .map((v) => v.temporada);

    if (e.tipo === 'movie') {
      if (mios.some((v) => v.visto)) miEstado = 'visto';
    } else {
      const total = numeros.length;
      const vistas = temporadasVistas.filter((t) => numeros.includes(t)).length;
      resumenTemporadas = { total, vistas };
      if (total > 0 && vistas >= total) miEstado = 'visto';
    }

    const misMarcas: ElementoVista['misMarcas'] = [];
    let guardada = false;
    const candidatas: CandidataVista[] = [];
    for (const t of numeros) {
      const clave = claveUnidad(e.embyId, t);
      const marcas = ctx.marcas.get(clave);
      const mia = marcas?.get(userId);
      if (mia) misMarcas.push({ temporada: t, tipo: mia });
      if ([...(marcas?.values() ?? [])].includes('guardar')) guardada = true;
      const c = ctx.candidatas.get(clave);
      if (c) candidatas.push(candidataVista(c, ctx, nombres));
    }

    return {
      embyId: e.embyId,
      tipo: e.tipo,
      tmdbId: e.tmdbId,
      tvdbId: e.tvdbId,
      mediaId: e.mediaId,
      bibliotecaId: e.bibliotecaId,
      titulo: e.titulo,
      anio: e.anio,
      fechaEstreno: e.fechaEstreno,
      generos: JSON.parse(e.generos) as string[],
      fechaDescarga: e.fechaDescarga,
      tamano: e.tamano,
      ultimaReproduccion: e.ultimaReproduccion,
      miEstado,
      temporadas: resumenTemporadas,
      numerosTemporada: e.tipo === 'movie' ? [] : numeros,
      temporadasVistas,
      misMarcas,
      guardada,
      candidatas,
      gestionado: e.gestionado,
      conEtiqueta: e.conEtiqueta,
    };
  });
};

// Candidatas en cuenta atras en las que aun no he dicho nada (solo si voto).
// Las que entran por antiguedad (C) no cuentan: nadie las ha pedido ni visto.
const pendientesDe = (ctx: Contexto, userId: number): Set<string> => {
  const r = new Set<string>();
  if (!ctx.votantes.includes(userId)) return r;
  for (const c of ctx.candidatas.values()) {
    if (c.estado !== 'lista' || c.motivo === 'C') continue;
    const clave = claveUnidad(c.embyId, c.temporada);
    if (!ctx.unidades.has(clave)) continue;
    if (!ctx.marcas.get(clave)?.has(userId)) r.add(c.embyId);
  }
  return r;
};

const nombresBibliotecas = (): Map<string, string> =>
  new Map(getSettings().jellyfin.libraries.map((l) => [l.id, l.name]));

bibliotecaRoutes.get('/estado', async (req, res) => {
  const sync = await leerAjuste('sync');
  const yo = await miUsuario(req);
  const ctx = await cargarContexto();
  const fila = ctx.usuarios.get(req.user?.id ?? 0);

  return res.status(200).json({
    modulo: 'biblioteca',
    version: getAppVersion(),
    simulacro: await soloAvisar(),
    // El tutorial se abre solo la primera vez (usuarios con cuenta de Emby)
    tutorialPendiente: !!fila && !fila.tutorialVisto,
    usuario: {
      id: req.user?.id,
      nombre: req.user?.displayName,
      ...yo,
      activo: ctx.votantes.includes(req.user?.id ?? 0),
    },
    pendientes: pendientesDe(ctx, req.user?.id ?? 0).size,
    plazos: ctx.plazos,
    sync: { ...sync, enCurso: sincronizadorBiblioteca.running },
  });
});

// Bibliotecas y generos para los filtros de Explorar
bibliotecaRoutes.get('/filtros', async (_req, res) => {
  const incluidas = await leerAjuste('bibliotecas');
  const nombres = nombresBibliotecas();
  const elementos = await getRepository(BibliotecaElemento).find({
    select: ['generos', 'bibliotecaId'],
  });
  const generos = new Set<string>();
  for (const e of elementos) {
    if (!incluidas.includes(e.bibliotecaId)) continue;
    for (const g of JSON.parse(e.generos) as string[]) generos.add(g);
  }

  return res.status(200).json({
    bibliotecas: incluidas.map((id) => ({ id, nombre: nombres.get(id) ?? id })),
    generos: [...generos].sort(),
  });
});

const ORDENES = [
  'descarga',
  'anio',
  'titulo',
  'tamano',
  'reproduccion',
] as const;
type Orden = (typeof ORDENES)[number];

bibliotecaRoutes.get('/explorar', async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const orden: Orden = ORDENES.includes(q.orden as Orden)
    ? (q.orden as Orden)
    : 'descarga';
  // Titulo ascendente por defecto; el resto, lo mas reciente/grande primero
  const asc = q.dir ? q.dir === 'asc' : orden === 'titulo';
  const porPagina = Math.min(Math.max(Number(q.porPagina) || 30, 1), 100);
  const pagina = Math.max(Number(q.pagina) || 1, 1);

  const ctx = await cargarContexto();
  let elementos = [...ctx.elementos.values()];
  if (q.biblioteca) {
    elementos = elementos.filter((e) => e.bibliotecaId === q.biblioteca);
  }
  if (q.tipo === 'movie' || q.tipo === 'tv') {
    elementos = elementos.filter((e) => e.tipo === q.tipo);
  }
  if (q.genero) {
    // Varios nombres del mismo genero separados por | ("Action|Acción")
    const generos = q.genero.split('|');
    elementos = elementos.filter((e) =>
      (JSON.parse(e.generos) as string[]).some((g) => generos.includes(g))
    );
  }

  let vista = await vistaDeElementos(
    elementos,
    req.user?.id ?? 0,
    ctx,
    await nombresUsuarios()
  );
  if (q.visto === 'si') {
    vista = vista.filter((e) => e.miEstado === 'visto');
  } else if (q.visto === 'no') {
    vista = vista.filter((e) => e.miEstado !== 'visto');
  } else if (q.visto === 'empezado') {
    vista = vista.filter((e) => e.miEstado === 'empezado');
  }
  if (q.marca === 'guardadas') {
    vista = vista.filter((e) => e.misMarcas.some((m) => m.tipo === 'guardar'));
  } else if (TIPOS_MARCA.includes(q.marca as TipoMarca)) {
    vista = vista.filter((e) => e.misMarcas.some((m) => m.tipo === q.marca));
  }
  if (q.candidatas === 'si') {
    vista = vista.filter((e) => e.candidatas.length > 0);
  }

  const valor = (e: ElementoVista): number | string => {
    switch (orden) {
      case 'anio':
        return e.fechaEstreno ? new Date(e.fechaEstreno).getTime() : 0;
      case 'titulo':
        return e.titulo.toLowerCase();
      case 'tamano':
        return e.tamano;
      case 'reproduccion':
        return e.ultimaReproduccion
          ? new Date(e.ultimaReproduccion).getTime()
          : 0;
      default:
        return new Date(e.fechaDescarga).getTime();
    }
  };
  vista.sort((a, b) => {
    // Sin fecha de estreno, siempre al final
    if (orden === 'anio' && !a.fechaEstreno !== !b.fechaEstreno) {
      return a.fechaEstreno ? -1 : 1;
    }
    const va = valor(a);
    const vb = valor(b);
    const c =
      typeof va === 'string'
        ? va.localeCompare(vb as string, 'es')
        : va - (vb as number);
    if (c) return asc ? c : -c;
    // Empates (p. ej. nunca vistas): orden fijo para que las paginas no
    // repitan ni salten titulos si cambia el orden de carga
    return (
      a.titulo.localeCompare(b.titulo, 'es') || a.embyId.localeCompare(b.embyId)
    );
  });

  const total = vista.length;
  return res.status(200).json({
    pageInfo: {
      pagina,
      paginas: Math.max(Math.ceil(total / porPagina), 1),
      porPagina,
      total,
    },
    resultados: vista.slice((pagina - 1) * porPagina, pagina * porPagina),
  });
});

// Un elemento con mi vista (tras votar, para refrescar la tarjeta)
const vistaDeUno = async (
  req: Request,
  embyId: string
): Promise<ElementoVista | null> => {
  const ctx = await cargarContexto();
  const e = ctx.elementos.get(embyId);
  if (!e) return null;
  const [vista] = await vistaDeElementos(
    [e],
    req.user?.id ?? 0,
    ctx,
    await nombresUsuarios()
  );
  return vista;
};

bibliotecaRoutes.get('/elemento/:embyId', async (req, res) => {
  const vista = await vistaDeUno(req, req.params.embyId);
  if (!vista) return res.status(404).json({ error: 'Not in the library' });
  return res.status(200).json(vista);
});

// Lo que esta en la lista, lo que vence antes primero
bibliotecaRoutes.get('/se-van', async (req, res) => {
  const userId = req.user?.id ?? 0;
  const ctx = await cargarContexto();
  const nombres = await nombresUsuarios();
  const ids = new Set([...ctx.candidatas.values()].map((c) => c.embyId));
  const elementos = [...ids]
    .map((id) => ctx.elementos.get(id))
    .filter((e): e is BibliotecaElemento => !!e);
  const vista = await vistaDeElementos(elementos, userId, ctx, nombres);
  const pendientes = pendientesDe(ctx, userId);

  const resultados = vista
    .filter((v) => v.candidatas.length)
    .map((v) => ({
      ...v,
      pendiente: pendientes.has(v.embyId),
      vence: v.candidatas
        .map((c) => new Date(c.vence).getTime())
        .reduce((a, b) => Math.min(a, b)),
      tamanoEnLista: v.candidatas.reduce((s, c) => s + c.tamano, 0),
    }))
    .sort((a, b) => a.vence - b.vence);

  return res.status(200).json({
    resultados,
    totalTamano: resultados.reduce((s, r) => s + r.tamanoEnLista, 0),
    pendientes: pendientes.size,
  });
});

// Lo que he pedido, con mi estado de visto, y lo que he marcado
bibliotecaRoutes.get('/lo-mio', async (req, res) => {
  const userId = req.user?.id ?? 0;
  const ctx = await cargarContexto();
  const nombres = await nombresUsuarios();
  const peticiones = await getRepository(MediaRequest).find({
    where: { requestedBy: { id: userId } },
    relations: { media: true },
    order: { createdAt: 'DESC' },
  });

  // Una fila por media (las series pueden tener varias peticiones)
  const porMedia = new Map<number, MediaRequest>();
  for (const p of peticiones) {
    if (p.media && !porMedia.has(p.media.id)) porMedia.set(p.media.id, p);
  }
  const mediaIds = new Set(porMedia.keys());
  const pedidos = [...ctx.elementos.values()].filter(
    (e) => e.mediaId && mediaIds.has(e.mediaId)
  );
  const vistaPedidos = await vistaDeElementos(pedidos, userId, ctx, nombres);
  const vistaPorMedia = new Map(vistaPedidos.map((v) => [v.mediaId, v]));

  // Lo que he marcado (todas las bibliotecas incluidas)
  const marcados = new Set<string>();
  for (const [clave, marcas] of ctx.marcas) {
    if (marcas.has(userId)) marcados.add(clave.split('|')[0]);
  }
  const vistaMarcados = await vistaDeElementos(
    [...marcados]
      .map((id) => ctx.elementos.get(id))
      .filter((e): e is BibliotecaElemento => !!e),
    userId,
    ctx,
    nombres
  );
  const conMarca = (tipo: TipoMarca) =>
    vistaMarcados.filter((v) => v.misMarcas.some((m) => m.tipo === tipo));

  // Series de las que no quiero avisos de novedades
  const silenciadas = await getRepository(BibliotecaProgreso).find({
    where: { userId, silenciada: true },
    order: { titulo: 'ASC' },
  });

  return res.status(200).json({
    resultados: [...porMedia.values()].map((p) => ({
      peticionId: p.id,
      fechaPeticion: p.createdAt,
      estadoPeticion: p.status,
      mediaId: p.media.id,
      tipo: p.media.mediaType,
      tmdbId: p.media.tmdbId,
      tvdbId: p.media.tvdbId ?? null,
      elemento: vistaPorMedia.get(p.media.id) ?? null,
    })),
    guardadas: conMarca('guardar'),
    borrar: conMarca('borrar'),
    quieroVer: conMarca('quiero_ver'),
    silenciadas: silenciadas.map((p) => ({
      tmdbId: p.tmdbId,
      tvdbId: p.tvdbId,
      titulo: p.titulo,
    })),
  });
});

// --- Novedades de las series ------------------------------------------------

interface TemporadaNovedad {
  temporada: number;
  // Episodios nuevos (desde-hasta)
  desde: number;
  hasta: number;
  // Emitidos de esa temporada y si ya se ha emitido entera
  emitidos: number;
  completa: boolean;
  // Episodios de esa temporada en el disco
  descargados: number;
  // Con una petición pendiente de aprobar en Seerr
  pedida: boolean;
  // Sonarr la vigila (pedida y aprobada) pero aún no está en el disco
  esperando: boolean;
}

interface NovedadSerie {
  tmdbId: number;
  tvdbId: number | null;
  titulo: string;
  mediaId: number | null;
  // Para abrirla en Emby (si la serie esta en el disco)
  embyUrl: string | null;
  // Lo mas reciente emitido
  fecha: Date | null;
  temporadas: TemporadaNovedad[];
}

interface ProximaSerie {
  tmdbId: number;
  tvdbId: number | null;
  titulo: string;
  mediaId: number | null;
  temporada: number;
  episodio: number;
  fecha: Date | null;
}

const urlEmby = (embyId: string): string => {
  const settings = getSettings();
  const { serverId, externalHostname } = settings.jellyfin;
  const host = externalHostname || getHostname();
  const pagina =
    settings.main.mediaServerType === MediaServerType.EMBY ? 'item' : 'details';
  return `${host}/web/index.html#!/${pagina}?id=${embyId}&context=home&serverId=${serverId}`;
};

// Mis novedades: lo nuevo de las series que veo (descargado o no) y lo
// proximo. Lo que he empezado a ver desde el ultimo calculo ya no sale.
bibliotecaRoutes.get('/novedades', async (req, res) => {
  const userId = req.user?.id ?? 0;
  const progreso = new Map(
    (await getRepository(BibliotecaProgreso).find({ where: { userId } })).map(
      (p) => [p.tmdbId, p]
    )
  );
  const filas = (
    await getRepository(BibliotecaNovedad).find({ where: { userId } })
  ).filter((n) => {
    const p = progreso.get(n.tmdbId);
    if (!p || p.silenciada) return false;
    return (
      n.temporada > p.temporada ||
      (n.temporada === p.temporada && n.desde > p.episodio)
    );
  });
  const tmdbIds = [...new Set(filas.map((n) => n.tmdbId))];

  // Lo que hay en el disco y lo pedido en Seerr
  const elementos = tmdbIds.length
    ? await getRepository(BibliotecaElemento).find({
        where: { tipo: 'tv', tmdbId: In(tmdbIds) },
      })
    : [];
  const elementoDe = new Map<number, BibliotecaElemento>();
  for (const e of elementos) {
    if (e.tmdbId && !elementoDe.has(e.tmdbId)) elementoDe.set(e.tmdbId, e);
  }
  const episodiosEn = new Map<string, number>();
  if (elementos.length) {
    for (const t of await getRepository(BibliotecaTemporada).find({
      where: { embyId: In(elementos.map((e) => e.embyId)) },
    })) {
      episodiosEn.set(claveUnidad(t.embyId, t.numero), t.episodios);
    }
  }
  const mediaDe = new Map(
    (tmdbIds.length
      ? await getRepository(Media).find({
          where: { mediaType: MediaType.TV, tmdbId: In(tmdbIds) },
        })
      : []
    ).map((m) => [m.tmdbId, m])
  );

  // Temporadas con una petición pendiente de aprobar (las aprobadas que aún no
  // han bajado salen como "esperando descarga")
  const pendientes = new Set<string>();
  const mediaIds = [...mediaDe.values()].map((m) => m.id);
  if (mediaIds.length) {
    for (const p of await getRepository(MediaRequest).find({
      where: {
        media: { id: In(mediaIds) },
        status: MediaRequestStatus.PENDING,
      },
      relations: { media: true, seasons: true },
    })) {
      for (const s of p.seasons ?? []) {
        pendientes.add(`${p.media.tmdbId}:${s.seasonNumber}`);
      }
    }
  }

  const nuevas = new Map<number, NovedadSerie>();
  const proximas: ProximaSerie[] = [];
  for (const n of filas) {
    const e = elementoDe.get(n.tmdbId);
    const media = mediaDe.get(n.tmdbId);
    if (n.tipo === 'proxima') {
      proximas.push({
        tmdbId: n.tmdbId,
        tvdbId: n.tvdbId,
        titulo: n.titulo,
        mediaId: media?.id ?? null,
        temporada: n.temporada,
        episodio: n.desde,
        fecha: n.fecha,
      });
      continue;
    }
    const serie: NovedadSerie = nuevas.get(n.tmdbId) ?? {
      tmdbId: n.tmdbId,
      tvdbId: n.tvdbId,
      titulo: n.titulo,
      mediaId: media?.id ?? null,
      embyUrl: e ? urlEmby(e.embyId) : null,
      fecha: null,
      temporadas: [],
    };
    const estado = media?.seasons?.find(
      (s) => s.seasonNumber === n.temporada
    )?.status;
    serie.temporadas.push({
      temporada: n.temporada,
      desde: n.desde,
      hasta: n.hasta,
      emitidos: n.emitidos,
      completa: n.completa,
      descargados: e
        ? (episodiosEn.get(claveUnidad(e.embyId, n.temporada)) ?? 0)
        : 0,
      pedida: pendientes.has(`${n.tmdbId}:${n.temporada}`),
      esperando:
        estado === MediaStatus.PENDING || estado === MediaStatus.PROCESSING,
    });
    if (n.fecha && (!serie.fecha || n.fecha > serie.fecha)) {
      serie.fecha = n.fecha;
    }
    nuevas.set(n.tmdbId, serie);
  }
  const tiempo = (d: Date | null) => (d ? new Date(d).getTime() : 0);
  for (const s of nuevas.values()) {
    s.temporadas.sort((a, b) => a.temporada - b.temporada);
  }

  return res.status(200).json({
    nuevas: [...nuevas.values()].sort(
      (a, b) => tiempo(b.fecha) - tiempo(a.fecha)
    ),
    proximas: proximas.sort((a, b) => tiempo(a.fecha) - tiempo(b.fecha)),
    calculada: (await leerAjuste('novedades')).ultima ?? null,
  });
});

interface CuerpoSilenciar {
  tmdbId?: number;
  // true: "No avisarme más"; false: volver a avisarme
  silenciar?: boolean;
}

bibliotecaRoutes.post('/novedades/silenciar', async (req, res) => {
  const cuerpo = req.body as CuerpoSilenciar;
  if (
    !Number.isInteger(cuerpo.tmdbId) ||
    typeof cuerpo.silenciar !== 'boolean'
  ) {
    return res.status(400).json({ error: 'tmdbId or silenciar is not valid' });
  }
  const repo = getRepository(BibliotecaProgreso);
  const fila = await repo.findOne({
    where: { userId: req.user?.id ?? 0, tmdbId: cuerpo.tmdbId },
  });
  if (!fila) {
    return res.status(404).json({ error: 'You have not watched this series' });
  }
  fila.silenciada = cuerpo.silenciar;
  await repo.save(fila);
  // Al volver a avisar, sus novedades salen en el proximo calculo
  if (!cuerpo.silenciar) calculadorNovedades.run();
  return res.status(204).send();
});

// --- Votos ---------------------------------------------------------------------

interface CuerpoMarca {
  embyId?: string;
  tipo?: TipoMarca;
  // Series: temporadas a las que aplica (por defecto, todas las descargadas)
  temporadas?: number[];
}

// Unidades (temporadas) de un elemento a las que aplica una peticion
const unidadesDe = (
  ctx: Contexto,
  e: BibliotecaElemento,
  temporadas?: number[]
): number[] | null => {
  if (e.tipo === 'movie') return [-1];
  const todas = ctx.temporadasDe.get(e.embyId) ?? [];
  if (!temporadas) return todas;
  if (
    !Array.isArray(temporadas) ||
    !temporadas.length ||
    temporadas.some((t) => !todas.includes(t))
  ) {
    return null;
  }
  return temporadas;
};

bibliotecaRoutes.post('/marca', async (req, res) => {
  const cuerpo = req.body as CuerpoMarca;
  const userId = req.user?.id ?? 0;
  const yo = await miUsuario(req);
  if (!yo.tieneVoto) {
    return res.status(403).json({ error: 'You cannot vote in the library' });
  }
  if (!TIPOS_MARCA.includes(cuerpo.tipo as TipoMarca)) {
    return res.status(400).json({ error: 'tipo is not valid' });
  }
  const tipo = cuerpo.tipo as TipoMarca;
  if (tipo === 'guardar' && !yo.puedeGuardar) {
    return res.status(403).json({ error: 'You cannot keep titles' });
  }

  const ctx = await cargarContexto();
  const e = ctx.elementos.get(cuerpo.embyId ?? '');
  if (!e) return res.status(404).json({ error: 'Not in the library' });
  const temporadas = unidadesDe(ctx, e, cuerpo.temporadas);
  if (!temporadas || !temporadas.length) {
    return res.status(400).json({ error: 'temporadas is not valid' });
  }

  const repo = getRepository(BibliotecaMarca);
  for (const temporada of temporadas) {
    const fila =
      (await repo.findOne({
        where: { userId, embyId: e.embyId, temporada },
      })) ?? new BibliotecaMarca({ userId, embyId: e.embyId, temporada });
    // Cambiar de marca reinicia la fecha (el "Quiero verla" caduca desde aqui)
    if (fila.tipo !== tipo) {
      if (fila.id) await repo.remove(fila);
      await repo.save(
        new BibliotecaMarca({ userId, embyId: e.embyId, temporada, tipo })
      );
    }
  }

  await evaluadorBiblioteca.run();
  return res.status(200).json(await vistaDeUno(req, e.embyId));
});

bibliotecaRoutes.post('/marca/quitar', async (req, res) => {
  const cuerpo = req.body as CuerpoMarca;
  const userId = req.user?.id ?? 0;
  const ctx = await cargarContexto();
  const e = ctx.elementos.get(cuerpo.embyId ?? '');
  if (!e) return res.status(404).json({ error: 'Not in the library' });
  const temporadas = unidadesDe(ctx, e, cuerpo.temporadas);
  if (!temporadas) {
    return res.status(400).json({ error: 'temporadas is not valid' });
  }

  const repo = getRepository(BibliotecaMarca);
  const mias = await repo.find({
    where: { userId, embyId: e.embyId, temporada: In(temporadas) },
  });
  await repo.remove(
    cuerpo.tipo ? mias.filter((m) => m.tipo === cuerpo.tipo) : mias
  );

  await evaluadorBiblioteca.run();
  return res.status(200).json(await vistaDeUno(req, e.embyId));
});

// Tutorial visto (o cerrado): no se vuelve a abrir solo
bibliotecaRoutes.post('/tutorial', async (req, res) => {
  await getRepository(BibliotecaUsuario).update(
    { userId: req.user?.id ?? 0 },
    { tutorialVisto: new Date() }
  );
  return res.status(204).send();
});

// --- Ajustes (solo admin) ---------------------------------------------------

bibliotecaRoutes.get(
  '/ajustes',
  isAuthenticated(Permission.ADMIN),
  async (_req, res) => {
    const settings = getSettings();
    const incluidas = await leerAjuste('bibliotecas');

    let bibliotecasEmby: { id: string; nombre: string; tipo: string }[];
    try {
      const emby = new EmbyBiblioteca(getHostname(), settings.jellyfin.apiKey);
      bibliotecasEmby = (await emby.getLibraries()).map((l) => ({
        id: l.key,
        nombre: l.title,
        tipo: l.type,
      }));
    } catch (e) {
      logger.warn(`Bibliotecas de Emby no disponibles: ${e.message}`, {
        label: 'Biblioteca',
      });
      bibliotecasEmby = settings.jellyfin.libraries.map((l) => ({
        id: l.id,
        nombre: l.name,
        tipo: l.type,
      }));
    }

    const usuarios = await getRepository(User).find({
      where: { jellyfinUserId: Not(IsNull()) },
      order: { id: 'ASC' },
    });
    const filas = new Map(
      (await getRepository(BibliotecaUsuario).find()).map((u) => [u.userId, u])
    );

    return res.status(200).json({
      simulacro: await soloAvisar(),
      bibliotecas: bibliotecasEmby.map((b) => ({
        ...b,
        incluida: incluidas.includes(b.id),
      })),
      usuarios: usuarios.map((u) => {
        const fila = filas.get(u.id);
        return {
          id: u.id,
          nombre: u.displayName,
          avatar: u.avatar,
          ultimaActividad: fila?.ultimaActividad ?? null,
          tieneVoto: fila?.tieneVoto ?? true,
          puedeGuardar: fila?.puedeGuardar ?? true,
        };
      }),
      plazos: await leerAjuste('plazos'),
      etiquetaRadarr: (await leerAjuste('etiquetaRadarr')).nombre,
      sync: {
        ...(await leerAjuste('sync')),
        enCurso: sincronizadorBiblioteca.running,
      },
      evaluacion: await leerAjuste('evaluacion'),
      ejecucion: sinContrasena(await leerAjuste('ejecucion')),
      borrador: {
        ...(await leerAjuste('borrador')),
        enCurso: borradorBiblioteca.running,
      },
      novedades: {
        ...(await leerAjuste('novedades')),
        enCurso: calculadorNovedades.running,
      },
    });
  }
);

// La contrasena de qBittorrent no sale de Seerr: solo si hay una guardada
const sinContrasena = ({ qbittorrent, ...resto }: Ejecucion) => ({
  ...resto,
  qbittorrent: {
    url: qbittorrent.url,
    usuario: qbittorrent.usuario,
    conContrasena: !!qbittorrent.contrasena,
  },
});

const MODOS: ModoEjecucion[] = ['avisar', 'arr', 'externo'];
const POLITICAS: PoliticaTorrents[] = ['dejar', 'borrar', 'esperar'];

interface CuerpoEjecucion {
  modo?: ModoEjecucion;
  hora?: number;
  // contrasena sin enviar: se queda la guardada
  qbittorrent?: { url?: string; usuario?: string; contrasena?: string };
  torrents?: {
    politica?: PoliticaTorrents;
    ratioMinimo?: number | null;
    horasMinimas?: number | null;
  };
}

// Ajustes de ejecucion con los cambios del cuerpo, o el error
const nuevaEjecucion = (
  actual: Ejecucion,
  cuerpo: CuerpoEjecucion
): Ejecucion | string => {
  const nueva: Ejecucion = {
    ...actual,
    qbittorrent: { ...actual.qbittorrent },
    torrents: { ...actual.torrents },
  };
  if (cuerpo.modo !== undefined) {
    if (!MODOS.includes(cuerpo.modo)) return 'modo is not valid';
    nueva.modo = cuerpo.modo;
  }
  if (cuerpo.hora !== undefined) {
    if (!Number.isInteger(cuerpo.hora) || cuerpo.hora < 0 || cuerpo.hora > 23) {
      return 'hora is not valid';
    }
    nueva.hora = cuerpo.hora;
  }
  const q = cuerpo.qbittorrent;
  if (q) {
    for (const campo of ['url', 'usuario', 'contrasena'] as const) {
      const v = q[campo];
      if (v === undefined) continue;
      if (typeof v !== 'string' || v.length > 500) {
        return `qbittorrent.${campo} is not valid`;
      }
      nueva.qbittorrent[campo] = campo === 'contrasena' ? v : v.trim();
    }
    // La contrasena guardada solo vale para la URL guardada: con otra URL
    // hay que volver a escribirla (si no, se mandaria a cualquier servidor)
    if (
      q.contrasena === undefined &&
      nueva.qbittorrent.url !== actual.qbittorrent.url
    ) {
      nueva.qbittorrent.contrasena = '';
    }
    if (
      nueva.qbittorrent.url &&
      !/^https?:\/\/\S+$/.test(nueva.qbittorrent.url)
    ) {
      return 'qbittorrent.url is not valid (http:// or https://)';
    }
  }
  const t = cuerpo.torrents;
  if (t) {
    if (t.politica !== undefined) {
      if (!POLITICAS.includes(t.politica))
        return 'torrents.politica is not valid';
      nueva.torrents.politica = t.politica;
    }
    for (const campo of ['ratioMinimo', 'horasMinimas'] as const) {
      const v = t[campo];
      if (v === undefined) continue;
      if (v !== null && (typeof v !== 'number' || !(v > 0) || v > 100000)) {
        return `torrents.${campo} is not valid`;
      }
      nueva.torrents[campo] = v;
    }
  }
  return nueva;
};

interface CuerpoAjustes {
  ejecucion?: CuerpoEjecucion;
  bibliotecas?: string[];
  plazos?: Partial<Plazos>;
  etiquetaRadarr?: string;
  usuarios?: { id: number; tieneVoto: boolean; puedeGuardar: boolean }[];
}

bibliotecaRoutes.put(
  '/ajustes',
  isAuthenticated(Permission.ADMIN),
  async (req, res) => {
    const cuerpo = req.body as CuerpoAjustes;

    if (cuerpo.ejecucion) {
      const actual = await leerAjuste('ejecucion');
      const nueva = nuevaEjecucion(actual, cuerpo.ejecucion);
      if (typeof nueva === 'string') {
        return res.status(400).json({ error: nueva });
      }
      if (actual.modo === 'avisar' && nueva.modo !== 'avisar') {
        // Al empezar a borrar de verdad, lo que vencio solo avisando vuelve a
        // tener su plazo completo: nadie lo ha visto irse de verdad
        const ahora = new Date();
        const plazos = await leerAjuste('plazos');
        await getRepository(Candidata).update(
          { estado: 'listo' },
          {
            estado: 'lista',
            entrada: ahora,
            vence: new Date(ahora.getTime() + plazos.listaDias * DIA),
          }
        );
      }
      await guardarAjuste('ejecucion', nueva);
    }

    if (cuerpo.bibliotecas) {
      if (
        !Array.isArray(cuerpo.bibliotecas) ||
        cuerpo.bibliotecas.some((b) => typeof b !== 'string')
      ) {
        return res.status(400).json({ error: 'bibliotecas is not valid' });
      }
      await guardarAjuste('bibliotecas', cuerpo.bibliotecas);
    }

    if (cuerpo.plazos) {
      const actuales = await leerAjuste('plazos');
      const nuevos = { ...actuales };
      for (const clave of Object.keys(actuales) as (keyof Plazos)[]) {
        const v = cuerpo.plazos[clave];
        if (v === undefined) continue;
        if (!Number.isInteger(v) || v < 1 || v > 3650) {
          return res.status(400).json({ error: `${clave} is not valid` });
        }
        nuevos[clave] = v;
      }
      await guardarAjuste('plazos', nuevos);
    }

    if (cuerpo.etiquetaRadarr !== undefined) {
      if (
        typeof cuerpo.etiquetaRadarr !== 'string' ||
        cuerpo.etiquetaRadarr.length > 100
      ) {
        return res.status(400).json({ error: 'etiquetaRadarr is not valid' });
      }
      await guardarAjuste('etiquetaRadarr', {
        nombre: cuerpo.etiquetaRadarr.trim(),
      });
    }

    if (cuerpo.usuarios) {
      const repo = getRepository(BibliotecaUsuario);
      const seerr = new Map(
        (
          await getRepository(User).find({
            where: { jellyfinUserId: Not(IsNull()) },
            select: ['id', 'jellyfinUserId'],
          })
        ).map((u) => [u.id, u.jellyfinUserId as string])
      );
      for (const u of cuerpo.usuarios) {
        const embyUserId = seerr.get(u.id);
        if (!embyUserId) continue;
        const fila =
          (await repo.findOne({ where: { userId: u.id } })) ??
          new BibliotecaUsuario({ userId: u.id, embyUserId });
        fila.tieneVoto = !!u.tieneVoto;
        fila.puedeGuardar = !!u.puedeGuardar;
        await repo.save(fila);
      }
    }

    return res.status(204).send();
  }
);

// Borrar ya lo vencido (modo arr), sin esperar a la hora
bibliotecaRoutes.post(
  '/borrar',
  isAuthenticated(Permission.ADMIN),
  async (_req, res) => {
    if ((await leerAjuste('ejecucion')).modo !== 'arr') {
      return res
        .status(409)
        .json({ error: 'Only available in Radarr/Sonarr removal mode' });
    }
    const yaEnCurso = borradorBiblioteca.running;
    if (!yaEnCurso) {
      borradorBiblioteca.run();
    }
    return res.status(202).json({ enCurso: true, yaEnCurso });
  }
);

// Probar la conexion con qBittorrent: la del cuerpo o, sin contrasena, la
// guardada (solo con la misma URL)
bibliotecaRoutes.post(
  '/qbittorrent/probar',
  isAuthenticated(Permission.ADMIN),
  async (req, res) => {
    const actual = await leerAjuste('ejecucion');
    const nueva = nuevaEjecucion(actual, {
      qbittorrent: (req.body as CuerpoEjecucion).qbittorrent,
    });
    if (typeof nueva === 'string') {
      return res.status(400).json({ error: nueva });
    }
    if (!nueva.qbittorrent.url) {
      return res.status(400).json({ error: 'The qBittorrent URL is missing' });
    }
    try {
      const qbt = new QBittorrent(nueva.qbittorrent);
      await qbt.entrar();
      return res.status(200).json({ version: await qbt.version() });
    } catch (e) {
      return res.status(502).json({ error: e.message });
    }
  }
);

bibliotecaRoutes.post(
  '/sync',
  isAuthenticated(Permission.ADMIN),
  async (_req, res) => {
    const yaEnCurso = sincronizadorBiblioteca.running;
    if (!yaEnCurso) {
      sincronizadorBiblioteca.run();
    }
    return res.status(202).json({ enCurso: true, yaEnCurso });
  }
);

bibliotecaRoutes.post(
  '/novedades/calcular',
  isAuthenticated(Permission.ADMIN),
  async (_req, res) => {
    await calculadorNovedades.run();
    return res.status(200).json(await leerAjuste('novedades'));
  }
);

bibliotecaRoutes.post(
  '/evaluar',
  isAuthenticated(Permission.ADMIN),
  async (_req, res) => {
    return res.status(200).json(await evaluadorBiblioteca.run());
  }
);

// Historial de lo borrado (o lo que se habria borrado en modo prueba)
bibliotecaRoutes.get(
  '/historial',
  isAuthenticated(Permission.ADMIN),
  async (req, res) => {
    const q = req.query as Record<string, string | undefined>;
    const tipos: TipoHistorial[] =
      q.tipo === 'borrado' || !q.tipo ? ['borrado', 'espera', 'error'] : [];
    const filas = await getRepository(BibliotecaHistorial).find({
      where: { tipo: In(tipos) },
      order: { fecha: 'DESC', id: 'DESC' },
      take: 500,
    });
    return res.status(200).json({
      resultados: filas,
      totalTamano: filas
        .filter((f) => f.tipo === 'borrado')
        .reduce((s, f) => s + f.tamano, 0),
    });
  }
);

interface CuerpoCandidata {
  embyId?: string;
  temporadas?: number[];
}

// Forzar: la mete en la lista con el plazo completo
bibliotecaRoutes.post(
  '/candidata/forzar',
  isAuthenticated(Permission.ADMIN),
  async (req, res) => {
    const cuerpo = req.body as CuerpoCandidata;
    const ctx = await cargarContexto();
    const e = ctx.elementos.get(cuerpo.embyId ?? '');
    if (!e) return res.status(404).json({ error: 'Not in the library' });
    // Solo lo que se puede borrar desde Radarr/Sonarr
    if (!e.gestionado) {
      return res
        .status(400)
        .json({ error: 'Not found in Radarr or Sonarr: it cannot be removed' });
    }
    const temporadas = unidadesDe(ctx, e, cuerpo.temporadas);
    if (!temporadas) {
      return res.status(400).json({ error: 'temporadas is not valid' });
    }
    const repo = getRepository(Candidata);
    for (const temporada of temporadas) {
      const fila =
        ctx.candidatas.get(claveUnidad(e.embyId, temporada)) ??
        new Candidata({ embyId: e.embyId, temporada });
      fila.motivo = 'F';
      fila.pedidoPor = '[]';
      fila.estado = 'lista';
      fila.entrada = ctx.ahora;
      fila.vence = new Date(ctx.ahora.getTime() + ctx.plazos.listaDias * DIA);
      fila.pausadaDesde = null;
      await repo.save(fila);
    }
    await evaluadorBiblioteca.run();
    return res.status(200).json(await vistaDeUno(req, e.embyId));
  }
);

export default bibliotecaRoutes;
