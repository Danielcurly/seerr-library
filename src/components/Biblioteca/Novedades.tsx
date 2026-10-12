import SeccionPlegable from '@app/components/Biblioteca/SeccionPlegable';
import type {
  NovedadSerie,
  NovedadesRespuesta,
  ProximaSerie,
  TemporadaNovedad,
} from '@app/components/Biblioteca/comun';
import { formatoFecha, temporadaCorta } from '@app/components/Biblioteca/comun';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import Tooltip from '@app/components/Common/Tooltip';
import RequestModal from '@app/components/RequestModal';
import Slider from '@app/components/Slider';
import TmdbTitleCard from '@app/components/TitleCard/TmdbTitleCard';
import useToasts from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import {
  ArrowDownTrayIcon,
  ArrowRightCircleIcon,
  BellSlashIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
} from '@heroicons/react/24/solid';
import axios from 'axios';
import Link from 'next/link';
import { useState } from 'react';
import type { IntlShape } from 'react-intl';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

// Novedades de las series que veo: lo que ha salido (descargado o no, para
// verlo en Jellyfin/Emby o pedirlo) y lo que está por salir.

const messages = defineMessages('components.Biblioteca.Novedades', {
  seasonComplete: '{season} complete',
  seasonEpisodes:
    '{season} · {count, plural, one {# episode} other {# episodes}}',
  seasonEpisode: '{season} · episode {episode}',
  seasonEpisodeRange: '{season} · episodes {from} to {to}',
  seasonsComplete: '{first} to {last} complete',
  statusAvailable: 'Available to watch',
  statusRequested: '{count, plural, one {Requested} other {Requested}}',
  statusWaiting: 'Waiting for download',
  statusPartial: '{downloaded} of {aired} downloaded',
  statusMissing: 'Not downloaded',
  muteTooltip: 'Stop notifying me about this series',
  muteTitle: 'Stop notifications',
  muteConfirm: 'Stop notifications',
  muteText:
    'You will no longer be notified about new seasons or episodes of this series. You can turn notifications back on in <strong>My Activity</strong>.',
  muted:
    'You will no longer be notified about {title}. You can undo this in My Activity.',
  saveError: 'The change could not be saved.',
  playTooltip: 'Play in Jellyfin/Emby',
  play: 'Play',
  requestTooltip: 'Request download',
  season: 'Season {season}',
  noDate: 'No date',
  loadError: 'New episodes could not be loaded.',
  intro:
    'New releases from the series you watch in Jellyfin/Emby, even if they are no longer stored. Downloaded content can be played; anything else can be requested. Once you start watching, it no longer appears here.',
  outTitle: 'Released',
  series: '{count, plural, one {# series} other {# series}}',
  outEmpty:
    'There is nothing new from the series you watch. New seasons and episodes will appear here when they are released.',
  upcomingTitle: 'Upcoming',
  upcomingDescription:
    'Series you watch with a scheduled date for their next season or episode.',
  sliderTitle: 'New Episodes of Your Series',
});

const URL_NOVEDADES = '/api/biblioteca/novedades';

const textoEpisodios = (intl: IntlShape, t: TemporadaNovedad): string => {
  const season = temporadaCorta(intl, t.temporada);
  const n = t.hasta - t.desde + 1;
  if (t.desde === 1 && t.completa) {
    return intl.formatMessage(messages.seasonComplete, { season });
  }
  if (t.desde === 1) {
    return intl.formatMessage(messages.seasonEpisodes, { season, count: n });
  }
  return t.desde === t.hasta
    ? intl.formatMessage(messages.seasonEpisode, { season, episode: t.desde })
    : intl.formatMessage(messages.seasonEpisodeRange, {
        season,
        from: t.desde,
        to: t.hasta,
      });
};

type EstadoDescarga = 'disco' | 'parcial' | 'pedida' | 'espera' | 'no';

