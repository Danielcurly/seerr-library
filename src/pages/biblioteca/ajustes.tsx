import AjustesBiblioteca from '@app/components/Biblioteca/AjustesBiblioteca';
import BibliotecaLayout from '@app/components/Biblioteca/BibliotecaLayout';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const BibliotecaAjustesPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);
  return (
    <BibliotecaLayout>
      <AjustesBiblioteca />
    </BibliotecaLayout>
  );
};

export default BibliotecaAjustesPage;
