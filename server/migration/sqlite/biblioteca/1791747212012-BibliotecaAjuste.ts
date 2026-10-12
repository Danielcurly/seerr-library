import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BibliotecaAjuste1791747212012 implements MigrationInterface {
  name = 'BibliotecaAjuste1791747212012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "biblioteca_ajuste" ("clave" varchar PRIMARY KEY NOT NULL, "valor" text NOT NULL, "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "biblioteca_ajuste"`);
  }
}
