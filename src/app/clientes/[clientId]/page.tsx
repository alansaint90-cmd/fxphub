import { ClientOnboardingDetail } from "@/components/client-onboarding-detail";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <ClientOnboardingDetail clientId={clientId} />;
}
