import express from 'express';
import protectedRoute from './routes/protected.route';
import otpRoute from './routes/otp.route';

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to Zicket API');
});

app.use('/auth', authRoute);
app.use('/auth', otpRoute);
app.use(protectedRoute);

export default app;
