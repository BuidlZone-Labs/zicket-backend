# 🚀 Zicket API

Zicket's backend built with **Express**, **TypeScript**, **Mongoose**, and **Jest** for testing.

## ⚙️ Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (v18+ recommended): [Download](https://nodejs.org/)
- **npm** (comes with Node.js) or [Yarn](https://yarnpkg.com/)
- **MongoDB** (local or cloud): [Install MongoDB](https://www.mongodb.com/try/download/community)

---

## 📁 Project Structure

src/ <br>
├── config/ # Environment config and DB setup <br>
├── controllers/ # Request handlers <br>
├── models/ # Mongoose schemas <br>
├── routes/ # Express route definitions <br>
├── services/ # Business logic layer <br>
├── tests/ # Jest test files <br>
├── utils/ # Utility functions <br>
└── app.ts # Application grade <br>
└── server.ts # Application entry point <br>

---

---

## 📦 Installation

```bash
# 1. Fork the repository
Click fork
# 2. Clone it
git clone https://github.com/username/zicket-backend.git
cd zicket-backend

# 3. Install dependencies
npm install
```

---

## ⚙️ Environment Setup

Create a `.env` file in the root directory using this command: `cp .env.example .env`

> Make sure you **never commit `.env`** to version control.

---

🚀 Running the App
Development mode (with hot reloading):
`npm run dev`
Production mode:
`npm run build`
`npm start`

---

🧪 Running Tests

# Run all tests

`npm run test`
Tests are written using Jest and live inside the src/tests directory.

---

## **Logging & Security**

- **Centralized sanitizer**: A structured logger is initialized at startup in `src/utils/logger.ts`. It overrides console methods to emit JSON logs with fields `{ timestamp, level, message, data }`.
- **What is masked**: Email addresses (e.g. `alice@example.com` → `a***e@example.com`) and 0x wallet addresses (e.g. `0x1234...abcd`) are automatically redacted in log messages and object payloads.
- **Queue job IDs**: Queue job IDs no longer embed raw emails — `src/services/queue.service.ts` uses a short SHA256-based hash for job identifiers.
- **Known remaining item**: The rate limiter currently uses `email` in its key generator (`src/middlewares/rateLimiter.ts`). Consider hashing or omitting emails there if you prefer zero-email storage in logs/keys.
- **Verification**: Run the test suite and a small demo to verify masking:

```bash
npm run build
npm test
npx ts-node src/scripts/log-demo.ts
```

If you want logs integrated with a production logger (pino/winston) while keeping sanitization, we can add that next.


<br>

# 🤝 Contributing

Contributions are welcome! 🎉

- Fork this repo
- Create your feature branch: git checkout -b feature/your-feature
- Commit your changes: git commit -am 'Add new feature'
- After applying your change, run `npm run lint:check && npm run build && npm test`
- Push to the branch: git push origin feature/your-feature
- Open a pull request 🚀

Please follow the code style and add tests where applicable.

---

📬 Contact

Have questions or suggestions? Feel free to reach out in the community(https://t.me/+nlYw80w3FF1jNGY0) or open an issue.
