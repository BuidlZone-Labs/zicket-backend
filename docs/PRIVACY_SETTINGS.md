# Event Ticket Privacy Settings

## Privacy Settings Fields

### Required Enums
- **privacyLevel**: `anonymous`, `wallet-required`, `verified-access`
- **attendanceMode**: `online`, `in-person`, `hybrid`
- **eventType**: `FREE`, `PAID` (requires wallet-required for PAID)
- **locationType**: `exact`, `general`
- **paymentPrivacy**: `anonymous`, `public`

### Boolean Fields
- **offerReceipts**: boolean
- **hasZkEmailUpdates**: boolean
- **hasEventReminders**: boolean
- **isPublished**: boolean

### Ticket Types (Array)
```typescript
{
  ticketName: string,
  quantity: number,
  currencyOrToken: string,
  price: number
}
```

## Business Rules
1. PAID events MUST have `privacyLevel: wallet-required`
2. FREE events cannot have tickets with price > 0
3. PAID events must have at least one ticket with price > 0

## Endpoints
- POST `/event-tickets` - Create event with privacy settings
- PATCH `/event-tickets/:ticketId/privacy` - Update privacy settings
