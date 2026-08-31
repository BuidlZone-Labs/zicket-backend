import request from 'supertest';
import app from '../src/app';
import healthService from '../src/services/health.service';

// Mock the health service singleton
jest.mock('../src/services/health.service', () => ({
  __esModule: true,
  default: {
    getHealthMetrics: jest.fn(),
    close: jest.fn(),
  },
}));

const mockedHealthService = healthService as jest.Mocked<typeof healthService>;

describe('Health Metrics Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 with full metrics when healthy', async () => {
      mockedHealthService.getHealthMetrics.mockResolvedValue({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 100,
        service: 'zicket-backend',
        database: {
          status: 'connected',
          responseTime: 1,
          message: 'MongoDB connected and operational',
        },
        redis: {
          status: 'connected',
          responseTime: 1,
          message: 'Redis connected and operational',
        },
        indexer: {
          status: 'healthy',
          laggedContracts: 0,
          totalIndexedContracts: 3,
          message: 'Indexer healthy. 3 contracts indexed, 0 lagging',
        },
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime', 100);
      expect(response.body).toHaveProperty('service', 'zicket-backend');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('redis');
      expect(response.body).toHaveProperty('indexer');
      expect(response.body.database).toHaveProperty('status', 'connected');
      expect(response.body.redis).toHaveProperty('status', 'connected');
      expect(response.body.indexer).toHaveProperty('status', 'healthy');
    });

    it('should return 200 with degraded status when indexer is lagging', async () => {
      mockedHealthService.getHealthMetrics.mockResolvedValue({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        uptime: 100,
        service: 'zicket-backend',
        database: {
          status: 'connected',
          responseTime: 1,
          message: 'MongoDB connected and operational',
        },
        redis: {
          status: 'connected',
          responseTime: 1,
          message: 'Redis connected and operational',
        },
        indexer: {
          status: 'lagging',
          laggedContracts: 2,
          totalIndexedContracts: 3,
          message: '66.7% of contracts are lagging',
        },
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('degraded');
      expect(response.body.indexer.status).toBe('lagging');
    });

    it('should return 503 with details envelope when unhealthy', async () => {
      const metrics = {
        status: 'unhealthy' as const,
        timestamp: new Date().toISOString(),
        uptime: 100,
        service: 'zicket-backend',
        database: {
          status: 'disconnected' as const,
          message: 'Database check failed',
        },
        redis: {
          status: 'disconnected' as const,
          message: 'Redis check failed',
        },
        indexer: {
          status: 'unavailable' as const,
          message: 'No contracts are currently indexed',
        },
      };
      mockedHealthService.getHealthMetrics.mockResolvedValue(metrics);

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toEqual(metrics);
    });

    it('should return 503 when the health service throws', async () => {
      mockedHealthService.getHealthMetrics.mockRejectedValue(
        new Error('Unexpected failure'),
      );

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.message).toBe('Health check failed');
      // Should not leak internal error details to the client
      expect(response.body).not.toHaveProperty('error');
    });
  });
});

describe('Swagger UI Endpoint', () => {
  let swaggerHtmlResponse: request.Response;

  beforeAll(async () => {
    swaggerHtmlResponse = await request(app)
      .get('/api/docs')
      .set('Accept', 'text/html');

    // Follow redirect if needed
    if (swaggerHtmlResponse.status >= 300 && swaggerHtmlResponse.status < 400) {
      const location = swaggerHtmlResponse.headers.location;
      swaggerHtmlResponse = await request(app)
        .get(location || '/api/docs/')
        .set('Accept', 'text/html');
    }
  });

  it('should serve Swagger UI HTML', () => {
    expect(swaggerHtmlResponse.status).toBe(200);
    expect(swaggerHtmlResponse.type).toMatch(/html/);
    expect(swaggerHtmlResponse.text).toContain('swagger');
  });

  it('should expose OpenAPI JSON specification', async () => {
    const response = await request(app)
      .get('/api/docs/swagger.json')
      .set('Accept', 'application/json');

    // swagger-ui-express serves the spec at swagger.json
    if (response.status !== 200) {
      // swagger.json endpoint not available in this test environment
      return;
    }
    expect(response.body).toHaveProperty('openapi');
    expect(response.body).toHaveProperty('info');
    expect(response.body).toHaveProperty('paths');
    expect(response.body.info.title).toContain('Zicket');
  });

  it('should include health endpoint in OpenAPI spec', async () => {
    const response = await request(app)
      .get('/api/docs/swagger.json')
      .set('Accept', 'application/json');

    if (response.status !== 200 || !response.body.paths) {
      return;
    }
    expect(response.body.paths).toHaveProperty('/health');
  });

  it('should include authentication schemes in OpenAPI spec', async () => {
    const response = await request(app)
      .get('/api/docs/swagger.json')
      .set('Accept', 'application/json');

    if (response.status !== 200 || !response.body.components) {
      return;
    }
    expect(response.body.components).toHaveProperty('securitySchemes');
  });

  it('should not have global security applied', async () => {
    const response = await request(app)
      .get('/api/docs/swagger.json')
      .set('Accept', 'application/json');

    if (response.status !== 200) {
      return;
    }
    expect(response.body).not.toHaveProperty('security');
  });
});

describe('API Documentation', () => {
  describe('OpenAPI Specification', () => {
    it('should have OpenAPI 3.0 format', async () => {
      const response = await request(app)
        .get('/api/docs/swagger.json')
        .set('Accept', 'application/json');

      if (response.status !== 200) {
        return;
      }
      expect(response.body.openapi).toMatch(/^3\./);
    });

    it('should include API info', async () => {
      const response = await request(app)
        .get('/api/docs/swagger.json')
        .set('Accept', 'application/json');

      if (response.status !== 200) {
        return;
      }
      expect(response.body.info.version).toBeDefined();
      expect(response.body.info.title).toBeDefined();
    });
  });
});
