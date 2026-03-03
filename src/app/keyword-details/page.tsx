import { WebAppPage } from "@/components/templates/WebAppPage/WebAppPage";
import { Routes } from "@/data/routes";
import { brandName } from "@/config";

export const metadata = {
  title: `Keyword Research Details | ${brandName}`,
  description: `Keyword Research Details | ${brandName}`,
};

const KeywordDetailsPage = () => {
  return <WebAppPage currentPage={Routes.keywordDetails} />;
};

export default KeywordDetailsPage;

