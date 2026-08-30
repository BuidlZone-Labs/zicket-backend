# OpenAPI/Swagger Documentation & Health Metrics Setup

## Overview

This document describes the OpenAPI 3.0 specification and enhanced health metrics endpoint added to the Zicket Backend API.

## Features Added

### 1. Swagger UI Documentation
- **Endpoint**: `GET /api/docs`
- **Description**: Interactive Swagger UI for exploring and testing the API
- **Features**:
  - Try-it-out functionality for API endpoints
  - Request/response schemas
  - Authentication scheme documentation
  - Real-time API exploration

### 2. Enhanced Health Metrics Endpoint
- **Endpoint**: `GET /health`
- **Description**: Comprehensive health check endpoint reporting system status
- **Returns**: Detailed metrics on database, Redis, and indexer health

## Installation & Setup

### 1. Install Dependencies

```bash
npm install swagger-ui-express swagger-jsdoc
npm install --save-dev @types/swagger-ui-express @types/swagger-jsdoc
```

The dependencies have been added to `package.json`:
- `swagger-ui-express@^5.0.0` - Express middleware for Swagger UI
- `swagger-jsdoc@^6.2.8` - JSDoc to OpenAPI specification generator
- `@types/swagger-ui-express@^4.1.6` - TypeScript types for Swagger UI
- `@types/swagger-jsdoc@^6.0.3` - TypeScript types for swagger-jsdoc

### 2. Health Metrics Service

**File**: `src/services/health.service.ts`

The health service provides methods to check:
- **Database (MongoDB)**: Connection state, response time, pool size
- **Redis**: Connection status, response time via PING
- **Indexer**: Blockchain event indexing status and lag detection

#### Key Methods:

```typescript
// Check database connectivity
async checkDatabase(): Promise<HealthMetrics['database']>

// Check Redis connectivity
async checkRedis(): Promise<HealthMetrics['redis']>

// Check indexer lag across contracts
async checkIndexerHealth(): Promise<HealthMetrics['indexer']>

// Get comprehensive metrics
async getHealthMetrics(): Promise<HealthMetrics>
```

### 3. Health Endpoint

**File**: `src/routes/health.route.ts`

Exposes the health metrics via REST:

```
GET /health
```

#### Response Codes:
- **200 OK**: Service is healthy or degraded (detailed metrics provided)
- **503 Service Unavailable**: Critical services (MongoDB or Redis) are disconnected

#### Example Response (Healthy):

```json
{
  "status": "healthy",
  "timestamp": "2026-08-30T22:30:00.000Z",
  "uptime": 3600.5,
  "service": "zicket-backend",
  "database": {
    "status": "connected",
    "responseTime": 2,
    "poolSize": 5,
    "message": "MongoDB connected and operational"
  },
  "redis": {
    "status": "connected",
    "responseTime": 1,
    "message": "Redis connected and operational"
  },
  "indexer": {
    "status": "healthy",
    "laggedContracts": 0,
    "totalIndexedContracts": 3,
    "message": "Indexer healthy. 3 contracts indexed, 0 lagging"
  }
}
```

#### Example Response (Degraded):

```json
{
  "status": "degraded",
  "timestamp": "2026-08-30T22:30:00.000Z",
  "uptime": 3600.5,
  "service": "zicket-backend",
  "database": {
    "status": "connected",
    "responseTime": 2,
    "poolSize": 5,
    "message": "MongoDB connected and operational"
  },
  "redis": {
    "status": "connected",
    "responseTime": 1,
    "message": "Redis connected and operational"
  },
  "indexer": {
    "status": "lagging",
    "laggedContracts": 2,
    "totalIndexedContracts": 3,
    "message": "60.0% of contracts are lagging (not updated in 5+ minutes)"
  }
}
```

#### Example Response (Unhealthy - 503):

