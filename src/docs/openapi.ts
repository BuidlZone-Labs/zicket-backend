export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Zicket Backend API',
    version: '1.0.0',
    description:
      'OpenAPI 3.0 specification for Zicket ticket marketplace, zero-knowledge attendance, Stellar payments, and event services.',
    contact: {
      name: 'Zicket Support',
      url: 'https://github.com/BuidlZone-Labs/zicket-backend',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current Environment API Server',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'System Health and Observability Metrics',
        description:
          'Returns real-time health metrics including database connection status, Redis availability, and Soroban RPC status.',
        responses: {
          '200': {
            description: 'All backend systems are healthy.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse',
                },
              },
            },
          },
          '503': {
            description:
              'One or more critical subsystems (DB / Redis) are degraded or disconnected.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse',
                },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register new user account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'User successfully created' },
          '400': { description: 'Validation error or email already in use' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate and receive JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Authentication successful with JWT bearer token',
          },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/event-tickets': {
      get: {
        summary: 'List available event tickets',
        responses: {
          '200': { description: 'List of tickets returned successfully' },
        },
      },
    },
  },
  components: {
    schemas: {
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
          timestamp: { type: 'string', format: 'date-time' },
          uptime: { type: 'number' },
          service: { type: 'string' },
          database: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              readyState: { type: 'number' },
            },
          },
          redis: {
            type: 'object',
            properties: {
              status: { type: 'string' },
            },
          },
          sorobanRpc: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              network: { type: 'string' },
            },
          },
        },
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

export function renderSwaggerHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Zicket API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; background: #fafafa; }
    .topbar { display: none !important; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/docs/json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
}
