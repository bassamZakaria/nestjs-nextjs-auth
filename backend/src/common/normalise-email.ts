export const normaliseEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