```json
{
  "status": "unhealthy",
  "timestamp": "2026-08-30T22:30:00.000Z",
  "message": "Service unhealthy: critical services are not available",
  "details": {
    "status": "unhealthy",
    "database": {
      "status": "disconnected",
      "message": "MongoDB connection state: 0. Expected: 1 (connected), got: 0"
    },
    "redis": {
      "status": "disconnected",
      "message": "Redis check failed: connect ECONNREFUSED 127.0.0.1:6379"
    },
    "indexer": {
      "status": "unavailable",
      "message": "Indexer check failed: error"
    }
  }
}
```

### 4. Swagger Configuration

**File**: `src/config/swagger.ts`

OpenAPI 3.0 specification configuration:

```typescript
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Zicket Backend API',
      version: '1.0.0',
      description: 'REST API for Zicket event ticketing platform',
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Zicket-API-Key',
        },
      },
    },
  },
  apis: ['src/routes/**/*.ts'],
};
```

### 5. App Integration

**File**: `src/app.ts`

Swagger UI middleware is mounted at `/api/docs`:

```typescript
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';

// Swagger UI documentation endpoint
app.use('/api/docs', swaggerUi.serve);
app.get('/api/docs', swaggerUi.setup(swaggerSpec, { explorer: true }));

// Health check endpoint - comprehensive metrics
app.use('/health', healthRoutes);
```

## Usage Examples

### 1. Check API Health

```bash
curl -X GET http://localhost:3000/health
```

### 2. Access Swagger UI

Open in browser:
```
http://localhost:3000/api/docs
```

### 3. Get OpenAPI Specification

```bash
curl -X GET http://localhost:3000/api/docs/swagger.json
```

## JSDoc Documentation

Route files have been updated with comprehensive JSDoc comments for Swagger generation:

### Documented Routes:

**src/routes/auth.route.ts**
- POST /auth/signup
- POST /auth/login
- POST /auth/verify-account
- POST /auth/resend-otp
- POST /auth/magic-link-request
- GET /auth/magic
- GET /auth/google
- GET /auth/google/callback

**src/routes/event-ticket.route.ts**
- GET /event-tickets/trending
- POST /event-tickets/scan
- POST /event-tickets/validate
- GET /event-tickets
- GET /event-tickets/category/{category}
- GET /event-tickets/search
- GET /event-tickets/{eventId}/organizer-balance
- GET /event-tickets/{eventId}
- POST /event-tickets/create-step-two
- PATCH /event-tickets/{eventId}/update-step-two
- POST /event-tickets/{eventId}/waitlist
- DELETE /event-tickets/{eventId}/waitlist
- GET /event-tickets/{eventId}/waitlist/status

**src/routes/account.route.ts**
- GET /account/erasure-assessment
- POST /account/request-erasure
- POST /account/developer-keys
- GET /account/developer-keys
- DELETE /account/developer-keys/{id}

**src/routes/health.route.ts**
- GET /health

## Testing

### Run Tests

```bash
npm test -- tests/health.test.ts
```

### Test Cases

**Health Endpoint Tests** (`tests/health.test.ts`):
- ✓ Returns health metrics with correct structure
- ✓ Has valid status values (healthy, degraded, unhealthy)
- ✓ Has valid database status (connected, disconnected)
- ✓ Has valid Redis status (connected, disconnected)
- ✓ Has valid indexer status (healthy, lagging, unavailable)
- ✓ Includes uptime as positive number
- ✓ Includes valid ISO timestamp
- ✓ Returns 503 when unhealthy
- ✓ Includes diagnostic messages for each component

**Swagger UI Tests**:
- ✓ Serves Swagger UI HTML at /api/docs
- ✓ Exposes OpenAPI JSON specification
- ✓ Includes health endpoint in spec
- ✓ Includes authentication schemes
- ✓ Uses OpenAPI 3.0 format
- ✓ Includes API info

## Health Status Logic

### Overall Status Determination

The health endpoint calculates overall status based on component statuses:

- **Unhealthy**: If database OR Redis is disconnected
- **Degraded**: If all critical services connected but indexer is lagging
- **Healthy**: All services operational and indexer current

