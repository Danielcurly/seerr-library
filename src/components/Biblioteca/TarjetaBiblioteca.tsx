import type { ModoAcciones } from '@app/components/Biblioteca/AccionesElemento';
import AccionesElemento from '@app/components/Biblioteca/AccionesElemento';
import type { ElementoBiblioteca } from '@app/components/Biblioteca/comun';
import {
  claseCuentaAtras,
  formatoTamano,
  temporadaCorta,
  textoCuentaAtras,
} from '@app/components/Biblioteca/comun';
import TmdbTitleCard from '@app/components/TitleCard/TmdbTitleCard';
import defineMessages from '@app/utils/defineMessages';
import {
  CheckCircleIcon,
  ClockIcon,
  LockClosedIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/solid';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Biblioteca.TarjetaBiblioteca', {
  watched: 'Watched',
  inProgress: 'In progress',
  seasonsWatched: '{watched}/{total} seasons',
  notWatched: 'Not watched',
  kept: 'Kept',
});

type TarjetaBibliotecaProps = {
  elemento: ElementoBiblioteca;
  // Texto extra bajo la tarjeta (p. ej. fecha de descarga)
  detalle?: string;
  // Con esto se muestran los botones de voto
  onCambio?: (e: ElementoBiblioteca) => void;
  modo?: ModoAcciones;
};

const EstadoMio = ({ elemento }: { elemento: ElementoBiblioteca }) => {
  const intl = useIntl();
  const t = elemento.temporadas;
  if (elemento.miEstado === 'visto') {
    return (
      <span className="flex items-center text-green-400">
        <CheckCircleIcon className="mr-1 h-4 w-4" />
        {intl.formatMessage(messages.watched)}
      </span>
    );
  }
  if (elemento.miEstado === 'empezado') {
    return (
      <span className="flex items-center text-yellow-400">
        <PlayCircleIcon className="mr-1 h-4 w-4" />
        {t && t.total > 1
          ? intl.formatMessage(messages.seasonsWatched, {
              watched: t.vistas,
              total: t.total,
            })
          : intl.formatMessage(messages.inProgress)}
      </span>
    );
  }
  return (
    <span className="text-gray-500">
      {intl.formatMessage(messages.notWatched)}
    </span>
  );
};

// La candidata que vence antes y, en series, que temporadas estan en la lista
const EnLista = ({ elemento }: { elemento: ElementoBiblioteca }) => {
  const intl = useIntl();
  if (!elemento.candidatas.length) return null;
  const primera = [...elemento.candidatas].sort(
    (a, b) => new Date(a.vence).getTime() - new Date(b.vence).getTime()
  )[0];
  const temporadas =
    elemento.tipo === 'tv'
      ? `${elemento.candidatas
          .map((c) => temporadaCorta(intl, c.temporada))
          .join(', ')} · `
      : '';
  return (
    <div className={`flex items-center text-xs ${claseCuentaAtras(primera)}`}>
      <ClockIcon className="mr-1 h-4 w-4 flex-shrink-0" />
      {temporadas}
      {textoCuentaAtras(intl, primera)}
    </div>
  );
};

// Tarjeta de Seerr (póster, estado, enlace a la ficha) con mi estado de visto,
// el tamaño, su situación en la lista y los botones de voto.
const TarjetaBiblioteca = ({
  elemento,
  detalle,
  onCambio,
  modo,
}: TarjetaBibliotecaProps) => {
  const intl = useIntl();
  return (
    <div>
      {elemento.tmdbId ? (
        <TmdbTitleCard
          id={elemento.mediaId ?? 0}
          tmdbId={elemento.tmdbId}
          tvdbId={elemento.tvdbId ?? undefined}
          type={elemento.tipo}
          canExpand
        />
      ) : (
        <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-gray-800 p-2 text-center text-sm text-gray-300 ring-1 ring-gray-700">
          {elemento.titulo}
        </div>
      )}
      <div className="mt-1 flex items-center justify-between text-xs">
        <EstadoMio elemento={elemento} />
        <span className="text-gray-400">
          {formatoTamano(intl, elemento.tamano)}
        </span>
      </div>
      {/* En Pendientes de borrado la cuenta atrás va debajo, con su motivo */}
      {modo !== 'seVan' && <EnLista elemento={elemento} />}
      {elemento.guardada && (
        <div className="flex items-center text-xs text-green-400">
          <LockClosedIcon className="mr-1 h-4 w-4" />
          {intl.formatMessage(messages.kept)}
        </div>
      )}
      {detalle && <div className="text-xs text-gray-500">{detalle}</div>}
      {onCambio && (
        <AccionesElemento elemento={elemento} onCambio={onCambio} modo={modo} />
      )}
    </div>
  );
};

export default TarjetaBiblioteca;
