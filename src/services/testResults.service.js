import { v4 as uuidv4 } from 'uuid';
import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { getSequelize } from '../config/database.js';

export async function saveTestResult(userId, { testKey, testTitle, methodId, answers, score }) {
  if (!testKey || !answers) {
    throw ApiError.badRequest('testKey and answers are required');
  }

  const { TestResult, Method } = getModels();
  if (methodId) {
    const method = await Method.findByPk(methodId, { attributes: ['id'] });
    if (!method) throw ApiError.notFound('Method not found');
  }

  const sequelize = getSequelize();
  return sequelize.transaction(async (transaction) => {
    const row = await TestResult.create(
      {
        documentId: uuidv4(),
        userId,
        methodId: methodId || null,
        testKey: String(testKey).slice(0, 120),
        testTitle: testTitle ? String(testTitle).slice(0, 255) : null,
        answers,
        score: score != null ? Number(score) : null,
        completedAt: new Date(),
      },
      { transaction },
    );
    return formatTestResult(row);
  });
}

export async function listMyTestResults(userId, { limit = 50 } = {}) {
  const { TestResult, Method } = getModels();
  const rows = await TestResult.findAll({
    where: { userId },
    include: [{ model: Method, as: 'method', attributes: ['id', 'documentId', 'slug', 'title'], required: false }],
    order: [['completedAt', 'DESC']],
    limit: Math.min(Number(limit) || 50, 100),
  });
  return rows.map(formatTestResult);
}

function formatTestResult(row) {
  const plain = row.toJSON();
  return {
    id: plain.id,
    documentId: plain.documentId,
    testKey: plain.testKey,
    testTitle: plain.testTitle,
    methodId: plain.methodId,
    method: plain.method || undefined,
    answers: plain.answers,
    score: plain.score != null ? Number(plain.score) : null,
    completedAt: plain.completedAt,
    createdAt: plain.createdAt,
  };
}
