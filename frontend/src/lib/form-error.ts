import { ApiError, HttpStatus } from "./api";
import { FormMessage } from "./messages";

export const toFormMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) return FormMessage.Generic;
  if (error.statusCode === HttpStatus.Unauthorized) return FormMessage.InvalidCredentials;
  if (error.statusCode === HttpStatus.TooManyRequests) return FormMessage.TooManyAttempts;
  if (error.statusCode === HttpStatus.BadRequest) return error.message || FormMessage.Generic;
  return FormMessage.Generic;
};
