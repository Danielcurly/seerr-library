import type { MigrationInterface, QueryRunner } from 'typeorm';

// La etiqueta "keepalive" de Radarr pasa a ser una etiqueta configurable
// (ajuste etiquetaRadarr) con su propio plazo (antiguedadEtiquetaMeses). Las
// instalaciones que ya tenian ajustes conservan 'keepalive'; las nuevas
// empiezan sin etiqueta.
export class BibliotecaEtiquetaRadarr1792400000000 implements MigrationInterface {
  name = 'BibliotecaEtiquetaRadarr1792400000000';

  private async renombrarPlazo(
    queryRunner: QueryRunner,
    de: string,
    a: string
  ): Promise<void> {
    const filas: { valor: string }[] = await queryRunner.query(
      `SELECT "valor" FROM "biblioteca_ajuste" WHERE "clave" = 'plazos'`
    );
    if (!filas.length) return;
    const plazos = JSON.parse(filas[0].valor) as Record<string, unknown>;
    if (!(de in plazos)) return;
    plazos[a] = plazos[de];
    delete plazos[de];
    await queryRunner.query(
      `UPDATE "biblioteca_ajuste" SET "valor" = ? WHERE "clave" = 'plazos'`,
      [JSON.stringify(plazos)]
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" RENAME COLUMN "keepalive" TO "conEtiqueta"`
    );
    await this.renombrarPlazo(
      queryRunner,
      'antiguedadKeepaliveMeses',
      'antiguedadEtiquetaMeses'
    );
    const [{ n }]: { n: number }[] = await queryRunner.query(
      `SELECT COUNT(*) AS "n" FROM "biblioteca_ajuste"`
    );
    if (n > 0) {
      await queryRunner.query(
        `INSERT OR IGNORE INTO "biblioteca_ajuste" ("clave", "valor") VALUES ('etiquetaRadarr', ?)`,
        [JSON.stringify({ nombre: 'keepalive' })]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "biblioteca_ajuste" WHERE "clave" = 'etiquetaRadarr'`
    );
    await this.renombrarPlazo(
      queryRunner,
      'antiguedadEtiquetaMeses',
      'antiguedadKeepaliveMeses'
    );
    await queryRunner.query(
      `ALTER TABLE "biblioteca_elemento" RENAME COLUMN "conEtiqueta" TO "keepalive"`
    );
  }
}
