import * as contentService from '../services/content.service.js';
import { formatPricingForApi, loadPricingSettings } from '../services/pricing.service.js';
import { getModels } from '../models/index.js';

export async function listMethodSections(req, res) {
  res.json(await contentService.listMethodSections(req.query));
}

export async function getMethodSection(req, res) {
  res.json(await contentService.getMethodSection(req.params.id, req.query));
}

export async function listMethods(req, res) {
  res.json(await contentService.listMethods(req.query));
}

export async function getMethod(req, res) {
  res.json(await contentService.getMethod(req.params.id, req.query));
}

export async function getPricing(req, res) {
  const { Pricing } = getModels();
  const row = await Pricing.findOne({ order: [['id', 'ASC']] });
  res.json({ data: row ? formatPricingForApi(row) : null, meta: {} });
}
