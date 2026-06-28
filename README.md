# 🚀 Zicket Backend

Zicket backend built with **Express**, **TypeScript**, **Mongoose**, and **Jest** for testing.

## ⚙️ Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (v22+ recommended): [Download](https://nodejs.org/)
- **npm** (comes with Node.js) or [Yarn](https://yarnpkg.com/)
- **MongoDB** (local or cloud): [Install MongoDB](https://www.mongodb.com/try/download/community)

---

## 📁 Project Structure

```
src/ <br>
├── config/        # Environment config and DB setup
├── controllers/   # Request handlers
├── middlewares/   # Express middleware
├── models/        # Mongoose schemas
├── routes/        # Express route definitions
├── services/      # Business logic layer
├── tests/         # Jest test files
├── utils/         # Utility functions
└── app.ts         # Application grade
└── server.ts      # Application entry point
```

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

<br>

# 🤝 Contributing

Contributions are welcome! 🎉

- Fork this repo
- Create your feature branch: git checkout -b feature/your-feature
- Commit your changes using conventional commits: git commit -am 'feat: Add new feature' or 'fix: Fix bug' or 'chore: Update dependencies'
- After applying your change, run `npm run format && npm run lint:check` to follow the code style
- Run the tests `npm run test` to make sure the tests pass and the CI will run all the tests on your pull request anyway
- Run `npm run build` to make sure the app compiles successfully
- Push to the branch: git push origin feature/your-feature
- Open a pull request 🚀

Please follow the code style and add tests where applicable.

---

📬 Contact

Have questions or suggestions? Feel free to reach out in the community(https://t.me/+nlYw80w3FF1jNGY0) or open an issue.
