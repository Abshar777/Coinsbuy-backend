# Backend (Bun + Express + TypeScript)

CoinsBuy test-mode API bridge for frontend testing.

## Setup

```bash
cd /Users/mhdabshar/delta/crm/coinseBuy/backend
cp .env.example .env
npm install
npm run dev
```

Server starts on `http://localhost:3000`.

## Endpoints

- `GET /api/health` - checks CoinsBuy sandbox `/ping`
- `GET /api/coinsbuy/wallets` - list wallets for authenticated account
- `POST /api/coinsbuy/deposits` - create deposit/payment page
- `GET /api/coinsbuy/deposits/:id` - fetch a specific deposit
- `POST /api/coinsbuy/callback` - local callback receiver (logs payload)

## Example create deposit body

```json
{
  "walletId": "4",
  "label": "Order #1001",
  "trackingId": "order-1001",
  "callbackUrl": "https://example.com/callback",
  "confirmationsNeeded": 1,
  "paymentPageRedirectUrl": "https://example.com/thanks",
  "paymentPageButtonText": "Return to store"
}
```
