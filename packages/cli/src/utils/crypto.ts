import { randomBytes } from "node:crypto";

export function generateSecret(bytes = 24): string {
  return randomBytes(bytes).toString("hex");
}

