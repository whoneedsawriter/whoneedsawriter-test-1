"use client";

import TeamSwitcher from "./components/team-switcher";
import { UserNav } from "./components/user-nav";
import { User } from "@prisma/client";
import {useContext} from "react";
import { UserContext, UserContextType } from "@/app/customProviders/UserProvider";
import { PricingPopupContext } from "@/app/PricingPopupProvider";
import { useMobile } from "@/hooks/useMobile";
import { IconButton, useColorModeValue } from "@chakra-ui/react";
import { TbMenu2 } from "react-icons/tb";
import { useSidebarDrawer } from "@/app/SidebarDrawerProvider";

const DashboardHeader = () => {
  const isMobile = useMobile();
  const { user, isLoading, error } = useContext(UserContext) as UserContextType;

  // Calculate credits using the same logic as Account.tsx
  const monthlyPlan = user?.monthyPlan ?? 0;
  const lifetimePlan = user?.lifetimePlan ?? 0;

  const baseFreeCredits = 4; // fixed total free credits
  const currentFreeCredits = user?.freeCredits ?? baseFreeCredits; // remaining free credits

  const monthlyBalance = user?.monthyBalance ?? 0;
  const lifetimeBalance = user?.lifetimeBalance ?? 0;

  let headerTotalCredits = 0;
  let headerRemainingCredits = 0;

  // 1. No paid plans → only free credits
  if (monthlyPlan === 0 && lifetimePlan === 0) {
    headerTotalCredits = baseFreeCredits;          // always show full free quota (e.g. 4)
    headerRemainingCredits = currentFreeCredits;   // remaining free credits (e.g. 3)
  } else {
    // 2. Has paid plans → ignore free credits
    if (monthlyPlan > 0 && lifetimePlan > 0) {
      // Both monthly and lifetime plans exist
      if (monthlyBalance > 0 && lifetimeBalance > 0) {
        // Both have remaining balance → use combined quota
        headerTotalCredits = monthlyPlan + lifetimePlan;
        headerRemainingCredits = monthlyBalance + lifetimeBalance;
      } else if (monthlyBalance > 0) {
        // Only monthly has remaining balance
        headerTotalCredits = monthlyPlan;
        headerRemainingCredits = monthlyBalance;
      } else if (lifetimeBalance > 0) {
        // Only lifetime has remaining balance
        headerTotalCredits = lifetimePlan;
        headerRemainingCredits = lifetimeBalance;
      } else {
        // Both consumed → show monthly quota only (e.g. 0/20)
        headerTotalCredits = monthlyPlan;
        headerRemainingCredits = 0;
      }
    } else if (monthlyPlan > 0) {
      // Only monthly plan
      headerTotalCredits = monthlyPlan;
      headerRemainingCredits = monthlyBalance;
    } else {
      // Only lifetime plan
      if (lifetimeBalance > 0) {
        // Some lifetime remaining → show lifetime plan normally
        headerTotalCredits = lifetimePlan;
        headerRemainingCredits = lifetimeBalance;
      } else {
        // Lifetime balance is 0 → fall back to free credits
        headerTotalCredits = baseFreeCredits;
        headerRemainingCredits = currentFreeCredits;
      }
    }
  }

  const { onOpen: onPricingPopupOpen } = useContext(PricingPopupContext);
  const buttonColor = useColorModeValue("whiteAlpha.600", "whiteAlpha.600");
  
  // Get drawer state from context (will be undefined if not in provider, which is fine)
  const drawerState = useSidebarDrawer();

  const topPosition = '0';

    return (
      <div className="border-b" style={{
          backgroundColor: '#080a0f80', 
          height: '68px', 
          position: 'fixed', 
          top: topPosition, 
          left: 0, 
          right: 0, 
          backdropFilter: 'blur(8px)'
        }}>
        <div className="flex h-[100%] items-center px-4">
          {isMobile && drawerState && (
            <IconButton
              icon={<TbMenu2 size="20px" color="#eef2f7" />}
              aria-label="Open menu"
              variant="ghost"
              color="transparent"
              border="1px solid #ffffff14"
              borderRadius="8px"
              bg="linear-gradient(135deg, #121722, var(--panel-2, #151923))"
              size="sm"
              onClick={drawerState.onOpen}
              mr={3}
              style={{ minWidth: '36px', width: '36px', height: '36px' }}
            />
          )}
          {/* <TeamSwitcher /> */}
          <div className="ml-auto flex items-center space-x-4">
            {/* Credits Section */}
            <div className={`credits-header flex items-center bg-[#151923] rounded-full px-4 py-2 ${isMobile ? 'mr-2' : 'mr-4'} border border-[#ffffff14]`}>
              <span className="text-[#a9b1c3] text-sm mr-2">Credits:</span>
              <span className="text-white font-medium text-sm mr-2">
                {isLoading ? "..." : headerRemainingCredits}
              </span>
             
                <button 
                 onClick={() => onPricingPopupOpen()}
                 className="buy-more-btn ml-3 bg-[transparent] text-[#eef2f7] hover:bg-[#13161b] border border-[#ffffff14] text-xs font-medium px-3 py-2 rounded-full transition-colors" style={{boxShadow: '0 10px 30px rgba(0,0,0,.35)'}}>
                  Buy More
                </button>
           
            </div>
            <div data-tour="user-nav">
              <UserNav />
            </div>
          </div>
        </div>
      </div>
    )
}

export default DashboardHeader;