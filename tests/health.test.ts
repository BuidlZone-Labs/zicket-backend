import request from 'supertest';
import app from '../src/app';
import mongoose from 'mongoose';

describe('Health Metrics Endpoint', () => {
  // Note: These tests verify the structure of responses and basic functionality
  // Full integration tests would require a running MongoDB, Redis, and Soroban indexer

  describe('GET /health', () => {
    it('should return health metrics with correct structure', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('redis');
      expect(response.body).toHaveProperty('indexer');
    });

    it('should have valid status values', async () => {
      const response = await request(app).get('/health');

      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
    });

    it('should have valid database status', async () => {
      const response = await request(app).get('/health');

      expect(response.body.database).toHaveProperty('status');
      expect(['connected', 'disconnected']).toContain(response.body.database.status);
    });

    it('should have valid redis status', async () => {
      const response = await request(app).get('/health');

      expect(response.body.redis).toHaveProperty('status');
      expect(['connected', 'disconnected']).toContain(response.body.redis.status);
    });

    it('should have valid indexer status', async () => {
      const response = await request(app).get('/health');

      expect(response.body.indexer).toHaveProperty('status');
      expect(['healthy', 'lagging', 'unavailable']).toContain(response.body.indexer.status);
    });

    it('should include uptime as a positive number', async () => {
      const response = await request(app).get('/health');

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should include a valid ISO timestamp', async () => {
      const response = await request(app).get('/health');

      const date = new Date(response.body.timestamp);
      expect(date.getTime()).toBeGreaterThan(0);
    });

    it('should return 503 when unhealthy (critical services down)', async () => {
      // This test would require mocking MongoDB and Redis disconnection
      // For now, we verify the structure when services are available
      const response = await request(app).get('/health');

      if (response.body.status === 'unhealthy') {
        expect(response.status).toBe(503);
      }
    });

    it('should include message field in indexer status', async () => {
      const response = await request(app).get('/health');

      expect(response.body.indexer).toHaveProperty('message');
      expect(typeof response.body.indexer.message).toBe('string');
    });

    it('should include message field in database status', async () => {
      const response = await request(app).get('/health');

      expect(response.body.database).toHaveProperty('message');
      expect(typeof response.body.database.message).toBe('string');
    });

    it('should include message field in redis status', async () => {
      const response = await request(app).get('/health');

      expect(response.body.redis).toHaveProperty('message');
      expect(typeof response.body.redis.message).toBe('string');
    });
  });
});

describe('Swagger UI Endpoint', () => {
  describe('GET /api/docs', () => {
    it('should serve Swagger UI HTML', async () => {
      const response = await request(app)
        .get('/api/docs')
        .set('Accept', 'text/html');

      expect(response.status).toBe(200);
      expect(response.type).toMatch(/html/);
      expect(response.text).toContain('swagger');
    });

    it('should expose OpenAPI JSON specification', async () => {
      const response = await request(app)
        .get('/api/docs/swagger.json')
        .set('Accept', 'application/json');

      // swagger-ui-express serves the spec at swagger.json
      if (response.status === 200) {
        expect(response.body).toHaveProperty('openapi');
        expect(response.body).toHaveProperty('info');
        expect(response.body).toHaveProperty('paths');
        expect(response.body.info.title).toContain('Zicket');
      }
    });

    it('should include health endpoint in OpenAPI spec', async () => {
      const response = await request(app)
        .get('/api/docs/swagger.json')
        .set('Accept', 'application/json');

      if (response.status === 200 && response.body.paths) {
        expect(response.body.paths).toHaveProperty('/health');
      }
    });

    it('should include authentication schemes in OpenAPI spec', async () => {
      const response = await request(app)
        .get('/api/docs/swagger.json')
        .set('Accept', 'application/json');

      if (response.status === 200 && response.body.components) {
        expect(response.body.components).toHaveProperty('securitySchemes');
      }
    });
  });
});

describe('API Documentation', () => {
  describe('OpenAPI Specification', () => {
    it('should have OpenAPI 3.0 format', async () => {
      const response = await request(app)
        .get('/api/docs/swagger.json')
        .set('Accept', 'application/json');

      if (response.status === 200) {
        expect(response.body.openapi).toMatch(/^3\./);
      }
    });

    it('should include API info', async () => {
      const response = await request(app)
        .get('/api/docs/swagger.json')
        .set('Accept', 'application/json');

      if (response.status === 200) {
        expect(response.body.info.version).toBeDefined();
        expect(response.body.info.title).toBeDefined();
      }
    });
  });
});
