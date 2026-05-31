/** Strapi-compatible user-method-section rows (shared by /auth/me and /user-method-sections/me). */
export function formatUserMethodSectionRow(ums) {
  return {
    id: ums.id,
    documentId: ums.documentId,
    createdAt: ums.createdAt,
    updatedAt: ums.updatedAt,
    publishedAt: null,
    locale: null,
    isPaid: ums.isPaid,
    method_section: ums.method_section
      ? {
          id: ums.method_section.id,
          documentId: ums.method_section.documentId,
          slug: ums.method_section.slug,
          title: ums.method_section.title,
          subtitle: ums.method_section.subtitle,
          mobtitle: ums.method_section.mobtitle,
        }
      : null,
  };
}

export function formatUserMethodSectionList(rows) {
  return rows.map(formatUserMethodSectionRow);
}
