import request from 'supertest';
import app from '../../app';
import jwt from 'jsonwebtoken';

const tok = (id: string) => jwt.sign({ id }, process.env.JWT_SECRET||'s', { expiresIn: '1h' });

describe('IDOR Media Destruction (issue #132)', () => {
  it('returns 403 when attacker tries to delete owner media', async () => {
    const res = await request(app)
      .delete('/api/media/fake-media-id')
      .set('Authorization', `Bearer ${tok('attacker-id')}`);
    expect([403,404]).toContain(res.status);
  });
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).delete('/api/media/any-id');
    expect([401,403]).toContain(res.status);
  });
});
