import * as contentService from '../services/content.service.js';
import { getPublicPricing } from '../services/pricing.service.js';
import { sendJson } from '../utils/response.js';

export async function listMethodSections(req, res) {
  sendJson(res, 200, await contentService.listMethodSections(req.query));
}

export async function getMethodSection(req, res) {
  sendJson(res, 200, await contentService.getMethodSection(req.params.id, req.query));
}

export async function listMethods(req, res) {
  sendJson(res, 200, await contentService.listMethods(req.query));
}

export async function getMethod(req, res) {
  sendJson(res, 200, await contentService.getMethod(req.params.id, req.query));
}

export async function getPricing(req, res) {
  sendJson(res, 200, await getPublicPricing());
}
