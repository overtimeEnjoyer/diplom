/**
 * Імпорт методик з methodics-sections/ напряму в PostgreSQL (Sequelize).
 * Запуск: pnpm import:methodics
 */
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { connectDatabase } from '../src/config/database.js';
import { initModels, getModels } from '../src/models/index.js';
import { CommunicateMethodic } from '../methodics-sections/CommunicateMethodic';
import { FamilyMethodic } from '../methodics-sections/FamilyMethodic';
import { KidsSectionMethodic } from '../methodics-sections/KidsSectionMethodic';
import { LifeSectionMethodic } from '../methodics-sections/LifeSectionMethodic';
import { ParentsMethodic } from '../methodics-sections/ParentsMethodic';
import { PscyhoSectionMethodic } from '../methodics-sections/PscyhoSectionMethodic';
import { UncommunicateMethodic } from '../methodics-sections/UnCommunicateMethodic';

type SectionSource = {
  category: string;
  title: string;
  subtitle: string;
  mobtitle: string;
  methods: MethodSource[];
};

type MethodSource = {
  title: string;
  slug: string;
  author_source?: string | null;
  approach?: string | null;
  target_audience?: string | null;
  goal?: string | null;
  purpose?: string | null;
  therapeutic_effect?: string | null;
  time?: string | null;
  materials?: string | null;
  short_instruction?: string | null;
  instruction?: string | null;
  interpretation?: string | null;
  completion?: string | null;
  reflection_questions?: string[] | null;
};

function toBlocks(value: string | null | undefined) {
  const text = (value ?? '').trim();
  if (!text) return null;
  return [{ type: 'paragraph', children: [{ type: 'text', text }] }];
}

function toReflectionQuestions(questions: string[] | null | undefined) {
  if (!questions?.length) return null;
  return questions.map((text) => ({ text }));
}

async function ensureMethodSection(section: SectionSource) {
  const { MethodSection } = getModels();
  const slug = section.category;
  const publishedAt = new Date();

  let row = await MethodSection.findOne({ where: { slug } });
  if (row) {
    await row.update({
      title: section.title,
      subtitle: section.subtitle,
      mobtitle: section.mobtitle,
      publishedAt: row.publishedAt || publishedAt,
    });
    return row;
  }

  row = await MethodSection.create({
    documentId: uuidv4(),
    slug,
    title: section.title,
    subtitle: section.subtitle,
    mobtitle: section.mobtitle,
    publishedAt,
  });
  return row;
}

async function upsertMethod(method: MethodSource, methodSectionId: number) {
  const { Method } = getModels();
  const publishedAt = new Date();

  const payload = {
    title: method.title,
    slug: method.slug,
    methodSectionId,
    authorSource: method.author_source ?? '',
    approach: method.approach ?? '',
    targetAudience: method.target_audience ?? '',
    goal: method.goal ?? '',
    purpose: toBlocks(method.purpose),
    therapeuticEffect: toBlocks(method.therapeutic_effect),
    time: method.time ?? '',
    materials: method.materials ?? '',
    shortInstruction: toBlocks(method.short_instruction),
    instruction: toBlocks(method.instruction),
    interpretation: toBlocks(method.interpretation),
    completion: toBlocks(method.completion),
    reflectionQuestions: toReflectionQuestions(method.reflection_questions),
    publishedAt,
  };

  const existing = await Method.findOne({ where: { slug: method.slug } });
  if (existing) {
    await existing.update(payload);
    return existing;
  }

  return Method.create({
    documentId: uuidv4(),
    ...payload,
  });
}

async function main() {
  await connectDatabase();
  initModels();

  const allSections: SectionSource[] = [
    ...PscyhoSectionMethodic,
    ...LifeSectionMethodic,
    ...KidsSectionMethodic,
    ...CommunicateMethodic,
    ...FamilyMethodic,
    ...ParentsMethodic,
    ...UncommunicateMethodic,
  ];

  let methodsOk = 0;
  let methodsFail = 0;

  for (const section of allSections) {
    const sectionRow = await ensureMethodSection(section);
    console.log(`Section: ${section.category} (id=${sectionRow.id})`);

    for (const method of section.methods) {
      try {
        await upsertMethod(method, sectionRow.id);
        methodsOk += 1;
        console.log(`  OK: ${method.slug}`);
      } catch (err) {
        methodsFail += 1;
        console.error(`  FAIL: ${method.slug}`, (err as Error).message);
      }
    }
  }

  console.log(`\nDone. Methods OK=${methodsOk}, FAIL=${methodsFail}`);
  process.exit(methodsFail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
