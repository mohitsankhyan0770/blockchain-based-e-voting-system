import { User } from "../entity/User";

/** The only shape of a user that ever leaves the server. Never includes the password hash. */
export const toPublicUser = (user: User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  citizenshipNumber: user.citizenshipNumber,
  admin: user.admin,
  verified: user.verified,
});
