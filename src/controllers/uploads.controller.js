import * as uploadsService from '../services/uploads.service.js';
import { sendJson } from '../utils/response.js';

export async function presign(req, res) {
  sendJson(res, 200, await uploadsService.createPresignedUpload(req.user, req.body));
}
