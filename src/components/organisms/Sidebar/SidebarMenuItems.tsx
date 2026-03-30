import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Link as NextJsChakraLink } from "@chakra-ui/next-js";
import {
  Box,
  Flex,
  chakra,
  Text,
  Link as ChakraLink,
  Spinner,
  useColorModeValue,
  Button,
  Badge,
  IconButton,
} from "@chakra-ui/react";
import {
  TbUsers,
  TbHeartHandshake,
  TbBrandHipchat,
  TbStar,
  TbRocket,
  TbChecklist,
  TbKey,
  TbWand,
  TbHistory,
  TbUser,
  TbChevronLeft,
} from "react-icons/tb";
import { FaFolderOpen } from "react-icons/fa6";
import { MdEditSquare } from "react-icons/md";
import { RiEditBoxFill } from "react-icons/ri";
import { RiEdit2Fill } from "react-icons/ri";
import { Routes } from "../../../data/routes";
import { brandName, cannyUrl } from "@/config";
import { Logo, LogoLight } from "@/components/atoms/Logo/Logo";
import { useRouter } from "next/navigation";
import { useUserPlanStatus } from "@/hooks/useUserPlanStatus";

type MenuItemProps = {
  route?: Routes | string;
  loadingRoute: Routes | string;
  currentPage: Routes;
  children: any;
  isExternal?: boolean;
  onClick: (route: Routes | string) => void;
};

