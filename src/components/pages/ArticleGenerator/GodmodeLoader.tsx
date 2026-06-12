import {
  CircularProgress,
  CircularProgressLabel,
  Text,
  VStack,
  Spinner,
  useColorModeValue,
  Button,
  Box,
  Flex,
  keyframes
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// 🆕 Added "Composing Final Article" step
const defaultSteps = [
  "Understanding Keyword",
  "Researching",
  "Writing Outline",
  "Composing First Draft",
  "Adding Facts",
  "Adding Citations and Links",
  "Composing Images",
  "Writing Final Draft",
  "SEO Optimization",
  "Writing Meta Tags",
  "Composing Final Article"
];
const liteSteps = [
  "Understanding keyword",
  "Creating outline",
  "Writing draft",
  "Polishing article",
  "Finalizing"
];

const TOTAL_DURATION = 900; // in seconds (15 minutes)
const EARLY_PHASE_DURATION = 10; // First 3 steps: total 30 seconds
// dynamically split remaining time among remaining steps

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

interface GodmodeLoaderProps {
  isProcessing: boolean;
  progress: number; // 0 to 100
  mode?: string;
}

const GodmodeLoader = ({ isProcessing, progress, mode }: GodmodeLoaderProps) => {
  const spinnerColor = useColorModeValue("blackAlpha.300", "whiteAlpha.300");
  const textColor = useColorModeValue("gray.600", "gray.300");
  const router = useRouter();
  
  // Force re-render when progress changes
  const [renderKey, setRenderKey] = useState(0);
  
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [progress]);

  if (!isProcessing) return null;

  const steps = mode === "1a-lite" ? liteSteps : defaultSteps;
  const totalDuration = mode === "1a-lite" ? 180 : TOTAL_DURATION;
  const latePhaseStepDuration = (totalDuration - EARLY_PHASE_DURATION) / Math.max(1, steps.length - 3);
  const elapsed = (progress / 100) * totalDuration;
  const remaining = totalDuration - elapsed;
  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);

  const getCurrentStep = () => {
    if (elapsed < EARLY_PHASE_DURATION) {
      const stepIndex = Math.floor(elapsed / 10); // 3 steps, 10s each
      return {
        label: steps[stepIndex],
        index: stepIndex,
      };
    } else {
      const adjustedElapsed = elapsed - EARLY_PHASE_DURATION;
      const stepIndex = Math.min(
        3 + Math.floor(adjustedElapsed / latePhaseStepDuration),
        steps.length - 1
      );
      return {
        label: steps[stepIndex],
        index: stepIndex,
      };
    }
  };

  const { label, index } = getCurrentStep();

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="rgba(0, 0, 0, 0.7)"
      zIndex={50}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Box
        p={8}
        borderRadius="xl"
        boxShadow="2xl"
        maxW="500px"
        w="90%"
        backgroundImage="linear-gradient(to bottom, #151923, #131827)"
      >
        <VStack spacing={6}>
          <CircularProgress
            key={renderKey}
            value={progress}
            size="180px"
            thickness="4px"
            color="teal.400"
            trackColor="gray.200"
            transition="all 0.3s ease"
          >
            <CircularProgressLabel fontSize="2xl" fontWeight="bold">
              {progress.toFixed(1)}%
            </CircularProgressLabel>
          </CircularProgress>

          {progress < 100 && (
            <>
              <Text fontSize="sm" color={textColor} textAlign="center">
                {mode === "1a-lite"
                  ? "Lite drafts usually finish in a few minutes."
                  : "Your complete batch of articles will be ready in about 15 to 20 minutes."}
              </Text>

              <Flex alignItems="center" justifyContent="center" mb={2}>
                <Spinner size="sm" color="teal.400" mr={3} />
                <Text fontSize="md" fontWeight="medium" color={textColor}>
                  {label}...
                </Text>
              </Flex>

              <Text fontSize="sm" color={textColor} textAlign="center">
                You can leave this page. We will email you when it is ready.
              </Text>

              <Button
                colorScheme="teal"
                size="lg"
                onClick={() => {
                  router.push('/dashboard');
                  //window.location.reload();
                }}
                w="100%"
              >
                Back to the Dashboard
              </Button>
            </>
          )}
        </VStack>
      </Box>
    </Box>
  );
};

export default GodmodeLoader;
