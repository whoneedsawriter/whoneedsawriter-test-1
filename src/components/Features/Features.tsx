import { Feature, FeatureProps } from "./Feature";
import { Section } from "../atoms/Section/Section";

const featuresList: Omit<FeatureProps, "showCta">[] = [
  {
    category: "Human-Focused Content",
    title: "Write for Humans, Not Search Engines",
    description:
      "Our AI understands search intent and creates content that resonates with real readers. Each article is crafted to provide genuine value and engage your audience naturally.",
    imageUrl: "/images/written-for-humans.png",
  },
  {
    category: "Complete Content Package",
    title: "Articles + Images in One Click",
    description:
      "Get more than just text. Each article comes with high-quality AI-generated images and is optimized for featured snippets. Save hours of work with our all-in-one content generation solution.",
    imageUrl: "/images/article+images.png",
  },
  {
    category: "Quality & Research",
    title: "Well-Researched & Accurate",
    description:
      "Our AI does not just generate content - it researches, fact-checks, and ensures accuracy. Every article is comprehensive, well-structured, and backed by thorough research.",
    imageUrl: "/images/well-researched.png",
  }
];

type FeaturesProps = {
  showCta?: boolean;
};

export const Features = ({ showCta = true }: FeaturesProps) => {
  return (
    <Section flexDir="column" mt={{ base: "56px", lg: "72px" }}>
      {featuresList.map((feature, index) => {
        return (
          <Feature
            key={index}
            category={feature.category}
            title={feature.title}
            description={feature.description}
            imageUrl={feature.imageUrl}
            showCta={showCta}
          />
        );
      })}
    </Section>
  );
};
