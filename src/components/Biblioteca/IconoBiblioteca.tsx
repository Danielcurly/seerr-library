import type { EstadoBiblioteca } from '@app/components/Biblioteca/comun';
import { ArchiveBoxIcon } from '@heroicons/react/24/outline';
import { ArchiveBoxIcon as ArchiveBoxIconRelleno } from '@heroicons/react/24/solid';
import useSWR from 'swr';

type IconoBibliotecaProps = {
  className?: string;
  relleno?: boolean;
  // Número fijo (tutorial) en vez de mis pendientes reales
  ejemplo?: number;
};

// Icono del menu con el numero de candidatas que tengo sin responder
const IconoBiblioteca = ({
  className,
  relleno,
  ejemplo,
}: IconoBibliotecaProps) => {
  const { data } = useSWR<EstadoBiblioteca>('/api/biblioteca/estado', {
    refreshInterval: 10 * 60 * 1000,
  });
  const Icono = relleno ? ArchiveBoxIconRelleno : ArchiveBoxIcon;
  const pendientes = ejemplo ?? data?.pendientes ?? 0;

  return (
    <span className={`relative inline-flex ${className ?? ''}`}>
      <Icono className="h-full w-full" />
      {pendientes > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
          {pendientes > 99 ? '99+' : pendientes}
        </span>
      )}
    </span>
  );
};

export default IconoBiblioteca;
