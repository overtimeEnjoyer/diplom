import { Op } from 'sequelize';

/**
 * Parse REST filters from query string, e.g. filters[slug][$eq]=communicate
 */
export function parseContentFilters(query) {
  const where = {};
  const prefix = 'filters[';

  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith(prefix)) continue;
    const inner = key.slice(prefix.length, -1);
    const match = inner.match(/^([^[]+)\[\$(\w+)\]$/);
    if (!match) continue;
    const [, field, op] = match;
    if (op === 'contains') {
      where[field] = { [Op.iLike]: `%${value}%` };
      continue;
    }
    const sequelizeOp = mapFilterOperator(op);
    if (!sequelizeOp) continue;
    where[field] = { [sequelizeOp]: castValue(value, op) };
  }

  return where;
}

function castValue(value, op) {
  if (op === 'in' || op === 'notIn') {
    return String(value).split(',').map((s) => s.trim());
  }
  if (/^\d+$/.test(String(value))) return Number(value);
  return value;
}

function mapFilterOperator(filterOp) {
  const map = {
    eq: Op.eq,
    ne: Op.ne,
    lt: Op.lt,
    lte: Op.lte,
    gt: Op.gt,
    gte: Op.gte,
    in: Op.in,
    notIn: Op.notIn,
    startsWith: Op.startsWith,
    endsWith: Op.endsWith,
  };
  return map[filterOp] || null;
}

export function parsePopulate(query) {
  const raw = query.populate;
  if (!raw) return [];
  if (raw === '*') return ['*'];
  if (typeof raw === 'string') {
    if (raw.includes(',')) return raw.split(',').map((s) => s.trim());
    return [raw];
  }
  if (typeof raw === 'object') return Object.keys(raw);
  return [];
}

export function onlyPublished(where = {}) {
  return { ...where, publishedAt: { [Op.ne]: null } };
}
