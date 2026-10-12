import {
  formatoFecha,
  formatoFechaHora,
  formatoTamano,
  temporadaCorta,
  textoTitulos,
} from '@app/components/Biblioteca/comun';
import SeccionPlegable from '@app/components/Biblioteca/SeccionPlegable';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import SlideCheckbox from '@app/components/Common/SlideCheckbox';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { useEffect, useState } from 'react';
import type { MessageDescriptor } from 'react-intl';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Biblioteca.AjustesBiblioteca', {
  modeNotify: 'Notify only',
  modeNotifyDescription:
    'Nothing is removed: when a countdown ends, the title is recorded in the removal history.',
  modeArr: 'Remove with Radarr/Sonarr',
  modeArrDescription:
    'At the scheduled time, Seerr asks Radarr to remove the movie, or Sonarr to remove the files of the season. Titles with a download in progress are skipped.',
  modeExternal: 'External executor',
  modeExternalDescription:
    'An external program retrieves the expired titles and reports the result through the executor API (/api/biblioteca/ejecutor, authenticated with the Seerr API key).',
  policyKeep: 'Keep torrents',
  policyRemove: 'Remove torrents and their files',
  policyWait: 'Remove torrents once they reach the minimum seeding goal',
  historyEmpty: 'No entries yet.',
  historySummary: '{count, plural, one {# entry} other {# entries}} · {size}',
  historyWaiting: 'Waiting',
  historyError: 'Removal failed',
  historyWithNote: '{label}: {note}',
  historyNotifyOnly: 'notify only',
  reasonRequested: 'Removal requested',
  reasonNotInterested: 'Not interested',
  reasonNotWatched: 'Not watched',
  reasonAdmin: 'Administrator',
  days: 'days',
  months: 'months',
  perWeek: 'per week',
  votes: 'votes',
  thresholdList: 'Time in Pending Removal before removal',
  thresholdAge:
    'Time without being watched (or since download) before being added to Pending Removal',
  thresholdActivity:
    'Time without Jellyfin/Emby activity before a user stops counting as active',
  thresholdWatchLater:
    'Duration of a "Watch later" mark if the title is not watched',
  thresholdPerWeek:
    'Titles added each week for not being watched (oldest downloads first)',
  thresholdVotes:
    '"Not interested" votes required to add a title to Pending Removal',
  thresholdTag:
    'Time without being watched for movies with the Radarr tag below',
  tagLabel: 'Radarr tag with its own threshold',
  tagDescription:
    'Movies with this tag use the threshold above instead of the general one (for example, content downloaded automatically that nobody requested). Leave it empty to disable it.',
  loadError: 'The settings could not be loaded.',
  confirmLeaveNotify:
    'From now on, expired titles will actually be removed. Titles that had already expired restart their countdown. Continue?',
  saved: 'Settings saved.',
  saveError: 'The settings could not be saved.',
  syncStarted: 'Jellyfin/Emby sync started.',
  reviewDone:
    'List reviewed: {total} pending removal ({added} added, {saved} kept, {expired} expired).',
  reviewError: 'The list could not be reviewed.',
  newCalculated: 'New episodes calculated.',
  newError: 'New episodes could not be calculated.',
  qbtConnected: 'Connected to qBittorrent {version}.',
  qbtError: 'Could not connect to qBittorrent.',
  qbtErrorDetail: 'Could not connect to qBittorrent: {error}',
  confirmRemoveNow: 'All expired titles will be removed now. Continue?',
  removeStarted: 'Removal of expired titles started.',
  removeError: 'The removal could not be started.',
  executionTitle: 'Removal Execution',
  executionNote:
    'When the most recent season of a series is removed, Sonarr stops monitoring the series; new seasons can be requested from New Episodes. Changes are applied when you save.',
  removalTime: 'Removal time',
  removing: 'Removing…',
  removeNow: 'Remove now',
  lastRemoval:
    'Last run: {date} · {removed} removed · {waiting} waiting · {errors} with errors',
  lastError: 'Last error: {error}',
  torrentsTitle: 'Torrents (optional)',
  torrentsDescription:
    'Removing a title in Radarr/Sonarr does not remove its torrents: if they share the same files (hardlinks), the space is not freed until the client removes them. With qBittorrent configured, Seerr finds the torrents through the Radarr/Sonarr history and applies the selected policy. Without a connection, the download client manages them. If you change the URL, enter the password again.',
  username: 'Username',
  password: 'Password',
  passwordSaved: 'Saved password',
  testConnection: 'Test connection',
  minRatio: 'minimum ratio',
  seedingHours: 'seeding hours',
  waitHint: 'Removed when either goal is reached; an empty field is ignored.',
  listTitle: 'Pending Removal List',
  listDescription:
    'Reviewed every hour after syncing with Jellyfin/Emby, and after each vote.',
  reviewNow: 'Review now',
  lastRun: 'Last run: {date}',
  historyTitle: 'Removal History',
  newTitle: 'New Episodes',
  newDescription:
    'Every 6 hours, TMDB is checked for new releases of the series each user watches.',
  calculateNow: 'Calculate now',
  lastNew:
    'Last run: {date} · {count, plural, one {# new release} other {# new releases}} in {series, plural, one {# series} other {# series}}',
  syncTitle: 'Jellyfin/Emby Sync',
  syncDescription:
    'Every hour, the content of the included libraries and the watch history of each user are read from Jellyfin/Emby, and file sizes from Radarr and Sonarr.',
  syncing: 'Syncing…',
  syncNow: 'Sync now',
  lastSync: 'Last run: {date} · {titles} · {seconds} s',
  librariesTitle: 'Included Libraries',
  librariesSummary: '{included} of {total} included',
  librariesDescription:
    'Only content in these libraries appears in the Library and can be removed. Consider excluding libraries for children.',
  usersTitle: 'Users',
  usersSummary: '{voters} of {total} can vote',
  usersDescription:
    'Who takes part in deciding what is removed, and who can keep titles so that they are never removed.',
  user: 'User',
  lastActivity: 'Last Jellyfin/Emby activity',
  canVote: 'Can vote',
  canKeep: 'Can keep',
  noData: 'No data',
  thresholdsTitle: 'Thresholds',
});