// Pedida = petición pendiente de aprobar; espera = Sonarr ya la vigila y
// aún no ha bajado (no hace falta pedirla)
const estadoDe = (t: TemporadaNovedad): EstadoDescarga =>
  t.emitidos > 0 && t.descargados >= t.emitidos
    ? 'disco'
    : t.pedida
      ? 'pedida'
      : t.descargados > 0
        ? 'parcial'
        : t.esperando
          ? 'espera'
          : 'no';

// Temporadas seguidas, enteras y en el mismo estado van en una sola línea
// ("T15 a T18 completas"): una serie con muchas temporadas nuevas no alarga
// la tarjeta
interface Grupo {
  primera: TemporadaNovedad;
  ultima: TemporadaNovedad;
}

const agrupar = (temporadas: TemporadaNovedad[]): Grupo[] => {
  const r: Grupo[] = [];
  for (const t of temporadas) {
    const g = r[r.length - 1];
    const entera = (x: TemporadaNovedad) => x.desde === 1 && x.completa;
    if (
      g &&
      entera(g.ultima) &&
      entera(t) &&
      t.temporada === g.ultima.temporada + 1 &&
      estadoDe(t) === estadoDe(g.ultima) &&
      estadoDe(t) !== 'parcial'
    ) {
      g.ultima = t;
    } else {
      r.push({ primera: t, ultima: t });
    }
  }
  return r;
};

const EstadoTemporada = ({ grupo }: { grupo: Grupo }) => {
  const intl = useIntl();
  const t = grupo.primera;
  const varias = grupo.ultima !== grupo.primera;
  const estado = estadoDe(t);
  const [clase, icono, texto] =
    estado === 'disco'
      ? [
          'text-green-400',
          <CheckCircleIcon key="i" className="mr-1 h-4 w-4 flex-shrink-0" />,
          intl.formatMessage(messages.statusAvailable),
        ]
      : estado === 'pedida'
        ? [
            'text-indigo-300',
            <ClockIcon key="i" className="mr-1 h-4 w-4 flex-shrink-0" />,
            intl.formatMessage(messages.statusRequested, {
              count: varias ? 2 : 1,
            }),
          ]
        : estado === 'espera'
          ? [
              'text-indigo-300',
              <ClockIcon key="i" className="mr-1 h-4 w-4 flex-shrink-0" />,
              intl.formatMessage(messages.statusWaiting),
            ]
          : estado === 'parcial'
            ? [
                'text-yellow-400',
                <ArrowDownTrayIcon
                  key="i"
                  className="mr-1 h-4 w-4 flex-shrink-0"
                />,
                intl.formatMessage(messages.statusPartial, {
                  downloaded: t.descargados,
                  aired: t.emitidos,
                }),
              ]
            : [
                'text-gray-400',
                <ArrowDownTrayIcon
                  key="i"
                  className="mr-1 h-4 w-4 flex-shrink-0"
                />,
                intl.formatMessage(messages.statusMissing),
              ];
  return (
    <div className="text-xs">
      <div className="font-semibold text-gray-200">
        {varias
          ? intl.formatMessage(messages.seasonsComplete, {
              first: temporadaCorta(intl, t.temporada),
              last: temporadaCorta(intl, grupo.ultima.temporada),
            })
          : textoEpisodios(intl, t)}
      </div>
      <div className={`flex items-center ${clase}`}>
        {icono}
        {texto}
      </div>
    </div>
  );
};

