"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const steps = ["Dados basicos", "Estrutura", "Comercial", "Reuniao", "Confirmacao"];

interface SubmitResult {
  ok?: boolean;
  leadId?: string;
  qualificationStatus?: "qualified" | "unqualified";
  score?: number;
  reason?: string;
  whatsappUrl?: string | null;
  settings?: { instagramUrl?: string | null; metaPixelId?: string | null };
  error?: string;
}

export function LeadCapturePublicForm({ slug }: { slug: string }) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [tracking, setTracking] = useState<Record<string, string>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextTracking: Record<string, string> = { landing_page_url: window.location.href };
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "campaign_id", "adset_id", "ad_id", "fbclid", "fbc", "fbp"].forEach((key) => {
      const value = params.get(key);
      if (value) nextTracking[key] = value;
    });
    setTracking(nextTracking);
    void fetch(`/api/lead-capture/forms/${slug}`, { cache: "no-store" });
  }, [slug]);

  const progress = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Enviando diagnostico...");
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      businessName: String(formData.get("businessName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      city: String(formData.get("city") ?? ""),
      state: String(formData.get("state") ?? ""),
      monthlyEnrollments: Number(formData.get("monthlyEnrollments") ?? 0),
      salesAttendants: Number(formData.get("salesAttendants") ?? 0),
      usesCrm: String(formData.get("usesCrm") ?? ""),
      runsPaidAds: String(formData.get("runsPaidAds") ?? ""),
      monthlyAdSpend: Number(formData.get("monthlyAdSpend") ?? 0),
      mainChallenge: String(formData.get("mainChallenge") ?? ""),
      responseTime: String(formData.get("responseTime") ?? ""),
      wantsWhatsappAutomation: String(formData.get("wantsWhatsappAutomation") ?? ""),
      meetingInterest: String(formData.get("meetingInterest") ?? ""),
      preferredMeetingPeriod: String(formData.get("preferredMeetingPeriod") ?? ""),
      contactAuthorized: formData.get("contactAuthorized") === "on",
      privacyPolicyAccepted: formData.get("privacyPolicyAccepted") === "on",
      tracking,
    };

    try {
      const response = await fetch(`/api/lead-capture/forms/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as SubmitResult;
      setResult(json);
      setStatus(json.ok ? "" : json.error ?? "Nao foi possivel enviar.");
    } catch {
      setStatus("Erro ao enviar formulario.");
    }
  }

  async function handleWhatsappClick() {
    if (!result?.leadId || !result.whatsappUrl) return;
    await fetch(`/api/lead-capture/leads/${result.leadId}/click`, { method: "POST" });
    window.location.href = result.whatsappUrl;
  }

  if (result?.ok) {
    const qualified = result.qualificationStatus === "qualified";
    return (
      <main className="public-form-shell">
        <section className="public-form-card result">
          <span className="public-form-logo">fxphub</span>
          <h1>{qualified ? "Sua autoescola foi selecionada para a proxima etapa!" : "Obrigado pelo seu interesse na FXP Assessoria"}</h1>
          <p>
            {qualified
              ? "Obrigado pelas informacoes. Identificamos que sua autoescola possui perfil para conhecer as solucoes da FXP Assessoria."
              : "Analisamos as informacoes enviadas e, neste momento, nossos servicos principais podem nao ser os mais adequados para o estagio atual da sua empresa. Seus dados foram registrados para futuras ofertas e conteudos."}
          </p>
          {qualified && result.whatsappUrl ? (
            <button type="button" onClick={handleWhatsappClick}>Falar com o Fausto no WhatsApp</button>
          ) : (
            <a className="public-secondary-link" href={result.settings?.instagramUrl || "https://instagram.com"}>Conhecer conteudos da FXP</a>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="public-form-shell">
      <form className="public-form-card" onSubmit={handleSubmit}>
        <span className="public-form-logo">FXP Assessoria</span>
        <h1>Diagnostico comercial para autoescolas</h1>
        <p>Responda algumas perguntas rapidas para avaliarmos o melhor proximo passo para sua autoescola.</p>
        <div className="public-progress"><i style={{ width: `${progress}%` }} /></div>
        <strong>{steps[step]}</strong>

        <div className={step === 0 ? "public-step" : "page-hidden"}>
          <Field name="name" label="Nome completo do responsavel" required />
          <Field name="businessName" label="Nome da autoescola" required />
          <Field name="phone" label="WhatsApp" required />
          <Field name="email" label="E-mail" type="email" />
          <Field name="city" label="Cidade" required />
          <Field name="state" label="Estado" required />
        </div>

        <div className={step === 1 ? "public-step" : "page-hidden"}>
          <Field name="monthlyEnrollments" label="Matriculas medias por mes" type="number" required />
          <Field name="salesAttendants" label="Pessoas atendendo leads no WhatsApp" type="number" required />
          <Select name="usesCrm" label="A autoescola ja utiliza CRM?" options={["Nao utiliza CRM", "Utiliza planilha", "Ja utiliza CRM"]} />
          <Select name="runsPaidAds" label="Ja investe em trafego pago?" options={["Ja investe em anuncios", "Ja investiu anteriormente", "Nunca investiu"]} />
          <Field name="monthlyAdSpend" label="Investimento medio mensal em anuncios" type="number" />
        </div>

        <div className={step === 2 ? "public-step" : "page-hidden"}>
          <Textarea name="mainChallenge" label="Maior dificuldade comercial atualmente" required />
          <Select name="responseTime" label="Em quanto tempo responde os leads?" options={["Ate 5 minutos", "Ate 30 minutos", "Algumas horas", "No dia seguinte"]} />
          <Select name="wantsWhatsappAutomation" label="Gostaria de automatizar o atendimento no WhatsApp?" options={["Sim", "Talvez", "Nao"]} />
        </div>

        <div className={step === 3 ? "public-step" : "page-hidden"}>
          <Select
            name="meetingInterest"
            label="Voce tem interesse real em participar de uma reuniao online?"
            options={[
              "Sim, quero participar de uma reuniao",
              "Tenho interesse, mas ainda nao sei quando",
              "Quero apenas conhecer melhor",
              "Nao tenho interesse em reuniao neste momento",
            ]}
          />
          <Select name="preferredMeetingPeriod" label="Melhor periodo para reuniao" options={["Manha", "Tarde", "Noite", "A combinar"]} />
        </div>

        <div className={step === 4 ? "public-step" : "page-hidden"}>
          <label className="public-check"><input name="contactAuthorized" type="checkbox" required /> Autorizo contato da FXP pelo WhatsApp.</label>
          <label className="public-check"><input name="privacyPolicyAccepted" type="checkbox" required /> Aceito a politica de privacidade e tratamento de dados.</label>
          {status ? <p className="form-error">{status}</p> : null}
        </div>

        <div className="public-form-actions">
          <button className="secondary" disabled={step === 0} type="button" onClick={() => setStep((current) => Math.max(0, current - 1))}>Voltar</button>
          {step < steps.length - 1 ? (
            <button type="button" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}>Continuar</button>
          ) : (
            <button type="submit">Enviar diagnostico</button>
          )}
        </div>
      </form>
    </main>
  );
}

function Field({ name, label, type = "text", required = false }: { name: string; label: string; type?: string; required?: boolean }) {
  return <label><span>{label}</span><input name={name} required={required} type={type} /></label>;
}

function Textarea({ name, label, required = false }: { name: string; label: string; required?: boolean }) {
  return <label><span>{label}</span><textarea name={name} required={required} rows={4} /></label>;
}

function Select({ name, label, options }: { name: string; label: string; options: string[] }) {
  return (
    <label>
      <span>{label}</span>
      <select name={name} required>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}
