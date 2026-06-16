import { UserPlanStatusResponse } from "@/app/api/user-plan-status/route";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useUserPlanStatus = () => {
  const { data, isLoading, ...rest } = useQuery<{ data: UserPlanStatusResponse }>({
    queryKey: ["user-plan-status"],
    queryFn: () => axios.get<UserPlanStatusResponse>("/api/user-plan-status"),
  });

  const hasPlan = Boolean(data?.data?.hasUsablePlan);

  return {
    planData: data?.data,
    hasPlan,
    isLoading,
    ...rest,
  };
};