export const MenuItem: React.FC<MenuItemProps> = ({
  route,
  loadingRoute,
  currentPage,
  children,
  isExternal = false,
  onClick,
  ...props
}) => {
  const menuItemColor = useColorModeValue("blackAlpha.900", "whiteAlpha.900");
  const menuItemBgColor = useColorModeValue("blackAlpha.100", "whiteAlpha.100");
  const spinnerColor = useColorModeValue("blackAlpha.300", "whiteAlpha.300");

  const isActive = currentPage === route;
  const href = route && route.startsWith("http") ? route : `${route}`;
  
  const handleClick = (e: React.MouseEvent) => {
    if (route && !isActive && !isExternal && href.startsWith("/")) {
      onClick(route);
    }
    if (!route) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  return (
    <chakra.div
      w="100%"
      _hover={{
        bgColor: menuItemBgColor,
      }}
      transition="background-color 0.2s ease-in-out"
      color={isActive ? "brand.600" : menuItemColor}
      bgColor={"transparent"}
      cursor="pointer"
      fontWeight={isActive ? "bold" : "normal"}
      borderTopWidth="0"
      borderRadius="8px"
      mb={["0", "0", "0", "4px"]}
      display="flex"
      flexDir="row"
      alignItems="center"
      justifyContent="left"
      as={!route ? "button" : "div"}
      sx={{
        ".Canny_BadgeContainer": {
          top: "16px",
          right: "8px",
        },
        ".Canny_Badge": {
          bgColor: "primary.500",
          overflow: "visible",
          border: "none",
          padding: 0,
          w: "6px",
          h: "6px",
        },
        ".Canny_Badge:after": {
          content: '""',
          zIndex: -1,
          w: "16px",
          h: "16px",
          top: "-5px",
          left: "-5px",
          position: "absolute",
          display: "block",
          boxSizing: "border-box",
          borderRadius: "45px",
          backgroundColor: "#b366b3",
          animation:
            "pulse-ring 1.25s cubic-bezier(0.215, 0.61, 0.355, 1) infinite",
        },
        div: {
          fontWeight: isActive ? "semibold" : "normal",
        },
      }}
      {...props}
    >
      {route && (
        <Link
          href={href}
          target={isExternal ? "_blank" : "_self"}
          passHref
          legacyBehavior
        >
          <ChakraLink
            _hover={{ textDecoration: "none" }}
            alignItems="center"
            boxSize="border-box"
            display="flex"
            flexDir="row"
            flexGrow={1}
            justifyContent="flex-start"
            m="0 16px"
            h="40px"
            fontWeight={isActive ? "bold" : "normal"}
            position="relative"
            target={isExternal ? "_blank" : "_self"}
            sx={{
              svg: {
                stroke: isActive ? "brand.600" : menuItemColor,
              },
            }}
            onClick={handleClick}
          >
            {children}
          </ChakraLink>
        </Link>
      )}
      {!route && (
        <Flex
          display="flex"
          flexGrow={1}
          alignItems="center"
          justifyContent="flex-start"
          flexDir="row"
          _hover={{ textDecoration: "none" }}
          m="0 16px"
          h="40px"
          sx={{
            svg: {
              stroke: "blackAlpha.800",
            },
          }}
        >
          {children}
        </Flex>
      )}
      {loadingRoute === route && (
        <Spinner size="xs" color={spinnerColor} mr="16px" />
      )}
    </chakra.div>
  );
};

type MenuLabelProps = {
  children: any;
};

export const MenuLabel: React.FC<MenuLabelProps> = ({ children }) => (
  <Box display="inline-block" fontWeight="500" fontSize="14px" ml="4px">
    {children}
  </Box>
);

type MenuProps = {
  currentPage: Routes;
  loadingRoute: Routes | string;
  onMenuItemClick: (route: Routes | string) => void;
  onClose?: () => void;
  isMobile?: boolean;
};

export const SidebarMenuItems: React.FC<MenuProps> = ({
  currentPage,
  loadingRoute,
  onMenuItemClick,
  onClose,
  isMobile = false,
}) => {
  const textColor = "#7f8aa3";
  const LogoComponent = useColorModeValue(LogoLight, Logo);
  const router = useRouter();
  const { hasPlan } = useUserPlanStatus();

  // Helper function to handle navigation and close drawer
  const handleNavigation = (route: Routes | string) => {
    router.push(route);
    onClose?.();
  };

  // Prefetch routes on component mount
  useEffect(() => {
    const routesToPrefetch = [
      Routes.dashboard,
      Routes.articlegenerator,
      Routes.batch,
      Routes.account,
      Routes.apiKeys,
      Routes.pricing,
    ];
    
    routesToPrefetch.forEach(route => {
      router.prefetch(route);
    });
  }, [router]);

  return (
    <Box p="0" width="100%" bg="linear-gradient(180deg, #151923, #111622)" minH="100vh" color="white" borderRight="1px solid #ffffff14" position="relative" sx={{ pointerEvents: 'auto' }}>
      <Flex alignItems="flex-start" flexDirection="column" p={isMobile ? "16px" : "16px 8px"} gap="24px" h="100%" position="relative">
        {/* Header Section with Logo and Close Button */}
        <Flex w="100%" justifyContent="space-between" flexDirection={isMobile ? "row" : "column"} alignItems="center" mb={isMobile ? "8px" : "0"} position="relative"             borderBottom={isMobile ? "1px solid #ffffff14" : "none"}
            pb={isMobile ? "16px" : "0"}>
          <Flex alignItems="center" gap={isMobile ? "12px" : "0"}>
            <Button
              color="white"
              fontWeight="bold"
              fontSize="16px"
              h="48px"
              w="48px"
              borderRadius="12px"
              p="6px"
              onClick={() => handleNavigation(Routes.dashboard)}
            >
              <Image src="/logo-icon.png" alt="Logo" width={36} height={36} />
            </Button>
            {isMobile && (
              <Text color="white" fontSize="16px" fontWeight="600">
                Who
                needs a
                writer
              </Text>
            )}
          </Flex>
          {isMobile && onClose && (
            <IconButton
              aria-label="Close sidebar"
              icon={<TbChevronLeft size="20px" />}
              variant="ghost"
              color="#a9b1c3"
              border="1px solid #ffffff14"
              borderRadius="8px"
              size="sm"
              minW="32px"
              h="32px"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onClose) {
                  onClose();
                }
              }}
              position="relative"
              cursor="pointer"
              _hover={{ bg: "rgba(255, 255, 255, 0.1)" }}
              sx={{
                pointerEvents: 'auto',
                zIndex: 1000,
                '&:hover': {
                  bg: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            />
          )}
        </Flex>

        {/* Navigation Items */}
        <Flex flexDirection="column" gap={isMobile ? "8px" : "20px"} w="100%" alignItems={isMobile ? "stretch" : "center"}>
          {/* Generator */}
          <Flex 
            flexDirection={isMobile ? "row" : "column"} 
            alignItems={isMobile ? "center" : "center"} 
            gap={isMobile ? "12px" : "4px"} 
            cursor="pointer" 
            _hover={{ opacity: 0.8 }}
            p={isMobile ? "10px 12px" : "0"}
            borderRadius={isMobile ? "8px" : "0"}
            bg={isMobile && currentPage === Routes.articlegenerator ? "#4da3ff1a" : "transparent"}
            onClick={() => window.location.href = '/article-generator'}
          >
            <Flex
              w={isMobile ? "unset" : "44px"}
              h={isMobile ? "unset" : "44px"}
              bg="transparent"
              borderRadius="12px"
              alignItems="center"
              justifyContent="center"
              border={isMobile ? "none" : "1px solid #ffffff14"}
            >
              <RiEdit2Fill size={isMobile ? "22px" : "16px"} color="#fbbf24" />
            </Flex>
            {isMobile && (
              <Text color="white" fontSize="14px" fontWeight="500" flex="1">
                Generator 
              </Text>
            )}
            {!isMobile && (
              <Text color={textColor} fontSize="11px" fontWeight="500" textAlign="center">
                Generator
              </Text>
            )}
          </Flex>

          {/* Keywords */}
          {/* <Flex flexDirection="column" alignItems="center" gap="4px" cursor="pointer" _hover={{ opacity: 0.8 }}>
           <Flex
              w="44px"
              h="44px"
              bg="transparent"
              border="1px solid #ffffff14"
              borderRadius="12px"
              alignItems="center"
              justifyContent="center"
              onClick={() => router.push(Routes.batch  )}
            >
              <TbKey size="16px" color="#fbbf24" />
            </Flex>
            <Text color={textColor} fontSize="11px" fontWeight="500" textAlign="center" onClick={() => router.push(Routes.batch  )}>
              Batches
            </Text>
          </Flex> */}

          {/* History */}
          <Flex 
            flexDirection={isMobile ? "row" : "column"} 
            alignItems={isMobile ? "center" : "center"} 
            gap={isMobile ? "12px" : "4px"} 
            cursor="pointer" 
            _hover={{ opacity: 0.8 }}
            p={isMobile ? "10px 12px" : "0"}
            borderRadius={isMobile ? "8px" : "0"}
            bg={isMobile && currentPage === Routes.batch ? "#4da3ff1a" : "transparent"}
            onClick={() => handleNavigation(Routes.batch)}
          >
            <Flex
              w={isMobile ? "unset" : "44px"}
              h={isMobile ? "unset" : "44px"}
              bg="transparent"
              border={isMobile ? "none" : "1px solid #ffffff14"}
              borderRadius="12px"
              alignItems="center"
              justifyContent="center"
            >
              <FaFolderOpen size={isMobile ? "20px" : "16px"} color="#fbbf24" />
            </Flex>
            {isMobile && (
              <Text color="white" fontSize="14px" fontWeight="500" flex="1">
                History
              </Text>
            )}
            {!isMobile && (
              <Text color={textColor} fontSize="11px" fontWeight="500" textAlign="center">
                History
              </Text>
            )}
          </Flex>
        </Flex>

        {/* Spacer */}
        <Box flex="1" />

        {/* Account Section - Bottom Aligned */}
        <Flex flexDirection="column" gap={isMobile ? "8px" : "20px"} w="100%" alignItems={isMobile ? "stretch" : "center"} mt="auto">
          {/* Account */}
          <Flex 
            flexDirection={isMobile ? "row" : "column"} 
            alignItems={isMobile ? "center" : "center"} 
            gap={isMobile ? "12px" : "4px"} 
            cursor="pointer" 
            _hover={{ opacity: 0.8 }} 
            position="relative"
            p={isMobile ? "8px 12px" : "0"}
            borderRadius={isMobile ? "8px" : "0"}
            bg={isMobile && currentPage === Routes.account ? "rgba(255, 255, 255, 0.1)" : "transparent"}
            onClick={() => handleNavigation(Routes.account)}
          >
            <Flex
              w="44px"
              h="44px"
              bg="transparent"
              border="1px solid #ffffff14"
              borderRadius="50%"
              alignItems="center"
              justifyContent="center"
              position="relative"
            >
              <TbUser size="16px" color="#60a5fa" />
              {hasPlan && (
                <Badge
                  position="absolute"
                  top="90%"
                  left="50%"
                  transform="translate(-50%, -50%)"
                  bgGradient="linear(to-r, blue.500, purple.500)"
                  color="white"
                  fontSize="8px"
                  fontWeight="bold"
                  borderRadius="3px"
                  px="4px"
                  py="1px"
                >
                  PRO
                </Badge>
              )}
            </Flex>
            {isMobile && (
              <Text color="white" fontSize="14px" fontWeight="500" flex="1">
                Account
              </Text>
            )}
            {!isMobile && (
              <Text color={textColor} fontSize="11px" fontWeight="500" textAlign="center">
                Account
              </Text>
            )}
          </Flex>

          {/* Upgrade */}
          <Flex 
            flexDirection={isMobile ? "row" : "column"} 
            alignItems={isMobile ? "center" : "center"} 
            gap={isMobile ? "12px" : "4px"} 
            cursor="pointer" 
            _hover={{ opacity: 0.8 }}
            p={isMobile ? "8px 12px" : "0"}
            borderRadius={isMobile ? "8px" : "0"}
            bg={isMobile && currentPage === Routes.pricing ? "rgba(255, 255, 255, 0.1)" : "transparent"}
            onClick={() => handleNavigation(Routes.pricing)}
          >
            <Flex
              w="44px"
              h="44px"
              bg="transparent"
              border="1px solid #ffffff14"
              borderRadius="12px"
              alignItems="center"
              justifyContent="center"
            >
              <TbRocket size="16px" color="#00bcd4" />
            </Flex>
            {isMobile && (
              <Text color="white" fontSize="14px" fontWeight="500" flex="1">
                Upgrade
              </Text>
            )}
            {!isMobile && (
              <Text color={textColor} fontSize="11px" fontWeight="500" textAlign="center">
                Upgrade
              </Text>
            )}
          </Flex>
        </Flex>
      </Flex>
    </Box>
  );
};
