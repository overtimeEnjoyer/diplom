import { v4 as uuidv4 } from 'uuid';
import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

export async function submitFeedback({ name, message, email, tariff }) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const trimmedTariff = tariff != null ? String(tariff).trim() : '';

  if (!trimmedName || trimmedName.length < 2) {
    throw ApiError.badRequest("Ім'я та прізвище обов'язкові (мін. 2 символи)");
  }
  if (!trimmedMessage || trimmedMessage.length < 10) {
    throw ApiError.badRequest("Повідомлення обов'язкове (мін. 10 символів)");
  }
  if (!trimmedEmail) throw ApiError.badRequest("Email обов'язковий");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) throw ApiError.badRequest('Невірний формат email');

  const { Feedback } = getModels();
  await Feedback.create({
    documentId: uuidv4(),
    name: trimmedName,
    message: trimmedMessage,
    email: trimmedEmail,
    tariff: trimmedTariff || null,
    isProcessed: false,
  });

  return { ok: true, message: 'Повідомлення збережено' };
}
