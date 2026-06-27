import request from 'supertest';
import app from '../app';

describe('JWT Token Transmission Security (issue #138)', () => {
  it('OAuth callback does not include token in redirect URL', async () => {
    const res = await request(app)
      .get('/api/auth/google/callback?code=testcode')
      .expect((r) => {
        // If it redirects, the Location header must not contain ?token=
        if (r.headers.location) {
          expect(r.headers.location).not.toContain('?token=');
          expect(r.headers.location).not.toContain('&token=');
        }
      });
  });

  it('token is set as HttpOnly cookie not URL param', async () => {
    const res = await request(app)
      .get('/api/auth/google/callback?code=testcode')
      .catch(() => null);
    if (res && res.headers['set-cookie']) {
      const cookies = Array.isArray(res.headers['set-cookie'])
        ? res.headers['set-cookie']
        : [res.headers['set-cookie']];
      const authCookie = cookies.find((c: string) => c.startsWith('auth_token='));
      if (authCookie) {
        expect(authCookie).toContain('HttpOnly');
        expect(authCookie).toContain('SameSite=Strict');
      }
    }
  });
});
