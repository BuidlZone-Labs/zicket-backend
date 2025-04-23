import app from './app';
import config from './config/config';
import { mongoConnect } from './config/db.mongo';

async function startServer() {
  await mongoConnect();
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}

startServer();
module.exports = app;
