// Vercel serverless entrypoint - wraps the Express app defined in src/index.ts
// so all backend routes are served as a single serverless function.
import app from '../src/index';

export default app;
