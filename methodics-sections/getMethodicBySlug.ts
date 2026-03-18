
import { CommunicateMethodic } from "./CommunicateMethodic";
import { FamilyMethodic } from "./FamilyMethodic";
import { KidsSectionMethodic } from "./KidsSectionMethodic";
import { LifeSectionMethodic } from "./LifeSectionMethodic";
import { ParentsMethodic } from "./ParentsMethodic";
import { PscyhoSectionMethodic } from "./PscyhoSectionMethodic";
import { UncommunicateMethodic } from "./UnCommunicateMethodic";


export async function getMethodicBySlug(slug: string) {
  const sections = [
    ...PscyhoSectionMethodic,
    ...LifeSectionMethodic,
    ...KidsSectionMethodic,
    ...CommunicateMethodic,
    ...FamilyMethodic,
    ...ParentsMethodic,
    ...UncommunicateMethodic
  ];

  for (const section of sections) {
    const method = section.methods.find((m) => m.slug === slug);

    if (method) {
      return {
        ...method,
        category: section.category,
        sectionTitle: section.title,
        heroImage: section.heroImage,
      };
    }
  }

  return null;
}
