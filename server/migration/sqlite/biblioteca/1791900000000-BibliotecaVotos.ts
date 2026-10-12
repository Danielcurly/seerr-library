import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BibliotecaVotos1791900000000 implements MigrationInterface {
  name = 'BibliotecaVotos1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" ADD COLUMN "gestionado" boolean NOT NULL DEFAULT (0)`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" ADD COLUMN "sonarrSigue" boolean NOT NULL DEFAULT (0)`
    );
    await queryRunner.query(
      `CREATE TABLE "biblioteca_marca" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" integer NOT NULL, "embyId" varchar NOT NULL, "temporada" integer NOT NULL, "tipo" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_biblioteca_marca_user_emby_temporada" ON "biblioteca_marca" ("userId", "embyId", "temporada")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_biblioteca_marca_userId" ON "biblioteca_marca" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_biblioteca_marca_embyId" ON "biblioteca_marca" ("embyId")`
    );
    await queryRunner.query(
      `CREATE TABLE "biblioteca_seguir" ("userId" integer NOT NULL, "embyId" varchar NOT NULL, "sigue" boolean NOT NULL, "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), PRIMARY KEY ("userId", "embyId"))`
    );
    await queryRunner.query(
      `CREATE TABLE "biblioteca_candidata" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "embyId" varchar NOT NULL, "temporada" integer NOT NULL, "motivo" varchar NOT NULL, "pedidoPor" text NOT NULL DEFAULT ('[]'), "estado" varchar NOT NULL, "entrada" datetime NOT NULL, "vence" datetime NOT NULL)`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_biblioteca_candidata_emby_temporada" ON "biblioteca_candidata" ("embyId", "temporada")`
    );
    await queryRunner.query(
      `CREATE TABLE "biblioteca_historial" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tipo" varchar NOT NULL, "embyId" varchar NOT NULL, "temporada" integer NOT NULL, "titulo" varchar NOT NULL, "tamano" integer NOT NULL DEFAULT (0), "motivo" varchar, "simulacro" boolean NOT NULL DEFAULT (1), "fecha" datetime NOT NULL DEFAULT (datetime('now')))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "biblioteca_historial"`);
    await queryRunner.query(`DROP TABLE "biblioteca_candidata"`);
    await queryRunner.query(`DROP TABLE "biblioteca_seguir"`);
    await queryRunner.query(`DROP TABLE "biblioteca_marca"`);
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" DROP COLUMN "sonarrSigue"`
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" DROP COLUMN "gestionado"`
    );
  }
}
