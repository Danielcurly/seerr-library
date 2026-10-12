import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Ajustes del modulo Biblioteca (clave -> valor JSON). Tabla propia para no
// tocar settings.json de Seerr.
@Entity({ name: 'biblioteca_ajuste' })
export class BibliotecaAjuste {
  @PrimaryColumn({ type: 'varchar' })
  public clave: string;

  @Column({ type: 'text' })
  public valor: string;

  @UpdateDateColumn()
  public updatedAt: Date;

  constructor(init?: Partial<BibliotecaAjuste>) {
    Object.assign(this, init);
  }
}
