import type { Accion } from '@app/components/Biblioteca/AccionesElemento';
import {
  BotonIcono,
  GUARDAR,
  NO_INTERESA,
  PEDIR_BORRAR,
  QUIERO_VER,
} from '@app/components/Biblioteca/AccionesElemento';
import type { EstadoBiblioteca } from '@app/components/Biblioteca/comun';
import {
  capturasDe,
  type Captura,
} from '@app/components/Biblioteca/tutorialCapturas';
import Modal from '@app/components/Common/Modal';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { IntlShape, MessageDescriptor } from 'react-intl';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

// Guia en diapositivas: que es la Biblioteca y que hace cada boton, sin
// detalles tecnicos. Cada diapositiva lleva una captura (de escritorio o de
// movil segun la pantalla) con lo que explica el texto resaltado y numerado.
// Cada concepto se explica antes de que otra diapositiva lo use.

const messages = defineMessages('components.Biblioteca.TutorialBiblioteca', {
  libraryTitle: 'The Library',
  libraryText1:
    'The Library lets users decide together which content is kept and which is removed to free up storage. No title is removed immediately: it is first added to a list with a countdown, during which any user can keep it.',
  libraryText2:
    'To open it, select <strong>Library</strong> {n1} {device, select, mobile {in the bottom menu (last icon).} other {in the sidebar.}}',
  browseTitle: 'Browse: all content',
  browseText1:
    '{device, select, mobile {Library sections are selected from this drop-down} other {Library sections are at the top}} {n1}: Browse, New Episodes, Pending Removal and My Activity.',
  browseText2:
    '<strong>Browse</strong> shows all available content. The filters {n2} let you sort it (by download date, release date…) and filter it by type or genre.',
  pendingTitle: 'Pending Removal',
  pendingText1:
    '<strong>Pending Removal</strong> lists the titles that will be removed soon, in two groups:',
  pendingText2:
    '{n1} <strong>Requested by users.</strong> Titles whose removal a user has requested, or that several users have marked as not interested.',
  pendingText3:
    '{n2} <strong>Not watched recently.</strong> Titles nobody has watched for a long time. They are added automatically, a few each week.',
  pendingText4: 'Select a group title to expand or collapse it.',
  countdownTitle: 'The countdown',
  countdownText1:
    'Each title in Pending Removal has a countdown {n1}. If nobody has kept it when the countdown ends, it is removed.',
  countdownText2:
    'To prevent this, use the <strong>Keep</strong> or <strong>Watch later</strong> actions {n2}, described next. While someone is watching a series in the list, its countdown is paused until they finish it. The number next to <strong>Library</strong> in the menu shows how many titles requested by users are awaiting your vote.',
  actionsTitle: 'Title actions',
  actionsText:
    'Each title has its actions below it {n1}. Active actions are shown in color; select one again to clear it. {device, select, mobile {The first time you tap each one, an explanation is shown.} other {Hover over an action to see its description.}}',
  actionKeep: 'The title is never removed.',
  actionWatchLater: 'Postpones its removal while you intend to watch it.',
  actionNotInterested:
    'Your vote: if several users select it, the title is added to Pending Removal.',
  actionRemove: 'The title is added to Pending Removal immediately.',
  seasonsTitle: 'Series by season',
  seasonsText1:
    'When you choose an action on a series, this window opens to select the seasons it applies to {n1}: each season is managed separately.',
  seasonsText2:
    'When a new season or episode of a series you watch is released, it appears in <strong>New Episodes</strong>, where you can request it if it is not available.',
  discoverTitle: 'New episodes of your series',
  discoverText:
    'New seasons and episodes of the series you watch appear first on <strong>Discover</strong> {n1}. From there you can play them if they are available, or request them.',
  newTitle: 'Play or request new episodes',
  newText1:
    'The <strong>New Episodes</strong> section {n1} of the Library shows the full list. If the content is available, select <strong>Play</strong> {n2}; otherwise, select <strong>Request</strong> {n3} to download it.',
  newText2:
    'To stop receiving notifications for a series, select the crossed-out bell button.',
  activityTitle: 'My Activity',
  activityText1:
    '<strong>My Activity</strong> {n1} brings together the titles you have kept, your watch later list, the titles you requested to remove, your requests and the series you have muted. You can change any mark at any time.',
  activityText2:
    'You can view this guide again with the <strong>How It Works</strong> button {n2}.',
  enlarge: 'Enlarge image',
  enlargeHint:
    '{device, select, mobile {Tap} other {Click}} the image to enlarge it.',
  closeImage: 'Close image',
  step: 'Step {step}: {title}',
  next: 'Next',
  start: 'Get Started',
});

