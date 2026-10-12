import type {
  ElementoBiblioteca,
  FiltrosBiblioteca,
  PaginaBiblioteca,
} from '@app/components/Biblioteca/comun';
import {
  agruparGeneros,
  formatoFecha,
  textoTitulos,
} from '@app/components/Biblioteca/comun';
import TarjetaBiblioteca from '@app/components/Biblioteca/TarjetaBiblioteca';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  Bars3BottomLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  FilmIcon,
  FolderIcon,
  ListBulletIcon,
  TagIcon,
} from '@heroicons/react/24/solid';
import { useRouter } from 'next/router';
import type { MessageDescriptor } from 'react-intl';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Biblioteca.Explorar', {
  sortDownloaded: 'Recently downloaded',
  sortReleaseNew: 'Release date (newest)',
  sortReleaseOld: 'Release date (oldest)',
  sortTitle: 'Title (A-Z)',
  sortSize: 'Size (largest)',
  sortWatched: 'Recently watched',
  sortNotWatched: 'Longest without being watched',
  listAll: 'All titles',
  listPending: 'Pending removal',
  listKept: 'Kept by me',
  listWatchLater: 'My watch later list',
  listRemove: 'Removal requested by me',
  listNotInterested: 'Marked as not interested',
  allLibraries: 'All libraries',
  allTypes: 'Movies and series',
  allGenres: 'All genres',
  watchedAll: 'Watched and not watched',
  watchedNo: 'Not finished',
  watchedStarted: 'In progress',
  watchedYes: 'Watched',
  lastWatched: 'Last watched: {date}',
  neverWatched: 'Never watched',
  released: 'Released: {date}',
  noReleaseDate: 'No release date',
  downloaded: 'Downloaded: {date}',
  loadError: 'The library could not be loaded.',
  noResults: 'No titles match these filters.',
  page: 'Page {page} of {pages}',
});

const ORDENES: { valor: string; texto: MessageDescriptor }[] = [
  { valor: 'descarga', texto: messages.sortDownloaded },
  { valor: 'anio', texto: messages.sortReleaseNew },
  { valor: 'anio-asc', texto: messages.sortReleaseOld },
  { valor: 'titulo', texto: messages.sortTitle },
  { valor: 'tamano', texto: messages.sortSize },
  { valor: 'reproduccion', texto: messages.sortWatched },
  { valor: 'reproduccion-asc', texto: messages.sortNotWatched },
];

const LISTAS: { valor: string; texto: MessageDescriptor }[] = [
  { valor: '', texto: messages.listAll },
  { valor: 'candidatas', texto: messages.listPending },
  { valor: 'guardadas', texto: messages.listKept },
  { valor: 'quiero_ver', texto: messages.listWatchLater },
  { valor: 'borrar', texto: messages.listRemove },
  { valor: 'no_interesa', texto: messages.listNotInterested },
];

const POR_PAGINA = 30;

