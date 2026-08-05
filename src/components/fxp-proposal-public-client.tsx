"use client";

import { useSearchParams } from "next/navigation";
import { FxpProposalPublicPage } from "@/components/fxp-proposal-workspace";
import { decodeProposalData } from "@/lib/proposals/fxp-proposal";

export function FxpProposalPublicClient() {
  const searchParams = useSearchParams();
  const data = decodeProposalData(searchParams.get("data"));
  return <FxpProposalPublicPage initialData={data} publicMode />;
}
