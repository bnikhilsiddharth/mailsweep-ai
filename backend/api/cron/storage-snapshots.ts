import mongoose from 'mongoose';
import { connectDB } from '../../src/config/database';
import { runStorageSnapshots } from '../../src/workers/storageSnapshots';

// Vercel Cron target - triggered on the schedule defined in backend/vercel.json.
export default async function handler(req: any, res: any) {
  if (
      process.env.CRON_SECRET &&
      req.headers?.authorization !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

try {
    if (mongoose.connection.readyState === 0) {
          await connectDB();
    }
    await runStorageSnapshots();
    return res.status(200).json({ ok: true });
} catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'Unknown error' });
}
}
