import { z } from "zod";

export enum FieldName {
  Email = "email",
  Name = "name",
  Password = "password",
}

export enum PasswordRule {
  Length = "Minimum 8 characters",
  Letter = "At least one letter",
  Digit = "At least one number",
  Special = "At least one special character",
}

export const LETTER_PATTERN = /\p{L}/u;
export const DIGIT_PATTERN = /\d/;
export const SPECIAL_PATTERN = /[^\p{L}\p{N}\s]/u;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export const PASSWORD_CHECKS: ReadonlyArray<{
  rule: PasswordRule;
  test: (value: string) => boolean;
}> = [
  { rule: PasswordRule.Length, test: (v) => v.length >= MIN_PASSWORD_LENGTH },
  { rule: PasswordRule.Letter, test: (v) => LETTER_PATTERN.test(v) },
  { rule: PasswordRule.Digit, test: (v) => DIGIT_PATTERN.test(v) },
  { rule: PasswordRule.Special, test: (v) => SPECIAL_PATTERN.test(v) },
];

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email must be at most 254 characters")
  .pipe(z.email("Enter a valid email address"));

const name = z
  .string()
  .trim()
  .min(3, "Name must be at least 3 characters")
  .max(100, "Name must be at most 100 characters");

const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, PasswordRule.Length)
  .max(MAX_PASSWORD_LENGTH, "Password must be at most 128 characters")
  .regex(LETTER_PATTERN, PasswordRule.Letter)
  .regex(DIGIT_PATTERN, PasswordRule.Digit)
  .regex(SPECIAL_PATTERN, PasswordRule.Special);

const currentPassword = z
  .string()
  .min(1, "Enter your password")
  .max(MAX_PASSWORD_LENGTH, "Password must be at most 128 characters");

export const signUpSchema = z.object({
  [FieldName.Email]: email,
  [FieldName.Name]: name,
  [FieldName.Password]: newPassword,
});

export const signInSchema = z.object({
  [FieldName.Email]: email,
  [FieldName.Password]: currentPassword,
});

export type SignUpValues = z.infer<typeof signUpSchema>;
export type SignInValues = z.infer<typeof signInSchema>;
