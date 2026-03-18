import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import plansRouter from './routes/plans';
import sessionsRouter from './routes/sessions';
import exercisesRouter from './routes/exercises';
import calendarRouter from './routes/calendar';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(helmet());
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/plans', plansRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/exercises', exercisesRouter);
app.use('/api/calendar', calendarRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

export default app;
