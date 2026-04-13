import React, { useEffect, useState, useRef, useContext } from "react";
import {
  Button,
  Text,
  Flex,
  Container,
  Heading,
  VStack,
  Input,
  Textarea,
  Switch,
  Box,
  Spinner,
  useColorModeValue,
  Select,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Tooltip
} from "@chakra-ui/react";
import {
  TbPlus
} from "react-icons/tb";
import { GiCheckMark } from "react-icons/gi";
import { HiOutlineCog6Tooth } from "react-icons/hi2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { User } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
//import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import GodmodeLoader from "./GodmodeLoader";
import { TourGuide, useTourStatus, articleGeneratorTourSteps, articleGeneratorGodModeTourSteps } from "@/components/TourGuide";
import DashboardHeader from "@/components/organisms/DashboardHeader/DashboardHeader"; 
import { UserContext, UserContextType } from "@/app/customProviders/UserProvider";
import { PricingPopupContext } from "@/app/PricingPopupProvider";

const ArticleGenerator: React.FC = () => {
  
  const router = useRouter();
  const [isEditPromptDialogOpen, setIsEditPromptDialogOpen] = React.useState(false);
  const { onOpen: onPricingPopupOpen } = useContext(PricingPopupContext);
  // Tour guide state
  const [runTour, setRunTour] = useState(false);
  const { shouldShowTour, resetTour, markTourComplete } = useTourStatus('article-generator');
  //const [todoToEdit, setTodoToEdit] = React.useState<Todo | null>(null);
  
  const searchParams = useSearchParams();
  const param = searchParams.get("payment"); 
  useEffect(() => {
    if(param === 'success') {
      const type = searchParams.get("type");
      const plan = searchParams.get("plan");
              if(type === 'subscription'){
          toast.success(`You have been successfully upgraded to "${plan} Monthly Plan"`, {
            duration: 20000 // 20 seconds
          });
        }else{
          toast.success(`You have been successfully upgraded to "${plan} Lifetime Plan"`, {
            duration: 20000 // 20 seconds
          });
        }
      }else if(param === 'failed'){
        toast.error("Your Payment has failed (Please Try again)", {
          duration: 20000 // 20 seconds
        });
    }
  }, [param]);

// Getting user details from the context
  const { user, isLoading, error } = useContext(UserContext) as UserContextType;
  const queryClient = useQueryClient();
  //console.log(user, isLoading);

  // Auto-start tour for new users
  useEffect(() => {
    if (shouldShowTour && !isLoading && user) {
      const timer = setTimeout(() => {
        setRunTour(true);
      }, 1500); // Small delay to ensure everything is rendered
      return () => clearTimeout(timer);
    }
  }, [shouldShowTour, isLoading, user]);

  const handleStartTour = () => {
    setRunTour(true);
  };

  const handleTourComplete = async () => {
    setRunTour(false);
    await markTourComplete(true, false);
  };

  const handleTourSkip = async () => {
    setRunTour(false);
    await markTourComplete(false, true);
  };

  const openPromptDialog = () => {
    setIsEditPromptDialogOpen(true);
  };

  const closeEditPromptDialog = () => {
    setIsEditPromptDialogOpen(false);
  };
  
  const [text, setText] = useState('');
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const [prompt, setPrompt] = useState("Write a detailed and information-dense and seo optimized article in English for the keyword {KEYWORD} in html using clear, language without unnecessary grandiose or exaggerations for newspaper. Write article with subheadings formatted in HTML without head or title.");
  const batchRef = useRef("");
  const handleBatchChange = (val: string) => {
    batchRef.current = val; // No re-render happens
  };

  const generateArticle = useMutation({
    mutationFn: async (keyword: { 
      batchId: string, 
      text: string, 
      prompt: string, 
      is_godmode: boolean, 
      model: string,
      balance_type?: string, 
      no_of_keyword: number,
      wordLimit?: string, // Optional as it might not be used by lite mode
      featuredImage?: string, // Optional
      imageInArticle?: string, // Optional
      enableExternalLinks?: string, // Optional
      specialRequests?: string, // Optional
      toneChoice?: string, // Optional
      perspective?: string, // Optional
      description?: string, // Optional
      references?: string, // Optional
    }) => {
      const response = await fetch("/api/article-generator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(keyword)
      });
      if (!response.ok) {
        throw new Error("Failed to create article");
      }
      return response.json();
    },
    onSuccess: (data) => {
      //toast.success("Article generated successfully for Keyword: ");
    },
    onError: (error) => {
      // If the error is an abort error, don't show the toast
      if (error.name !== 'AbortError') {
        toast.error("Error creating article");
      }
    },
  });

  const [currentKeyword, setCurrentKeyword] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const sendKeywordsSequentially = async (keywords: string[]) => {
    if(keywords.length === 0){
      toast.error("Please enter Keywords");
      return;
    }
    if(balance.credits == 0) {
      onPricingPopupOpen();
      return;
    }
    if(keywords.length > balance.credits*10){
      console.log(keywords.length);
      console.log(balance.credits*10);
      toast.error("Limit Exceeded. Please shorten your list or buy more credits. ");
      return;
    }
    if(keywords.length > 10) {
      toast.error("10 Maximum keywords allowed in one batch");
      return;
    }

    setIsProcessing(true);

    const batchValue = batchRef.current && batchRef.current.trim() !== ''
    ? batchRef.current
    : "Batch_" + (Math.floor(Math.random() * 9000) + 1000);

    try {
      const response = await fetch('/api/article-generator/batch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({batch: batchValue, articleType: 'liteMode', articles: keywords.length})
      });

      const data = await response.json();
     // batchRef.current = data.assignedBatch;

    // console.log(data);

      const interval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 0.3, 95)); // Slow continuous progress
      }, 1000);

      for (let i = 0; i < keywords.length; i++) {

        setCurrentKeyword(keywords[i]);
        try {
          await generateArticle.mutateAsync({
            batchId: data.assignedBatch,
            text: keywords[i],
            prompt: prompt,
            is_godmode: isGodMode,
            model: selectedModel,
            no_of_keyword: 1,
            balance_type: balance.balance_type,
          });
        } catch (error: any) {
         // console.error(`Error processing keyword "${keywords[i]}":`, error);
          toast.error(`Error creating article for the keyword: "${keywords[i]}"`);
        }
        let progressPercent = ((i + 1) / keywords.length) * 100;
        setProgress(progressPercent); // Jump to the actual progress when result is received
      }
      
      clearInterval(interval);
      router.push(`/articles?batchId=${data.assignedBatch}`);
      
    } catch (error: any) {
     // console.error("Error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const godModeArticleIds = useRef<string[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [godmodeArticlePrepared, setGodmodeArticlePrepared] = useState([]);
  const [godmodeArticleRemain, setGodmodeArticleRemain] = useState(0);
  const [godmodeStatus, setGodmodeStatus] = useState('');
  const [isProcessingGodmode, setIsProcessingGodmode] = useState(false);
  const [progressGodmode, setProgressGodmode] = useState(0);
  const [GodModeLoader, setGodModeLoader] = useState(false);
  const redirectReadyRef = useRef(false);
  const [showLowBalanceDialog, setShowLowBalanceDialog] = useState(false);

  const sendKeywordsSequentiallyGodmode = async (keywords: string[]) => {
    if (balance.credits == 0 ) {
      onPricingPopupOpen();
      return;
    }
    if( selectedModel === '1a-lite' && keywords.length * 0.1 > balance.credits){
     // toast.error("Limit Exceeded. Please shorten your list or buy more credits. ");
      setShowLowBalanceDialog(true);
      return;
    }
    if( selectedModel === '1a-core' && keywords.length * 1 > balance.credits){
     // toast.error("Limit Exceeded. Please shorten your list or buy more credits. ");
      setShowLowBalanceDialog(true);
      return;
    }
    if( selectedModel === '1a-pro' && keywords.length * 2 > balance.credits){
     // toast.error("Limit Exceeded. Please shorten your list or buy more credits. ");
      setShowLowBalanceDialog(true);
      return;
    }

    if (keywords.length === 0) {
      toast.error("Please enter Keywords");
      return;
    }
    if (keywords.length > 10) {
      toast.error("10 Maximum keywords allowed in one batch");
      return;
    }
    setIsProcessingGodmode(true);
    setGodModeLoader(true);
    start25MinLoader(); // 🔥 Start the 25-min loader here

    try {
      const batchValue = batchRef.current && batchRef.current.trim() !== ''
      ? batchRef.current
      : "Batch_" + (Math.floor(Math.random() * 9000) + 1000);

      const response = await fetch('/api/article-generator/batch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({batch: batchValue, articleType: 'godmode', articles: keywords.length})
      });

      const data = await response.json();
      batchRef.current = data.assignedBatch;
    
      const res = await generateArticle.mutateAsync({
        batchId: batchRef.current,
        text: keywords.join('\n'),
        prompt: prompt,
        is_godmode: isGodMode,
        model: selectedModel,
        balance_type: balance.balance_type,
        no_of_keyword: keywords.length,
        wordLimit: wordLimit,
        featuredImage: featuredImage,
        imageInArticle: imageInArticle,
        enableExternalLinks: enableExternalLinks,
        specialRequests: specialRequests,
        toneChoice: toneChoice,
        perspective: perspective,
        description: description,
        references: references,
      });
      
      // Store all article IDs
      godModeArticleIds.current = res.articles.map((article: any) => article.id);
      
    //  console.log(godModeArticleIds.current);
    } catch (error: any) {
     // console.error("Error processing keywords:", error);
      // Always clean up when there's an error
      setIsProcessingGodmode(false);
      setGodModeLoader(false);
      if (timerRef.current) {
           clearInterval(timerRef.current);
      }
    }
  };

  // Add this state
