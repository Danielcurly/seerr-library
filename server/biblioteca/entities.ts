import { BibliotecaAjuste } from '@server/biblioteca/entity/BibliotecaAjuste';
import { BibliotecaCandidata } from '@server/biblioteca/entity/BibliotecaCandidata';
import { BibliotecaElemento } from '@server/biblioteca/entity/BibliotecaElemento';
import { BibliotecaHistorial } from '@server/biblioteca/entity/BibliotecaHistorial';
import { BibliotecaMarca } from '@server/biblioteca/entity/BibliotecaMarca';
import { BibliotecaNovedad } from '@server/biblioteca/entity/BibliotecaNovedad';
import { BibliotecaProgreso } from '@server/biblioteca/entity/BibliotecaProgreso';
import { BibliotecaTemporada } from '@server/biblioteca/entity/BibliotecaTemporada';
import { BibliotecaUsuario } from '@server/biblioteca/entity/BibliotecaUsuario';
import { BibliotecaVisto } from '@server/biblioteca/entity/BibliotecaVisto';

// Entidades del modulo Biblioteca, registradas en server/datasource.ts.
export const bibliotecaEntities = [
  BibliotecaAjuste,
  BibliotecaCandidata,
  BibliotecaElemento,
  BibliotecaHistorial,
  BibliotecaMarca,
  BibliotecaNovedad,
  BibliotecaProgreso,
  BibliotecaTemporada,
  BibliotecaUsuario,
  BibliotecaVisto,
];
