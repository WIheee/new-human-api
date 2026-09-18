// api/admin.js
import express from 'express';
import { getRequestLog } from '../chat/store.js';

const router = express.Router();

router.get('/requests', (req, res) => {
  res.json(getRequestLog());
});

export default router;
