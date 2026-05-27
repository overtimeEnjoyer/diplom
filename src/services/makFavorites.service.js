import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

const makFavoritesLocks = new Map();

function withMakFavoritesLock(userId, fn) {
  const prev = makFavoritesLocks.get(userId) ?? Promise.resolve();
  const promise = prev
    .then(() => fn())
    .finally(() => {
      if (makFavoritesLocks.get(userId) === promise) makFavoritesLocks.delete(userId);
    });
  makFavoritesLocks.set(userId, promise);
  return promise;
}

export function normalizeFavoriteCardIds(raw) {
  if (Array.isArray(raw)) {
    const out = [];
    for (const item of raw) {
      if (typeof item === 'string') out.push(item);
      else if (Array.isArray(item)) out.push(...item.filter((id) => typeof id === 'string'));
    }
    return out;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    if (raw.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((id) => typeof id === 'string');
      } catch {
        // ignore
      }
    }
    return [raw];
  }
  return [];
}

export async function getMakFavorites(userId) {
  const { User } = getModels();
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound();
  return { favoriteCardIds: normalizeFavoriteCardIds(user.makFavoriteCardIds) };
}

export async function setMakFavorites(userId, favoriteCardIds) {
  if (!Array.isArray(favoriteCardIds)) throw ApiError.badRequest('favoriteCardIds must be an array');
  const toStore = favoriteCardIds.filter((id) => typeof id === 'string');
  const { User } = getModels();
  await withMakFavoritesLock(userId, async () => {
    await User.update({ makFavoriteCardIds: toStore }, { where: { id: userId } });
  });
  return { favoriteCardIds: toStore };
}

export async function toggleMakFavorite(userId, cardId) {
  if (typeof cardId !== 'string' || cardId.trim() === '') {
    throw ApiError.badRequest('cardId must be a non-empty string');
  }
  const { User } = getModels();
  return withMakFavoritesLock(userId, async () => {
    const user = await User.findByPk(userId);
    let list = normalizeFavoriteCardIds(user.makFavoriteCardIds);
    const idx = list.indexOf(cardId);
    if (idx === -1) list = [...list, cardId];
    else list = list.filter((_, i) => i !== idx);
    await user.update({ makFavoriteCardIds: list });
    return { favoriteCardIds: list };
  });
}
