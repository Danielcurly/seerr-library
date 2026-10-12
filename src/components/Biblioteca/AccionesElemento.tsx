import type {
  ElementoBiblioteca,
  EstadoBiblioteca,
  TipoMarca,
} from '@app/components/Biblioteca/comun';
import { temporadaCorta } from '@app/components/Biblioteca/comun';
import Modal from '@app/components/Common/Modal';
import Tooltip from '@app/components/Common/Tooltip';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import {
  BookmarkIcon,
  EyeSlashIcon,
  LockClosedIcon,
  QueueListIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { useState } from 'react';
import type { MessageDescriptor } from 'react-intl';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

export const messages = defineMessages(
  'components.Biblioteca.AccionesElemento',
  {
    removeLabel: 'Request removal (adds it to Pending Removal)',
    removeTitle: 'Request removal',
    removeExplanation:
      'The title is added to Pending Removal immediately. Unless someone keeps it, it is removed when its countdown ends.',
    removeUndo: 'Withdraw removal request',
    notInterestedLabel: 'Not interested (you will not watch it)',
    notInterestedTitle: 'Not interested',
    notInterestedExplanation:
      'Indicates that you will not watch it. It counts as a vote: when enough users mark a title as not interested, it is added to Pending Removal.',
    notInterestedUndo: 'Clear "Not interested"',
    watchLaterLabel: 'Watch later (postpones its removal)',
    watchLaterTitle: 'Watch later',
    watchLaterExplanation:
      'Prevents the title from being removed while you intend to watch it. Once you watch it, or after some time, it can be removed again.',
    watchLaterUndo: 'Clear "Watch later"',
    keepLabel: 'Keep (never remove)',
    keepTitle: 'Keep',
    keepExplanation: 'The title is not removed while it is marked as kept.',
    keepUndo: 'Stop keeping',
    forceLabel: 'Add to Pending Removal (administrator)',
    forceTitle: 'Add to Pending Removal',
    forceExplanation:
      'Adds the title to Pending Removal with a full countdown (administrators only).',
    undoMovie: 'Removes your "{action}" mark from this movie.',
    seasons: 'Seasons:',
    apply: 'Apply',
    ok: 'OK',
    saveError: 'The change could not be saved.',
  }
);

export interface Accion {
  tipo: TipoMarca;
  texto: MessageDescriptor;
  // Titulo corto del dialogo de series y del aviso (el texto largo no cabe en
  // el movil)
  titulo: MessageDescriptor;
  // Lo que hace, para quien no lo conoce (aviso del primer toque y dialogo de
  // series)
  explicacion: MessageDescriptor;
  // Texto del boton cuando ya esta marcada
  quitar: MessageDescriptor;
  icono: React.ReactNode;
  // Color cuando esta marcada
  activo: string;
}

export const PEDIR_BORRAR: Accion = {
  tipo: 'borrar',
  texto: messages.removeLabel,
  titulo: messages.removeTitle,
  explicacion: messages.removeExplanation,
  quitar: messages.removeUndo,
  icono: <TrashIcon className="h-5 w-5" />,
  activo: 'bg-red-600 text-white',
};

export const NO_INTERESA: Accion = {
  tipo: 'no_interesa',
  texto: messages.notInterestedLabel,
  titulo: messages.notInterestedTitle,
  explicacion: messages.notInterestedExplanation,
  quitar: messages.notInterestedUndo,
  icono: <EyeSlashIcon className="h-5 w-5" />,
  activo: 'bg-gray-500 text-white',
};

export const QUIERO_VER: Accion = {
  tipo: 'quiero_ver',
  texto: messages.watchLaterLabel,
  titulo: messages.watchLaterTitle,
  explicacion: messages.watchLaterExplanation,
  quitar: messages.watchLaterUndo,
  icono: <BookmarkIcon className="h-5 w-5" />,
  activo: 'bg-indigo-600 text-white',
};

export const GUARDAR: Accion = {
  tipo: 'guardar',
  texto: messages.keepLabel,
  titulo: messages.keepTitle,
  explicacion: messages.keepExplanation,
  quitar: messages.keepUndo,
  icono: <LockClosedIcon className="h-5 w-5" />,
  activo: 'bg-green-600 text-white',
};

// Explorar: pedir borrarla la mete ya en la lista; "No me interesa" es un voto
// (con varios, entra en la lista).
const ACCIONES_EXPLORAR: Accion[] = [
  PEDIR_BORRAR,
  NO_INTERESA,
  QUIERO_VER,
  GUARDAR,
];

// Pendientes de borrado: ya esta en la lista, asi que pedir que se borre no
// tiene sentido
const ACCIONES_SE_VAN: Accion[] = [QUIERO_VER, GUARDAR, NO_INTERESA];

const CLAVE_FORZAR = 'forzar';

// --- Aviso del primer toque (pantallas tactiles, sin texto al pasar por encima)

const CLAVE_AVISOS = 'biblioteca-avisos-vistos';

const esTactil = (): boolean => {
  try {
    return window.matchMedia('(hover: none)').matches;
  } catch {
    return false;
  }
};

const avisosVistos = (): string[] => {
  try {
    const lista = JSON.parse(
      window.sessionStorage.getItem(CLAVE_AVISOS) ?? '[]'
    );
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
};

// Una vez por boton y por sesion del navegador
const marcarAvisoVisto = (clave: string) => {
  try {
    const lista = avisosVistos();
    if (!lista.includes(clave)) {
      window.sessionStorage.setItem(
        CLAVE_AVISOS,
        JSON.stringify([...lista, clave])
      );
    }
  } catch {
    // Sin almacenamiento: el aviso puede repetirse
  }
};

const necesitaAviso = (clave: string): boolean =>
  esTactil() && !avisosVistos().includes(clave);

export interface CuerpoMarca {
  embyId: string;
  tipo?: TipoMarca;
  temporadas?: number[];
}

// Pone (o quita) una marca y devuelve el elemento actualizado. Al quitar sin
// tipo se quitan todas mis marcas de esas temporadas.
export const enviarMarca = async (
  cuerpo: CuerpoMarca,
  quitar = false
): Promise<ElementoBiblioteca> => {
  const { data } = await axios.post<ElementoBiblioteca>(
    quitar ? '/api/biblioteca/marca/quitar' : '/api/biblioteca/marca',
    cuerpo
  );
  return data;
};

export const BotonIcono = ({
  texto,
  activo,
  claseActivo,
  onClick,
  children,
}: {
  texto: string;
  activo?: boolean;
  claseActivo?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) => (
  <Tooltip content={texto}>
    <button
      type="button"
      aria-label={texto}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
        activo
          ? claseActivo
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
      }`}
    >
      {children}
    </button>
  </Tooltip>
);

// Dialogo de una serie: a que temporadas aplicar. Sirve tambien de aviso.
const DialogoSerie = ({
  elemento,
  accion,
  porDefecto,
  onCerrar,
  onCambio,
}: {
  elemento: ElementoBiblioteca;
  accion: Accion;
  // Temporadas seleccionadas al abrir si no hay ninguna marcada
  porDefecto: number[];
  onCerrar: () => void;
  onCambio: (e: ElementoBiblioteca) => void;
}) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const marcadas = elemento.misMarcas
    .filter((m) => m.tipo === accion.tipo)
    .map((m) => m.temporada);
  const [temporadas, setTemporadas] = useState<number[]>(
    marcadas.length ? marcadas : porDefecto
  );
  const [enviando, setEnviando] = useState(false);

  const enviar = async (quitar: boolean) => {
    setEnviando(true);
    try {
      onCambio(
        await enviarMarca(
          {
            embyId: elemento.embyId,
            tipo: accion.tipo,
            temporadas,
          },
          quitar
        )
      );
      onCerrar();
    } catch {
      addToast(intl.formatMessage(messages.saveError), {
        appearance: 'error',
        autoDismiss: true,
      });
      setEnviando(false);
    }
  };

  return (
    <Modal
      title={intl.formatMessage(accion.titulo)}
      subTitle={elemento.titulo}
      onCancel={onCerrar}
      cancelText={intl.formatMessage(globalMessages.cancel)}
      onOk={() => enviar(false)}
      okText={intl.formatMessage(messages.apply)}
      okDisabled={enviando || !temporadas.length}
      onSecondary={marcadas.length ? () => enviar(true) : undefined}
      secondaryText={
        marcadas.length ? intl.formatMessage(accion.quitar) : undefined
      }
      secondaryDisabled={enviando || !temporadas.length}
    >
      <p className="mb-4 text-sm text-gray-300">
        {intl.formatMessage(accion.explicacion)}
      </p>
      <p className="mb-2 text-sm text-gray-300">
        {intl.formatMessage(messages.seasons)}
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {elemento.numerosTemporada.map((t) => {
          const sel = temporadas.includes(t);
          const vista = elemento.temporadasVistas.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() =>
                setTemporadas((ts) =>
                  sel
                    ? ts.filter((x) => x !== t)
                    : [...ts, t].sort((a, b) => a - b)
                )
              }
              className={`rounded-md px-3 py-1 text-sm ring-1 ${
                sel
                  ? 'bg-indigo-600 text-white ring-indigo-500'
                  : 'bg-gray-800 text-gray-300 ring-gray-600'
              }`}
            >
              {temporadaCorta(intl, t)}
              {vista ? ' ✓' : ''}
            </button>
          );
        })}
      </div>
    </Modal>
  );
};

// Aviso del primer toque en pantallas tactiles: que hace el boton
interface Aviso {
  clave: string;
  titulo: string;
  explicacion: string;
  hacer: () => void;
}

export type ModoAcciones = 'explorar' | 'seVan';

type AccionesElementoProps = {
  elemento: ElementoBiblioteca;
  onCambio: (e: ElementoBiblioteca) => void;
  modo?: ModoAcciones;
};

// Botones de voto bajo cada tarjeta de la Biblioteca
const AccionesElemento = ({
  elemento,
  onCambio,
  modo = 'explorar',
}: AccionesElementoProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { data: estado, mutate: mutateEstado } = useSWR<EstadoBiblioteca>(
    '/api/biblioteca/estado'
  );
  const [dialogo, setDialogo] = useState<Accion | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  if (!estado || !elemento.gestionado) return null;
  const yo = estado.usuario;
  if (!yo.tieneVoto && !yo.admin) return null;

  const cambio = (e: ElementoBiblioteca) => {
    onCambio(e);
    mutateEstado();
  };

  const errorAlGuardar = () =>
    addToast(intl.formatMessage(messages.saveError), {
      appearance: 'error',
      autoDismiss: true,
    });

  // La primera vez que se toca un boton en el movil, antes se explica
  const conAviso = (
    clave: string,
    titulo: string,
    explicacion: string,
    hacer: () => void
  ) => {
    if (necesitaAviso(clave)) {
      setAviso({ clave, titulo, explicacion, hacer });
    } else {
      hacer();
    }
  };

  const pulsar = async (accion: Accion, activa: boolean) => {
    if (elemento.tipo === 'tv') {
      // El dialogo de temporadas ya explica la accion
      marcarAvisoVisto(accion.tipo);
      setDialogo(accion);
      return;
    }
    conAviso(
      accion.tipo,
      intl.formatMessage(activa ? accion.quitar : accion.titulo),
      activa
        ? intl.formatMessage(messages.undoMovie, {
            action: intl.formatMessage(accion.titulo),
          })
        : intl.formatMessage(accion.explicacion),
      async () => {
        try {
          cambio(
            await enviarMarca(
              { embyId: elemento.embyId, tipo: accion.tipo },
              activa
            )
          );
        } catch {
          errorAlGuardar();
        }
      }
    );
  };

  const forzar = () =>
    conAviso(
      CLAVE_FORZAR,
      intl.formatMessage(messages.forceTitle),
      intl.formatMessage(messages.forceExplanation),
      async () => {
        try {
          const { data } = await axios.post<ElementoBiblioteca>(
            '/api/biblioteca/candidata/forzar',
            { embyId: elemento.embyId }
          );
          cambio(data);
        } catch {
          errorAlGuardar();
        }
      }
    );

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-1">
        {yo.tieneVoto &&
          (modo === 'seVan' ? ACCIONES_SE_VAN : ACCIONES_EXPLORAR)
            .filter((a) => a.tipo !== 'guardar' || yo.puedeGuardar)
            .map((a) => {
              const activa = elemento.misMarcas.some((m) => m.tipo === a.tipo);
              return (
                <BotonIcono
                  key={a.tipo}
                  texto={intl.formatMessage(
                    activa && elemento.tipo === 'movie' ? a.quitar : a.texto
                  )}
                  activo={activa}
                  claseActivo={a.activo}
                  onClick={() => pulsar(a, activa)}
                >
                  {a.icono}
                </BotonIcono>
              );
            })}
        {yo.admin && modo === 'explorar' && !elemento.candidatas.length && (
          <BotonIcono
            texto={intl.formatMessage(messages.forceLabel)}
            onClick={forzar}
          >
            <QueueListIcon className="h-5 w-5" />
          </BotonIcono>
        )}
      </div>
      <Transition
        as="div"
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        show={!!dialogo}
      >
        {dialogo && (
          <DialogoSerie
            elemento={elemento}
            accion={dialogo}
            porDefecto={
              // En Pendientes de borrado, las temporadas que estan en la lista
              modo === 'seVan' && elemento.candidatas.length
                ? elemento.candidatas.map((c) => c.temporada)
                : elemento.numerosTemporada
            }
            onCerrar={() => setDialogo(null)}
            onCambio={cambio}
          />
        )}
      </Transition>
      <Transition
        as="div"
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        show={!!aviso}
      >
        {aviso && (
          <Modal
            title={aviso.titulo}
            subTitle={elemento.titulo}
            onCancel={() => setAviso(null)}
            cancelText={intl.formatMessage(globalMessages.cancel)}
            onOk={() => {
              marcarAvisoVisto(aviso.clave);
              setAviso(null);
              aviso.hacer();
            }}
            okText={intl.formatMessage(messages.ok)}
          >
            <p className="text-sm text-gray-300">{aviso.explicacion}</p>
          </Modal>
        )}
      </Transition>
    </>
  );
};

export default AccionesElemento;
