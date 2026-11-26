import { describe, expect, it } from "vitest";
import { ApiError, HttpStatus } from "./api";
import { toFormMessage } from "./form-error";
import { FormMessage } from "./messages";

describe("toFormMessage", () => {
  it.each([
    [HttpStatus.Unauthorized, FormMessage.InvalidCredentials],
    [HttpStatus.TooManyRequests, FormMessage.TooManyAttempts],
    [HttpStatus.BadGateway, FormMessage.Generic],
  ])("maps status %i", (status, message) => {
    expect(toFormMessage(new ApiError(status, "server text"))).toBe(message);
  });

  it("shows the server message for a 400", () => {
    expect(toFormMessage(new ApiError(HttpStatus.BadRequest, "email is too long"))).toBe("email is too long");
  });

  it("falls back to the generic message for an empty 400 message or a non-API error", () => {
    expect(toFormMessage(new ApiError(HttpStatus.BadRequest, ""))).toBe(FormMessage.Generic);
    expect(toFormMessage(new TypeError("network"))).toBe(FormMessage.Generic);
  });
});
