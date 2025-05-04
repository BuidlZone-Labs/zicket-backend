import express from 'express';
import protectedRoute from './routes/protected.route';

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to Zicket API');
});

app.use(protectedRoute);

export default app;
