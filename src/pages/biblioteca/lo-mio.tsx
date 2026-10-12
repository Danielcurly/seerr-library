import BibliotecaLayout from '@app/components/Biblioteca/BibliotecaLayout';
import LoMio from '@app/components/Biblioteca/LoMio';
import type { NextPage } from 'next';

const BibliotecaLoMioPage: NextPage = () => {
  return (
    <BibliotecaLayout>
      <LoMio />
    </BibliotecaLayout>
  );
};

export default BibliotecaLoMioPage;
