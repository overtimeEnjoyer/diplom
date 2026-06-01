import { Op } from 'sequelize';

/**
 * Symptom / thematic filter (thesis §2.1 categorization by symptom or approach).
 * Query: ?symptom=тривога or ?approach=кпт
 */
export function parseSymptomQuery(query) {
  return String(query.symptom || query.symptoms || query.approach || '').trim();
}

export function applySymptomFilter(where, query) {
  const term = parseSymptomQuery(query);
  if (!term) return where;

  const pattern = `%${term}%`;
  const clause = {
    [Op.or]: [
      { approach: { [Op.iLike]: pattern } },
      { targetAudience: { [Op.iLike]: pattern } },
      { goal: { [Op.iLike]: pattern } },
      { title: { [Op.iLike]: pattern } },
    ],
  };

  if (!where || Object.keys(where).length === 0) return clause;
  return { [Op.and]: [where, clause] };
}

export function symptomSqlFragment(alias = 'm') {
  return `
    AND (
      ${alias}.approach ILIKE :symptom OR
      ${alias}.target_audience ILIKE :symptom OR
      ${alias}.goal ILIKE :symptom OR
      ${alias}.title ILIKE :symptom
    )
  `;
}