interface Plazos {
  listaDias: number;
  antiguedadMeses: number;
  actividadDias: number;
  quieroVerMeses: number;
  cPorSemana: number;
  votosB: number;
  antiguedadEtiquetaMeses: number;
}

type ModoEjecucion = 'avisar' | 'arr' | 'externo';
type PoliticaTorrents = 'dejar' | 'borrar' | 'esperar';

interface Ejecucion {
  modo: ModoEjecucion;
  hora: number;
  qbittorrent: { url: string; usuario: string; conContrasena: boolean };
  torrents: {
    politica: PoliticaTorrents;
    ratioMinimo: number | null;
    horasMinimas: number | null;
  };
}

const MODOS: {
  valor: ModoEjecucion;
  texto: MessageDescriptor;
  descripcion: MessageDescriptor;
}[] = [
  {
    valor: 'avisar',
    texto: messages.modeNotify,
    descripcion: messages.modeNotifyDescription,
  },
  {
    valor: 'arr',
    texto: messages.modeArr,
    descripcion: messages.modeArrDescription,
  },
  {
    valor: 'externo',
    texto: messages.modeExternal,
    descripcion: messages.modeExternalDescription,
  },
];

const POLITICAS: { valor: PoliticaTorrents; texto: MessageDescriptor }[] = [
  { valor: 'dejar', texto: messages.policyKeep },
  { valor: 'borrar', texto: messages.policyRemove },
  { valor: 'esperar', texto: messages.policyWait },
];

interface FilaHistorial {
  id: number;
  tipo: 'borrado' | 'espera' | 'error';
  titulo: string;
  temporada: number;
  tamano: number;
  motivo: string | null;
  nota: string | null;
  simulacro: boolean;
  fecha: string;
}

const MOTIVOS: Record<string, MessageDescriptor> = {
  A: messages.reasonRequested,
  B: messages.reasonNotInterested,
  C: messages.reasonNotWatched,
  F: messages.reasonAdmin,
};

