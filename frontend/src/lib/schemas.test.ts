import { describe, expect, it } from "vitest";
import {
  FieldName,
  PasswordRule,
  signInSchema,
  signUpSchema,
} from "./schemas";

const validSignUp = {
  [FieldName.Email]: "ada@example.com",
  [FieldName.Name]: "Ada",
  [FieldName.Password]: "correct-horse-1",
};

const passwordIssues = (password: string) => {
  const result = signUpSchema.safeParse({ ...validSignUp, [FieldName.Password]: password });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("signUpSchema", () => {
  it("accepts valid input", () => {
    expect(signUpSchema.safeParse(validSignUp).success).toBe(true);
  });

  it("trims and lowercases the email", () => {
    const result = signUpSchema.parse({
      ...validSignUp,
      [FieldName.Email]: "  Ada@Example.COM ",
    });
    expect(result[FieldName.Email]).toBe("ada@example.com");
  });

  it.each(["", "not-an-email", "a@b", "a b@example.com"])("rejects email %j", (email) => {
    expect(signUpSchema.safeParse({ ...validSignUp, [FieldName.Email]: email }).success).toBe(false);
  });

  it("rejects an email longer than 254 characters", () => {
    const email = `${"a".repeat(250)}@example.com`;
    expect(signUpSchema.safeParse({ ...validSignUp, [FieldName.Email]: email }).success).toBe(false);
  });

  it("trims the name and requires 3 to 100 characters", () => {
    const parse = (name: string) =>
      signUpSchema.safeParse({ ...validSignUp, [FieldName.Name]: name });
    expect(parse("Ada").success).toBe(true);
    expect(parse("  Al  ").success).toBe(false);
    expect(parse("ab").success).toBe(false);
    expect(parse("a".repeat(100)).success).toBe(true);
    expect(parse("a".repeat(101)).success).toBe(false);
  });

  it("accepts a password that meets every rule", () => {
    expect(passwordIssues("abcdefg1!")).toEqual([]);
    expect(passwordIssues("pässwörd1?")).toEqual([]);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(passwordIssues("abc12!")).toEqual([PasswordRule.Length]);
  });

  it("rejects a password longer than 128 characters", () => {
    expect(passwordIssues(`a1!${"x".repeat(126)}`)).toHaveLength(1);
    expect(passwordIssues(`a1!${"x".repeat(125)}`)).toEqual([]);
  });

  it("rejects a password without a letter", () => {
    expect(passwordIssues("12345678!")).toEqual([PasswordRule.Letter]);
  });

  it("rejects a password without a digit", () => {
    expect(passwordIssues("abcdefgh!")).toEqual([PasswordRule.Digit]);
  });

  it("rejects a password without a special character", () => {
    expect(passwordIssues("abcdefg12")).toEqual([PasswordRule.Special]);
  });

  it("does not count whitespace as a special character", () => {
    expect(passwordIssues("abcdef 12")).toEqual([PasswordRule.Special]);
  });

  it("rejects missing fields", () => {
    expect(signUpSchema.safeParse({}).success).toBe(false);
  });
});

describe("signInSchema", () => {
  const validSignIn = {
    [FieldName.Email]: "ada@example.com",
    [FieldName.Password]: "x",
  };

  it("accepts any non-empty password without complexity checks", () => {
    expect(signInSchema.safeParse(validSignIn).success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(signInSchema.safeParse({ ...validSignIn, [FieldName.Password]: "" }).success).toBe(false);
  });

  it("rejects a password longer than 128 characters", () => {
    const password = "a".repeat(129);
    expect(signInSchema.safeParse({ ...validSignIn, [FieldName.Password]: password }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(signInSchema.safeParse({ ...validSignIn, [FieldName.Email]: "nope" }).success).toBe(false);
  });
});
