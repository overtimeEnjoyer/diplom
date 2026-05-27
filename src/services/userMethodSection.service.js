import { getModels } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { createAccessPayment } from './payments.service.js';

export async function assignSection(user, { methodSectionId, categorySlug, methodicSlug }) {
  const { MethodSection } = getModels();
  if (!methodSectionId) throw ApiError.badRequest('methodSectionId is required');

  const methodSection = await MethodSection.findByPk(methodSectionId);
  if (!methodSection) throw ApiError.notFound('Method section not found');

  const payment = await createAccessPayment(
    'section',
    { id: user.id, email: user.email },
    {
      methodSectionId: Number(methodSectionId),
      returnParams: {
        category: typeof categorySlug === 'string' ? categorySlug : methodSection.slug,
        methodic: typeof methodicSlug === 'string' ? methodicSlug : undefined,
      },
    },
  );

  return {
    status: 'payment_required',
    access: 'section',
    methodSectionId: Number(methodSectionId),
    methodSection: {
      id: methodSection.id,
      slug: methodSection.slug,
      title: methodSection.title,
      subtitle: methodSection.subtitle,
      mobtitle: methodSection.mobtitle,
    },
    ...payment,
  };
}

export async function getMySections(userId) {
  const { UserMethodSection, MethodSection, User } = getModels();
  const items = await UserMethodSection.findAll({
    where: { userId },
    include: [
      {
        model: MethodSection,
        as: 'method_section',
        attributes: ['id', 'documentId', 'slug', 'title', 'subtitle', 'mobtitle'],
      },
    ],
  });

  const user = await User.findByPk(userId);
  return {
    items: items.map((ums) => ({
      id: ums.id,
      documentId: ums.documentId,
      createdAt: ums.createdAt,
      updatedAt: ums.updatedAt,
      publishedAt: null,
      locale: null,
      isPaid: ums.isPaid,
      method_section: ums.method_section,
    })),
    makCardsAccess: user?.makCardsAccess === true,
  };
}
