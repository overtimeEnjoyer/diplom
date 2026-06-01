import * as contentService from '../services/content.service.js';
import * as contentAccessService from '../services/contentAccess.service.js';
import { getPublicPricing } from '../services/pricing.service.js';
import { sendJson } from '../utils/response.js';

/** Thesis-aligned aliases: /api/content/* */

export async function listSections(req, res) {
  sendJson(res, 200, await contentService.listMethodSections(req.query));
}

export async function getMethodBySlug(req, res) {
  const method = await contentAccessService.getMethodBySlug(req.params.slug, req.user);
  sendJson(res, 200, { data: contentService.formatMethod(method), meta: {} });
}

export async function getPricing(req, res) {
  sendJson(res, 200, await getPublicPricing());
}
