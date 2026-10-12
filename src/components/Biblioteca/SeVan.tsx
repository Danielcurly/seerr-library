import type {
  ElementoBiblioteca,
  EstadoBiblioteca,
} from '@app/components/Biblioteca/comun';
import {
  claseCuentaAtras,
  formatoTamano,
  temporadaCorta,
  textoCuentaAtras,
  textoMotivo,
  textoTitulos,
} from '@app/components/Biblioteca/comun';
import SeccionPlegable from '@app/components/Biblioteca/SeccionPlegable';
import TarjetaBiblioteca from '@app/components/Biblioteca/TarjetaBiblioteca';
import Alert from '@app/components/Common/Alert';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Biblioteca.SeVan', {
  loadError: 'The list could not be loaded.',
  notifyOnlyTitle: 'Notification-only mode',
  notifyOnlyText:
    'Nothing is removed yet: when a countdown ends, the title is only recorded in the removal history.',
  intro:
    'Titles in this list are removed when their countdown ends ({days, plural, one {# day} other {# days}}), unless someone marks them as <strong>Keep</strong> or <strong>Watch later</strong>. If a title does not interest you, mark it as <strong>Not interested</strong>. While someone is watching a series, its countdown is paused until they finish it.',
  awaitingYourVote:
    '{count, plural, one {# awaiting your vote} other {# awaiting your vote}}',
  awaitingVote: 'Awaiting your vote',
  empty: 'There are no titles pending removal.',
  requestedTitle: 'Requested by users',
  requestedDescription:
    'A user requested their removal, or several users marked them as not interested.',
  inactiveTitle: 'Not watched recently',
  inactiveDescription:
    'Not watched for more than {months, plural, one {# month} other {# months}} (or since they were downloaded, if never watched). A few titles are added each week, oldest first.',
});

interface ElementoSeVan extends ElementoBiblioteca {
  pendiente: boolean;
  tamanoEnLista: number;
}

interface SeVanRespuesta {
  resultados: ElementoSeVan[];
  totalTamano: number;
  pendientes: number;
}

// Una seccion de la lista, con su cuenta atras, el motivo y los votos
const Seccion = ({
  id,
  titulo,
  descripcion,
  elementos,
  onCambio,
}: {
  id: string;
  titulo: string;
  descripcion: string;
  elementos: ElementoSeVan[];
  onCambio: () => void;
}) => {
  const intl = useIntl();
  if (!elementos.length) return null;
  return (
    <SeccionPlegable
      id={id}
      titulo={titulo}
      grande
      resumen={`${textoTitulos(intl, elementos.length)} · ${formatoTamano(
        intl,
        elementos.reduce((s, e) => s + e.tamanoEnLista, 0)
      )}`}
    >
      <p className="mb-4 text-sm text-gray-400">{descripcion}</p>
      <ul className="cards-vertical">
        {elementos.map((e) => (
          <li key={e.embyId}>
            {e.pendiente && (
              <div className="mb-1 text-xs font-semibold text-yellow-400">
                {intl.formatMessage(messages.awaitingVote)}
              </div>
            )}
            <TarjetaBiblioteca elemento={e} onCambio={onCambio} modo="seVan" />
            <div className="mt-2 space-y-1 text-xs text-gray-400">
              {e.candidatas.map((c) => (
                <div key={c.temporada}>
                  {e.tipo === 'tv' && (
                    <span className="text-gray-200">
                      {temporadaCorta(intl, c.temporada)}:{' '}
                    </span>
                  )}
                  <span className={claseCuentaAtras(c)}>
                    {textoCuentaAtras(intl, c)}
                  </span>
                  {e.tipo === 'tv' && ` · ${formatoTamano(intl, c.tamano)}`}
                  <div>{textoMotivo(intl, c, e.ultimaReproduccion)}</div>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </SeccionPlegable>
  );
};

// Pendientes de borrado: primero lo pedido por los usuarios, despues lo que
// entra por llevar mucho tiempo sin verse
const SeVan = () => {
  const intl = useIntl();
  const { data: estado, mutate: mutateEstado } = useSWR<EstadoBiblioteca>(
    '/api/biblioteca/estado'
  );
  const { data, error, mutate } = useSWR<SeVanRespuesta>(
    '/api/biblioteca/se-van'
  );

  if (error) {
    return (
      <p className="text-red-400">{intl.formatMessage(messages.loadError)}</p>
    );
  }
  if (!data || !estado) {
    return <LoadingSpinner />;
  }

  // Tras votar se recarga la lista: una candidata salvada desaparece
  const actualizar = () => {
    mutate();
    mutateEstado();
  };

  const yo = estado.usuario;
  const sinUso = (e: ElementoSeVan) =>
    e.candidatas.every((c) => c.motivo === 'C');

  return (
    <>
      {estado.simulacro && (
        <div className="mb-6">
          <Alert
            type="info"
            title={intl.formatMessage(messages.notifyOnlyTitle)}
          >
            {intl.formatMessage(messages.notifyOnlyText)}
          </Alert>
        </div>
      )}
      <p className="mb-2 text-gray-300">
        {intl.formatMessage(messages.intro, {
          days: estado.plazos.listaDias,
          strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
        })}
      </p>
      <p className="mb-6 text-sm text-gray-400">
        {textoTitulos(intl, data.resultados.length)} ·{' '}
        {formatoTamano(intl, data.totalTamano)}
        {yo.tieneVoto && data.pendientes > 0
          ? ` · ${intl.formatMessage(messages.awaitingYourVote, {
              count: data.pendientes,
            })}`
          : ''}
      </p>

      {data.resultados.length === 0 ? (
        <p className="mt-16 text-center text-xl text-gray-400">
          {intl.formatMessage(messages.empty)}
        </p>
      ) : (
        <>
          <Seccion
            id="seVan-familia"
            titulo={intl.formatMessage(messages.requestedTitle)}
            descripcion={intl.formatMessage(messages.requestedDescription)}
            elementos={data.resultados.filter((e) => !sinUso(e))}
            onCambio={actualizar}
          />
          <Seccion
            id="seVan-antiguas"
            titulo={intl.formatMessage(messages.inactiveTitle)}
            descripcion={intl.formatMessage(messages.inactiveDescription, {
              months: estado.plazos.antiguedadMeses,
            })}
            elementos={data.resultados.filter(sinUso)}
            onCambio={actualizar}
          />
        </>
      )}
    </>
  );
};

export default SeVan;
