# 🚀 Zicket API

Zicket's backend built with **Express**, **TypeScript**, **Mongoose**, and **Jest** for testing.

## ⚙️ Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (v18+ recommended): [Download](https://nodejs.org/)
- **npm** (comes with Node.js) or [Yarn](https://yarnpkg.com/)
- **MongoDB** (local or cloud): [Install MongoDB](https://www.mongodb.com/try/download/community)

---


## 📁 Project Structure
src/ 
  ├── config/ # Environment config and DB setup 
  ├── controllers/ # Request handlers 
  ├── models/ # Mongoose schemas 
  ├── routes/ # Express route definitions ├── services/ # Business logic layer ├── tests/ # Jest test files 
  ├── utils/ # Utility functions 
  └── app.ts # Application grade
  └── server.ts # Application entry point
---



---

## 📦 Installation

```bash
# 1. Clone the repository
git clone https://github.com/BuidlZone-Labs/zicket-backend.git
cd zicket-backend

# 2. Install dependencies
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