"use client";

import { useEffect, useState } from "react";
import { Text, Heading } from "@chakra-ui/react";
import { Section } from "../atoms/Section/Section";
import { useQuery } from "@tanstack/react-query";

export type PricingPluginProps = {
  userId: string;
  /** Hostname from the plugin install / pricing link (e.g. example.com). */
  website?: string;
};

export const PricingPlugin = ({ userId, website }: PricingPluginProps) => {
  //console.log(userId);
  //console.log(website);
  const { data: productData, isLoading: isLoadingPrice, error: errorPrice } = useQuery({
      queryKey: ["products"],
      queryFn: async () => {
        const response = await fetch("/api/products");
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      }
    });
  console.log(productData);

  // Filter plans based on country
  const [filteredPlansSubscription, setFilteredPlansSubscription] = useState<any[]>([]);
  const [filteredPlansLifetime, setFilteredPlansLifetime] = useState<any[]>([]);
  const [countryName, setCountryName] = useState<string>('');

  useEffect(() => {
    //  console.log(productData);
      // Early return if productData is not available yet
      if (!productData) return;
      

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
  //  console.log('Country Name:', country.long_name);
   // console.log('Country Code:', country.short_name);
   setCountryName(country.long_name); 
   if(country.long_name === 'India'){
  //  console.log('Country Name:', country_name);
    setFilteredPlansSubscription(productData.subscriptionPlans.filter((plan: { currency: string; }) => plan.currency === 'INR'));
    setFilteredPlansLifetime(productData.lifetimePlans.filter((plan: { currency: string; }) => plan.currency === 'INR'));
  }else{
    setFilteredPlansSubscription(productData.subscriptionPlans.filter((plan: { currency: string; }) => plan.currency === 'USD'));
    setFilteredPlansLifetime(productData.lifetimePlans.filter((plan: { currency: string; }) => plan.currency === 'USD'));
  }
  } else {
    console.log('Country information not found');
  }
})
.catch(error => {
  console.error('Error:', error);
  // Add null check for productData before accessing its properties
  if (productData) {
    setFilteredPlansSubscription(productData.subscriptionPlans.filter((plan: { currency: string; }) => plan.currency === 'USD'));
    setFilteredPlansLifetime(productData.lifetimePlans.filter((plan: { currency: string; }) => plan.currency === 'USD'));
  }
});
  }, [productData]);

  const {
      data: planData,
      isLoading: isLoadingPlan,
      error: errorPlan,
    } = useQuery({
      queryKey: ["plans"],
      queryFn: async () => {
        const response = await fetch(`/api/article-generator/plugin/user?id=${userId}`);
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      },
  });
  
  //console.log(planData);

    const [activeTab, setActiveTab] = useState<string>("monthly")
    const [processingPlan, setProcessingPlan] = useState<string | null>(null);

    const payStripeSubscription = async (priceId: string, name: string) => {      
      setProcessingPlan(priceId);
      if(countryName === 'India'){
        try {
          const response = await fetch("/api/subscriptions/plugin/stripe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priceId, name, userId, website }), 
          });
    
          if (!response.ok) throw new Error(`Error: ${response.status}`);
          const { url } = await response.json();
          window.location.href = url;
        } catch (error:any) {
          //console.error("Fetch error:", error);
          return { error: error.message };
        }
      }else{
        try {
          const response = await fetch("/api/subscriptions/plugin/lemon-squeezy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ variantId: priceId, name, userId, website }), 
          });
    
          if (!response.ok) throw new Error(`Error: ${response.status}`);
          const { checkoutUrl } = await response.json();
          window.location.href = checkoutUrl;
        } catch (error:any) {
          //console.error("Fetch error:", error);
          return { error: error.message };
        }
      }

    }; 
  
    const payStripeLifetime = async (priceId: string, name: string) => {
      
      setProcessingPlan(priceId);
      if(countryName === 'India'){
        try {
          const response = await fetch("/api/lifetimePurchase/plugin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, priceId, name, website }), 
          });
    
          if (!response.ok) throw new Error(`Error: ${response.status}`);
          const { url } = await response.json();
          window.location.href = url;
        } catch (error:any) {
          //console.error("Fetch error:", error);
          return { error: error.message };
        }
      }else{
        try {
          const response = await fetch("/api/lifetime-purchase/lemon-squeezy/plugin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, variantId: priceId, name, website }), 
          });
    
          if (!response.ok) throw new Error(`Error: ${response.status}`);
          const { checkoutUrl, checkoutId } = await response.json();
          window.location.href = checkoutUrl;
        } catch (error:any) {
          //console.error("Fetch error:", error);
          return { error: error.message };
        }
      }
    };

  return (
    <>
      <Section flexDir="column" id="pricing">
        <Heading as="h4" fontSize="16px" color="brand.400" mb="16px">
          Pricing
        </Heading>
        <Heading
          as="h2"
          fontSize={["26px", "40px", "48px"]}
          lineHeight={["32px", "48px", "56px"]}
          mb="32px"
          fontWeight="extrabold"
          textAlign="center"
        >
          Upgrade your plan
        </Heading>

      </Section>
      {isLoadingPrice && 
      <Text my="5px" textAlign="center">
        Loading plans...
      </Text>
      }

      {!isLoadingPrice &&
            <div className="w-full max-w-5xl mx-auto px-4">
            {/* Content Area with Plans */}
            <div className="overflow-y-auto">
              {activeTab === 'monthly' ? (
                <div className="bg-gradient-to-b from-[#151923] to-[#131827] rounded-3xl border border-[#111827] shadow-2xl overflow-hidden">
      <p className="text-sm text-[#8990a5] text-center mb-8 mt-8 px-4">
        Same powerful features on every plan. Just choose how many credits you need.
      </p>
                  {/* Body */}
                  <div className="px-8 pb-8 pt-6 text-white">
                    

                    {/* Pricing Cards */}
                    <div className="grid gap-6 md:grid-cols-3 mt-2">
    { filteredPlansSubscription &&
      filteredPlansSubscription.map((plan: {id: number; name: string; productId: string; priceId: string; price: number; features: string, currency: string}) => {
        // Extract credits from features
        const featuresArray = plan.features ? JSON.parse(plan.features) : [];
        const creditsMatch = featuresArray[0]?.match(/^(\d+|Unlimited)\s/);
        const credits = creditsMatch ? creditsMatch[1] : '0';
        const approximateArticles = credits === 'Unlimited' ? 'Unlimited' : `~${credits}`;
        
        // Get plan description
        const getPlanDescription = (name: string) => {
          if (name === 'Pro') return 'For individuals & light users';
          if (name === 'Premium') return 'For creators & marketers';
          if (name === 'Ultimate') return 'For agencies & power users';
          return '';
        };

        return (
        <div 
          key={plan.id} 
          className={`rounded-2xl border ${
            plan.name === 'Premium' 
              ? 'border-[#33d6e2] shadow-[0_0_30px_rgba(51,214,226,0.25)]' 
              : 'border-[#1f2937]'
          } bg-[#0b1120] px-6 py-6 relative`}
        >
          { plan.name === 'Premium' &&
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center px-4 py-1 rounded-full bg-[#33d6e2] text-xs font-semibold text-slate-900 uppercase tracking-wide">
                Most Popular
              </span>
            </div>
          }
          
          <h3 className={`text-lg font-semibold ${plan.name === 'Premium' ? 'mt-2' : ''}`}>{plan.name}</h3>

          {/* PRICE + CREDITS CARD */}
          <div className="mt-4 rounded-xl bg-[#020617] border border-[#111827] px-4 py-3 flex items-center justify-between text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#8990a5]">Price</p>
              <p className="text-sm font-semibold text-white">
                {plan.currency === 'INR' ? '₹' : '$'}{plan.price} 
                <span className="text-[11px] text-[#8990a5]">/month</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-[#8990a5]">Credits</p>
              <p className="text-sm font-semibold text-white">{credits}</p>
            </div>
          </div>

          <p className="mt-2 text-[11px] uppercase tracking-wide text-[#33d6e2]">
            {getPlanDescription(plan.name)}
          </p>

          {/* APPROX ARTICLES */}
          <div className="mt-4 rounded-xl bg-[#020617] border border-[#111827] px-4 py-3 text-xs text-[#8990a5] relative">
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold text-[13px]">
                {approximateArticles === 'Unlimited' ? 'Unlimited Researched Articles' : `${approximateArticles} Researched Articles`}
              </p>

              {/* INFO ICON */}
              <div className="relative group cursor-pointer">
                <span className="text-[#33d6e2] text-sm font-bold">i</span>

                <div className="absolute right-0 mt-2 w-64 rounded-lg bg-[#0b1120] border border-[#111827] px-3 py-3 text-xs text-[#8990a5] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                  <p className="mb-1 text-[#33d6e2] font-semibold">How credits work:</p>
                  <p>• Short form articles ≈ 0.1 credit each</p>
                  <p>• Researched articles ≈ 1 credit each</p>
                  <p>• Deep researched articles ≈ 2 credits each</p>
                  <p className="mt-2 text-[#ffffff] font-medium">
                    You can mix any type with your credits.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => payStripeSubscription(plan.priceId, plan.name)} 
            disabled={processingPlan === plan.priceId || (planData?.SubscriptionPlan && planData.SubscriptionPlan.planId === plan.id)}
            className={`mt-6 w-full py-3 rounded-xl bg-[#33d6e2] text-[#0b1120] font-semibold text-sm hover:bg-[#4cf0ff] transition ${
              (processingPlan === plan.priceId || (planData?.SubscriptionPlan && planData.SubscriptionPlan.planId === plan.id))
                ? 'cursor-not-allowed opacity-50' 
                : 'cursor-pointer'
            }`}
          >
            { planData?.SubscriptionPlan && planData.SubscriptionPlan.planId === plan.id
              ? 'Current Plan' 
              : processingPlan === plan.priceId 
                ? 'Processing Payment...' 
                : 'Upgrade Now'
            }
          </button>
        </div>
      )})}
                    </div>

                    {/* SHARED FEATURES */}
                    <div className="mt-10 border-t border-[#111827] pt-8">
                      <h3 className="text-center text-xs font-semibold text-[#8990a5] uppercase tracking-[0.25em] mb-6">
                        All Plans Include
                      </h3>

                      <div className="max-w-3xl mx-auto">
                        <div className="grid gap-y-3 gap-x-10 sm:grid-cols-2 lg:grid-cols-3 text-sm text-[#8990a5]">
                          <div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>SERP Analysis</span>
                            </div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>Images & Infographics</span>
                            </div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>WordPress Integration</span>
                            </div>
                            <div className="flex items-start">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>Email Support</span>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>Keyword Intent Analysis</span>
                            </div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>AI SEO Optimization</span>
                            </div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>Semantic SEO</span>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>Deep Research</span>
                            </div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>Bulk Writing Mode</span>
                            </div>
                            <div className="flex items-start">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>High EEAT Score</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-6 text-center text-xs text-[#8990a5]">
                      All plans include a 7-day money-back guarantee.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-b from-[#050816] to-[#020617] rounded-3xl border border-[#111827] shadow-2xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-[#111827]">
                    <h2 className="text-2xl font-semibold text-white">Upgrade Plan</h2>
                  </div>

                  {/* Body */}
                  <div className="px-8 pb-8 pt-6 text-white">
                    <p className="text-sm text-[#8990a5] text-center mb-8 px-4">
                      Same powerful features on every plan. Just choose how many credits you need.
                    </p>

                    {/* Pricing Cards */}
                    <div className="grid gap-6 md:grid-cols-3 mt-2">
    { filteredPlansLifetime &&
      filteredPlansLifetime.map((plan: {id: number; name: string; productId: string; priceId: string; price: number; features: string, currency: string}) => {
        // Extract credits from features
        const featuresArray = plan.features ? JSON.parse(plan.features) : [];
        const creditsMatch = featuresArray[0]?.match(/^(\d+|Unlimited)\s/);
        const credits = creditsMatch ? creditsMatch[1] : '0';
        const approximateArticles = credits === 'Unlimited' ? 'Unlimited' : `~${credits}`;
        
        // Get plan description
        const getPlanDescription = (name: string) => {
          if (name === 'Pro') return 'For individuals & light users';
          if (name === 'Premium') return 'For creators & marketers';
          if (name === 'Ultimate') return 'For agencies & power users';
          return '';
        };

        return (
        <div 
          key={plan.id} 
          className={`rounded-2xl border ${
            plan.name === 'Premium' 
              ? 'border-[#33d6e2] shadow-[0_0_30px_rgba(51,214,226,0.25)]' 
              : 'border-[#1f2937]'
          } bg-[#0b1120] px-6 py-6 relative`}
        >
          { plan.name === 'Premium' &&
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center px-4 py-1 rounded-full bg-[#33d6e2] text-xs font-semibold text-slate-900 uppercase tracking-wide">
                Most Popular
              </span>
            </div>
          }
          
          <h3 className={`text-lg font-semibold ${plan.name === 'Premium' ? 'mt-2' : ''}`}>{plan.name}</h3>

          {/* PRICE + CREDITS CARD */}
          <div className="mt-4 rounded-xl bg-[#020617] border border-[#111827] px-4 py-3 flex items-center justify-between text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#8990a5]">Price</p>
              <p className="text-sm font-semibold text-white">
                {plan.currency === 'INR' ? '₹' : '$'}{plan.price}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-[#8990a5]">Credits</p>
              <p className="text-sm font-semibold text-white">{credits}</p>
            </div>
          </div>

          <p className="mt-2 text-[11px] uppercase tracking-wide text-[#33d6e2]">
            {getPlanDescription(plan.name)}
          </p>

          {/* APPROX ARTICLES */}
          <div className="mt-4 rounded-xl bg-[#020617] border border-[#111827] px-4 py-3 text-xs text-[#8990a5] relative">
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold text-[13px]">
                {approximateArticles === 'Unlimited' ? 'Unlimited Researched Articles' : `${approximateArticles} Researched Articles`}
              </p>

              {/* INFO ICON */}
              <div className="relative group cursor-pointer">
                <span className="text-[#33d6e2] text-sm font-bold">i</span>

                <div className="absolute right-0 mt-2 w-64 rounded-lg bg-[#0b1120] border border-[#111827] px-3 py-3 text-xs text-[#8990a5] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                  <p className="mb-1 text-[#33d6e2] font-semibold">How credits work:</p>
                  <p>• Short form articles ≈ 0.1 credit each</p>
                  <p>• Researched articles ≈ 1 credit each</p>
                  <p>• Deep researched articles ≈ 2 credits each</p>
                  <p className="mt-2 text-[#ffffff] font-medium">
                    You can mix any type with your credits.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => payStripeLifetime(plan.priceId, plan.name)} 
            disabled={processingPlan === plan.priceId || (planData?.LifetimePlan && planData.LifetimePlan.planId === plan.id)}
            className={`mt-6 w-full py-3 rounded-xl bg-[#33d6e2] text-[#0b1120] font-semibold text-sm hover:bg-[#4cf0ff] transition ${
              (processingPlan === plan.priceId || (planData?.LifetimePlan && planData.LifetimePlan.planId === plan.id))
                ? 'cursor-not-allowed opacity-50' 
                : 'cursor-pointer'
            }`}
          >
            { processingPlan === plan.priceId ? 'Processing Payment...' : 'Upgrade Now'}
          </button>
        </div>
      )})}
                    </div>

                    {/* SHARED FEATURES */}
                    <div className="mt-10 border-t border-[#111827] pt-8">
                      <h3 className="text-center text-xs font-semibold text-[#8990a5] uppercase tracking-[0.25em] mb-6">
                        All Plans Include
                      </h3>

                      <div className="max-w-3xl mx-auto">
                        <div className="grid gap-y-3 gap-x-10 sm:grid-cols-2 lg:grid-cols-3 text-sm text-[#8990a5]">
                          <div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>SERP Analysis</span>
                            </div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>Images & Infographics</span>
                            </div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>WordPress Integration</span>
                            </div>
                            <div className="flex items-start">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>Email Support</span>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>Keyword Intent Analysis</span>
                            </div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>AI SEO Optimization</span>
                            </div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>Semantic SEO</span>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>Deep Research</span>
                            </div>
                            <div className="flex items-start mb-2">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>Bulk Writing Mode</span>
                            </div>
                            <div className="flex items-start">
                              <span className="text-[#33d6e2] mr-2 mt-[2px]">✓</span>
                              <span>High EEAT Score</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-6 text-center text-xs text-[#8990a5]">
                      All plans include a 7-day money-back guarantee.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
      }
    </>
  );
};
