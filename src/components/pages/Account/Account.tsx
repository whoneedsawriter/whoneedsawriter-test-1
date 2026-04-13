"use client";

import { Metadata } from "next";
import TeamSwitcher from "./components/team-switcher";
import { UserNav } from "./components/user-nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, Flex, Skeleton } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { DashboardData } from "@/app/api/dashboard/route";
import { User } from "@prisma/client";
import { paymentProvider } from "@/config";
import toast from "react-hot-toast";
import { TbFileText, TbBolt, TbCrown, TbCreditCard } from "react-icons/tb";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import DashboardHeader from "@/components/organisms/DashboardHeader/DashboardHeader";
import { useSearchParams } from "next/navigation";

/*
  For more layout examples, check out:
  https://ui.shadcn.com/examples/dashboard

  For more charts examples, check out:
  https://ui.shadcn.com/charts
*/

export const Account = () => {
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
   
    const searchParams = useSearchParams();
    const showBuyExtraCredits = searchParams.get("action");

    useEffect(() => {
     if (showBuyExtraCredits === "buy-extra-credits") {
         setIsModalOpen(true);
     }
    }, [showBuyExtraCredits]);
    
    const {
        data: userData,
        isLoading,
        error,
      } = useQuery({
        queryKey: ["user"],
        queryFn: async () => {
          const response = await fetch('/api/user');
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json() as Promise<{
            user: User;
          }>;
        },
        enabled: true,
    });
    const user = userData?.user ?? null;
   // console.log(user);

    const {
        data: planData,
        isLoading: planLoading,
        error: planError,
      } = useQuery({
        queryKey: ["plans"],
        queryFn: async () => {
          const response = await fetch('/api/account');
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        },
        enabled: true,
    });

    // Fetch lifetime plans from products API
    const {
        data: productData,
        isLoading: productLoading,
        error: productError,
      } = useQuery({
        queryKey: ["products"],
        queryFn: async () => {
          const response = await fetch('/api/products');
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        },
        enabled: true,
    });

    // State for filtered plans and country
    const [filteredPlansLifetime, setFilteredPlansLifetime] = useState<any[]>([]);
    const [countryName, setCountryName] = useState<string>('');
    const [processingPlan, setProcessingPlan] = useState<string | null>(null);
    
    // State for account management
    const [newEmail, setNewEmail] = useState<string>('');
    const [deleteConfirmation, setDeleteConfirmation] = useState<string>('');
    const [isUpdatingEmail, setIsUpdatingEmail] = useState<boolean>(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);

    // Filter plans based on country (same logic as ArticleGenerator)
    useEffect(() => {
      if (!productData) return;
      
      console.log('ProductData:', productData);
      console.log('LifetimePlans:', productData.lifetimePlans);
      
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      const geoUrl = `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`;

      const requestData = {
        homeMobileCountryCode: 310,
        homeMobileNetworkCode: 410,
        radioType: 'gsm',
        carrier: 'Vodafone',
        considerIp: true
      };

      fetch(geoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })
      .then(response => response.json())
      .then(data => {
        const { lat, lng } = data.location;
        
        const geocodeApiKey = apiKey;
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${geocodeApiKey}`;
        
        return fetch(geocodeUrl);
      })
      .then(response => response.json())
      .then(data => {
        const addressComponents = data.results[0].address_components;
        const country = addressComponents.find((component: { types: string[]; }) => component.types.includes('country'));
        if (country) {
          console.log('Country detected:', country.long_name);
          setCountryName(country.long_name); 
          if(country.long_name === 'India'){
            const filtered = productData.lifetimePlans.filter((plan: { currency: string; }) => plan.currency === 'INR');
            console.log('Filtered plans (INR):', filtered);
            setFilteredPlansLifetime(filtered);
          }else{
            const filtered = productData.lifetimePlans.filter((plan: { currency: string; }) => plan.currency === 'USD');
            console.log('Filtered plans (USD):', filtered);
            setFilteredPlansLifetime(filtered);
          }
        } else {
          console.log('Country information not found');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        if (productData) {
          const filtered = productData.lifetimePlans.filter((plan: { currency: string; }) => plan.currency === 'USD');
          console.log('Fallback filtered plans (USD):', filtered);
          setFilteredPlansLifetime(filtered);
        }
      });
    }, [productData]);
    
   // console.log(planData);

    const getStripeCustomerPortalUrl = async () => {
        const response = await axios.get("/api/stripe/customer-portal");
        return response?.data?.url;
      };
      
     const onLoadCustomerPortal = async () => {
        try {
      
          if (paymentProvider === "stripe") {
            const url = await getStripeCustomerPortalUrl();
            if (url) {
              window.open(url, "_blank");
              return;
            }
          }
      
          toast.error("You don't have an active subscription");
        } catch (error) {
          toast.error("You don't have an active subscription");
        }
      };

    // Payment handler for lifetime plans (same as ArticleGenerator)
    const payStripeLifetime = async (priceId: string, name: string) => {
      setProcessingPlan(priceId);
      if(countryName === 'India'){
        try {
          const response = await fetch("/api/lifetimePurchase", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priceId, name }), 
          });
    
          if (!response.ok) throw new Error(`Error: ${response.status}`);
          const { url } = await response.json();
          window.location.href = url;
        } catch (error:any) {
          toast.error("Payment failed. Please try again.");
          setProcessingPlan(null);
        }
      }else{
        try {
          const response = await fetch("/api/lifetime-purchase/lemon-squeezy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ variantId: priceId, name }), 
          });
    
          if (!response.ok) throw new Error(`Error: ${response.status}`);
          const { checkoutUrl, checkoutId } = await response.json();
          window.location.href = checkoutUrl;
        } catch (error:any) {
          toast.error("Payment failed. Please try again.");
          setProcessingPlan(null);
        }
      }
    };

    // Handler for updating email
    const handleUpdateEmail = async () => {
      if (!newEmail || !newEmail.includes('@')) {
        toast.error('Please enter a valid email address');
        return;
      }

      setIsUpdatingEmail(true);
      try {
        const response = await fetch('/api/user/update-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newEmail }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to update email');
        }

        toast.success('Email updated successfully! Please check your new email for verification.');
        setNewEmail('');
        // Refresh user data
        window.location.reload();
      } catch (error: any) {
        toast.error(error.message || 'Failed to update email');
      } finally {
        setIsUpdatingEmail(false);
      }
    };

    // Handler for deleting account
    const handleDeleteAccount = async () => {
      if (deleteConfirmation !== 'DELETE') {
        toast.error('Please type "DELETE" to confirm');
        return;
      }

      setIsDeletingAccount(true);
      try {
        const response = await fetch('/api/user/delete-account', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to delete account');
        }

        toast.success('Account deleted successfully. You will be redirected to the home page.');
        // Redirect to home page after successful deletion
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } catch (error: any) {
        toast.error(error.message || 'Failed to delete account');
      } finally {
        setIsDeletingAccount(false);
      }
    };

  return (
    <>
      <Flex justifyContent="flex-start" w="100%" minH="100vh">
        <div className="flex-col w-full">
          <DashboardHeader />
          <div className="flex-1 space-y-4 px-[35px] pt-[15px] pb-[56px] md:pt-[96px]">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium mb-2">Balance</CardTitle>
                  <TbCrown className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <Skeleton isLoaded={!isLoading}>
                    {(() => {
                      // Calculate total credits and used credits
                      const monthlyPlan = user?.monthyPlan ?? 0;
                      const lifetimePlan = user?.lifetimePlan ?? 0;
                      const freeCredits = 4; // Default free credits
                      const totalCredits = monthlyPlan + lifetimePlan + freeCredits;
                      
                      const monthlyBalance = user?.monthyBalance ?? 0;
                      const lifetimeBalance = user?.lifetimeBalance ?? 0;
                      const currentFreeCredits = user?.freeCredits ?? 4;
                      const remainingCredits = monthlyBalance + lifetimeBalance + currentFreeCredits;
                      
                      const usedCredits = totalCredits - remainingCredits;
                      const usagePercentage = totalCredits > 0 ? Math.round((usedCredits / totalCredits) * 100) : 0;
                      
                      return (
                        <div className="space-y-1">
                          {/* Credits display */}
                          <div className="text-left">
                              <div className="text-lg font-bold">
                              {usedCredits.toFixed(1)}/{totalCredits} credits used ({usagePercentage}%)
                            </div>
                          </div>
                          
                          {/* Range slider */}
                          <div className="space-y-2">
                            <input
                              type="range"
                              min="0"
                              max={totalCredits}
                              value={usedCredits}
                              className="w-full h-1 rounded-lg appearance-none cursor-default slider py-[3px]"
                              style={{
                                background: `linear-gradient(to right, #33d6e2 0%, #8b5cf6 ${usagePercentage}%, #e5e7eb ${usagePercentage}%, #e5e7eb 100%)`
                              }}
                              readOnly
                              disabled
                            />
                          </div>
                          
                          {/* Renewal date for monthly plans */}
                          {planData?.SubscriptionPlan && planData?.SubscriptionDetails && (
                            <div className="text-sm text-muted-foreground text-left">
                              Usage resets on {planData.SubscriptionPlan.validUntil ? 
                                new Date(planData.SubscriptionPlan.validUntil).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                }) : 
                                'N/A'
                              }
                            </div>
                          )}
                          
                          {/* Buy extra button */}
                          <div className="text-left" style={{ marginTop: '16px' }}>
                            <button 
                              className="bg-blue-200 text-blue-800 border border-blue-300 rounded-lg py-2 px-4 font-semibold cursor-pointer hover:bg-blue-300 hover:text-blue-900 hover:border-blue-400 transition-all duration-200 flex items-center gap-2"
                              onClick={() => setIsModalOpen(true)}
                            >
                              <TbCreditCard className="w-4 h-4" />
                              Buy Extra
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </Skeleton>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium">Current Plan {planData?.SubscriptionPlan ? '- ' + planData.SubscriptionDetails.name : ''}</CardTitle>  
                  { planLoading && <Skeleton height="30" width="100%" mt="30px"/>}
                  { !planLoading &&
                  <div>
                    { planData?.SubscriptionPlan ? (
                      <>
                        {/* Plan Details and Buttons */}
                        <div className="mt-4 flex justify-between items-start gap-6">
                          {/* Plan Details - Left Side */}
                          <div className="flex-1 p-4 rounded-lg border border-[#17243d]">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-slate-500 font-medium">Price:</span>
                                <span className="ml-2 font-semibold text-slate-500">
                                  {planData.SubscriptionDetails.price}{planData.SubscriptionDetails.currency === 'INR' ? '₹' : '$'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 font-medium">Credits/mo:</span>
                                <span className="ml-2 font-semibold text-slate-500">
                                  {user?.monthyPlan || 0}
                                </span>
                              </div>
                                <div>
                                  <span className="text-slate-500 font-medium">Used credits:</span>
                                  <span className="ml-2 font-semibold text-blue-500">
                                    {(() => {
                                      const monthlyPlan = user?.monthyPlan ?? 0;
                                      const lifetimePlan = user?.lifetimePlan ?? 0;
                                      const freeCredits = 4;
                                      const totalCredits = monthlyPlan + lifetimePlan + freeCredits;
                                      
                                      const monthlyBalance = user?.monthyBalance ?? 0;
                                      const lifetimeBalance = user?.lifetimeBalance ?? 0;
                                      const currentFreeCredits = user?.freeCredits ?? 4;
                                      const remainingCredits = monthlyBalance + lifetimeBalance + currentFreeCredits;
                                      
                                      return totalCredits - remainingCredits;
                                    })()}
                                  </span>
                                </div>
                              <div>
                                <span className="text-slate-500 font-medium">Billing interval:</span>
                                <span className="ml-2 font-semibold text-slate-500">Monthly</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-500 font-medium">Next bill on:</span>
                                <span className="ml-2 font-semibold text-slate-500">
                                  {planData.SubscriptionPlan.validUntil ? 
                                    new Date(planData.SubscriptionPlan.validUntil).toLocaleDateString('en-US', { 
                                      month: 'long', 
                                      day: 'numeric', 
                                      year: 'numeric' 
                                    }) : 
                                    'N/A'
                                  }
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Buttons - Right Side */}
                          <div className="flex flex-col gap-3">
                            <button 
                              className="bg-[#33d6e2] text-[#141824] border-none rounded-lg py-2 px-4 font-semibold cursor-pointer hover:bg-[#2bc4d0] transition-colors" 
                              onClick={() => router.push("/pricing")}
                            >
                              Upgrade
                            </button>
                            <button 
                              className="bg-red-500 text-white border-none rounded-lg py-2 px-4 font-semibold cursor-pointer hover:bg-red-600 transition-colors" 
                              onClick={() => onLoadCustomerPortal()}
                            >
                              Cancel plan
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-500 mt-[20px]">You do not have any subscription right now</div>
                    )}
                  </div>
                  }
                </CardHeader>
              </Card>
            </div>

            {/* Account Management Section */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium">Change Email</CardTitle>
                  <CardDescription>
                    Update your account email address
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-500">Current Email</label>
                      <div className="mt-1 p-3 rounded-lg border">
                        <span className="text-slate-500">{user?.email || 'No email set'}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-500">New Email</label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#33d6e2] focus:border-transparent"
                        placeholder="Enter new email address"
                        disabled={isUpdatingEmail}
                      />
                    </div>
                    <button 
                      onClick={handleUpdateEmail}
                      disabled={isUpdatingEmail || !newEmail}
                      className="w-full bg-[#33d6e2] text-[#141824] py-2 px-4 rounded-lg font-semibold hover:bg-[#2bc4d0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUpdatingEmail ? 'Updating...' : 'Update Email'}
                    </button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium">Delete Account</CardTitle>
                  <CardDescription>
                    Permanently delete your account and all data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">
                            Warning
                          </h3>
                          <div className="mt-2 text-sm text-red-700">
                            <p>This action cannot be undone. All your data, including articles, credits, and account information will be permanently deleted.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Type &quot;DELETE&quot; to confirm</label>
                      <input
                        type="text"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        placeholder="Type DELETE to confirm"
                        disabled={isDeletingAccount}
                      />
                    </div>
                    <button 
                      onClick={handleDeleteAccount}
                      disabled={isDeletingAccount || deleteConfirmation !== 'DELETE'}
                      className="w-full bg-red-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeletingAccount ? 'Deleting Account...' : 'Delete Account'}
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>

            
           

          </div>
        </div>
      </Flex>

      {/* Buy Extra Credits Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Buy Extra Credits</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-8">
            {/* Lifetime Plans */}
            <div>
              {productLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading Extra Credits plans...</p>
                </div>
              ) : productError ? (
                <div className="text-center py-8">
                  <p className="text-red-600">Error loading Extra Credits plans</p>
                </div>
              ) : filteredPlansLifetime?.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">No Extra Credits plans available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {filteredPlansLifetime?.map((plan: any) => (
                    <Card key={plan.id} className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-purple-300">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center mb-2">
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          <span className="text-2xl font-bold text-blue-600">
                            {plan.currency === 'INR' ? '₹' : '$'}{plan.price}
                          </span>
                        </div>
                        <CardDescription>
                          {plan.features ? (
                            <ul className="list-none p-0 my-2">
                              {JSON.parse(plan.features).slice(0, 1).map((feature: string, index: number) => {
                                const match = feature.match(/^(\d+|Unlimited)\s(.+)$/); // Extracts number and text part
                                return (
                                  <li key={index} className="py-1 flex items-start text-[#8990a5] text-sm leading-tight">
                                    <span className="text-[#33d6e2] mr-2 font-bold flex-shrink-0">✓</span>
                                    {match ? (
                                      <span>
                                        <span className="text-[#33d6e2] font-medium">{match[1]}</span> {match[2]}
                                      </span>
                                    ) : (
                                      <span>{feature}</span> // If no number detected, show feature as is
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : ''}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <button 
                            className="w-full bg-[#33d6e2] text-[#141824] py-2 px-4 rounded-lg hover:bg-[#2bc4d0] transition-colors disabled:opacity-50"
                            onClick={() => payStripeLifetime(plan.priceId, plan.name)}
                            disabled={processingPlan === plan.priceId}
                          >
                            {processingPlan === plan.priceId ? 'Processing Payment...' : 'Purchase Now'}
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
