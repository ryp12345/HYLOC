require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

const getAllowedOrigins = () => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:3001',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ];

  return (origin, callback) => {
    if (!origin) {
      // Allow non-origin requests (like mobile apps or Postman)
      return callback(null, true);
    }

    if (nodeEnv === 'development' && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const isDevelopmentOrigin = nodeEnv === 'development' &&
      /^http:\/\/(\d{1,3}\.){3}\d{1,3}:(3000|3001|5000|5173)$/.test(origin);
    if (isDevelopmentOrigin) {
      return callback(null, true);
    }

    if (nodeEnv !== 'development' && origin === 'https://hyloc.git.edu') {
      return callback(null, true);
    }

    console.warn(`CORS: Origin not allowed: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  };
};

const config = {
  nodeEnv,
  port: process.env.PORT || 3001,
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'hyloc',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '7d'
  },
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASS
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  }
};

config.validateEnvironment = () => {
  const missing = [];
  if (!process.env.DB_PASS) missing.push('DB_PASS');
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.JWT_REFRESH_SECRET) missing.push('JWT_REFRESH_SECRET');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

module.exports = config;
