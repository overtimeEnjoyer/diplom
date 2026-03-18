import axios from "axios";

import { CommunicateMethodic } from "./methodics-sections/CommunicateMethodic";
import { FamilyMethodic } from "./methodics-sections/FamilyMethodic";
import { KidsSectionMethodic } from "./methodics-sections/KidsSectionMethodic";
import { LifeSectionMethodic } from "./methodics-sections/LifeSectionMethodic";
import { ParentsMethodic } from "./methodics-sections/ParentsMethodic";
import { PscyhoSectionMethodic } from "./methodics-sections/PscyhoSectionMethodic";
import { UncommunicateMethodic } from "./methodics-sections/UnCommunicateMethodic";

const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_TOKEN =
  "0d6609d81ee8f0b7da11d937a6d8a61c011ec4a80dd9ae473771a95f4110fe53b19c8eed0974291eff5e431537ce4e6cb10be422d6bd03e5a9dd281bec401015c872fb7f82ad939e70bac5d543da3f9e6185784c7876b1dbc04b7c016bb48eaaf12e6efe749a2f768ab22c29fcca68a548a4459c5e2ba39f846af1516bfe468e";

const client = axios.create({
  baseURL: `${STRAPI_URL}/api`,
  headers: {
    Authorization: `Bearer ${STRAPI_TOKEN}`,
    "Content-Type": "application/json",
  },
});

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
  const text = (value ?? "").trim();
  if (!text) return null;

  return [
    {
      type: "paragraph",
      children: [
        {
          type: "text",
          text,
        },
      ],
    },
  ];
}

async function ensureMethodSection(section: SectionSource): Promise<number> {
  const slug = section.category;

  const existing = await client.get("/method-sections", {
    params: {
      "filters[slug][$eq]": slug,
    },
  });

  const existingData = existing.data?.data;
  if (Array.isArray(existingData) && existingData.length > 0) {
    return existingData[0].id;
  }

  const created = await client.post("/method-sections", {
    data: {
      slug,
      title: section.title,
      subtitle: section.subtitle,
      mobtitle: section.mobtitle,
    },
  });

  return created.data.data.id;
}

async function upsertMethod(
  method: MethodSource,
  methodSectionId: number
): Promise<void> {
  const existing = await client.get("/methods", {
    params: {
      "filters[slug][$eq]": method.slug,
    },
  });

  const existingData = existing.data?.data;
  const payload = {
    data: {
      title: method.title,
      slug: method.slug,
      author_source: method.author_source ?? "",
      approach: method.approach ?? "",
      target_audience: method.target_audience ?? "",
      goal: method.goal ?? "",
      purpose: toBlocks(method.purpose),
      therapeutic_effect: toBlocks(method.therapeutic_effect),
      time: method.time ?? "",
      materials: method.materials ?? "",
      short_instruction: toBlocks(method.short_instruction),
      instruction: toBlocks(method.instruction),
      interpretation: toBlocks(method.interpretation),
      completion: toBlocks(method.completion),
      reflection_questions: (method.reflection_questions ?? []).map((q) => ({
        text: q,
      })),
      method_section: methodSectionId,
    },
  };

  if (Array.isArray(existingData) && existingData.length > 0) {
    const id = existingData[0].id;
    await client.put(`/methods/${id}`, payload);
  } else {
    await client.post("/methods", payload);
  }
}

async function migrate() {
  const allSections: SectionSource[] = [
    ...PscyhoSectionMethodic,
    ...LifeSectionMethodic,
    ...KidsSectionMethodic,
    ...CommunicateMethodic,
    ...FamilyMethodic,
    ...ParentsMethodic,
    ...UncommunicateMethodic,
  ];

  for (const section of allSections) {
    const sectionId = await ensureMethodSection(section);

    for (const method of section.methods) {
      try {
        await upsertMethod(method, sectionId);
        // eslint-disable-next-line no-console
        console.log(`OK: ${section.category} / ${method.slug}`);
      } catch (err: any) {
        const status = err?.response?.status;
        const data = err?.response?.data;
        // eslint-disable-next-line no-console
        console.error(
          `FAIL: ${section.category} / ${method.slug} STATUS=${status}`,
          JSON.stringify(data, null, 2)
        );
      }
    }
  }
}

migrate()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("Migration finished");
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Migration failed", (err as Error).message);
    process.exit(1);
  });