// Lo borrado (o lo que se habria borrado solo avisando) y lo que el ejecutor
// no pudo borrar todavia
const Historial = () => {
  const intl = useIntl();
  const { data } = useSWR<{ resultados: FilaHistorial[]; totalTamano: number }>(
    '/api/biblioteca/historial?tipo=borrado'
  );
  if (!data) return <LoadingSpinner />;
  if (!data.resultados.length) {
    return (
      <p className="mt-2 text-sm text-gray-400">
        {intl.formatMessage(messages.historyEmpty)}
      </p>
    );
  }
  const conNota = (label: MessageDescriptor, nota: string | null) =>
    nota
      ? intl.formatMessage(messages.historyWithNote, {
          label: intl.formatMessage(label),
          note: nota,
        })
      : intl.formatMessage(label);
  return (
    <div className="mt-3 max-h-96 overflow-auto">
      <p className="mb-2 text-sm text-gray-400">
        {intl.formatMessage(messages.historySummary, {
          count: data.resultados.length,
          size: formatoTamano(intl, data.totalTamano),
        })}
      </p>
      <table className="min-w-full text-sm">
        <tbody>
          {data.resultados.map((f) => {
            const motivo = MOTIVOS[f.motivo ?? ''];
            return (
              <tr key={f.id} className="border-t border-gray-700">
                <td className="py-1 pr-4 text-gray-400">
                  {formatoFechaHora(intl, f.fecha)}
                </td>
                <td className="py-1 pr-4 text-gray-200">
                  {f.titulo}
                  {f.temporada >= 0
                    ? ` ${temporadaCorta(intl, f.temporada)}`
                    : ''}
                </td>
                <td className="py-1 pr-4 text-gray-400">
                  {f.tipo === 'borrado'
                    ? [
                        formatoTamano(intl, f.tamano),
                        motivo ? intl.formatMessage(motivo) : '',
                        f.nota ?? '',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : f.tipo === 'espera'
                      ? conNota(messages.historyWaiting, f.nota)
                      : conNota(messages.historyError, f.nota)}
                </td>
                <td className="py-1 text-xs text-gray-500">
                  {f.simulacro
                    ? intl.formatMessage(messages.historyNotifyOnly)
                    : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface AjustesRespuesta {
  simulacro: boolean;
  ejecucion: Ejecucion;
  borrador: {
    ultima?: string;
    borrados?: number;
    esperas?: number;
    errores?: number;
    error?: string;
    enCurso: boolean;
  };
  evaluacion: { ultima?: string; error?: string };
  novedades: {
    ultima?: string;
    duracionMs?: number;
    series?: number;
    novedades?: number;
    error?: string;
    enCurso: boolean;
  };
  bibliotecas: {
    id: string;
    nombre: string;
    tipo: string;
    incluida: boolean;
  }[];
  usuarios: {
    id: number;
    nombre: string;
    avatar: string;
    ultimaActividad: string | null;
    tieneVoto: boolean;
    puedeGuardar: boolean;
  }[];
  plazos: Plazos;
  etiquetaRadarr: string;
  sync: {
    ultima?: string;
    duracionMs?: number;
    elementos?: number;
    error?: string;
    enCurso: boolean;
  };
}

const CAMPOS_PLAZO: {
  clave: keyof Plazos;
  texto: MessageDescriptor;
  unidad: MessageDescriptor;
}[] = [
  { clave: 'listaDias', texto: messages.thresholdList, unidad: messages.days },
  {
    clave: 'antiguedadMeses',
    texto: messages.thresholdAge,
    unidad: messages.months,
  },
  {
    clave: 'actividadDias',
    texto: messages.thresholdActivity,
    unidad: messages.days,
  },
  {
    clave: 'quieroVerMeses',
    texto: messages.thresholdWatchLater,
    unidad: messages.months,
  },
  {
    clave: 'cPorSemana',
    texto: messages.thresholdPerWeek,
    unidad: messages.perWeek,
  },
  { clave: 'votosB', texto: messages.thresholdVotes, unidad: messages.votes },
  {
    clave: 'antiguedadEtiquetaMeses',
    texto: messages.thresholdTag,
    unidad: messages.months,
  },
];

const AjustesBiblioteca = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { data, error, mutate } = useSWR<AjustesRespuesta>(
    '/api/biblioteca/ajustes',
    // Mientras sincroniza, refrescar para ver cuándo termina
    {
      refreshInterval: (d) =>
        d?.sync.enCurso || d?.borrador.enCurso ? 3000 : 0,
    }
  );
  const [bibliotecas, setBibliotecas] = useState<string[]>([]);
  const [usuarios, setUsuarios] = useState<AjustesRespuesta['usuarios']>([]);
  const [plazos, setPlazos] = useState<Plazos | null>(null);
  const [etiquetaRadarr, setEtiquetaRadarr] = useState('');
  const [ejecucion, setEjecucion] = useState<Ejecucion | null>(null);
  // Vacia: se queda la guardada
  const [contrasenaQbt, setContrasenaQbt] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!data || plazos) return;
    setBibliotecas(data.bibliotecas.filter((b) => b.incluida).map((b) => b.id));
    setUsuarios(data.usuarios);
    setPlazos(data.plazos);
    setEtiquetaRadarr(data.etiquetaRadarr ?? '');
    setEjecucion(data.ejecucion);
  }, [data, plazos]);

  if (error) {
    return (
      <p className="text-red-400">{intl.formatMessage(messages.loadError)}</p>
    );
  }
  if (!data || !plazos || !ejecucion) {
    return <LoadingSpinner />;
  }

  const aviso = (texto: string, appearance: 'success' | 'error' | 'info') =>
    addToast(texto, { appearance, autoDismiss: true });

  const cuerpoQbt = () => ({
    url: ejecucion.qbittorrent.url,
    usuario: ejecucion.qbittorrent.usuario,
    ...(contrasenaQbt ? { contrasena: contrasenaQbt } : {}),
  });

  const guardar = async () => {
    if (
      data.ejecucion.modo === 'avisar' &&
      ejecucion.modo !== 'avisar' &&
      !window.confirm(intl.formatMessage(messages.confirmLeaveNotify))
    ) {
      return;
    }
    setGuardando(true);
    try {
      await axios.put('/api/biblioteca/ajustes', {
        ejecucion: {
          modo: ejecucion.modo,
          hora: ejecucion.hora,
          qbittorrent: cuerpoQbt(),
          torrents: ejecucion.torrents,
        },
        bibliotecas,
        plazos,
        etiquetaRadarr,
        usuarios: usuarios.map((u) => ({
          id: u.id,
          tieneVoto: u.tieneVoto,
          puedeGuardar: u.puedeGuardar,
        })),
      });
      aviso(intl.formatMessage(messages.saved), 'success');
      setContrasenaQbt('');
      mutate();
    } catch {
      aviso(intl.formatMessage(messages.saveError), 'error');
    } finally {
      setGuardando(false);
    }
  };

  const sincronizar = async () => {
    await axios.post('/api/biblioteca/sync');
    aviso(intl.formatMessage(messages.syncStarted), 'info');
    mutate();
  };

  const evaluar = async () => {
    try {
      const { data: r } = await axios.post<{
        enLista: number;
        nuevas: number;
        salvadas: number;
        vencidas: number;
      }>('/api/biblioteca/evaluar');
      aviso(
        intl.formatMessage(messages.reviewDone, {
          total: r.enLista,
          added: r.nuevas,
          saved: r.salvadas,
          expired: r.vencidas,
        }),
        'success'
      );
      mutate();
    } catch {
      aviso(intl.formatMessage(messages.reviewError), 'error');
    }
  };

  const calcularNovedades = async () => {
    try {
      await axios.post('/api/biblioteca/novedades/calcular');
      aviso(intl.formatMessage(messages.newCalculated), 'success');
      mutate();
    } catch {
      aviso(intl.formatMessage(messages.newError), 'error');
    }
  };

  const probarQbt = async () => {
    try {
      const { data: r } = await axios.post<{ version: string }>(
        '/api/biblioteca/qbittorrent/probar',
        { qbittorrent: cuerpoQbt() }
      );
      aviso(
        intl.formatMessage(messages.qbtConnected, { version: r.version }),
        'success'
      );
    } catch (e) {
      aviso(
        axios.isAxiosError(e) && e.response?.data?.error
          ? intl.formatMessage(messages.qbtErrorDetail, {
              error: e.response.data.error,
            })
          : intl.formatMessage(messages.qbtError),
        'error'
      );
    }
  };

  const borrarAhora = async () => {
    if (!window.confirm(intl.formatMessage(messages.confirmRemoveNow))) {
      return;
    }
    try {
      await axios.post('/api/biblioteca/borrar');
      aviso(intl.formatMessage(messages.removeStarted), 'info');
      mutate();
    } catch {
      aviso(intl.formatMessage(messages.removeError), 'error');
    }
  };

  const cambiarTorrents = (cambio: Partial<Ejecucion['torrents']>) =>
    setEjecucion({
      ...ejecucion,
      torrents: { ...ejecucion.torrents, ...cambio },
    });

  const cambiarQbt = (cambio: Partial<Ejecucion['qbittorrent']>) =>
    setEjecucion({
      ...ejecucion,
      qbittorrent: { ...ejecucion.qbittorrent, ...cambio },
    });

  const numeroONulo = (v: string) => (v === '' ? null : Number(v));

  const claseInput =
    'block rounded-md border border-gray-500 bg-gray-700 text-white sm:text-sm';

  const cambiarUsuario = (id: number, campo: 'tieneVoto' | 'puedeGuardar') =>
    setUsuarios((us) =>
      us.map((u) => (u.id === id ? { ...u, [campo]: !u[campo] } : u))
    );

  const ultimoError = (texto?: string) =>
    texto && (
      <p className="mt-2 text-sm text-red-400">
        {intl.formatMessage(messages.lastError, { error: texto })}
      </p>
    );

  return (
    <div className="space-y-10">
      <SeccionPlegable
        id="ajustes-ejecucion"
        titulo={intl.formatMessage(messages.executionTitle)}
        className=""
      >
        <div className="mt-3 space-y-3">
          {MODOS.map((m) => (
            <div key={m.valor}>
              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  name="modo-ejecucion"
                  checked={ejecucion.modo === m.valor}
                  onChange={() => setEjecucion({ ...ejecucion, modo: m.valor })}
                />
                <span className="text-gray-200">
                  {intl.formatMessage(m.texto)}
                </span>
              </label>
              <p className="description ml-7">
                {intl.formatMessage(m.descripcion)}
              </p>
            </div>
          ))}
        </div>
        <p className="description mt-3">
          {intl.formatMessage(messages.executionNote)}
        </p>

        {ejecucion.modo === 'arr' && (
          <div className="mt-6 space-y-4">
            <label className="flex items-center space-x-3">
              <span className="text-gray-200">
                {intl.formatMessage(messages.removalTime)}
              </span>
              <select
                value={ejecucion.hora}
                onChange={(e) =>
                  setEjecucion({ ...ejecucion, hora: Number(e.target.value) })
                }
                className={`${claseInput} w-24`}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {`${String(h).padStart(2, '0')}:00`}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
              <Button
                buttonType="primary"
                onClick={borrarAhora}
                disabled={
                  data.borrador.enCurso || data.ejecucion.modo !== 'arr'
                }
              >
                <ArrowPathIcon
                  className={data.borrador.enCurso ? 'animate-spin' : undefined}
                />
                <span>
                  {intl.formatMessage(
                    data.borrador.enCurso
                      ? messages.removing
                      : messages.removeNow
                  )}
                </span>
              </Button>
              {data.borrador.ultima && (
                <span>
                  {intl.formatMessage(messages.lastRemoval, {
                    date: formatoFechaHora(intl, data.borrador.ultima),
                    removed: data.borrador.borrados ?? 0,
                    waiting: data.borrador.esperas ?? 0,
                    errors: data.borrador.errores ?? 0,
                  })}
                </span>
              )}
            </div>
            {ultimoError(data.borrador.error)}

            <h3 className="pt-2 text-gray-200">
              {intl.formatMessage(messages.torrentsTitle)}
            </h3>
            <p className="description">
              {intl.formatMessage(messages.torrentsDescription)}
            </p>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              <input
                type="text"
                placeholder="http://qbittorrent:8080"
                value={ejecucion.qbittorrent.url}
                onChange={(e) => cambiarQbt({ url: e.target.value })}
                className={claseInput}
              />
              <input
                type="text"
                placeholder={intl.formatMessage(messages.username)}
                autoComplete="off"
                value={ejecucion.qbittorrent.usuario}
                onChange={(e) => cambiarQbt({ usuario: e.target.value })}
                className={claseInput}
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder={intl.formatMessage(
                  ejecucion.qbittorrent.conContrasena &&
                    ejecucion.qbittorrent.url === data.ejecucion.qbittorrent.url
                    ? messages.passwordSaved
                    : messages.password
                )}
                value={contrasenaQbt}
                onChange={(e) => setContrasenaQbt(e.target.value)}
                className={claseInput}
              />
            </div>
            <div>
              <Button
                buttonType="default"
                onClick={probarQbt}
                disabled={!ejecucion.qbittorrent.url}
              >
                <span>{intl.formatMessage(messages.testConnection)}</span>
              </Button>
            </div>
            {ejecucion.qbittorrent.url && (
              <div className="space-y-3">
                {POLITICAS.map((p) => (
                  <label key={p.valor} className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="politica-torrents"
                      checked={ejecucion.torrents.politica === p.valor}
                      onChange={() => cambiarTorrents({ politica: p.valor })}
                    />
                    <span className="text-gray-200">
                      {intl.formatMessage(p.texto)}
                    </span>
                  </label>
                ))}
                {ejecucion.torrents.politica === 'esperar' && (
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={ejecucion.torrents.ratioMinimo ?? ''}
                        onChange={(e) =>
                          cambiarTorrents({
                            ratioMinimo: numeroONulo(e.target.value),
                          })
                        }
                        className={`${claseInput} w-24`}
                      />
                      <span className="text-gray-400">
                        {intl.formatMessage(messages.minRatio)}
                      </span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="number"
                        min={1}
                        value={ejecucion.torrents.horasMinimas ?? ''}
                        onChange={(e) =>
                          cambiarTorrents({
                            horasMinimas: numeroONulo(e.target.value),
                          })
                        }
                        className={`${claseInput} w-24`}
                      />
                      <span className="text-gray-400">
                        {intl.formatMessage(messages.seedingHours)}
                      </span>
                    </label>
                    <span className="description">
                      {intl.formatMessage(messages.waitHint)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SeccionPlegable>

      <SeccionPlegable
        id="ajustes-lista"
        titulo={intl.formatMessage(messages.listTitle)}
        className=""
      >
        <p className="description">
          {intl.formatMessage(messages.listDescription)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-300">
          <Button buttonType="primary" onClick={evaluar}>
            <ArrowPathIcon />
            <span>{intl.formatMessage(messages.reviewNow)}</span>
          </Button>
          {data.evaluacion.ultima && (
            <span>
              {intl.formatMessage(messages.lastRun, {
                date: formatoFechaHora(intl, data.evaluacion.ultima),
              })}
            </span>
          )}
        </div>
        {ultimoError(data.evaluacion.error)}
      </SeccionPlegable>

      <SeccionPlegable
        id="ajustes-borrado"
        titulo={intl.formatMessage(messages.historyTitle)}
        className=""
      >
        <Historial />
      </SeccionPlegable>

      <SeccionPlegable
        id="ajustes-novedades"
        titulo={intl.formatMessage(messages.newTitle)}
        className=""
      >
        <p className="description">
          {intl.formatMessage(messages.newDescription)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-300">
          <Button
            buttonType="primary"
            onClick={calcularNovedades}
            disabled={data.novedades.enCurso}
          >
            <ArrowPathIcon />
            <span>{intl.formatMessage(messages.calculateNow)}</span>
          </Button>
          {data.novedades.ultima && (
            <span>
              {intl.formatMessage(messages.lastNew, {
                date: formatoFechaHora(intl, data.novedades.ultima),
                count: data.novedades.novedades ?? 0,
                series: data.novedades.series ?? 0,
              })}
            </span>
          )}
        </div>
        {ultimoError(data.novedades.error)}
      </SeccionPlegable>

      <SeccionPlegable
        id="ajustes-sync"
        titulo={intl.formatMessage(messages.syncTitle)}
        className=""
      >
        <p className="description">
          {intl.formatMessage(messages.syncDescription)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-300">
          <Button
            buttonType="primary"
            disabled={data.sync.enCurso}
            onClick={sincronizar}
          >
            <ArrowPathIcon
              className={data.sync.enCurso ? 'animate-spin' : undefined}
            />
            <span>
              {intl.formatMessage(
                data.sync.enCurso ? messages.syncing : messages.syncNow
              )}
            </span>
          </Button>
          {data.sync.ultima && (
            <span>
              {intl.formatMessage(messages.lastSync, {
                date: formatoFechaHora(intl, data.sync.ultima),
                titles: textoTitulos(intl, data.sync.elementos ?? 0),
                seconds: intl.formatNumber((data.sync.duracionMs ?? 0) / 1000, {
                  maximumFractionDigits: 1,
                }),
              })}
            </span>
          )}
        </div>
        {ultimoError(data.sync.error)}
      </SeccionPlegable>

      <SeccionPlegable
        id="ajustes-bibliotecas"
        titulo={intl.formatMessage(messages.librariesTitle)}
        className=""
        resumen={intl.formatMessage(messages.librariesSummary, {
          included: bibliotecas.length,
          total: data.bibliotecas.length,
        })}
      >
        <p className="description">
          {intl.formatMessage(messages.librariesDescription)}
        </p>
        <ul className="mt-3 space-y-2">
          {data.bibliotecas.map((b) => (
            <li key={b.id} className="flex items-center space-x-3">
              <SlideCheckbox
                checked={bibliotecas.includes(b.id)}
                onClick={() =>
                  setBibliotecas((bs) =>
                    bs.includes(b.id)
                      ? bs.filter((x) => x !== b.id)
                      : [...bs, b.id]
                  )
                }
              />
              <span className="text-gray-200">{b.nombre}</span>
              <span className="text-xs text-gray-500">
                {intl.formatMessage(
                  b.tipo === 'movie'
                    ? globalMessages.movies
                    : globalMessages.tvshows
                )}
              </span>
            </li>
          ))}
        </ul>
      </SeccionPlegable>

      <SeccionPlegable
        id="ajustes-usuarios"
        titulo={intl.formatMessage(messages.usersTitle)}
        className=""
        resumen={intl.formatMessage(messages.usersSummary, {
          voters: usuarios.filter((u) => u.tieneVoto).length,
          total: usuarios.length,
        })}
      >
        <p className="description">
          {intl.formatMessage(messages.usersDescription)}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="py-2 pr-4">
                  {intl.formatMessage(messages.user)}
                </th>
                <th className="py-2 pr-4">
                  {intl.formatMessage(messages.lastActivity)}
                </th>
                <th className="py-2 pr-4">
                  {intl.formatMessage(messages.canVote)}
                </th>
                <th className="py-2 pr-4">
                  {intl.formatMessage(messages.canKeep)}
                </th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t border-gray-700">
                  <td className="py-2 pr-4 text-gray-200">{u.nombre}</td>
                  <td className="py-2 pr-4 text-gray-400">
                    {u.ultimaActividad
                      ? formatoFecha(intl, u.ultimaActividad)
                      : intl.formatMessage(messages.noData)}
                  </td>
                  <td className="py-2 pr-4">
                    <SlideCheckbox
                      checked={u.tieneVoto}
                      onClick={() => cambiarUsuario(u.id, 'tieneVoto')}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <SlideCheckbox
                      checked={u.puedeGuardar}
                      onClick={() => cambiarUsuario(u.id, 'puedeGuardar')}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SeccionPlegable>

      <SeccionPlegable
        id="ajustes-plazos"
        titulo={intl.formatMessage(messages.thresholdsTitle)}
        className=""
      >
        <div className="mt-3 space-y-3">
          {CAMPOS_PLAZO.map((c) => (
            <label key={c.clave} className="flex items-center space-x-3">
              <input
                type="number"
                min={1}
                max={3650}
                value={plazos[c.clave]}
                onChange={(e) =>
                  setPlazos({ ...plazos, [c.clave]: Number(e.target.value) })
                }
                className={`${claseInput} w-24`}
              />
              <span className="text-gray-400">
                {intl.formatMessage(c.unidad)}
              </span>
              <span className="text-gray-200">
                {intl.formatMessage(c.texto)}
              </span>
            </label>
          ))}
          <div className="pt-2">
            <label className="flex items-center space-x-3">
              <input
                type="text"
                maxLength={100}
                value={etiquetaRadarr}
                onChange={(e) => setEtiquetaRadarr(e.target.value)}
                className={`${claseInput} w-40`}
              />
              <span className="text-gray-200">
                {intl.formatMessage(messages.tagLabel)}
              </span>
            </label>
            <p className="description mt-1">
              {intl.formatMessage(messages.tagDescription)}
            </p>
          </div>
        </div>
      </SeccionPlegable>

      <div className="flex justify-end">
        <Button buttonType="primary" disabled={guardando} onClick={guardar}>
          <span>
            {intl.formatMessage(
              guardando ? globalMessages.saving : globalMessages.save
            )}
          </span>
        </Button>
      </div>
    </div>
  );
};

export default AjustesBiblioteca;
