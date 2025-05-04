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

<br>

# 🤝 Contributing

Contributions are welcome! 🎉

Fork this repo

Create your feature branch: git checkout -b feature/your-feature

Commit your changes: git commit -am 'Add new feature'

Push to the branch: git push origin feature/your-feature

Open a pull request 🚀

Please follow the code style and add tests where applicable.

---


📬 Contact

Have questions or suggestions? Feel free to reach out or open an issue.
