import * as adminService from '../services/admin.service.js';
import { confirmManualPayment } from '../services/payments.service.js';
import { sendCreated, sendData, sendJson } from '../utils/response.js';

export async function listFeedbacks(req, res) {
  const rows = await adminService.listFeedbacks({
    processed: req.query.processed,
    limit: req.query.limit,
  });
  sendData(res, rows);
}

export async function markFeedbackProcessed(req, res) {
  const row = await adminService.markFeedbackProcessed(req.params.id);
  sendData(res, row);
}

export async function getPricing(req, res) {
  sendData(res, await adminService.getPricing());
}

export async function updatePricing(req, res) {
  sendData(res, await adminService.updatePricing(req.body));
}

export async function listUsers(req, res) {
  const rows = await adminService.listUsers({ search: req.query.search, limit: req.query.limit });
  sendData(res, rows);
}

export async function confirmPayment(req, res) {
  const orderReference = String(req.body.orderReference || '');
  sendJson(res, 200, await confirmManualPayment(orderReference));
}

export async function updateUserTariff(req, res) {
  const user = await adminService.updateUserTariff(req.params.id, req.body);
  sendJson(res, 200, {
    ok: true,
    data: {
      id: user.id,
      isPremium: user.isPremium,
      isMedium: user.isMedium,
      makCardsAccess: user.makCardsAccess,
    },
  });
}

export async function listMethodSections(req, res) {
  const rows = await adminService.listMethodSectionsAdmin({
    includeUnpublished: req.query.includeUnpublished !== 'false',
    limit: req.query.limit,
  });
  sendData(res, rows);
}

export async function createMethodSection(req, res) {
  const row = await adminService.createMethodSection(req.body);
  sendCreated(res, row);
}

export async function updateMethodSection(req, res) {
  const row = await adminService.updateMethodSection(req.params.id, req.body);
  sendData(res, row);
}

export async function listMethods(req, res) {
  const rows = await adminService.listMethodsAdmin({
    sectionId: req.query.sectionId,
    limit: req.query.limit,
  });
  sendData(res, rows);
}

export async function createMethod(req, res) {
  const row = await adminService.createMethod(req.body);
  sendCreated(res, row);
}

export async function updateMethod(req, res) {
  const row = await adminService.updateMethod(req.params.id, req.body);
  sendData(res, row);
}