// "No avisarme más" de una serie, con confirmación
const BotonSilenciar = ({
  serie,
  onHecho,
}: {
  serie: { tmdbId: number; titulo: string };
  onHecho: () => void;
}) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const silenciar = async () => {
    setEnviando(true);
    try {
      await axios.post('/api/biblioteca/novedades/silenciar', {
        tmdbId: serie.tmdbId,
        silenciar: true,
      });
      addToast(intl.formatMessage(messages.muted, { title: serie.titulo }), {
        appearance: 'info',
        autoDismiss: true,
      });
      setAbierto(false);
      onHecho();
    } catch {
      addToast(intl.formatMessage(messages.saveError), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Tooltip content={intl.formatMessage(messages.muteTooltip)}>
        <button
          type="button"
          aria-label={intl.formatMessage(messages.muteTooltip)}
          onClick={() => setAbierto(true)}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-gray-700 text-gray-300 transition hover:bg-gray-600 hover:text-white"
        >
          <BellSlashIcon className="h-4 w-4" />
        </button>
      </Tooltip>
      <Transition
        as="div"
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        show={abierto}
      >
        {abierto && (
          <Modal
            title={intl.formatMessage(messages.muteTitle)}
            subTitle={serie.titulo}
            onCancel={() => setAbierto(false)}
            cancelText={intl.formatMessage(globalMessages.cancel)}
            onOk={silenciar}
            okText={intl.formatMessage(messages.muteConfirm)}
            okDisabled={enviando}
          >
            <p className="text-sm text-gray-300">
              {intl.formatMessage(messages.muteText, {
                strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
              })}
            </p>
          </Modal>
        )}
      </Transition>
    </>
  );
};

// Una serie con novedades: póster de Seerr, cada temporada nueva con su
// estado y los botones para verla, pedirla o dejar de recibir avisos
export const TarjetaNovedad = ({
  serie,
  onCambio,
}: {
  serie: NovedadSerie;
  onCambio: () => void;
}) => {
  const intl = useIntl();
  const { hasPermission } = useUser();
  const [pidiendo, setPidiendo] = useState(false);
  const puedePedir = hasPermission(
    [Permission.REQUEST, Permission.REQUEST_TV],
    {
      type: 'or',
    }
  );
  // Algo descargado que se pueda ver ya (lo pedido aún no)
  const paraVer = serie.temporadas.some((t) => t.descargados > 0);
  const falta = serie.temporadas.some(
    (t) => estadoDe(t) === 'no' || (estadoDe(t) === 'parcial' && !t.esperando)
  );

  return (
    <div>
      <TmdbTitleCard
        id={serie.mediaId ?? 0}
        tmdbId={serie.tmdbId}
        tvdbId={serie.tvdbId ?? undefined}
        type="tv"
        canExpand
      />
      <div className="mt-1 space-y-1">
        {agrupar(serie.temporadas).map((g) => (
          <EstadoTemporada key={g.primera.temporada} grupo={g} />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1">
        {paraVer && serie.embyUrl && (
          <Tooltip content={intl.formatMessage(messages.playTooltip)}>
            <a
              href={serie.embyUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={intl.formatMessage(messages.playTooltip)}
              className="flex h-8 flex-1 items-center justify-center rounded-md bg-green-700 px-2 text-xs font-semibold text-white transition hover:bg-green-600"
            >
              <PlayIcon className="mr-1 h-4 w-4" />
              {intl.formatMessage(messages.play)}
            </a>
          </Tooltip>
        )}
        {falta && puedePedir && (
          <Tooltip content={intl.formatMessage(messages.requestTooltip)}>
            <button
              type="button"
              aria-label={intl.formatMessage(messages.requestTooltip)}
              onClick={() => setPidiendo(true)}
              className="flex h-8 flex-1 items-center justify-center rounded-md bg-indigo-600 px-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
            >
              <ArrowDownTrayIcon className="mr-1 h-4 w-4" />
              {intl.formatMessage(globalMessages.request)}
            </button>
          </Tooltip>
        )}
        <BotonSilenciar serie={serie} onHecho={onCambio} />
      </div>
      <RequestModal
        show={pidiendo}
        type="tv"
        tmdbId={serie.tmdbId}
        onComplete={() => {
          setPidiendo(false);
          onCambio();
        }}
        onCancel={() => setPidiendo(false)}
      />
    </div>
  );
};

const TarjetaProxima = ({
  serie,
  onCambio,
}: {
  serie: ProximaSerie;
  onCambio: () => void;
}) => {
  const intl = useIntl();
  return (
    <div>
      <TmdbTitleCard
        id={serie.mediaId ?? 0}
        tmdbId={serie.tmdbId}
        tvdbId={serie.tvdbId ?? undefined}
        type="tv"
        canExpand
      />
      <div className="mt-1 text-xs">
        <div className="font-semibold text-gray-200">
          {serie.episodio === 1
            ? intl.formatMessage(messages.season, { season: serie.temporada })
            : intl.formatMessage(messages.seasonEpisode, {
                season: temporadaCorta(intl, serie.temporada),
                episode: serie.episodio,
              })}
        </div>
        <div className="flex items-center text-gray-400">
          <CalendarDaysIcon className="mr-1 h-4 w-4 flex-shrink-0" />
          {serie.fecha
            ? formatoFecha(intl, serie.fecha)
            : intl.formatMessage(messages.noDate)}
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <BotonSilenciar serie={serie} onHecho={onCambio} />
      </div>
    </div>
  );
};

// Pestaña "Novedades" de la Biblioteca
const Novedades = () => {
  const intl = useIntl();
  const { data, error, mutate } = useSWR<NovedadesRespuesta>(URL_NOVEDADES);

  if (error) {
    return (
      <p className="text-red-400">{intl.formatMessage(messages.loadError)}</p>
    );
  }
  if (!data) {
    return <LoadingSpinner />;
  }

  const recargar = () => mutate();

  return (
    <>
      <p className="mb-6 text-gray-300">{intl.formatMessage(messages.intro)}</p>
      <SeccionPlegable
        id="novedades-nuevas"
        titulo={intl.formatMessage(messages.outTitle)}
        grande
        resumen={intl.formatMessage(messages.series, {
          count: data.nuevas.length,
        })}
      >
        {data.nuevas.length ? (
          <ul className="cards-vertical">
            {data.nuevas.map((s) => (
              <li key={s.tmdbId}>
                <TarjetaNovedad serie={s} onCambio={recargar} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400">
            {intl.formatMessage(messages.outEmpty)}
          </p>
        )}
      </SeccionPlegable>
      {data.proximas.length > 0 && (
        <SeccionPlegable
          id="novedades-proximas"
          titulo={intl.formatMessage(messages.upcomingTitle)}
          grande
          resumen={intl.formatMessage(messages.series, {
            count: data.proximas.length,
          })}
        >
          <p className="mb-4 text-sm text-gray-400">
            {intl.formatMessage(messages.upcomingDescription)}
          </p>
          <ul className="cards-vertical">
            {data.proximas.map((s) => (
              <li key={s.tmdbId}>
                <TarjetaProxima serie={s} onCambio={recargar} />
              </li>
            ))}
          </ul>
        </SeccionPlegable>
      )}
    </>
  );
};

// Primera fila de Descubrir: solo si hay algo nuevo
export const NovedadesSlider = () => {
  const intl = useIntl();
  const { data, mutate } = useSWR<NovedadesRespuesta>(URL_NOVEDADES, {
    revalidateOnMount: true,
  });

  if (!data || !data.nuevas.length) return null;

  return (
    <>
      <div className="slider-header">
        <Link href="/biblioteca/novedades" className="slider-title">
          <span>{intl.formatMessage(messages.sliderTitle)}</span>
          <ArrowRightCircleIcon />
        </Link>
      </div>
      <Slider
        sliderKey="biblioteca-novedades"
        isLoading={false}
        items={data.nuevas.map((s) => (
          <div key={s.tmdbId} className="w-36 sm:w-36 md:w-44">
            <TarjetaNovedad serie={s} onCambio={() => mutate()} />
          </div>
        ))}
      />
    </>
  );
};

export default Novedades;
