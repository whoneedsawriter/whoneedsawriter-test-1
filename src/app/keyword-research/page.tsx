import { WebAppPage } from "@/components/templates/WebAppPage/WebAppPage";
import { Routes } from "@/data/routes";
import { brandName } from "@/config";

export const metadata = {
  title: `Keyword Research | ${brandName}`,
  description: `Keyword Research | ${brandName}`,
};

const KeywordResearch = () => {
  return <WebAppPage currentPage={Routes.keywordresearch} />;
};

export default KeywordResearch;