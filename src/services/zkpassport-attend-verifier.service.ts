import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import * as snarkjs from 'snarkjs';
import { ZkProofPayload } from '../services/zk-orchestrator.service';
import { isZkPassportProofExpired } from '../utils/zkpassport-expiry';

export interface ZkPassportAttendVerification {
  nullifier: string;
}

/**
 * Verifies zkPassport attendance proofs via external relay or local circuit (#121).
 * Raw proof bytes are never persisted — only the nullifier hash is returned.
 */
export class ZkPassportAttendVerifier {
  /**
   * Validates proof expiry, then relays or locally verifies the Groth16 proof.
   */
  static async verify(
    payload: ZkProofPayload,
  ): Promise<ZkPassportAttendVerification | null> {
    if (
      !payload.proof ||
      !payload.publicSignals ||
      payload.publicSignals.length === 0
    ) {
      return null;
    }

    if (isZkPassportProofExpired(payload.publicSignals)) {
      return null;
    }

    const relayUrl = process.env.ZKPASSPORT_RELAY_URL;
    if (relayUrl) {
      return this.verifyViaRelay(relayUrl, payload);
    }

    return this.verifyLocally(payload);
  }

  private static async verifyViaRelay(
    relayUrl: string,
    payload: ZkProofPayload,
  ): Promise<ZkPassportAttendVerification | null> {
    try {
      const body = JSON.stringify({
        proof: payload.proof,
        publicSignals: payload.publicSignals,
      });

      const responseBody = await new Promise<string>((resolve, reject) => {
        const url = new URL(relayUrl);
        const lib = url.protocol === 'https:' ? https : http;
        const req = lib.request(
          {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
              const text = Buffer.concat(chunks).toString('utf8');
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve(text);
              } else {
                reject(new Error(`zkPassport relay status ${res.statusCode}`));
              }
            });
          },
        );
        req.on('error', reject);
        req.write(body);
        req.end();
      });

      const parsed = JSON.parse(responseBody) as {
        valid?: boolean;
        nullifier?: string;
      };

      if (!parsed.valid) {
        return null;
      }

      const nullifier =
        parsed.nullifier?.toString() || payload.publicSignals[0]?.toString();
      if (!nullifier) {
        return null;
      }

      return { nullifier };
    } catch (error) {
      console.error('[ZkPassportAttendVerifier] relay error:', error);
      return null;
    }
  }

  private static async verifyLocally(
    payload: ZkProofPayload,
  ): Promise<ZkPassportAttendVerification | null> {
    try {
      const vKeyPath = path.join(
        __dirname,
        '../../config/zk-passport-vkey.json',
      );

      if (!fs.existsSync(vKeyPath)) {
        if (process.env.NODE_ENV === 'production') {
          console.error(
            '[ZkPassportAttendVerifier] Missing vKey in production',
          );
          return null;
        }
        console.warn(
          '[ZkPassportAttendVerifier] Missing vKey — mock verify for dev',
        );
        return { nullifier: payload.publicSignals[0].toString() };
      }

      const vKey = JSON.parse(fs.readFileSync(vKeyPath, 'utf-8'));
      const isValid = await snarkjs.groth16.verify(
        vKey,
        payload.publicSignals,
        payload.proof,
      );

      if (!isValid) {
        return null;
      }

      return { nullifier: payload.publicSignals[0].toString() };
    } catch (error) {
      console.error('[ZkPassportAttendVerifier] local verify error:', error);
      return null;
    }
  }
}
