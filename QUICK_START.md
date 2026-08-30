# Quick Start: OpenAPI/Swagger & Health Metrics

## What's New?

- 🔍 **Swagger UI** at `GET /api/docs` - Interactive API documentation
- 💚 **Enhanced Health Endpoint** at `GET /health` - System status monitoring

---

## Getting Started (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Open Swagger UI
```
http://localhost:3000/api/docs
```

### 4. Test Health Endpoint
```bash
curl http://localhost:3000/health
```

---

## Testing

### Run All Tests
```bash
npm test
```

### Run Health Tests Only
```bash
npm test -- tests/health.test.ts
```

### Test Swagger UI
```bash
curl http://localhost:3000/api/docs
```

### Test Health Endpoint
```bash
# Health check
curl http://localhost:3000/health

# With pretty formatting
curl http://localhost:3000/health | jq
```

---

## Key Endpoints

### Swagger Documentation
```
GET /api/docs          - Interactive UI
GET /api/docs/swagger.json - Raw OpenAPI spec
```

### Health Metrics
```
GET /health            - System health status
```

### Example Response
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

---

## Status Codes

| Status | Code | Meaning |
|--------|------|---------|
| Healthy | 200 | All services operational |
| Degraded | 200 | Services running but indexer lagging |
| Unhealthy | 503 | Critical services (DB/Redis) down |

---

## Files to Know

| File | Purpose |
|------|---------|
| `src/services/health.service.ts` | Health metrics logic |
| `src/routes/health.route.ts` | Health endpoint handler |
| `src/config/swagger.ts` | Swagger configuration |
| `tests/health.test.ts` | Test suite |
| `docs/SWAGGER_HEALTH_SETUP.md` | Detailed setup guide |
| `docs/IMPLEMENTATION_SUMMARY.md` | Technical details |

---

## Common Tasks

### Check MongoDB Status
```bash
curl http://localhost:3000/health | jq '.database'
```

### Check Redis Status
```bash
curl http://localhost:3000/health | jq '.redis'
```

### Check Indexer Status
```bash
curl http://localhost:3000/health | jq '.indexer'
```

### Get Just Overall Status
```bash
curl http://localhost:3000/health | jq '.status'
```

### Monitor Health Continuously
```bash
watch -n 5 'curl -s http://localhost:3000/health | jq'
```

---

## Documentation

- 📖 **Setup Guide**: `docs/SWAGGER_HEALTH_SETUP.md`
- 🔧 **Implementation Details**: `docs/IMPLEMENTATION_SUMMARY.md`
- ✅ **Verification Checklist**: `FEATURE_VERIFICATION.md`

---

## Troubleshooting

### Swagger UI blank?
- Check browser console for errors
- Verify npm dependencies installed
- Try clearing browser cache

### Health endpoint returns disconnected?
- Check MongoDB is running: `mongo --version`
- Check Redis is running: `redis-cli ping`
- Check connection strings in environment

### Tests failing?
- Run `npm install` first
- Ensure MongoDB and Redis are running
- Check Node.js version (14+ required)

---

## Environment Variables

No new environment variables required! These optional ones customize behavior:

```bash
# API base URL for Swagger (default: http://localhost:3000)
API_BASE_URL=http://api.example.com

# Node environment (default: development)
NODE_ENV=production

# Existing MongoDB connection
MONGO_URI=mongodb://localhost:27017

# Existing Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Architecture Overview

```
Client
  ↓
GET /api/docs → Swagger UI (swagger-ui-express)
GET /health   → Health Service (src/services/health.service.ts)
  ↓
Health Service
  ├→ checkDatabase()    → MongoDB status
  ├→ checkRedis()       → Redis status
  └→ checkIndexerHealth() → Indexer lag
  ↓
Response (200 or 503)
```

---

## Security Notes

- ✅ Health endpoint needs NO authentication (for monitoring)
- ✅ No sensitive data exposed in responses
- ✅ Swagger UI safe for public access
- ✅ API keys & JWT documented in Swagger

---

## Performance

- ⚡ Health checks: <50ms typical
- ⚡ Runs in parallel (fast)
- ⚡ No blocking operations
- ⚡ Can be called frequently

---

## Monitoring & Observability

Use `/health` for:
- ✅ Kubernetes probes
- ✅ Docker health checks
- ✅ Infrastructure monitoring
- ✅ Load balancer checks
- ✅ Synthetic monitoring

---

## Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Start server: `npm run dev`
3. ✅ Visit Swagger: `http://localhost:3000/api/docs`
4. ✅ Test health: `curl http://localhost:3000/health`
5. ✅ Read docs: `docs/SWAGGER_HEALTH_SETUP.md`

---

## Support

For issues or questions:
1. Check `docs/SWAGGER_HEALTH_SETUP.md` (Troubleshooting section)
2. Review `tests/health.test.ts` for examples
3. See GitHub issue #180 for context

---

**Ready to go!** 🚀

For detailed information, see the documentation files.
For examples and troubleshooting, see `FEATURE_VERIFICATION.md`.
