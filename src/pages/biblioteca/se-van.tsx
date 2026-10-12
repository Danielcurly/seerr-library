import BibliotecaLayout from '@app/components/Biblioteca/BibliotecaLayout';
import SeVan from '@app/components/Biblioteca/SeVan';
import type { NextPage } from 'next';

const BibliotecaSeVanPage: NextPage = () => {
  return (
    <BibliotecaLayout>
      <SeVan />
    </BibliotecaLayout>
  );
};

export default BibliotecaSeVanPage;