// Movil = pantalla estrecha (el menu va abajo y las secciones en un desplegable)
const useEsMovil = () => {
  const [movil, setMovil] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const cambiar = () => setMovil(mq.matches);
    cambiar();
    mq.addEventListener('change', cambiar);
    return () => mq.removeEventListener('change', cambiar);
  }, []);
  return movil;
};

// Numero de una zona en el texto, igual que en la captura
const Num = ({ n }: { n: number }) => (
  <span className="mx-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 align-text-bottom text-xs font-bold text-gray-900">
    {n}
  </span>
);

// Valores comunes de los textos: negrita, numeros de zona y tipo de pantalla
const valores = (movil: boolean) => ({
  strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
  n1: <Num n={1} />,
  n2: <Num n={2} />,
  n3: <Num n={3} />,
  device: movil ? 'mobile' : 'desktop',
});

// Captura con sus zonas numeradas; el tamano lo pone quien la usa
const CapturaConZonas = ({
  c,
  className,
  style,
}: {
  c: Captura;
  className: string;
  style?: React.CSSProperties;
}) => (
  <div
    className={`relative overflow-hidden rounded-lg ring-1 ring-gray-700 ${className}`}
    style={style}
  >
    {/* Captura estatica de public/: sin optimizar */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={c.src}
      alt=""
      width={c.ancho}
      height={c.alto}
      className="block h-auto w-full"
    />
    {c.zonas.map((z) => (
      <div
        key={z.n}
        className="pointer-events-none absolute rounded-md border-[3px] border-yellow-400 shadow-[0_0_0_2px_rgba(0,0,0,0.6),0_0_12px_rgba(250,204,21,0.6)]"
        style={{
          left: `${z.x}%`,
          top: `${z.y}%`,
          width: `${z.w}%`,
          height: `${z.h}%`,
        }}
      >
        <span className="absolute -left-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-sm font-bold text-gray-900 shadow">
          {z.n}
        </span>
      </div>
    ))}
  </div>
);

const CapturaResaltada = ({
  clave,
  movil,
}: {
  clave: string;
  movil: boolean;
}) => {
  const intl = useIntl();
  const c = capturasDe(intl.locale)[clave][movil ? 'movil' : 'escritorio'];
  const [ampliada, setAmpliada] = useState(false);
  const proporcion = c.ancho / c.alto;
  return (
    <>
      <button
        type="button"
        aria-label={intl.formatMessage(messages.enlarge)}
        className="mx-auto block w-full cursor-zoom-in"
        // Que no pase de dos tercios de la pantalla de alto
        style={{ maxWidth: `calc(64vh * ${proporcion})` }}
        onClick={() => setAmpliada(true)}
      >
        <CapturaConZonas c={c} className="w-full" />
      </button>
      <p className="text-center text-xs text-gray-400">
        {intl.formatMessage(messages.enlargeHint, {
          device: movil ? 'mobile' : 'desktop',
        })}
      </p>
      {/* Fuera del modal: dentro, "fixed" no cubriria toda la pantalla */}
      {ampliada &&
        createPortal(
          <button
            type="button"
            aria-label={intl.formatMessage(messages.closeImage)}
            className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/90 p-2"
            onClick={() => setAmpliada(false)}
          >
            <CapturaConZonas
              c={c}
              className="w-full"
              style={{ maxWidth: `min(98vw, calc(96vh * ${proporcion}))` }}
            />
          </button>,
          document.body
        )}
    </>
  );
};

// Las cuatro acciones, con su icono y lo que hacen en una frase
const ListaAcciones = () => {
  const intl = useIntl();
  const acciones: [Accion, MessageDescriptor][] = [
    [GUARDAR, messages.actionKeep],
    [QUIERO_VER, messages.actionWatchLater],
    [NO_INTERESA, messages.actionNotInterested],
    [PEDIR_BORRAR, messages.actionRemove],
  ];
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {acciones.map(([accion, texto]) => (
        <li key={accion.tipo} className="flex items-center gap-3">
          <BotonIcono
            texto={intl.formatMessage(accion.texto)}
            activo
            claseActivo={accion.activo}
          >
            {accion.icono}
          </BotonIcono>
          <div className="text-sm">
            <div className="font-semibold text-white">
              {intl.formatMessage(accion.titulo)}
            </div>
            <div className="text-gray-300">{intl.formatMessage(texto)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
};

interface Diapositiva {
  titulo: MessageDescriptor;
  captura: string;
  // Parrafos del texto
  parrafos: MessageDescriptor[];
  // En movil la captura no tiene la zona 1 (se omite su numero en el texto)
  sinZona1EnMovil?: boolean;
  extra?: React.ReactNode;
}

// Orden: que es, donde esta todo, Pendientes de borrado y su cuenta atras, y
// despues las acciones que lo evitan, las series y las novedades
const DIAPOSITIVAS: Diapositiva[] = [
  {
    titulo: messages.libraryTitle,
    captura: 'menu',
    parrafos: [messages.libraryText1, messages.libraryText2],
  },
  {
    titulo: messages.browseTitle,
    captura: 'explorar',
    parrafos: [messages.browseText1, messages.browseText2],
  },
  {
    titulo: messages.pendingTitle,
    captura: 'sevan',
    parrafos: [
      messages.pendingText1,
      messages.pendingText2,
      messages.pendingText3,
      messages.pendingText4,
    ],
  },
  {
    titulo: messages.countdownTitle,
    captura: 'cuenta',
    parrafos: [messages.countdownText1, messages.countdownText2],
  },
  {
    titulo: messages.actionsTitle,
    captura: 'botones',
    parrafos: [messages.actionsText],
    extra: <ListaAcciones />,
  },
  {
    titulo: messages.seasonsTitle,
    captura: 'temporadas',
    parrafos: [messages.seasonsText1, messages.seasonsText2],
  },
  {
    titulo: messages.discoverTitle,
    captura: 'descubrir',
    parrafos: [messages.discoverText],
  },
  {
    titulo: messages.newTitle,
    captura: 'novedades',
    parrafos: [messages.newText1, messages.newText2],
    sinZona1EnMovil: true,
  },
  {
    titulo: messages.activityTitle,
    captura: 'lomio',
    parrafos: [messages.activityText1, messages.activityText2],
  },
];

const textoDiapositiva = (intl: IntlShape, d: Diapositiva, movil: boolean) => {
  const v = valores(movil);
  if (movil && d.sinZona1EnMovil) v.n1 = <></>;
  return d.parrafos.map((p) => <p key={p.id}>{intl.formatMessage(p, v)}</p>);
};

const TutorialBiblioteca = ({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) => {
  const intl = useIntl();
  const [paso, setPaso] = useState(0);
  const movil = useEsMovil();
  const d = DIAPOSITIVAS[paso];
  const ultimo = paso === DIAPOSITIVAS.length - 1;

  const cerrar = () => {
    onCerrar();
    setPaso(0);
  };

  return (
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
          title={intl.formatMessage(d.titulo)}
          onCancel={cerrar}
          cancelText={intl.formatMessage(globalMessages.close)}
          onOk={() => (ultimo ? cerrar() : setPaso(paso + 1))}
          okText={intl.formatMessage(ultimo ? messages.start : messages.next)}
          onSecondary={paso > 0 ? () => setPaso(paso - 1) : undefined}
          secondaryText={
            paso > 0 ? intl.formatMessage(globalMessages.previous) : undefined
          }
          backgroundClickable={false}
          dialogClass="sm:max-w-5xl"
        >
          <div className="space-y-4">
            <CapturaResaltada clave={d.captura} movil={movil} />
            <div className="space-y-2 text-gray-200">
              {textoDiapositiva(intl, d, movil)}
            </div>
            {d.extra}
            <div className="flex justify-center gap-2">
              {DIAPOSITIVAS.map((x, i) => (
                <button
                  key={x.titulo.id}
                  type="button"
                  aria-label={intl.formatMessage(messages.step, {
                    step: i + 1,
                    title: intl.formatMessage(x.titulo),
                  })}
                  onClick={() => setPaso(i)}
                  className={`h-2.5 w-2.5 rounded-full ${
                    i === paso ? 'bg-indigo-400' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </Modal>
      )}
    </Transition>
  );
};

// Se abre sola la primera vez que cada usuario entra en la web (montado en el
// Layout de Seerr)
export const TutorialAutomatico = () => {
  const { user } = useUser();
  const { data: estado, mutate } = useSWR<EstadoBiblioteca>(
    user ? '/api/biblioteca/estado' : null
  );
  const [cerrado, setCerrado] = useState(false);

  return (
    <TutorialBiblioteca
      abierto={!!estado?.tutorialPendiente && !cerrado}
      onCerrar={async () => {
        setCerrado(true);
        try {
          await axios.post('/api/biblioteca/tutorial');
          mutate();
        } catch {
          // Volvera a salir la proxima vez
        }
      }}
    />
  );
};

export default TutorialBiblioteca;
