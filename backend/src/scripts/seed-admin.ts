/**
 * Creates the first admin account from environment variables (put them in .env, run this
 * once, then remove ADMIN_PASSWORD from .env). Safe to run again: it never overwrites a user.
 *
 *   ADMIN_EMAIL, ADMIN_PASSWORD (12+ chars), ADMIN_NAME, ADMIN_CITIZENSHIP_NUMBER
 */
import "reflect-metadata";
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createConnection } from "typeorm";
import { User } from "../entity/User";

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = (process.env.ADMIN_NAME || "Administrator").trim();
  const citizenshipNumber = (process.env.ADMIN_CITIZENSHIP_NUMBER || "admin-000").trim();

  if (!email || password.length < 12) {
    console.error("Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters in .env first.");
    process.exit(1);
  }

  await createConnection();

  if (await User.findOne({ where: { email } })) {
    console.log(`A user with email ${email} already exists. Nothing changed.`);
    process.exit(0);
  }

  const admin = new User();
  admin.name = name;
  admin.email = email;
  admin.citizenshipNumber = citizenshipNumber;
  admin.password = await bcrypt.hash(password, 12);
  admin.admin = true;
  admin.verified = true;
  await admin.save();

  console.log(`Admin ${email} created. Now remove ADMIN_PASSWORD from your .env file.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