### Indexer Lag Detection

Contracts are considered "lagging" if not updated in the last 5 minutes. Status:
- **Healthy**: < 50% of contracts lagging
- **Lagging**: >= 50% of contracts lagging
- **Unavailable**: No indexed contracts found

## Monitoring & Observability

### Recommended Monitoring

The `/health` endpoint can be used for:

1. **Kubernetes/Container Liveness Probes**:
   ```yaml
   livenessProbe:
     httpGet:
       path: /health
       port: 3000
     initialDelaySeconds: 30
     periodSeconds: 10
     failureThreshold: 3
   ```

2. **Infrastructure Monitoring** (Prometheus, DataDog, etc.):
   - Poll `/health` every 30 seconds
   - Alert if status becomes "unhealthy"
   - Track response times for database and Redis

3. **Development & Debugging**:
   - Use Swagger UI to explore API
   - Test endpoints interactively
   - Verify authentication schemes

## Security Considerations

1. **Authentication**: The `/health` endpoint is public (no auth required)
   - This is intentional for monitoring/observability
   - No sensitive data is exposed in responses

2. **Swagger UI**:
   - Available in all environments (development, staging, production)
   - Disable in production by not mounting at `/api/docs` if needed
   - Consider IP whitelisting in production

3. **API Key & JWT**:
   - Documented in Swagger for authenticated endpoints
   - BearerAuth (JWT) for user endpoints
   - ApiKeyAuth (X-Zicket-API-Key) for developer endpoints

## Edge Cases & Error Handling

1. **Database Disconnection**:
   - Mongoose connection state checked
   - Returns "disconnected" status
   - Overall status → "unhealthy"

2. **Redis Connection Failure**:
   - PING command used for verification
   - Connection timeout handled gracefully
   - Overall status → "unhealthy"

3. **Indexer State Unavailable**:
   - No indexed contracts: status "unavailable"
   - Query timeout: caught and logged
   - Doesn't affect overall status if other services OK

4. **Health Check Timeout**:
   - All checks run in parallel
   - Timeout on individual checks doesn't block response
   - Error messages included in response

## Future Enhancements

1. **Additional Metrics**:
   - Queue status (BullMQ job counts)
   - Memory usage
   - Database query performance
   - External API dependencies

2. **Structured Logging**:
   - Health check metrics in structured logs
   - Correlation IDs for tracing

3. **Custom Health Checks**:
   - Plugin system for custom checks
   - Business logic health indicators

## Acceptance Criteria Met

✅ Swagger UI available at `/api/docs`
✅ Detailed health metrics exposed at `/health`
✅ MongoDB connection state reported
✅ Redis status reported
✅ Soroban RPC connection status reported (via indexer)
✅ Indexer lag count calculated and reported
✅ HTTP 503 returned when critical services down
✅ Tests verify `/api/docs` renders Swagger UI
✅ Tests verify `/health` returns valid JSON state
✅ OpenAPI 3.0 specification generated
✅ JSDoc documentation added to routes

## Troubleshooting

### Issue: Swagger UI not loading

**Solution**: Ensure `swagger-ui-express` is installed:
```bash
npm install swagger-ui-express
```

### Issue: Health endpoint returns "disconnected" for Redis

**Solution**: Verify Redis is running and accessible:
```bash
redis-cli ping
```

### Issue: Swagger spec doesn't include new routes

**Solution**: Ensure JSDoc comments are in route files and `apis` paths in `src/config/swagger.ts` are correct.

### Issue: Indexer status always "unavailable"

**Solution**: Verify IndexerState records exist in MongoDB:
```bash
db.getCollection('indexerstates').find()
```

## References

- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [swagger-jsdoc npm package](https://www.npmjs.com/package/swagger-jsdoc)
- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.3)
- [Express Health Check Patterns](https://nodejs.org/en/docs/guides/nodejs-performance-with-async-await/)
