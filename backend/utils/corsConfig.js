const DEFAULT_ORIGINS = [
  'https://unityhub1.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

const normalize = (url) => (url || '').trim().replace(/\/+$/, '');

const getAllowedOrigins = () => {
  const fromEnv = [
    process.env.FRONTEND_URL,
    ...(process.env.FRONTEND_URLS || '').split(','),
  ]
    .map(normalize)
    .filter(Boolean);

  return [...new Set([...DEFAULT_ORIGINS, ...fromEnv])];
};

const createCorsOptions = () => {
  const allowed = getAllowedOrigins();

  return {
    origin: (origin, callback) => {
      // Allow non-browser tools (curl, Thunder Client, server-to-server)
      if (!origin) return callback(null, true);

      const clean = normalize(origin);
      const isVercelPreview = /^https:\/\/unityhub1[a-z0-9-]*\.vercel\.app$/.test(clean);

      if (allowed.includes(clean) || isVercelPreview) {
        return callback(null, true);
      }

      console.warn('[CORS] Blocked origin:', origin);
      // Return false instead of throwing, so the error handler doesn't send a 500
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 204,
  };
};

module.exports = { createCorsOptions, getAllowedOrigins };