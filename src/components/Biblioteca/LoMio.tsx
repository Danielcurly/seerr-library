import type { ElementoBiblioteca } from '@app/components/Biblioteca/comun';
import { formatoFecha, textoTitulos } from '@app/components/Biblioteca/comun';
import SeccionPlegable from '@app/components/Biblioteca/SeccionPlegable';
import TarjetaBiblioteca from '@app/components/Biblioteca/TarjetaBiblioteca';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import TmdbTitleCard from '@app/components/TitleCard/TmdbTitleCard';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import { BellIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Biblioteca.LoMio', {
  loadError: 'Your activity could not be loaded.',
  notifyAgain: 'You will be notified again about {title}.',
  saveError: 'The change could not be saved.',
  keptTitle: 'Kept',
  keptEmpty:
    'You have not kept any titles. Kept titles are not removed until the mark is cleared.',
  watchLaterTitle: 'Watch later',
  watchLaterEmpty: 'Your watch later list is empty.',
  removeTitle: 'Removal requested',
  removeEmpty: 'You have not requested the removal of any title.',
  requestedAvailableTitle: 'My requests in the library',
  requestedNoneAvailable: 'None of your requests has been downloaded yet.',
  requestedNone: 'You have not made any requests yet.',
  requestedPendingTitle:
    'My requests not yet downloaded or outside the library',
  requestedOn: 'Requested: {date}',
  mutedTitle: 'Series without new episode notifications',
  mutedDescription:
    'You chose not to receive New Episodes notifications for these series.',
  notifyMe: 'Notify me again',
});

interface MiPeticion {
  peticionId: number;
  fechaPeticion: string;
  estadoPeticion: number;
  mediaId: number;
  tipo: 'movie' | 'tv';
  tmdbId: number;
  tvdbId: number | null;
  elemento: ElementoBiblioteca | null;
}

interface LoMioRespuesta {
  resultados: MiPeticion[];
  guardadas: ElementoBiblioteca[];
  borrar: ElementoBiblioteca[];
  quieroVer: ElementoBiblioteca[];
  // Series de las que pedí no recibir más novedades
  silenciadas: { tmdbId: number; tvdbId: number | null; titulo: string }[];
}

const Seccion = ({
  id,
  titulo,
  vacio,
  elementos,
  onCambio,
}: {
  id: string;
  titulo: string;
  vacio: string;
  elementos: ElementoBiblioteca[];
  onCambio: () => void;
}) => {
  const intl = useIntl();
  return (
    <SeccionPlegable
      id={id}
      titulo={titulo}
      resumen={textoTitulos(intl, elementos.length)}
    >
      {elementos.length ? (
        <ul className="cards-vertical">
          {elementos.map((e) => (
            <li key={e.embyId}>
              <TarjetaBiblioteca elemento={e} onCambio={onCambio} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400">{vacio}</p>
      )}
    </SeccionPlegable>
  );
};

// Lo que he marcado y lo que he pedido en Seerr, con mi estado de visto
const LoMio = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { data, error, mutate } = useSWR<LoMioRespuesta>(
    '/api/biblioteca/lo-mio'
  );

  if (error) {
    return (
      <p className="text-red-400">{intl.formatMessage(messages.loadError)}</p>
    );
  }
  if (!data) {
    return <LoadingSpinner />;
  }

  const enBiblioteca = data.resultados.filter((p) => p.elemento);
  const pendientes = data.resultados.filter((p) => !p.elemento);

  const recargar = () => mutate();

  const volverAAvisar = async (tmdbId: number, titulo: string) => {
    try {
      await axios.post('/api/biblioteca/novedades/silenciar', {
        tmdbId,
        silenciar: false,
      });
      addToast(intl.formatMessage(messages.notifyAgain, { title: titulo }), {
        appearance: 'success',
        autoDismiss: true,
      });
      mutate();
    } catch {
      addToast(intl.formatMessage(messages.saveError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  return (
    <>
      <Seccion
        id="loMio-guardadas"
        titulo={intl.formatMessage(messages.keptTitle)}
        vacio={intl.formatMessage(messages.keptEmpty)}
        elementos={data.guardadas}
        onCambio={recargar}
      />
      <Seccion
        id="loMio-quieroVer"
        titulo={intl.formatMessage(messages.watchLaterTitle)}
        vacio={intl.formatMessage(messages.watchLaterEmpty)}
        elementos={data.quieroVer}
        onCambio={recargar}
      />
      <Seccion
        id="loMio-borrar"
        titulo={intl.formatMessage(messages.removeTitle)}
        vacio={intl.formatMessage(messages.removeEmpty)}
        elementos={data.borrar}
        onCambio={recargar}
      />

      <SeccionPlegable
        id="loMio-pedidas"
        titulo={intl.formatMessage(messages.requestedAvailableTitle)}
        resumen={textoTitulos(intl, enBiblioteca.length)}
      >
        {enBiblioteca.length ? (
          <ul className="cards-vertical">
            {enBiblioteca.map((p) => (
              <li key={p.peticionId}>
                <TarjetaBiblioteca
                  elemento={p.elemento as ElementoBiblioteca}
                  detalle={intl.formatMessage(messages.requestedOn, {
                    date: formatoFecha(intl, p.fechaPeticion),
                  })}
                  onCambio={recargar}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400">
            {intl.formatMessage(
              data.resultados.length
                ? messages.requestedNoneAvailable
                : messages.requestedNone
            )}
          </p>
        )}
      </SeccionPlegable>

      {pendientes.length > 0 && (
        <SeccionPlegable
          id="loMio-pendientes"
          titulo={intl.formatMessage(messages.requestedPendingTitle)}
          resumen={textoTitulos(intl, pendientes.length)}
        >
          <ul className="cards-vertical">
            {pendientes.map((p) => (
              <li key={p.peticionId}>
                <TmdbTitleCard
                  id={p.mediaId}
                  tmdbId={p.tmdbId}
                  tvdbId={p.tvdbId ?? undefined}
                  type={p.tipo}
                  canExpand
                />
                <div className="mt-1 text-xs text-gray-500">
                  {intl.formatMessage(messages.requestedOn, {
                    date: formatoFecha(intl, p.fechaPeticion),
                  })}
                </div>
              </li>
            ))}
          </ul>
        </SeccionPlegable>
      )}

      {data.silenciadas.length > 0 && (
        <SeccionPlegable
          id="loMio-silenciadas"
          titulo={intl.formatMessage(messages.mutedTitle)}
          resumen={textoTitulos(intl, data.silenciadas.length)}
        >
          <p className="mb-4 text-sm text-gray-400">
            {intl.formatMessage(messages.mutedDescription)}
          </p>
          <ul className="cards-vertical">
            {data.silenciadas.map((s) => (
              <li key={s.tmdbId}>
                <TmdbTitleCard
                  id={0}
                  tmdbId={s.tmdbId}
                  tvdbId={s.tvdbId ?? undefined}
                  type="tv"
                  canExpand
                />
                <Button
                  buttonType="ghost"
                  buttonSize="sm"
                  className="mt-2 w-full"
                  onClick={() => volverAAvisar(s.tmdbId, s.titulo)}
                >
                  <BellIcon />
                  <span>{intl.formatMessage(messages.notifyMe)}</span>
                </Button>
              </li>
            ))}
          </ul>
        </SeccionPlegable>
      )}
    </>
  );
};

export default LoMio;
