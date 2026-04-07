import { randomBytes } from "node:crypto";

export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function generatePassword(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}
