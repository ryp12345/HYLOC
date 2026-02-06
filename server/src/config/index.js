require('dotenv').config();

const getAllowedOrigins = () => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:3001'
  ];

  // Allow any IP-based origin for development (0.0.0.0:3000 or 192.168.x.x:3000, etc.)
  return (origin, callback) => {
    if (!origin) {
      // Allow non-origin requests (like mobile apps or Postman)
      return callback(null, true);
    }

    // Check if it's localhost or 127.0.0.1
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Check if it's an IP-based origin (for development)
    const ipPattern = /^https?:\/\/(localhost|127\.0\.0\.1|(\d{1,3}\.){3}\d{1,3}):\d+$/;
    if (ipPattern.test(origin)) {
      return callback(null, true);
    }

    // For production, you can add specific domains
    const productionOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (productionOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS: Origin not allowed: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  };
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3001,
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'hyloc',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'password'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'supersecret_access_please_change',
    expiresIn: process.env.JWT_EXPIRES || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'supersecret_refresh_please_change',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '7d'
  },
  // In development allow all origins to simplify local/network testing.
  cors: {
    origin: process.env.NODE_ENV === 'development' ? true : getAllowedOrigins(),
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
