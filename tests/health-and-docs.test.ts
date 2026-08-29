import request from 'supertest';
import app from '../src/app';
import mongoose from 'mongoose';

describe('Health and OpenAPI Docs Endpoints', () => {
  it('GET /health returns detailed JSON metrics', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('database');
    expect(res.body.database).toHaveProperty('status');
    expect(res.body).toHaveProperty('redis');
    expect(res.body).toHaveProperty('sorobanRpc');
  });

  it('GET /api/docs serves Swagger UI HTML page', async () => {
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('SwaggerUIBundle');
    expect(res.text).toContain('Zicket API Documentation');
  });

  it('GET /api/docs/json returns valid OpenAPI 3.0 specification JSON', async () => {
    const res = await request(app).get('/api/docs/json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toBe('Zicket Backend API');
    expect(res.body.paths).toHaveProperty('/health');
    expect(res.body.paths).toHaveProperty('/auth/register');
  });
});
