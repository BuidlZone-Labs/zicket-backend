import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Zicket Backend API',
      version: '1.0.0',
      description: 'REST API for Zicket event ticketing platform built on blockchain',
      contact: {
        name: 'Zicket Team',
        url: 'https://github.com/BuidlZone-Labs/zicket-backend',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3000',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token for protected routes',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Zicket-API-Key',
          description: 'API Key for developer/public API endpoints',
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: [
    'src/routes/**/*.ts', // Include all route files
    'src/middlewares/**/*.ts', // Include middleware if documented
  ],
};

/**
 * Generate OpenAPI/Swagger specification
 */
const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
