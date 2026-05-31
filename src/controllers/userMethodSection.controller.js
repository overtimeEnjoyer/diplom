import * as userMethodSectionService from '../services/userMethodSection.service.js';
import { sendJson } from '../utils/response.js';

export async function assign(req, res) {
  sendJson(res, 200, await userMethodSectionService.assignSection(req.user, req.body));
}

export async function mySections(req, res) {
  sendJson(res, 200, await userMethodSectionService.getMySections(req.user));
}
