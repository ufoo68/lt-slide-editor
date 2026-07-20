import { createHash, randomBytes, timingSafeEqual } from "crypto";

const tokenPrefix = "ltsd";
const tokenSecretBytes = 32;

export function createDeckAgentToken(deckId: string) {
  const secret = randomBytes(tokenSecretBytes).toString("base64url");
  const token = [tokenPrefix, deckId, secret].join(".");

  return {
    token,
    tokenHash: hashDeckAgentToken(token),
  };
}

export function hashDeckAgentToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function parseDeckAgentToken(token: string) {
  const [prefix, deckId, secret] = token.split(".");

  if (prefix !== tokenPrefix || !deckId || !secret) {
    return null;
  }

  return { deckId, secret };
}

export function verifyDeckAgentToken(input: { expectedHash: string | null | undefined; token: string }) {
  if (!input.expectedHash) {
    return false;
  }

  const actualHash = hashDeckAgentToken(input.token);
  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(input.expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
