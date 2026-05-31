import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { methodSectionBriefInclude } from '../utils/contentQuery.js';
import { formatUserMethodSectionList } from '../serializers/userMethodSection.serializer.js';
import { startAccessPayment } from './payments.service.js';

export async function assignSection(user, { methodSectionId }) {
  const { MethodSection } = getModels();
  if (!methodSectionId) throw ApiError.badRequest('methodSectionId is required');

  const methodSection = await MethodSection.findByPk(methodSectionId, {
    attributes: ['id', 'slug', 'title', 'subtitle', 'mobtitle'],
  });
  if (!methodSection) throw ApiError.notFound('Method section not found');

  const payment = await startAccessPayment('section', user, {
    methodSectionId: Number(methodSectionId),
  });

  return {
    ...payment,
    methodSectionId: Number(methodSectionId),
    methodSection: {
      id: methodSection.id,
      slug: methodSection.slug,
      title: methodSection.title,
      subtitle: methodSection.subtitle,
      mobtitle: methodSection.mobtitle,
    },
  };
}

export async function getMySections(user) {
  const { UserMethodSection, MethodSection } = getModels();
  const items = await UserMethodSection.findAll({
    where: { userId: user.id },
    include: [methodSectionBriefInclude(MethodSection)],
  });

  return {
    items: formatUserMethodSectionList(items),
    makCardsAccess: user.makCardsAccess === true,
  };
}
