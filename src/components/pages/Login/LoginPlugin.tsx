"use client";

import {
  Button,
  Flex,
  Link,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { useColorModeValues } from "@/hooks/useColorModeValues";
import { TbArrowNarrowLeft } from "react-icons/tb";
import { useRouter } from "next/navigation";
import { Logo, LogoLight } from "@/components/atoms/Logo/Logo";

type Props = {
  redirectUri: string;
  initialState: string;
  initialError?: string | null;
};

const LoginPlugin = ({ redirectUri, initialState, initialError }: Props) => {
  const router = useRouter();
  const { primaryTextColor, borderColor } = useColorModeValues();
  const boxBgColor = useColorModeValue("white", "transparent");
  const LogoComponent = useColorModeValue(LogoLight, Logo);

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isSigningInWithGoogle, setSigningInWithGoogle] = useState(false);

  useEffect(() => {
    if (!redirectUri) {
      setSessionError(
        "Missing redirect_uri. Open this page using the link from your WordPress plugin."
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/plugin-connect/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            redirect_uri: redirectUri,
            state: initialState,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          if (!cancelled) {
            setSessionError(data.error || `Could not start connect (${res.status})`);
          }
          return;
        }
        if (!cancelled) setSessionReady(true);
      } catch {
        if (!cancelled) setSessionError("Network error starting connect flow.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [redirectUri, initialState]);

  const onGoogleSignIn = () => {
    setSigningInWithGoogle(true);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    signIn("google", {
      callbackUrl: `${origin}/login/plugin/complete`,
    });
  };

  const missingRedirect = !redirectUri;

  return (
    <Flex
      w="100vw"
      minH="100vh"
      alignItems="center"
      justifyContent="flex-start"
      flexDir="column"
    >
      <Button
        position="absolute"
        top="8px"
        left="8px"
        variant="ghost"
        leftIcon={<TbArrowNarrowLeft />}
        onClick={() => router.push("/")}
        _hover={{
          bgColor: "transparent",
        }}
      >
        Back
      </Button>
      <Flex
        w="100vw"
        h="100vh"
        alignItems="center"
        justifyContent="center"
        flexDir="column"
      >
        <Flex
          flexDir="column"
          p="0 60px 40px"
          borderRadius="24px"
          boxShadow={["none", "lg"]}
          border={["0", "1px solid"]}
          borderColor={[borderColor, borderColor]}
          alignItems="flex-start"
          position="relative"
          bgColor={boxBgColor}
          w="400px"
        >
          <Flex
            alignItems="center"
            justifyContent="center"
            alignSelf="center"
            color="white"
            fontSize="18px"
            mb="40px"
            mt="20px"
            ml="0px"
          >
            <LogoComponent />
          </Flex>
          <Text textAlign="left" fontSize="18px" fontWeight="semibold" as="h1">
            Connect WordPress
          </Text>
          <Text mt="12px" fontSize="13px" color="gray.600">
            Sign in with Google to link this site to your Who Needs a Writer
            account. You will be sent back to WordPress when finished.
          </Text>

          {initialError ? (
            <Text mt="16px" fontSize="sm" color="orange.500">
              {initialError}
            </Text>
          ) : null}

          {sessionError ? (
            <Text mt="24px" fontSize="sm" color="red.500">
              {sessionError}
            </Text>
          ) : null}

          {!missingRedirect && (
            <Button
              my="24px"
              h="36px"
              variant="solid"
              size="sm"
              w="100%"
              leftIcon={<FcGoogle />}
              bgColor="transparent"
              border="1px solid"
              borderColor="brand.400"
              _hover={{
                bgColor: "transparent",
                borderColor: "brand.300",
              }}
              onClick={onGoogleSignIn}
              isLoading={isSigningInWithGoogle}
              isDisabled={!sessionReady}
              color={primaryTextColor}
            >
              Continue with Google
            </Button>
          )}

          <Text mt="16px" fontSize="13px" color="gray.500">
            Prefer signing in on the web app?{" "}
            <Link href="/login" ml="4px" color="brand.500">
              Normal login
            </Link>
          </Text>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default LoginPlugin;
