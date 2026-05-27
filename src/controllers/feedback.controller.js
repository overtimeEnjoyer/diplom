import * as feedbackService from '../services/feedback.service.js';

export async function sendFeedback(req, res) {
  const result = await feedbackService.submitFeedback(req.body);
  res.json(result);
}
