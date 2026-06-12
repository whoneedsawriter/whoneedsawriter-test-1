"use client";

import { Routes } from "@/data/routes";
import {
  Text,
  Flex,
  Heading,
  Button,
  Stack,
  useColorModeValue,
} from "@chakra-ui/react";
import { useState } from "react";
import { TbArrowRight, TbCalendarDue, TbCircleCheck } from "react-icons/tb";
import { useIsLogged } from "@/hooks/useIsLogged";
import { useRouter } from "next/navigation";
import { Section } from "../atoms/Section/Section";
import { brandName, demoCalendlyLink } from "@/config";
import Link from "next/link";
import { trackFunnelEvent } from "@/libs/analytics";

export const CtaBox = () => {
  const router = useRouter();
  const { user } = useIsLogged();

  const ctaColor = useColorModeValue("white", "brand.100");
  const ctaBgColor = useColorModeValue("brand.500", "brand.700");
  const secondaryCtaColor = useColorModeValue("brand.700", "brand.700");
  const secondaryCtaHoverColor = useColorModeValue("brand.900", "brand.900");

  const [isLoadingCta, setLoadingCta] = useState(false);
  const onGetStartedClick = () => {
    setLoadingCta(true);
    trackFunnelEvent("homepage_cta_click", { location: "final_cta" });
    if (user) {
      router.push(Routes.dashboard);
      return;
    }
    router.push(`${Routes.signUp}?trial=1&source=final-cta`);
  };

  return (
    <Section flexDir="column" mb="80px" mt="80px">
      <Flex
        p="80px 24px"
        borderRadius="16px"
        flexDir="column"
        w="90%"
        minW={["90%", "90%", "90%", "800px"]}
        maxW="1000px"
        alignItems="center"
        textAlign="center"
        bgColor="brand.300"
        color="blackAlpha.900"
      >
        <Heading
          fontSize={["22px", "26px", "32px", "48px"]}
          mb="8px"
          fontWeight="extrabold"
        >
          Increase Blog Traffic by 10x
        </Heading>
        <Text
          fontSize="16px"
          my="8px"
          color="blackAlpha.800"
          maxW="600px"
          fontWeight={500}
        >
          Get started with {brandName} today.
          <br />
          Start making money with your audience.
        </Text>

        <Stack direction={["column", "column", "column", "row"]} mt="24px">
          <Flex maxW="524px" flexDir="row">
            <Button
              as={Link}
              href={user ? Routes.dashboard : `${Routes.signUp}?trial=1&source=final-cta`}
              size="md"
              variant="solid"
              colorScheme="brand"
              color={ctaColor}
              bgColor={ctaBgColor}
              h="50px"
              minH="50px"
              w="220px"
              px="24px"
              borderRadius="16px"
              onClick={() => onGetStartedClick()}
              isLoading={isLoadingCta}
              rightIcon={<TbArrowRight />}
              sx={{
                svg: {
                  transition: "all .15s linear",
                  transform: "translateX(0px)",
                },
              }}
              _hover={{
                svg: {
                  transform: "translateX(4px)",
                },
              }}
            >
              Start free for 7 days
            </Button>
          </Flex>
        </Stack>
        {!user && (
          <Text mt="14px" fontSize="13px" color="blackAlpha.700" maxW="560px">
            5 credits included. Then your selected plan price/month. Cancel anytime. Card required.
          </Text>
        )}

        <Stack
          direction={["column", "column", "row"]}
          alignItems="center"
          my="32px"
          fontSize="13px"
          color="brand.300"
          spacing={["16px", "16px", "32px"]}
        >
          <Stack direction="row" alignItems="center">
            <Flex minW="16px" color="brand.500">
              <TbCircleCheck size="16px" />
            </Flex>
            <Text color="blackAlpha.700">Personalized onboarding</Text>
          </Stack>
          <Stack direction="row" alignItems="center" color="brand.500">
            <TbCircleCheck size="16px" />
            <Text color="blackAlpha.700">Friendly pricing as you scale</Text>
          </Stack>
        </Stack>
      </Flex>
    </Section>
  );
};
