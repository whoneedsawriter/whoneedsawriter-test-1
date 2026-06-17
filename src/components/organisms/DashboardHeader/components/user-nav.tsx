import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "next-auth/react";
import { CreateWorkspaceModal } from "@/components/organisms/CreateWorkspaceModal/CreateWorkspaceModal";
import { useState } from "react";
import { onLoadCustomerPortal } from "@/components/AccountMenu/AccountMenu";
import { useRouter } from "next/navigation";
import { TbUser, TbReceipt, TbLogout } from "react-icons/tb";
import { useUserPlanStatus } from "@/hooks/useUserPlanStatus";

export function UserNav() {
  const { data: session } = useSession();
  const router = useRouter();
  const userName = session?.user.name;
  const userEmail = session?.user.email;
  const userPictureUrl = session?.user.image;

  const [showNewWorkspaceDialog, setShowNewWorkspaceDialog] = useState(false);

  const { badgeLabel } = useUserPlanStatus();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
            <Avatar className="h-8 w-8 border-2 border-[#60a5fa]">
              <AvatarImage src={userPictureUrl} alt={userName} />
              <AvatarFallback className="bg-[#151923] text-[#eef2f7] border-1 border-[#60a5fa] flex items-center justify-center">
                <TbUser className="h-4 w-4 text-[#60a5fa]"/>
              </AvatarFallback>
            </Avatar>
            {badgeLabel && (
              <span className="absolute -top-2 -right-1 bg-gradient-to-r from-[#4da3ff] to-[#8b5cf6] text-white text-[9px] font-semibold px-1.5 py-1 rounded leading-none">
                {badgeLabel}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="w-48 bg-[#1a1d29] border border-[#ffffff14] rounded-lg p-1" 
          align="end" 
          forceMount 
          style={{zIndex: 1000}}
        >
          <DropdownMenuGroup>
            <DropdownMenuItem 
              onClick={() => router.push("/account")}
              className="flex items-center gap-2 text-[#eef2f7] hover:bg-[#252833] cursor-pointer rounded-md px-2 py-2"
            >
              <TbUser className="h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onLoadCustomerPortal()}
              className="flex items-center gap-2 text-[#eef2f7] hover:bg-[#252833] cursor-pointer rounded-md px-2 py-2"
            >
              <TbReceipt className="h-4 w-4" />
              <span>Billing</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => signOut({callbackUrl: "/",})}
              className="flex items-center gap-2 text-[#f87171] hover:bg-[#252833] cursor-pointer rounded-md px-2 py-2"
            >
              <TbLogout className="h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateWorkspaceModal
        isOpen={showNewWorkspaceDialog}
        onClose={() => setShowNewWorkspaceDialog(false)}
      />
    </>
  );
}
