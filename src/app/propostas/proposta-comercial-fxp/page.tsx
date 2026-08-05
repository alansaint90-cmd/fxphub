import { Suspense } from "react";
import { FxpProposalPublicClient } from "@/components/fxp-proposal-public-client";

export default function ProposalCommercialFxpPage() {
  return (
    <Suspense fallback={<main className="proposal-loading">Carregando proposta...</main>}>
      <FxpProposalPublicClient />
    </Suspense>
  );
}
