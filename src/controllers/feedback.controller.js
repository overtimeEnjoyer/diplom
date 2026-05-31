import * as feedbackService from '../services/feedback.service.js';
import { sendJson } from '../utils/response.js';

export async function sendFeedback(req, res) {
  sendJson(res, 200, await feedbackService.submitFeedback(req.body));
}
