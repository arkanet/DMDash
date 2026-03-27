import { x25519 } from "@noble/curves/ed25519";

export function getX25519PrivateKey(): Uint8Array {
  const key = x25519.utils.randomPrivateKey();
  if (key.length < 32) {
    throw new Error("Invalid X25519 private key length");
  }

  // scalar clamping for curve25519, according to
  // https://www.rfc-editor.org/rfc/rfc7748#section-5
  key[0] = (key[0] ?? 0) & 248;
  key[31] = (key[31] ?? 0) & 127;
  key[31] |= 64;

  return key;
}

export function getX25519PublicKey(privateKey: Uint8Array): Uint8Array {
  return x25519.getPublicKey(privateKey);
}
