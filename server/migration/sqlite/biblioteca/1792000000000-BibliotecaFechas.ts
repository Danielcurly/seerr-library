import type { MigrationInterface, QueryRunner } from 'typeorm';

// Fecha de estreno para ordenar por año, y fin del indulto ("Quiero verla" lo
// sustituye): las candidatas indultadas desaparecen.
export class BibliotecaFechas1792000000000 implements MigrationInterface {
  name = 'BibliotecaFechas1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" ADD COLUMN "fechaEstreno" datetime`
    );
    await queryRunner.query(
      `DELETE FROM "biblioteca_candidata" WHERE "estado" = 'indultada'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" DROP COLUMN "fechaEstreno"`
    );
  }
}