const [startTime, setStartTime] = useState<number | null>(null);
const [apiCalled, setApiCalled] = useState(false);

// Replace your start25MinLoader function with this approach:
const start25MinLoader = () => {
  const startTime = Date.now();
  setStartTime(startTime);
  setProgressGodmode(0);
  let lastApiCallTime = 0;
  
  const updateProgress = () => {
    const elapsed = (Date.now() - startTime) / 1000; // seconds
    const percent = Math.min((elapsed / 900) * 100, 100);
    setProgressGodmode(percent);
    
    // Check article prepared every 2 minutes (120 seconds)
    if (elapsed - lastApiCallTime >= 120) {
      lastApiCallTime = elapsed;
      checkArticlePrepared();
    }
    
    if (elapsed >= 900) {
      setGodModeLoader(false);
      redirectReadyRef.current = true;
    } else {
      requestAnimationFrame(updateProgress);
    }
  };
  
  updateProgress();
};
  
  const checkArticlePrepared = () => {
    fetch("/api/article-generator/check-godmode-completion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({keywords: godModeArticleIds.current})
    }).then(response => response.json())
      .then(data => {
       // console.log(data.res);
         if(data.res === 'Partial'){
           setGodmodeArticlePrepared(data.contentFilledKeywords);
           setGodmodeArticleRemain(data.remainingKeywords);
           setGodmodeStatus('Partial');
         }
         if(data.res === 'Full'){
           setGodmodeArticlePrepared(data.contentFilledKeywords);
           setGodmodeStatus('Full');
           // Complete the loader circle immediately when articles are fully ready
           setProgressGodmode(100);
           setGodModeLoader(false);
           redirectReadyRef.current = true;
         }
         if(data.res === 'Incomplete'){
          setGodmodeArticleRemain(data.remainingKeywords);
          setGodmodeStatus('Incomplete');
         }
      })
      .catch(error => {
        // Ignore abort errors
        if (error.name !== 'AbortError') {
         // console.error('Error:', error);
        }
      });
  }

  useEffect(() => {
    if (redirectReadyRef.current && godmodeArticleRemain === 0 && !GodModeLoader) {
      setTimeout(() => {
        router.push(`/articles?batchId=${batchRef.current}`);
      }, 3000);
    }
  }, [godmodeArticleRemain, GodModeLoader]);
  
  const [isGodMode, setIsGodMode] = useState<boolean>(true);
  const [selectedModel, setSelectedModel] = useState<string>("1a-core");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  
  const modelOptions = [
    {
      value: "1a-lite",
      label: "1a Lite",
      credits: "0.1 Credit",
      description: "Simple content, no frills",
      isGodMode: true
    },
    {
      value: "1a-core",
      label: "1a Core",
      credits: "1 Credit",
      description: "Research-backed. Blog-ready.",
      isGodMode: true
    },
    {
      value: "1a-pro",
      label: "1a Pro", 
      credits: "2 Credits",
      description: "PhD-level & Deeply Researched",
      isGodMode: true
    }
  ];

  const handleModelSelect = (option: typeof modelOptions[0]) => {
    setSelectedModel(option.value);
    setIsGodMode(option.isGodMode);
    setIsDropdownOpen(false);
  };

  useEffect(() => {
    if (selectedModel === '1a-lite') {
      setFeaturedImage('no');
    }else{
      setFeaturedImage('yes');
    }
  }, [selectedModel]);

  const selectedOption = modelOptions.find(option => option.value === selectedModel) || modelOptions[1];

  // Credit cost calculation based on selected model
  const perArticleCredit =
    selectedModel === "1a-lite"
      ? 0.1
      : selectedModel === "1a-core"
      ? 1
      : 2; // 1a-pro

  const totalCredits = Number((lines.length * perArticleCredit).toFixed(2));

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const [showGodModeAlert, setShowGodModeAlert] = useState<boolean>(true);
  const [balance, setBalance] = useState({credits: 0, balance_type: '', balance_text: ''});

  useEffect(() => {
      setShowGodModeAlert(true);
      //console.log(user);
      
      const totalCredits = (user?.monthyBalance || 0) + (user?.lifetimeBalance || 0) + (user?.freeCredits || 0);
      let balanceType = '';
      
      if(user && user?.monthyBalance > 0) {
        balanceType = 'monthyBalance';
      } else if(user && user.lifetimeBalance > 0){
        balanceType = 'lifetimeBalance';
      } else {
        balanceType = 'freeCredits';
      }
      
      setBalance({
        credits: totalCredits,
        balance_type: balanceType,
        balance_text: 'Credits'
      });
    
  }, [user]);


  const [wordLimit, setWordLimit] = useState("2000");
  const [featuredImage, setFeaturedImage] = useState("yes");
  const [imageInArticle, setImageInArticle] = useState("no");
  const [specialRequests, setSpecialRequests] = useState("");
  const [enableExternalLinks, setEnableExternalLinks] = useState("No");
  
  // Additional Options state
  const [showAdditionalOptions, setShowAdditionalOptions] = useState(false);
  const [showPublisherDetailsPopup, setShowPublisherDetailsPopup] = useState(false);
  const [references, setReferences] = useState("No");
  const [toneChoice, setToneChoice] = useState("Neutral");
  const [perspective, setPerspective] = useState("Individual (I)");
  const [description, setDescription] = useState("");
  const [isToneDropdownOpen, setIsToneDropdownOpen] = useState(false);
  const [isPerspectiveDropdownOpen, setIsPerspectiveDropdownOpen] = useState(false);
  
  // Refs for dropdowns
  const toneDropdownRef = useRef<HTMLDivElement>(null);
  const perspectiveDropdownRef = useRef<HTMLDivElement>(null);

  // Close tone dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toneDropdownRef.current && !toneDropdownRef.current.contains(event.target as Node)) {
        setIsToneDropdownOpen(false);
      }
    };

    if (isToneDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isToneDropdownOpen]);

  // Close perspective dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (perspectiveDropdownRef.current && !perspectiveDropdownRef.current.contains(event.target as Node)) {
        setIsPerspectiveDropdownOpen(false);
      }
    };

    if (isPerspectiveDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPerspectiveDropdownOpen]);

  // Load saved profile values from user when component mounts or user data changes
  useEffect(() => {
    if (user) {
      const userWithProfile = user as User & { toneChoice?: string; perspective?: string; description?: string };
      if (userWithProfile.toneChoice) {
        setToneChoice(userWithProfile.toneChoice);
      }
      if (userWithProfile.perspective) {
        setPerspective(userWithProfile.perspective);
      }
      if (userWithProfile.description) {
        setDescription(userWithProfile.description);
      }
    }
  }, [user]);

  // Save profile mutation
  const saveProfile = useMutation({
    mutationFn: async (profileData: {
      toneChoice: string;
      perspective: string;
      description: string;
    }) => {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save profile");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Profile saved successfully");
      // Invalidate user query to refresh user data
      queryClient.invalidateQueries({ queryKey: ["user"] });
      setShowPublisherDetailsPopup(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save profile");
    },
  });

  return (
    <Flex justifyContent="flex-start" w="100%" minH="100vh">
        <div className="flex-col w-full">
        <DashboardHeader />
        <Container px="27px" pt={["15px", "15px", "96px"]} alignItems="flex-center" maxWidth="1050px" mb="56px">
         <VStack align="flex-start" spacing={6} width="100%">
      
      <Box className="border border-[#ffffff14] rounded-2xl p-[22px] w-full mb-4 bg-gradient-to-b from-[#151923] to-[#131827]" style={{ boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>
        {/* Header Section */}
        <VStack align="flex-start" spacing={2} width="100%">
         <Heading size="lg" color="#eef2f7">What do you want to write today?</Heading>
          <Text className="text-[#a9b1c3] text-md">
          Enter your Topic or Keywords
          </Text>
        </VStack>
        {/* Mode Selection and Balance Section */}
        <Flex width="100%" justifyContent="space-between" alignItems="flex-start" gap={4}>
          <div className="flex flex-col w-full" data-tour="article-mode">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-3.5 mb-3">
              <div className="flex flex-col w-full">
                <div className="bg-[#1b2232] rounded-lg p-4 flex-1 border border-[#ffffff14]">
                  <label className="block text-sm text-[#7f8aa3] mb-3">Model Selection</label>
                  <div className="relative dropdown-container" data-tour="article-mode">
                <div className="relative">
                  <button
                    className="w-[100%] bg-[#0e1322] border border-[#ffffff14] text-white rounded-lg py-3 px-4 text-left flex items-center justify-between"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <span className="font-medium text-white">{selectedOption.label}</span>
                    <svg 
                      className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 border border-[#ffffff14] bg-[#151923] rounded-lg z-50 overflow-hidden"
                    style={{ boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>
                      {modelOptions.map((option, index) => (
                        <div
                          key={option.value}
                          className={`dropdown-option p-4 cursor-pointer transition-all duration-200 hover:bg-[#ffffff0d] ${
                            index === 0 ? 'rounded-t-lg' : ''
                          } ${
                            index === modelOptions.length - 1 ? 'rounded-b-lg' : ''
                          }`}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#1a1f3a';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          onClick={() => handleModelSelect(option)}
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <strong className="font-medium text-white">
                                {option.label}
                              </strong>
                              <span className="badge text-[10px] px-2 py-1 font-bold rounded-full bg-[#1b2232] text-[#a9b1c3] border border-[#ffffff14]">
                                {option.credits}
                              </span>
                              { selectedModel === option.value && (
                                <GiCheckMark className="w-3 h-3 text-[#4da3ff] ml-auto" />
                              )}
                            </div>
                            <small className="text-xs text-[#7f8aa3]">
                              {option.description}
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                </div>
              </div>
              </div>
              { isGodMode && (
              <div className="flex flex-col w-full">
                <div className="bg-[#1b2232] rounded-lg p-4 flex-1 border border-[#ffffff14]">
                  <label className="block text-sm text-[#7f8aa3] mb-3">Word Count</label>
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type="range"
                        min="500"
                        max="4000"
                        step="100"
                        value={wordLimit}
                        onChange={(e) => setWordLimit(e.target.value)}
                         className="w-full bg-slate-700 rounded-lg appearance-none cursor-pointer slider slider-sm"
                         style={{
                          padding: '0px',
                           background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((parseInt(wordLimit) - 500) / (4000 - 500)) * 100}%,rgb(246, 247, 249) ${((parseInt(wordLimit) - 500) / (4000 - 500)) * 100}%,rgb(232, 236, 243) 100%)`
                         }}
                      />
                    </div>
                    <div className="text-left">
                      <span className="text-white text-sm">{wordLimit}</span>
                    </div>
                  </div>
                </div>
              </div>
              )}

          {/* <Flex direction="column" alignItems="flex-end" width="100%" className="balance-div">
            { isLoading ?
            <Spinner size="xs" color={spinnerColor} mr="16px" /> 
            :
            <>
            <Text fontSize="sm" color="gray.400">{balance.balance_text}: {balance.credits}</Text>
            { user && user?.monthyBalance === 0 && user && user?.lifetimeBalance === 0 &&
            <Text
            fontSize="sm"
            color="blue.500"
            textDecoration="underline"
            onClick={openPricingPopup}
            cursor="pointer"
            >
              Buy more credits
            </Text>
            }
            </>
          }
          </Flex> */}
            </div>
          </div>
        </Flex>

        {/* Options - Stylish Checkboxes */}
        { (selectedModel === '1a-pro' || selectedModel === '1a-core' || selectedModel === '1a-lite') && (
        <div className={`flex flex-wrap gap-4 mt-6 mb-8 ${selectedModel === '1a-lite' ? 'opacity-50' : ''}`}>
          <Tooltip 
            label={selectedModel === '1a-lite' ? 'Not supported in current model' : ''}
            isDisabled={selectedModel !== '1a-lite'}
            hasArrow
          >
            <span className="inline-block">
              <button
                type="button"
                onClick={() => selectedModel !== '1a-lite' && setFeaturedImage(prev => (prev === 'yes' ? 'no' : 'yes'))}
                disabled={selectedModel === '1a-lite'}
                className={`w-fit flex items-center gap-3 px-5 py-3 rounded-full border bg-[#1b2232] border-[#ffffff14] hover-gradient ${selectedModel === '1a-lite' ? 'cursor-not-allowed' : ''}`}
                style={{ transition: 'background .2s ease, box-shadow .2s ease, border-color .2s ease' }}
              >
                <span className={`w-4 h-4 rounded-[4px] flex items-center justify-center ${
                  featuredImage === 'yes' ? 'bg-[#6c8cff]' : 'bg-[#0e1322]'
                }`}>
                  {featuredImage === 'yes' && <GiCheckMark className="text-white w-2.5 h-2.5" />}
                </span>
                <span className="text-[#eef2f7] font-bold text-xs">Featured image</span>
              </button>
            </span>
          </Tooltip>

          <Tooltip 
            label={selectedModel === '1a-lite' ? 'Not supported in current model' : ''}
            isDisabled={selectedModel !== '1a-lite'}
            hasArrow
          >
            <span className="inline-block">
              <button
                type="button"
                onClick={() => selectedModel !== '1a-lite' && setImageInArticle(prev => (prev === 'yes' ? 'no' : 'yes'))}
                disabled={selectedModel === '1a-lite'}
                className={`w-fit flex items-center gap-3 px-5 py-3 rounded-full border bg-[#1b2232] border-[#ffffff14] hover-gradient ${selectedModel === '1a-lite' ? 'cursor-not-allowed' : ''}`}
                style={{ transition: 'background .2s ease, box-shadow .2s ease, border-color .2s ease' }}
              >
                <span className={`w-4 h-4 rounded-[4px] flex items-center justify-center ${
                  imageInArticle === 'yes' ? 'bg-[#6c8cff]' : 'bg-[#0e1322]'
                }`}>
                  {imageInArticle === 'yes' && <GiCheckMark className="text-white w-2.5 h-2.5" />}
                </span>
                <span className="text-[#eef2f7] font-bold text-xs">Infographics</span>
              </button>
            </span>
          </Tooltip>

          <Tooltip 
            label={selectedModel === '1a-lite' ? 'Not supported in current model' : ''}
            isDisabled={selectedModel !== '1a-lite'}
            hasArrow
          >
            <span className="inline-block">
              <button
                type="button"
                onClick={() => selectedModel !== '1a-lite' && setEnableExternalLinks(prev => (prev === 'Yes' ? 'No' : 'Yes'))}
                disabled={selectedModel === '1a-lite'}
                className={`w-fit flex items-center gap-3 px-5 py-3 bg-[#1b2232] border-[#ffffff14] rounded-full border hover-gradient ${selectedModel === '1a-lite' ? 'cursor-not-allowed' : ''}`}
                style={{ transition: 'background .2s ease, box-shadow .2s ease, border-color .2s ease' }}
              >
                <span className={`w-4 h-4 rounded-[4px] flex items-center justify-center ${
                  enableExternalLinks === 'Yes' ? 'bg-[#6c8cff]' : 'bg-[#0e1322]'
                }`}>
                  {enableExternalLinks === 'Yes' && <GiCheckMark className="text-white w-2.5 h-2.5" />}
                </span>
                <span className="text-[#eef2f7] font-bold text-xs">External links</span>
              </button>
            </span>
          </Tooltip>

          {/* Additional Options Button - Only for 1a-pro and 1a-core */}
          {(selectedModel === '1a-pro' || selectedModel === '1a-core') && (
            <button
              type="button"
              onClick={() => setShowAdditionalOptions(prev => !prev)}
              className="w-fit flex items-center gap-3 px-5 py-3 bg-[#1b2232] border-[#ffffff14] rounded-full border hover-gradient"
              style={{ transition: 'background .2s ease, box-shadow .2s ease, border-color .2s ease' }}
            >
              <HiOutlineCog6Tooth className="text-[#eef2f7] w-4 h-4" />
              <span className="text-[#eef2f7] font-bold text-xs">Additional Options</span>
            </button>
          )}
        </div>
        )}

        {/* Additional Options Section */}
        {showAdditionalOptions && (selectedModel === '1a-pro' || selectedModel === '1a-core') && (
          <div className="flex flex-wrap gap-4 mt-4 mb-8 p-4 rounded-lg border border-[#ffffff14] bg-[#1b2232]">
            {/* References Checkbox */}
            { selectedModel === '1a-pro' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setReferences(prev => (prev === 'Yes' ? 'No' : 'Yes'))}
                className="w-fit flex items-center gap-3 px-5 py-3 rounded-full border bg-[#1b2232] border-[#ffffff14] hover-gradient"
                style={{ transition: 'background .2s ease, box-shadow .2s ease, border-color .2s ease' }}
              >
                <span className={`w-4 h-4 rounded-[4px] flex items-center justify-center ${
                  references === 'Yes' ? 'bg-[#6c8cff]' : 'bg-[#0e1322]'
                }`}>
                  {references === 'Yes' && <GiCheckMark className="text-white w-2.5 h-2.5" />}
                </span>
                <span className="text-[#eef2f7] font-bold text-xs">References ({references === 'Yes' ? 'Yes' : 'No'})</span>
              </button>
            </div>
            )}
            {/* Publisher Details */}
            <Tooltip label="Helps enhance article" hasArrow>
              <button
                type="button"
                onClick={() => setShowPublisherDetailsPopup(true)}
                className="w-fit flex items-center gap-3 px-5 py-3 bg-[#1b2232] border-[#ffffff14] rounded-full border hover-gradient"
                style={{ transition: 'background .2s ease, box-shadow .2s ease, border-color .2s ease' }}
              >
                <span className="text-[#eef2f7] font-bold text-xs">Publisher Details</span>
              </button>
            </Tooltip>
          </div>
        )}

        {/* Lite Mode Change Prompt */}
        {!isGodMode && (
          <Flex gap={2} width="100%" justifyContent="space-between" alignItems="center" mt="20px">
            <div data-tour="custom-prompt">
              <Button
                onClick={() => openPromptDialog()}
                size="sm"
                leftIcon={<TbPlus />}
                minW="160px"
                variant="solid"
                className="text-slate-500 custom-btn-1"
              >
                Change Prompt
              </Button>
            </div>
          </Flex>
        )}

        {/* Batch Details Section */}
        <VStack align="flex-start" spacing={2} width="100%" mt="16px">
          <label className={`font-normal text-[13px] text-[#7f8aa3]`}>Batch name (optional)</label>
          <input
             placeholder="e.g., March SEO Batch or Client ABC - Pillar Posts"
             defaultValue={batchRef.current}
             onChange={(e) => handleBatchChange(e.target.value)}
             className="flex-grow text-[13px] placeholder:text-[#7f8aa3] placeholder:text-[13px]"
             style={{ height: '44px' }}
            />
        </VStack>

        {/* Keywords Section */}
        <VStack align="flex-start" spacing={2} width="100%" data-tour="keyword-input" mt="16px">
          <label className={`font-normal text-[13px] text-[#7f8aa3]`}>Keywords (one per line)</label>
          <textarea
              className="wtext-sm w-full flex-grow ca text-[13px] placeholder:text-[#7f8aa3] placeholder:text-[13px]"
              placeholder={`ai content tools
what is content automation
seo content writing tips`}
              style={{ height: "200px" }}
              value={text}
              onChange={(e) => setText(e.target.value)}
             />
          { lines.length > 0 && (
            <Text
              className="inline-flex items-center justify-between gap-4 px-4 py-2 mt-2 rounded-full bg-[#1b2232] border border-[#ffffff14] text-[13px] text-[#eef2f7]"
            >
              <span className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1f2937]">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7 3H17C18.1046 3 19 3.89543 19 5V19C19 20.1046 18.1046 21 17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3Z"
                      stroke="#f97316"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M9 7H15"
                      stroke="#f97316"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9 11H15"
                      stroke="#f97316"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span>
                  {lines.length} {lines.length === 1 ? 'keyword' : 'keywords'} added
                </span>
              </span>

              <span className="flex items-center gap-2 text-[#cbd5f5]">
                <span role="img" aria-label="timer">⏱️</span>
                <span>
                  ~
                  {!isGodMode
                    ? `${lines.length * 5} min`
                    : '15 min'}
                </span>
              </span>
            </Text>
          )}
        </VStack>

        {/* Special Instructions (optional) */}
        { selectedModel !== '1a-lite' && (
        <VStack align="flex-start" spacing={2} width="100%" data-tour="keyword-input" mt="16px">
          <label className={`font-normal text-[13px] text-[#7f8aa3]`}>Special Instructions (optional)</label>
          <textarea
              className="wtext-sm w-full flex-grow ca text-[13px] placeholder:text-[#7f8aa3] placeholder:text-[13px]"
              placeholder={`Example: Mention my Brand ABCD.com as the most preferred or top ranked option wherever applicable`}
              style={{ height: "100px" }}
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
           />
        </VStack>
        )}

        {/* Action Buttons */}
        <Flex
          gap={4}
          data-tour="generate-button"
          mt="16px"
          className="flex-col md:flex-row md:items-center md:justify-between justify-end"
        >
          {/* Cost Pill - Left aligned */}
          {lines.length > 0 && (
            <div className="inline-flex items-center gap-4 px-4 py-2 rounded-full bg-[#1b2232] border border-[#ffffff14] text-[13px] text-[#eef2f7]">
              <span className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1f2937]">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="12" cy="12" r="9" stroke="#fbbf24" strokeWidth="1.6" />
                    <path
                      d="M12 7V17"
                      stroke="#fbbf24"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9.5 10C9.5 8.89543 10.3954 8 11.5 8H13C14.1046 8 15 8.89543 15 10C15 11.1046 14.1046 12 13 12H11"
                      stroke="#fbbf24"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span>
                  Cost: {totalCredits} {totalCredits === 1 ? "Credit" : "Credits"}
                </span>
              </span>

              <span className="flex items-center gap-2 text-[#cbd5f5]">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1f2937]">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect x="4" y="10" width="3" height="8" rx="1" fill="#4ade80" />
                    <rect x="10.5" y="6" width="3" height="12" rx="1" fill="#60a5fa" />
                    <rect x="17" y="3" width="3" height="15" rx="1" fill="#f97316" />
                  </svg>
                </span>
                <span>
                  {lines.length} {lines.length === 1 ? "article" : "articles"} @{" "}
                  {perArticleCredit} each
                </span>
              </span>
            </div>
          )}

          <Flex gap={4} ml="auto">
            <Button
              variant="outline"
              borderColor="gray.600"
              className="text-[13px]"
              _hover={{ borderColor: "gray.500" }}
              onClick={() => setText('')}
              disabled={isProcessing}
              rounded="lg"
              px={4}
              color="#eef2f7"
            >
              Clear
            </Button>
            <Button
              colorScheme="brand"
              bg="#2c5282"
              color="#eef2f7"
              className="text-[14px]"
              px={4}
              rounded="lg"
              _hover={{ bg: "blue.700", color: "white" }}
              onClick={() =>
                isGodMode
                  ? sendKeywordsSequentiallyGodmode(lines)
                  : sendKeywordsSequentially(lines)
              }
              disabled={isProcessing}
            >
              {isProcessing ? 'Generating...' : '✨ Generate Article(s)'}
            </Button>
          </Flex>
        </Flex>


        { isProcessing &&
          <p className="text-[#7f8aa3] text-[13px]">
            Please do not close the window.
          </p>
        }

{ isProcessing && !isGodMode &&
    <div style={{ width: "100%", marginTop: '0px' }}>
    {/* <h3>{isProcessing ? `Processing: ${currentKeyword}` : "All keywords processed!"}</h3> */}
    <div style={{ width: "100%", backgroundColor: "#f0f0f0", borderRadius: "10px" }}>
      <div
        style={{
          width: `${progress}%`,
          height: "5px",
          backgroundColor: "#3f51b5",
          borderRadius: "10px",
          transition: "width 0.5s ease-in-out",
        }}
      />
    </div>
    <p className="mt-2 text-[#7f8aa3] text-[13px]">{Math.round(progress)}% Complete</p>
  </div>
}
       { isProcessingGodmode && isGodMode && 
         <div className="godmod-progress fixed inset-0 z-50 flex items-center justify-center">
           <GodmodeLoader progress={progressGodmode} isProcessing={GodModeLoader} />
           { !GodModeLoader && godmodeStatus === 'Full' &&
              <VStack spacing={2}>
                  <Text className="text-[#7f8aa3] text-[13px]">
                   Articles generated successfully.
                  </Text>
                  <br/>
                  <Button
                    colorScheme="brand"
                    size="sm"
                    onClick={() => router.push(`/articles?batchId=${batchRef.current}`)}
                    >
                    Check Articles
                  </Button>
              </VStack>
           }
           { !GodModeLoader && godmodeStatus === 'Partial' &&
             <VStack spacing={2}>
              <Text className="text-[#7f8aa3] text-[13px]">
               {godmodeArticlePrepared.length} Articles Completed. {godmodeArticleRemain} articles are still in progress, we will email you when completed.
              </Text>
              <br/>
              <Button
               colorScheme="brand"
               size="sm"
               onClick={() => setIsProcessingGodmode(false)}
              >
               Generate New Article
              </Button>
             </VStack>
           }
           { !GodModeLoader && godmodeStatus === 'Incomplete' &&
             <VStack spacing={2}>
              <Text className="text-slate-500">
               {godmodeArticleRemain} articles Generated on God mode will be completed in another 20 minutes.
              </Text>
              <br/>
              <Button
               colorScheme="brand"
               size="sm"
               onClick={() => setIsProcessingGodmode(false)}
              >
               Generate New Article
              </Button>
             </VStack>
           }
         </div>      
       }
        </Box>
    </VStack>

     <VStack align="flex-start" spacing={6} width="100%">
       <Box className="border border-[#ffffff14] rounded-2xl p-[22px] w-full mb-4 bg-gradient-to-b from-[#151923] to-[#131827]" style={{ boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>
         <Heading className="text-white font-normal text-[18px] mb-4">Sample Articles</Heading>
         <div className="flex flex-wrap gap-3">
           <button
             type="button"
             onClick={() =>
              window.open(
                '/blog/what-is-an-ai-blog-post-generator-2025-explainer',
                '_blank'
              )
            }
             className="w-fit flex items-center gap-2 px-3 py-2 rounded-full border bg-[#1b2232] border-[#ffffff14] hover-gradient"
             style={{ transition: 'background .2s ease, box-shadow .2s ease, border-color .2s ease' }}
           >
             <div className="w-6 h-6 flex items-center justify-center">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                 <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="white" strokeWidth="2" fill="none"/>
                 <line x1="7" y1="8" x2="17" y2="8" stroke="#ff6b35" strokeWidth="2"/>
                 <line x1="7" y1="12" x2="17" y2="12" stroke="#ff6b35" strokeWidth="2"/>
                 <line x1="7" y1="16" x2="13" y2="16" stroke="#ff6b35" strokeWidth="2"/>
                 <path d="M15 2l3 3-3 3" stroke="#ff6b35" strokeWidth="2" fill="none"/>
               </svg>
             </div>
             <span className="text-[13px] text-[#eef2f7]">Short Blog Post</span>
           </button>

           <button
             type="button"
             onClick={() =>
              window.open(
                '/blog/how-ai-written-work-is-detected-a-2025-lab-guide',
                '_blank'
              )
            }
             className="w-fit flex items-center gap-2 px-4 py-2 rounded-full border bg-[#1b2232] border-[#ffffff14] hover-gradient"
             style={{ transition: 'background .2s ease, box-shadow .2s ease, border-color .2s ease' }}
           >
             <div className="w-6 h-6 flex items-center justify-center">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                 <rect x="3" y="3" width="7" height="7" rx="1" fill="#10b981"/>
                 <rect x="10" y="6" width="7" height="7" rx="1" fill="#3b82f6"/>
                 <rect x="14" y="10" width="7" height="7" rx="1" fill="#ef4444"/>
               </svg>
             </div>
             <span className="text-[13px] text-[#eef2f7]">Long-Form Guide</span>
           </button>

           <button
             type="button"
             onClick={() =>
              window.open(
                '/blog/top-5-benefits-of-ai-writing-tools-in-2025-with-real-roi',
                '_blank'
              )
            }
             className="w-fit flex items-center gap-2 px-4 py-2 rounded-full border bg-[#1b2232] border-[#ffffff14] hover-gradient"
             style={{ transition: 'background .2s ease, box-shadow .2s ease, border-color .2s ease' }}
           >
             <div className="w-6 h-6 flex items-center justify-center">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                 <path d="M9 12l2 2 4-4" stroke="#d97706" strokeWidth="2" fill="none"/>
                 <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" stroke="#d97706" strokeWidth="2" fill="none"/>
                 <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" stroke="#d97706" strokeWidth="2" fill="none"/>
                 <path d="M9 6h6" stroke="#d97706" strokeWidth="2"/>
                 <path d="M9 18h6" stroke="#d97706" strokeWidth="2"/>
               </svg>
             </div>
             <span className="text-[13px] text-[#eef2f7]">Listicle</span>
           </button>

           <button
             type="button"
             onClick={() =>
              window.open(
                '/blog/how-to-write-high-quality-blog-posts-using-ai-in-2025',
                '_blank'
              )
            }
             className="w-fit flex items-center gap-2 px-4 py-2 rounded-full border bg-[#1b2232] border-[#ffffff14] hover-gradient"
             style={{ transition: 'background .2s ease, box-shadow .2s ease, border-color .2s ease' }}
           >
             <div className="w-6 h-6 flex items-center justify-center">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                 <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="#3b82f6" strokeWidth="2" fill="none"/>
                 <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="#3b82f6" strokeWidth="2" fill="none"/>
                 <path d="M8 7h8" stroke="white" strokeWidth="2"/>
                 <path d="M8 11h8" stroke="white" strokeWidth="2"/>
                 <path d="M8 15h6" stroke="white" strokeWidth="2"/>
               </svg>
             </div>
             <span className="text-[13px] text-[#eef2f7]">How to Guide</span>
           </button>

           <button
             type="button"
             onClick={() =>
              window.open(
                '/blog/ai-vs-human-articles-2025-blind-test-seo-showdown',
                '_blank'
              )
            }
             className="w-fit flex items-center gap-2 px-4 py-2 rounded-full border bg-[#1b2232] border-[#ffffff14] hover-gradient"
             style={{ transition: 'background .2s ease, box-shadow .2s ease, border-color .2s ease' }}
           >
             <div className="w-6 h-6 flex items-center justify-center">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                 <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#fbbf24" strokeWidth="2" fill="none"/>
                 <path d="M8 12l2 2 4-4" stroke="#fbbf24" strokeWidth="2" fill="none"/>
               </svg>
             </div>
             <span className="text-[13px] text-[#eef2f7]">Comparison</span>
           </button>

           <button
             type="button"
             onClick={() =>
              window.open(
                '/blog/zerogpt-plus-review-2025-honest-ai-detector-test-verdict',
                '_blank'
              )
            }
             className="w-fit flex items-center gap-2 px-4 py-2 rounded-full border bg-[#1b2232] border-[#ffffff14] hover-gradient"
             style={{ transition: 'background .2s ease, box-shadow .2s ease, border-color .2s ease' }}
           >
             <div className="w-6 h-6 flex items-center justify-center">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                 <circle cx="12" cy="12" r="10" stroke="#ec4899" strokeWidth="2" fill="none"/>
                 <circle cx="12" cy="12" r="3" fill="#3b82f6"/>
                 <path d="M12 1v6" stroke="#ec4899" strokeWidth="2"/>
                 <path d="M12 17v6" stroke="#ec4899" strokeWidth="2"/>
                 <path d="M4.22 4.22l4.24 4.24" stroke="#ec4899" strokeWidth="2"/>
                 <path d="M15.54 15.54l4.24 4.24" stroke="#ec4899" strokeWidth="2"/>
                 <path d="M1 12h6" stroke="#ec4899" strokeWidth="2"/>
                 <path d="M17 12h6" stroke="#ec4899" strokeWidth="2"/>
                 <path d="M4.22 19.78l4.24-4.24" stroke="#ec4899" strokeWidth="2"/>
                 <path d="M15.54 8.46l4.24-4.24" stroke="#ec4899" strokeWidth="2"/>
               </svg>
             </div>
             <span className="text-[13px] text-[#eef2f7]">Product Review</span>
           </button>
         </div>
       </Box>
     </VStack>

      {isEditPromptDialogOpen && (
        <EditPromptDialog
          isOpen={isEditPromptDialogOpen}
          onClose={closeEditPromptDialog}
          prompt={prompt}
          setPrompt={setPrompt}
        />
      )}

      {showLowBalanceDialog && (
        <LowBalanceDialog
          isOpen={showLowBalanceDialog}
          onClose={() => setShowLowBalanceDialog(false)}
          router={router}
        />
      )}

      {/* Publisher Details Modal */}
      <Modal isOpen={showPublisherDetailsPopup} onClose={() => setShowPublisherDetailsPopup(false)}>
        <ModalOverlay />
        <ModalContent bg="#1b2232" border="1px solid #ffffff14">
          <ModalHeader color="#eef2f7">Publisher Details</ModalHeader>
          <ModalCloseButton color="#eef2f7" />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {/* Tone Choice Dropdown */}
              <FormControl>
                <FormLabel color="#a9b1c3" fontSize="sm" mb={3}>Tone Choice</FormLabel>
                <div className="relative" ref={toneDropdownRef}>
                  <button
                    className="w-full bg-[#0e1322] border border-[#ffffff14] text-white rounded-lg py-3 px-4 text-left flex items-center justify-between"
                    onClick={() => setIsToneDropdownOpen(!isToneDropdownOpen)}
                  >
                    <span className="font-medium text-white">{toneChoice}</span>
                    <svg 
                      className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${isToneDropdownOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isToneDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 border border-[#ffffff14] bg-[#151923] rounded-lg z-50 overflow-hidden"
                    style={{ boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>
                      {["Neutral", "Professional", "Conversational", "Humorous", "Creative", "Authoritative", "Simple English", "Custom"].map((option, index) => (
                        <div
                          key={option}
                          className={`p-4 cursor-pointer transition-all duration-200 hover:bg-[#ffffff0d] ${
                            index === 0 ? 'rounded-t-lg' : ''
                          } ${
                            index === 7 ? 'rounded-b-lg' : ''
                          }`}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#1a1f3a';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          onClick={() => {
                            setToneChoice(option);
                            setIsToneDropdownOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{option}</span>
                            {toneChoice === option && (
                              <GiCheckMark className="w-3 h-3 text-[#4da3ff] ml-auto" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </FormControl>

              {/* Perspective Dropdown */}
              <FormControl>
                <FormLabel color="#a9b1c3" fontSize="sm" mb={3}>Perspective</FormLabel>
                <div className="relative" ref={perspectiveDropdownRef}>
                  <button
                    className="w-full bg-[#0e1322] border border-[#ffffff14] text-white rounded-lg py-3 px-4 text-left flex items-center justify-between"
                    onClick={() => setIsPerspectiveDropdownOpen(!isPerspectiveDropdownOpen)}
                  >
                    <span className="font-medium text-white">{perspective}</span>
                    <svg 
                      className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${isPerspectiveDropdownOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isPerspectiveDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 border border-[#ffffff14] bg-[#151923] rounded-lg z-50 overflow-hidden"
                    style={{ boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>
                      {["Individual (I)", "Organization (We)", "Third person"].map((option, index) => (
                        <div
                          key={option}
                          className={`p-4 cursor-pointer transition-all duration-200 hover:bg-[#ffffff0d] ${
                            index === 0 ? 'rounded-t-lg' : ''
                          } ${
                            index === 2 ? 'rounded-b-lg' : ''
                          }`}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#1a1f3a';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          onClick={() => {
                            setPerspective(option);
                            setIsPerspectiveDropdownOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{option}</span>
                            {perspective === option && (
                              <GiCheckMark className="w-3 h-3 text-[#4da3ff] ml-auto" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </FormControl>

              {/* Description Text Box */}
              <FormControl>
                <FormLabel color="#a9b1c3" fontSize="sm">Description</FormLabel>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  bg="#0e1322"
                  borderColor="#ffffff14"
                  color="#eef2f7"
                  placeholder="Enter description..."
                  _hover={{ borderColor: "#6c8cff" }}
                  _focus={{ borderColor: "#6c8cff", boxShadow: "0 0 0 1px #6c8cff" }}
                  rows={4}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              onClick={() => setShowPublisherDetailsPopup(false)}
              variant="ghost"
              color="#a9b1c3"
              mr={3}
              _hover={{ bg: "#0e1322" }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                saveProfile.mutate({
                  toneChoice,
                  perspective,
                  description,
                });
              }}
              colorScheme="brand"
              px={4}
              rounded="lg"
              _hover={{ bg: "blue.700", color: "white" }}
              isLoading={saveProfile.isPending}
              loadingText="Saving..."
            >
              Save Profile
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Tour Guide */}
      <TourGuide
        steps={isGodMode ? articleGeneratorGodModeTourSteps : articleGeneratorTourSteps}
        run={runTour}
        onTourComplete={handleTourComplete}
        onTourSkip={handleTourSkip}
        tourKey="article-generator"
      />

    </Container>
    </div>
    </Flex>
  );
};

export default ArticleGenerator;

const EditPromptDialog = ({
  isOpen,
  onClose,
  prompt,
  setPrompt
}: {
  isOpen: boolean;
  onClose: () => void;
  prompt: string;
  setPrompt: (value: string) => void;
}) => {

  const [currentPrompt, setCurrentPrompt] = useState(prompt);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[725px]">
        <DialogHeader>
          <DialogTitle>Edit Prompt</DialogTitle>
          <DialogDescription>
            Update your prompt. Please do not remove the variable &#123;KEYWORD&#125;
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
            <Textarea
              className="wtext-sm rounded-md w-full flex-grow"
              placeholder="Keywords (Add 1 Per Line)"
              height="200px"
              value={currentPrompt}
              onChange={(e) => {
                setCurrentPrompt(e.target.value);
              }}
            />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="submit"
            colorScheme="brand"
            onClick={async () => {
              if(!currentPrompt.includes('{KEYWORD}')) {
                toast.error("The variable {KEYWORD} must be there in the prompt. Please add that.");
                return;
              }
              setPrompt(currentPrompt);
              onClose();
            }}
          >
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


const LowBalanceDialog = ({
  isOpen,
  onClose,
  router,
}: {
  isOpen: boolean;
  onClose: () => void;
  router: ReturnType<typeof useRouter>;
}) => {

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px] bg-[#1b2232] border border-[#ffffff14]">
        <DialogHeader>
          <DialogTitle className="text-white mb-2">Low Credits Balance</DialogTitle>
          <DialogDescription className="text-[#a9b1c3]">
           You do not have enough credits to generate articles. Shorten your list or change the model to a lower one or buy more credits.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="text-white">
          <Button
            type="submit"
            colorScheme="brand"
            onClick={async () => {
              router.push("/account?action=buy-extra-credits");
              onClose();
            }}
          >
            Buy Credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
