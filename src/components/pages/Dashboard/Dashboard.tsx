"use client";

import { Metadata } from "next";

import { CalendarDateRangePicker } from "./components/date-range-picker";
import { Overview } from "./components/overview";
import { RecentSales } from "./components/recent-sales";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, Flex, Skeleton } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { DashboardData } from "@/app/api/dashboard/route";
import { TrendChart } from "./components/trend-chart";
import { GodmodeArticles } from "@prisma/client";
import { useRouter } from "next/navigation";
import { TbCrown, TbBolt, TbFileText } from "react-icons/tb";
import { TourGuide, TourTrigger, useTourStatus, createDashboardTourConfig } from "@/components/TourGuide";
import { FirstLoginPopup } from "@/components/FirstLoginPopup/FirstLoginPopup";
import { FirstLoginResponse } from "@/app/api/first-login/route";
import { useState, useEffect } from "react";
import DashboardHeader from "@/components/organisms/DashboardHeader/DashboardHeader";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Example dashboard app built using the components.",
};

/*
  For more layout examples, check out:
  https://ui.shadcn.com/examples/dashboard

  For more charts examples, check out:
  https://ui.shadcn.com/charts
*/

export const Dashboard = () => {
  const { data, isLoading } = useQuery({
    queryFn: () => {
      return axios.get<{ data: DashboardData }>("/api/dashboard");
    },
    queryKey: ["dashboard"]
  });

  const router = useRouter();
  
  // Tour guide state
  const [runTour, setRunTour] = useState(false);
  const dashboardTourConfig = createDashboardTourConfig(router);
  const { shouldShowTour, resetTour, markTourComplete } = useTourStatus(dashboardTourConfig.tourKey);

  // First login popup state
  const [showFirstLoginPopup, setShowFirstLoginPopup] = useState(false);

  // Check for first login
  const { data: firstLoginData } = useQuery({
    queryFn: () => {
      return axios.get<FirstLoginResponse>("/api/first-login");
    },
    queryKey: ["first-login"],
    enabled: !isLoading, // Only run after dashboard data is loaded
  });

  // Show first login popup
  useEffect(() => {
    if (firstLoginData?.data?.isFirstLogin && !isLoading) {
      const timer = setTimeout(() => {
        setShowFirstLoginPopup(true);
      }, 1000); // Small delay to ensure everything is rendered
      return () => clearTimeout(timer);
    }
  }, [firstLoginData?.data?.isFirstLogin, isLoading]);

  // Auto-start tour for new users
  // useEffect(() => {
  //   if (shouldShowTour && !isLoading) {
  //     const timer = setTimeout(() => {
  //       setRunTour(true);
  //     }, 1000); // Small delay to ensure everything is rendered
  //     return () => clearTimeout(timer);
  //   }
  // }, [shouldShowTour, isLoading]);

  const handleStartTour = () => {
    setRunTour(true); // Always show tour when manually triggered, regardless of completion status
  };

  const handleTourComplete = async () => {
    setRunTour(false);
    await markTourComplete(true, false); // Mark as completed, not skipped
  };

  const handleTourSkip = async () => {
    setRunTour(false);
    await markTourComplete(false, true); // Mark as skipped, not completed
  };
  const chartData = data?.data.data.charts || [];
  const revenue = data?.data.data.revenue;
  const subscriptions = data?.data.data.subscriptions;
  const orders = data?.data.data.orders;
  const activeNow = data?.data.data.activeNow;

  const {
    data: articleData,
    isLoading: articleLoading,
    error,
  } = useQuery({
    queryKey: ["todos"],
    queryFn: async () => {
      const response = await fetch(`/api/article-generator`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json() as Promise<{
        todos: (Omit<GodmodeArticles, "updatedAt"> & { updatedAt: string })[];
      }>;
    }
  });
  const { data: planResponse } = useQuery({
    queryKey: ["account-plan"],
    queryFn: () => axios.get("/api/account"),
  });
  const userPlan = planResponse?.data?.SubscriptionPlan;
  const subscriptionDetails = planResponse?.data?.SubscriptionDetails;
  const trialEndsAt = userPlan?.trialEndsAt ? new Date(userPlan.trialEndsAt) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const trialCreditsGranted = Number(userPlan?.trialCreditsGranted || 5);
  const trialCreditsUsed = Number(userPlan?.trialCreditsUsed || 0);
  const trialCreditsRemaining = Math.max(0, trialCreditsGranted - trialCreditsUsed);

  return (
    <>
      <Flex justifyContent="flex-start" w="100%" minH="100vh">
        <div className="flex-col w-full">
          <DashboardHeader />
          <div className="flex-1 space-y-4 px-[35px] pt-[15px] pb-[56px] md:pt-[96px]">
            <div className="flex sm:items-center justify-between space-y-2 flex-col sm:flex-row">
              <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
              {/* <TourTrigger onStartTour={handleStartTour}>
                🎯 Take Dashboard Tour
              </TourTrigger> */}
            </div>

            {userPlan?.status === "trialing" && (
              <Card className="border-cyan-400/30 bg-[#07111f] shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_18px_50px_rgba(0,0,0,0.28)]">
                <CardHeader>
                  <CardTitle>Trial active: {trialDaysLeft} days left</CardTitle>
                  <CardDescription className="text-slate-300">
                    Trial credits: {trialCreditsRemaining} / {trialCreditsGranted} remaining. Your {subscriptionDetails?.name || "selected"} plan starts on {trialEndsAt?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button colorScheme="brand" onClick={() => router.push("/article-generator")}>
                    Generate your first article
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/account")}>
                    Cancel trial
                  </Button>
                  <Button variant="ghost" onClick={() => router.push("/pricing")}>
                    Upgrade now
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
              <Card 
                className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 hover:border-blue-300" 
                onClick={() => router.push("/article-generator")}
                data-tour="godmode-card"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-xl">
                    Generate your first article
                  </CardTitle>
                  <TbCrown className="h-6 w-6 text-muted-foreground transition-all duration-300 hover:text-yellow-500 hover:scale-110 group-hover:text-yellow-500 group-hover:scale-110" />
                </CardHeader>
                <CardContent className="text-sm text-slate-500">
                  Start with a keyword. You can leave the page after submitting; we will email you when it is ready.
                </CardContent>
              </Card>

              {/* <Card 
                className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 hover:border-blue-300" 
                onClick={() => router.push("/article-generator")}
                data-tour="litemode-card"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-xl">Generate Lite Mode Articles</CardTitle>
                  <TbBolt className="h-6 w-6 text-muted-foreground transition-all duration-300 hover:text-blue-500 hover:scale-110 group-hover:text-blue-500 group-hover:scale-110" />
                </CardHeader>
                <CardContent className="text-sm text-slate-500">
                  These are free to generate articles good for guest posting and other purposes. 
                </CardContent>
              </Card> */}

              <Card 
                className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 hover:border-blue-300" 
                onClick={() => router.push("/batch")}
                data-tour="my-articles-card"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-xl">
                  My Articles
                  </CardTitle>
                  <TbFileText className="h-6 w-6 text-muted-foreground transition-all duration-300 hover:text-green-500 hover:scale-110 group-hover:text-green-500 group-hover:scale-110" />
                </CardHeader>
                <CardContent className="text-sm text-slate-500">
                  Find your previously generated articles here.
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Article(s) Generated
                  </CardTitle>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="h-4 w-4 text-muted-foreground"
                   >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="7" y1="9" x2="17" y2="9" />
                    <line x1="7" y1="13" x2="17" y2="13" />
                    <line x1="7" y1="17" x2="12" y2="17" />
                  </svg>
                </CardHeader>
                <CardContent>
                  <Skeleton isLoaded={!isLoading}>
                    <div className="text-2xl font-bold">
                      {revenue?.value || 0}
                    </div>
                  </Skeleton>
                  {/* <Skeleton isLoaded={!isLoading} mt="2px">
                    <p className="text-xs text-muted-foreground">
                      {revenue?.increase} from last month
                    </p>
                  </Skeleton> */}
                </CardContent>
              </Card>

              {/* <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Lite Mode Generations
                  </CardTitle>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="h-4 w-4 text-muted-foreground"
                   >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="7" y1="9" x2="17" y2="9" />
                    <line x1="7" y1="13" x2="17" y2="13" />
                    <line x1="7" y1="17" x2="12" y2="17" />
                  </svg>
                </CardHeader>
                <CardContent>
                  
                  <Skeleton isLoaded={!isLoading}>
                    <div className="text-2xl font-bold">
                      {subscriptions?.value || 0}
                    </div>
                  </Skeleton>
                 <Skeleton isLoaded={!isLoading} mt="2px">
                    <p className="text-xs text-muted-foreground">
                      {subscriptions?.increase} from last month
                    </p>
                  </Skeleton>
                </CardContent>
              </Card> */}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Member Age</CardTitle>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="h-4 w-4 text-muted-foreground"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </CardHeader>
                <CardContent>
                  <Skeleton isLoaded={!isLoading}>
                    <div className="text-sm font-bold">
                      {orders?.value || 0}
                    </div>
                  </Skeleton>
                  {/* <Skeleton isLoaded={!isLoading} mt="2px">
                    <p className="text-xs text-muted-foreground">
                      {orders?.increase} from last month
                    </p>
                  </Skeleton> */}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Batches
                  </CardTitle>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="h-4 w-4 text-muted-foreground"
                  >
                   <rect x="2" y="2" width="18" height="18" rx="2" />
                   <rect x="6" y="6" width="18" height="18" rx="2" />
                  </svg>
                </CardHeader>
                <CardContent>
                  <Skeleton isLoaded={!isLoading}>
                    <div className="text-2xl font-bold">
                      {activeNow?.value || 0}
                    </div>
                  </Skeleton>
                  {/* <Skeleton isLoaded={!isLoading} mt="2px">
                    <p className="text-xs text-muted-foreground">
                      {activeNow?.increase} since last hour
                    </p>
                  </Skeleton> */}
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4" data-tour="generations-chart">
                <CardHeader>
                  <CardTitle>Generations</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <Skeleton isLoaded={!isLoading} borderRadius="8px">
                    <Overview data={chartData} />
                  </Skeleton>
                </CardContent>
              </Card>
              <Card className="col-span-3" data-tour="recent-articles">
                <CardHeader>
                  <CardTitle>Recent Articles</CardTitle>
                  <CardDescription>
                    {articleData && `You made total ${articleData.todos.length} keywords.`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Skeleton isLoaded={!isLoading} borderRadius="8px">
                  <div className="space-y-8">
                  {articleData && articleData.todos.slice(0, 7).map((article: { id: string; keyword: string; content: string | null }, index: number) => (
                   <div className="flex items-center" key={index}>
                    <div className="ml-4 space-y-1">
                     <p className="text-sm font-medium leading-none">
                      <a href={`/articles/${article.id}`}>{article.keyword}</a>
                     </p>
                    </div>
                   </div>
                  ))}
                  </div>
                  </Skeleton>
                </CardContent>
              </Card>
            </div>

            {/* <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-7">
                <CardHeader>
                  <CardTitle>Sales</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <Skeleton isLoaded={!isLoading} borderRadius="8px">
                    <TrendChart data={trendData} />
                  </Skeleton>
                </CardContent>
              </Card>
            </div> */}
          </div>
        </div>
      </Flex>
      
      {/* First Login Popup */}
      <FirstLoginPopup
        isOpen={showFirstLoginPopup}
        onClose={() => setShowFirstLoginPopup(false)}
      />

      {/* Tour Guide */}
      <TourGuide
        steps={dashboardTourConfig.steps}
        run={runTour}
        onTourComplete={handleTourComplete}
        onTourSkip={handleTourSkip}
        tourKey={dashboardTourConfig.tourKey}
      />
    </>
  );
};
