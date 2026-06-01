import { connectDatabase } from '../config/database.js';
import { initModels } from '../models/index.js';
import { handleWayForPayCallback } from '../services/wayforpay.service.js';
import { sendJson } from '../utils/response.js';

export async function callback(req, res) {
  await connectDatabase();
  initModels();
  const result = await handleWayForPayCallback(req.wayforpayRawBody ?? req.body, req.headers['content-type']);
  sendJson(res, 200, result);
}
