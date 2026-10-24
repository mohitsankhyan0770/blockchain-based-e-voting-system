import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * This migration used to insert three demo accounts, one of them an admin, with passwords that
 * were written down in the README. Seeding known credentials is unsafe, so it now does nothing.
 *
 * The file stays (and keeps its name) because databases that already ran it have it recorded in
 * the migrations table. Create your own admin with `npm run seed:admin` instead.
 *
 * If you set up this project before this change, delete the old demo accounts:
 *   DELETE FROM `user` WHERE email IN ('john@gmail.com', 'liza@gmail.com', 'ben@gmail.com');
 */
export class users1645187823173 implements MigrationInterface {
  name = "users1645187823173";

  public async up(_queryRunner: QueryRunner): Promise<void> {}

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
