import {
  extractZkPassportExpiryUnix,
  isZkPassportProofExpired,
} from '../src/utils/zkpassport-expiry';

describe('zkpassport-expiry', () => {
  it('parses Unix expiry from publicSignals[2]', () => {
    const expiry = extractZkPassportExpiryUnix(['nullifier', 'birth', '1893456000']);
    expect(expiry).toBe(1893456000);
  });

  it('parses YYYYMMDD expiry from publicSignals[2]', () => {
    const expiry = extractZkPassportExpiryUnix(['nullifier', 'birth', '20301231']);
    expect(expiry).not.toBeNull();
    expect(isZkPassportProofExpired(['n', 'b', '20301231'], Date.UTC(2030, 11, 31))).toBe(
      false,
    );
  });

  it('treats missing expiry signal as expired', () => {
    expect(isZkPassportProofExpired(['only-nullifier'])).toBe(true);
  });

  it('rejects proofs past expiry before relay', () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    expect(
      isZkPassportProofExpired(['nullifier', 'birth', past.toString()]),
    ).toBe(true);
  });
});
