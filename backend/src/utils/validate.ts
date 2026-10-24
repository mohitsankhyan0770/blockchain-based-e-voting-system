import * as yup from "yup";
import { HttpError } from "./http";

/** Validates and returns the cleaned value, or throws a 400 with a readable message. */
export async function validate<T extends yup.AnySchema>(schema: T, data: unknown): Promise<yup.InferType<T>> {
  try {
    return await schema.validate(data, { abortEarly: false, stripUnknown: true });
  } catch (error) {
    if (error instanceof yup.ValidationError) throw new HttpError(400, error.errors.join(", "));
    throw error;
  }
}
