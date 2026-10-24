import cors, { type CorsOptions } from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env, allowedOrigins } from './config/env.js';
import { ApiError, ErrorCode } from './domain/errors.js';
import { authenticate } from './middlewares/authenticate.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { apiRateLimiter } from './middlewares/rateLimit.js';
import { requestId } from './middlewares/requestId.js';
import { requestLogger } from './middlewares/requestLogger.js';
import apiRouter from './routes/index.js';

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Sin Origin = cliente no navegador (PowerShell/curl/servidor). Se permite.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(
      new ApiError(
        403,
        ErrorCode.FORBIDDEN,
        'El origen de la petición no está autorizado por CORS.',
        undefined,
        'Configure el origen en ALLOWED_ORIGINS (por ejemplo https://driwin.vercel.app).',
      ),
    );
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Accept',
    'X-API-Key',
    'Authorization',
    'X-Request-Id',
    'Idempotency-Key',
  ],
  exposedHeaders: ['X-Request-Id', 'Location', 'RateLimit', 'RateLimit-Policy'],
  maxAge: 600,
  credentials: false,
};

export const app = express();

// Detrás de Azure App Service / Front Door: una capa de proxy confiable.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(requestId);
app.use(helmet());
app.use(cors(corsOptions));
app.use(requestLogger);
app.use(express.json({ limit: '100kb', strict: true }));

// Contrato público versionado + límite de tasa + autenticación opcional.
app.use(env.API_BASE_PATH, apiRateLimiter, authenticate, apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
