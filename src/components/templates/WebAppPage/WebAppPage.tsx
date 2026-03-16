"use client";

import { SideBar, sidebarWidth, sidebarWidthMobile } from "@/components/organisms/Sidebar/Sidebar";
import { Routes } from "@/data/routes";
import { useMobile } from "@/hooks/useMobile";
import {
  Button,
  Center,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
  Flex,
  Spinner,
  Stack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useContext } from "react";
import { PricingPopupContext } from "@/app/PricingPopupProvider";
import PricingPopup from "@/components/PricingPopup/PricingPopup";
import { SidebarDrawerProvider, useSidebarDrawer } from "@/app/SidebarDrawerProvider";

// Dynamically import page components with loading states
const DashboardComponent = dynamic(
  () => import("@/components/pages/Dashboard/Dashboard").then((mod) => mod.Dashboard),
  { loading: () => <Spinner color="brand.500" /> }
);

const TodoComponent = dynamic(
  () => import("@/components/pages/Todo/Todo").then((mod) => mod.default),
  { loading: () => <Spinner color="brand.500" /> }
);

const ArticleGeneratorComponent = dynamic(
  () => import("@/components/pages/ArticleGenerator/ArticleGenerator").then((mod) => mod.default),
  { loading: () => <Spinner color="brand.500" /> }
);

const ArticlesComponent = dynamic(
  () => import("@/components/pages/Articles/Articles").then((mod) => mod.default),
  { loading: () => <Spinner color="brand.500" /> }
);

const BatchComponent = dynamic(
  () => import("@/components/pages/Batch/Batch").then((mod) => mod.default),
  { loading: () => <Spinner color="brand.500" /> }
);

const AccountComponent = dynamic(
  () => import("@/components/pages/Account/Account").then((mod) => mod.Account),
  { loading: () => <Spinner color="brand.500" /> }
);

const ApiKeysComponent = dynamic(
  () => import("@/components/pages/ApiKeys/ApiKeys").then((mod) => mod.ApiKeys),
  { loading: () => <Spinner color="brand.500" /> }
);

const KeywordResearchComponent = dynamic(
  () => import("@/components/pages/KeywordResearch/KeywordResearch").then((mod) => mod.default),
  { loading: () => <Spinner color="brand.500" /> }
);

const GenerationHistoryComponent = dynamic(
  () => import("@/components/pages/GenerationHistory/GenerationHistory").then((mod) => mod.default),
  { loading: () => <Spinner color="brand.500" /> }
);

const KeywordDetailsComponent = dynamic(
  () => import("@/components/pages/KeywordDetails/KeywordDetails").then((mod) => mod.default),
  { loading: () => <Spinner color="brand.500" /> }
);

type WebAppPageProps = {
  currentPage: Routes;
};

const WebAppPageContent = ({ currentPage }: WebAppPageProps) => {
  const isMobile = useMobile();
  const { data: session, status } = useSession();
  const { isOpen, onClose } = useSidebarDrawer();
  const { isOpen: isPricingPopupOpen, onOpen: onPricingPopupOpen, onClose: onPricingPopupClose } = useContext(PricingPopupContext);
  const buttonColorScheme = useColorModeValue("blackAlpha", "whiteAlpha");
  const buttonColor = useColorModeValue("blackAlpha.600", "whiteAlpha.600");

  return (
    <Center minH="100vh">
      {status === "loading" && <Spinner color="brand.500" />}
      {status === "unauthenticated" && (
        <Stack>
          <Text>Sign in to access</Text>
          <Button as="a" href="/login" colorScheme="brand">
            Sign in
          </Button>
        </Stack>
      )}
      {status === "authenticated" && (
        <>
          <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="xs">
            <DrawerOverlay onClick={onClose} />
            <DrawerContent w={sidebarWidthMobile} maxW={sidebarWidthMobile} onClick={(e) => e.stopPropagation()}>
              <DrawerBody p={0}>
                <SideBar currentPage={currentPage} onClose={onClose} />
              </DrawerBody>
            </DrawerContent>
          </Drawer>
          {!isMobile && <SideBar currentPage={currentPage} />}
          <Flex
            minW="100vw"
            w="100vw"
            minH="100vh"
            margin="0"
            padding="0"
            pt={isMobile ? "80px" : "0"}
            flexGrow={1}
            justifyContent="flex-start"
            pl={isMobile ? 0 : sidebarWidth}
            style={{
              marginInlineStart: "0",
              marginInlineEnd: "0",
            }}
          >
            {currentPage === Routes.dashboard && (
              <Center w="100%" flexDir="column">
                <DashboardComponent />
              </Center>
            )}
            {currentPage === Routes.todo && (
              <Center w="100%" flexDir="column">
                <TodoComponent />
              </Center>
            )}
            {currentPage === Routes.articlegenerator && (
              <Center w="100%" flexDir="column">
                <ArticleGeneratorComponent />
              </Center>
            )} 
            {currentPage === Routes.articles && (
              <Center w="100%" flexDir="column">
                <ArticlesComponent />
              </Center>
            )}
            {currentPage === Routes.account && (
              <Center w="100%" flexDir="column">
                <AccountComponent />
              </Center>
            )} 
            {currentPage === Routes.batch && (
              <Center w="100%" flexDir="column">
                <BatchComponent />
              </Center>
            )}
              {currentPage === Routes.apiKeys && (
                <Center w="100%" flexDir="column">
                  <ApiKeysComponent />
                </Center>
              )}  
              {currentPage === Routes.keywordresearch && (
                <Center w="100%" flexDir="column">
                  <KeywordResearchComponent />
                </Center>
              )}
              {currentPage === Routes.generationHistory && (
                <Center w="100%" flexDir="column">
                  <GenerationHistoryComponent />
                </Center>
              )}
              {currentPage === Routes.keywordDetails && (
                <Center w="100%" flexDir="column">
                  <KeywordDetailsComponent />
                </Center>
              )}
          </Flex>
          <PricingPopup isOpen={isPricingPopupOpen} onClose={onPricingPopupClose} />
        </>
      )}

    </Center>
  );
};

export const WebAppPage = ({ currentPage }: WebAppPageProps) => {
  return (
    <SidebarDrawerProvider>
      <WebAppPageContent currentPage={currentPage} />
    </SidebarDrawerProvider>
  );
};
