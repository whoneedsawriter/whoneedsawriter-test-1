import React, { useEffect, useState, useRef, useContext } from "react";
import {
  Button,
  Text,
  Flex,
  Container,
  Heading,
  VStack,
  Box
} from "@chakra-ui/react";
import { IoChevronBackSharp } from "react-icons/io5";
import { GrNext } from "react-icons/gr";
import DashboardHeader from "@/components/organisms/DashboardHeader/DashboardHeader";
import { RenderFormStep } from "./FormSteps";
import { UserContext, UserContextType } from "@/app/customProviders/UserProvider";

type ResearchData = {
  websiteUrl: string;
  topic: string;
  description: string;
  goal: string;
}

const KeywordResearch: React.FC = () => {
  const { user, isLoading, error: userError } = useContext(UserContext) as UserContextType;
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 4;
  const [researchData, setResearchData] = useState<ResearchData>({
    websiteUrl: '',
    topic: '',
    description: '',
    goal: '',
  });

  const [error, setError] = useState<null | string>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  const handleContinue = () => {
    if (currentStep === 1) {
      if (researchData.websiteUrl === '' && researchData.topic === '') {
        setError('Please enter a website URL or a topic');
        return;
      }
    }
    if (currentStep === 2) {
      if (researchData.description === '') {
        setError('Please enter a description');
        return;
      }
    }
    if (currentStep === 3) {
      if (researchData.goal === '') {
        setError('Please enter a goal');
        return;
      }
    }

    setCurrentStep(currentStep + 1);
    setError(null);
  }

  const [keywordResearchResult, setKeywordResearchResult] = useState(0);
  const handleGenerateKeywordResearch = async () => {
    const totalCredits = (user?.monthyBalance || 0) + (user?.lifetimeBalance || 0) + (user?.freeCredits || 0);
    if(totalCredits < 0.1) {
      alert('You do not have enough credits to generate keyword research');
      return;
    }
    try {
      setIsProcessing(true);
      setProgress(0);

      // Call API to create keyword research record and send to make.com
      const response = await fetch('/api/keyword-research/start-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          websiteUrl: researchData.websiteUrl,
          topic: researchData.topic,
          description: researchData.description,
          goal: researchData.goal,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create keyword research request');
      }

      const data = await response.json();
      console.log('Keyword research created:', data);

      // Simulate progress (you can update this based on actual progress from make.com webhook callbacks)
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 1; // Increment by 1% every 5 seconds
        });
      }, 3000);

      // Stop progress after 3-5 minutes (180-300 seconds)
      setTimeout(async () => {
        clearInterval(interval);
        setProgress(100);
        setIsProcessing(false);
        const response = await fetch('/api/keyword-research/check-generation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ generationId: data.id }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to check keyword research');
        }
        const checkData = await response.json();
        console.log('Keyword research status:', checkData);
        if (checkData.message === 'completed') {
          setKeywordResearchResult(1);
        } else {
          setKeywordResearchResult(2);
        }
      }, 300000); // 5 minutes - adjust as needed

    } catch (error) {
      console.error('Error generating keyword research:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate keyword research');
      setIsProcessing(false);
      setProgress(0);
      setKeywordResearchResult(3);
    }
  }

  return (
    <Flex justifyContent="flex-start" w="100%" minH="100vh">
      <div className="flex-col w-full">
        <DashboardHeader />
        <Container px="27px" pt={["15px", "15px", "96px"]} alignItems="flex-center" maxWidth="700px" mb="56px">
         <VStack align="flex-start" spacing={6} width="100%">
      <Box className="border border-[#ffffff14] w-full mb-4 bg-gradient-to-b from-[#151923] to-[#131827]" style={{ boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>
        {/* Header Section */}
        <div className="w-full bg-[#1f2937]">
         <p className="h-1 rounded-full bg-[#2c5282] transition-all duration-300" style={{ width: `${(100 / totalSteps) * (currentStep - 1)}%` }}></p>
        </div>

        <div className="min-h-[300px]">
          <VStack align="flex-start" spacing={2} width="100%">
            <Heading size="lg" color="#eef2f7" textAlign="center" width="100%" mb="20px" mt="20px" >Keyword Research</Heading>
          </VStack>
          <VStack align="flex-start" spacing={2} width="100%">
            <RenderFormStep
              step={currentStep}
              researchData={researchData}
              setResearchData={setResearchData}
              error={error}
              progress={progress}
              isProcessing={isProcessing}
              keywordResearchResult={keywordResearchResult}
            />
          </VStack>
        </div>
        
        {/* Action Buttons */}
        <Flex
          gap={4}
          data-tour="generate-button"
          p="22px"
          className="flex-col md:flex-row md:items-center md:justify-between justify-end"
        >
            {currentStep === 1 || currentStep === 5 ? null : (
            <div className="inline-flex items-center gap-4 px-4 py-2 rounded-full bg-[#1b2232] border border-[#ffffff14] text-[13px] text-[#eef2f7]">
              <span className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentStep(currentStep - 1)}>
                  <>
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1f2937]">
                      <IoChevronBackSharp />
                    </span>
                    <span>
                      Back
                    </span>
                  </>
              </span>
            </div>
            )}
          {currentStep !== 5 && (
          <Flex gap={4} ml="auto">
            <Button
              colorScheme="brand"
              bg="#2c5282"
              color="#eef2f7"
              className="text-[14px]"
              px={4}
              rounded="lg"
              _hover={{ bg: "blue.700", color: "white" }}
              onClick={() => {
                if (currentStep == 4) {
                  handleGenerateKeywordResearch();
                }
                handleContinue();
              }}
              disabled={false}
            >
                <span>{ currentStep == 4 ? "Generate Keyword Research" : "Continue" }</span>
                <span className="ml-2 flex items-center justify-center w-4 h-4 rounded-full bg-[#2c5282]">
                <GrNext />
                </span>
              
            </Button>
          </Flex>
          )}
        </Flex>
       </Box>
      </VStack>
     </Container>
    </div>
   </Flex>
  );
};

export default KeywordResearch;