const Filtro = ({
  icono,
  children,
}: {
  icono: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="mb-2 flex flex-grow sm:mb-0 sm:mr-2 lg:flex-grow-0">
    <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
      {icono}
    </span>
    {children}
  </div>
);

const Explorar = () => {
  const intl = useIntl();
  const router = useRouter();
  const q = router.query as Record<string, string | undefined>;
  const ordenSel = q.orden ?? 'descarga';
  const [orden, dir] = ordenSel.endsWith('-asc')
    ? [ordenSel.replace(/-asc$/, ''), 'asc']
    : [ordenSel, undefined];
  const pagina = Number(q.pagina) || 1;

  const params = new URLSearchParams({
    orden,
    pagina: String(pagina),
    porPagina: String(POR_PAGINA),
  });
  if (dir) params.set('dir', dir);
  for (const clave of ['biblioteca', 'tipo', 'genero', 'visto']) {
    if (q[clave]) params.set(clave, q[clave] as string);
  }
  if (q.lista === 'candidatas') {
    params.set('candidatas', 'si');
  } else if (q.lista) {
    params.set('marca', q.lista);
  }

  const { data: filtros } = useSWR<FiltrosBiblioteca>(
    '/api/biblioteca/filtros'
  );
  const { data, error, mutate } = useSWR<PaginaBiblioteca>(
    `/api/biblioteca/explorar?${params.toString()}`
  );

  // Tras votar, se cambia la tarjeta sin recargar la página (el filtro se
  // vuelve a aplicar al cambiar de página o de filtro)
  const actualizar = (nuevo: ElementoBiblioteca) => {
    if (!data) return;
    mutate(
      {
        ...data,
        resultados: data.resultados.map((r) =>
          r.embyId === nuevo.embyId ? nuevo : r
        ),
      },
      false
    );
  };

  // Cambia un filtro en la URL (y vuelve a la primera página)
  const cambiar = (clave: string, valor: string) => {
    const query = { ...router.query, [clave]: valor };
    if (!valor) delete query[clave];
    if (clave !== 'pagina') delete query.pagina;
    router.push({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
    if (clave === 'pagina') window.scrollTo(0, 0);
  };

  const detalle = (e: PaginaBiblioteca['resultados'][number]) => {
    if (orden === 'reproduccion') {
      return e.ultimaReproduccion
        ? intl.formatMessage(messages.lastWatched, {
            date: formatoFecha(intl, e.ultimaReproduccion),
          })
        : intl.formatMessage(messages.neverWatched);
    }
    if (orden === 'anio') {
      return e.fechaEstreno
        ? intl.formatMessage(messages.released, {
            date: formatoFecha(intl, e.fechaEstreno),
          })
        : intl.formatMessage(messages.noReleaseDate);
    }
    return intl.formatMessage(messages.downloaded, {
      date: formatoFecha(intl, e.fechaDescarga),
    });
  };

  return (
    <>
      <div className="mb-4 flex flex-col flex-wrap gap-y-2 sm:flex-row">
        <Filtro icono={<Bars3BottomLeftIcon className="h-6 w-6" />}>
          <select
            value={ordenSel}
            onChange={(e) => cambiar('orden', e.target.value)}
            className="rounded-r-only"
          >
            {ORDENES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {intl.formatMessage(o.texto)}
              </option>
            ))}
          </select>
        </Filtro>
        <Filtro icono={<FolderIcon className="h-6 w-6" />}>
          <select
            value={q.biblioteca ?? ''}
            onChange={(e) => cambiar('biblioteca', e.target.value)}
            className="rounded-r-only"
          >
            <option value="">
              {intl.formatMessage(messages.allLibraries)}
            </option>
            {filtros?.bibliotecas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </Filtro>
        <Filtro icono={<FilmIcon className="h-6 w-6" />}>
          <select
            value={q.tipo ?? ''}
            onChange={(e) => cambiar('tipo', e.target.value)}
            className="rounded-r-only"
          >
            <option value="">{intl.formatMessage(messages.allTypes)}</option>
            <option value="movie">
              {intl.formatMessage(globalMessages.movies)}
            </option>
            <option value="tv">
              {intl.formatMessage(globalMessages.tvshows)}
            </option>
          </select>
        </Filtro>
        <Filtro icono={<TagIcon className="h-6 w-6" />}>
          <select
            value={q.genero ?? ''}
            onChange={(e) => cambiar('genero', e.target.value)}
            className="rounded-r-only"
          >
            <option value="">{intl.formatMessage(messages.allGenres)}</option>
            {agruparGeneros(intl, filtros?.generos ?? []).map(
              ({ valor, nombre }) => (
                <option key={valor} value={valor}>
                  {nombre}
                </option>
              )
            )}
          </select>
        </Filtro>
        <Filtro icono={<EyeIcon className="h-6 w-6" />}>
          <select
            value={q.visto ?? ''}
            onChange={(e) => cambiar('visto', e.target.value)}
            className="rounded-r-only"
          >
            <option value="">{intl.formatMessage(messages.watchedAll)}</option>
            <option value="no">{intl.formatMessage(messages.watchedNo)}</option>
            <option value="empezado">
              {intl.formatMessage(messages.watchedStarted)}
            </option>
            <option value="si">
              {intl.formatMessage(messages.watchedYes)}
            </option>
          </select>
        </Filtro>
        <Filtro icono={<ListBulletIcon className="h-6 w-6" />}>
          <select
            value={q.lista ?? ''}
            onChange={(e) => cambiar('lista', e.target.value)}
            className="rounded-r-only"
          >
            {LISTAS.map((l) => (
              <option key={l.valor} value={l.valor}>
                {intl.formatMessage(l.texto)}
              </option>
            ))}
          </select>
        </Filtro>
      </div>

      {error ? (
        <p className="text-red-400">{intl.formatMessage(messages.loadError)}</p>
      ) : !data ? (
        <LoadingSpinner />
      ) : data.resultados.length === 0 ? (
        <p className="mt-16 text-center text-xl text-gray-400">
          {intl.formatMessage(messages.noResults)}
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-400">
            {textoTitulos(intl, data.pageInfo.total)}
          </p>
          <ul className="cards-vertical">
            {data.resultados.map((e) => (
              <li key={e.embyId}>
                <TarjetaBiblioteca
                  elemento={e}
                  detalle={detalle(e)}
                  onCambio={actualizar}
                />
              </li>
            ))}
          </ul>
          <nav className="mb-8 mt-6 flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {intl.formatMessage(messages.page, {
                page: data.pageInfo.pagina,
                pages: data.pageInfo.paginas,
              })}
            </span>
            <div className="flex space-x-2">
              <Button
                disabled={pagina <= 1}
                onClick={() => cambiar('pagina', String(pagina - 1))}
              >
                <ChevronLeftIcon />
                <span>{intl.formatMessage(globalMessages.previous)}</span>
              </Button>
              <Button
                disabled={pagina >= data.pageInfo.paginas}
                onClick={() => cambiar('pagina', String(pagina + 1))}
              >
                <span>{intl.formatMessage(globalMessages.next)}</span>
                <ChevronRightIcon />
              </Button>
            </div>
          </nav>
        </>
      )}
    </>
  );
};

export default Explorar;
