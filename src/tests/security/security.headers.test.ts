import request from 'supertest';
import app from '../app';

describe('Security Headers and CORS (issue #139)', () => {
  describe('Security Headers via helmet', () => {
    it('sets X-Content-Type-Options: nosniff', async () => {
      const res = await request(app).get('/api/health').catch(() => request(app).get('/'));
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('sets X-Frame-Options: DENY', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('sets strict HSTS header', async () => {
      const res = await request(app).get('/');
      expect(res.headers['strict-transport-security']).toBeDefined();
    });
  });

  describe('CORS', () => {
    it('allows whitelisted origin', async () => {
      const res = await request(app)
        .get('/')
        .set('Origin', 'http://localhost:3000');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('blocks unlisted origin', async () => {
      const res = await request(app)
        .get('/')
        .set('Origin', 'https://evil.example.com');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
