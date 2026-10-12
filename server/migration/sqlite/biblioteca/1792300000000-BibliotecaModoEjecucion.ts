import type { MigrationInterface, QueryRunner } from 'typeorm';

// El modo prueba pasa a ser un modo de ejecucion: avisar (antes modo prueba),
// arr (borra Seerr en Radarr/Sonarr) o externo (antes sin modo prueba: borra
// un programa externo por la API del ejecutor)
export class BibliotecaModoEjecucion1792300000000 implements MigrationInterface {
  name = 'BibliotecaModoEjecucion1792300000000';

  private async cambiar(
    queryRunner: QueryRunner,
    cambio: (valor: Record<string, unknown>) => Record<string, unknown>
  ): Promise<void> {
    const filas: { valor: string }[] = await queryRunner.query(
      `SELECT "valor" FROM "biblioteca_ajuste" WHERE "clave" = 'ejecucion'`
    );
    if (!filas.length) return;
    await queryRunner.query(
      `UPDATE "biblioteca_ajuste" SET "valor" = ? WHERE "clave" = 'ejecucion'`,
      [JSON.stringify(cambio(JSON.parse(filas[0].valor)))]
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.cambiar(queryRunner, ({ modoPrueba, ...resto }) => ({
      ...resto,
      modo: modoPrueba === false ? 'externo' : 'avisar',
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.cambiar(queryRunner, ({ modo, ...resto }) => ({
      ...resto,
      // Sin modo arr antes: lo mas prudente es no borrar
      modoPrueba: modo !== 'externo',
    }));
  }
}
