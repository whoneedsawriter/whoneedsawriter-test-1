import { WebAppPage } from "@/components/templates/WebAppPage/WebAppPage";
import { Routes } from "@/data/routes";
import { brandName } from "@/config";

export const metadata = {
  title: `Generation History | ${brandName}`,
  description: `Generation History | ${brandName}`,
};

const GenerationHistoryPage = () => {
  return <WebAppPage currentPage={Routes.generationHistory} />;
};

export default GenerationHistoryPage;

