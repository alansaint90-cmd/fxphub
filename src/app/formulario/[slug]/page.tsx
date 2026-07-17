import { LeadCapturePublicForm } from "@/components/lead-capture-public-form";

export default async function PublicLeadFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LeadCapturePublicForm slug={slug} />;
}
