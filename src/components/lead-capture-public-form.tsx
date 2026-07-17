"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

interface PublicFormSettings {
  title?: string;
  description?: string | null;
  privacyPolicyUrl?: string | null;
}

type QuizField =
  | "name"
  | "businessName"
  | "phone"
  | "email"
  | "city"
  | "state"
  | "monthlyEnrollments"
  | "salesAttendants"
  | "usesCrm"
  | "runsPaidAds"
  | "monthlyAdSpend"
  | "mainChallenge"
  | "responseTime"
  | "wantsWhatsappAutomation"
  | "meetingInterest"
  | "preferredMeetingPeriod";

interface QuizQuestion {
  field: QuizField;
  title: string;
  subtitle: string;
  type: "text" | "email" | "number" | "textarea" | "choice";
  required?: boolean;
  options?: string[];
}

const questions: QuizQuestion[] = [
  { field: "name", title: "Qual e o seu nome?", subtitle: "Vamos identificar o responsavel pela autoescola.", type: "text", required: true },
  { field: "businessName", title: "Qual e o nome da autoescola?", subtitle: "Use o nome comercial que sua equipe usa no atendimento.", type: "text", required: true },
  { field: "phone", title: "Qual WhatsApp podemos usar?", subtitle: "Informe com DDD para liberar o contato com o Fausto.", type: "text", required: true },
  { field: "email", title: "Qual e-mail de contato?", subtitle: "Opcional, mas ajuda no envio de materiais.", type: "email" },
  { field: "city", title: "Em qual cidade fica a autoescola?", subtitle: "Cidade da operacao principal.", type: "text", required: true },
  { field: "state", title: "Qual e o estado?", subtitle: "Exemplo: BA, SP, RJ.", type: "text", required: true },
  { field: "monthlyEnrollments", title: "Quantas matriculas por mes?", subtitle: "Escolha a faixa mais proxima da realidade atual.", type: "choice", required: true, options: ["Ate 10", "11 a 20", "21 a 40", "Acima de 40"] },
  { field: "salesAttendants", title: "Quantas pessoas atendem leads?", subtitle: "Conte quem responde WhatsApp, Instagram ou telefone.", type: "choice", required: true, options: ["Nenhum atendente dedicado", "1 atendente", "2 ou mais atendentes"] },
  { field: "usesCrm", title: "Como voces organizam os leads hoje?", subtitle: "Isso mostra o nivel de maturidade comercial.", type: "choice", required: true, options: ["Nao utiliza CRM", "Utiliza planilha", "Ja utiliza CRM"] },
  { field: "runsPaidAds", title: "A autoescola investe em anuncios?", subtitle: "Meta Ads, Google Ads ou impulsionamentos.", type: "choice", required: true, options: ["Ja investe em anuncios", "Ja investiu anteriormente", "Nunca investiu"] },
  { field: "monthlyAdSpend", title: "Quanto investe por mes em anuncios?", subtitle: "Pode ser uma estimativa.", type: "number" },
  { field: "mainChallenge", title: "Qual a maior dificuldade comercial hoje?", subtitle: "Exemplo: demora no atendimento, leads perdidos, falta de follow-up.", type: "textarea", required: true },
  { field: "responseTime", title: "Em quanto tempo respondem os leads?", subtitle: "A velocidade de resposta impacta diretamente as matriculas.", type: "choice", required: true, options: ["Ate 5 minutos", "Ate 30 minutos", "Algumas horas", "No dia seguinte"] },
  { field: "wantsWhatsappAutomation", title: "Voce quer automatizar o WhatsApp?", subtitle: "A IA pode responder, organizar e qualificar os interessados.", type: "choice", required: true, options: ["Sim", "Talvez", "Nao"] },
  { field: "meetingInterest", title: "Voce tem interesse real em uma reuniao online?", subtitle: "Essa resposta define se o Fausto libera a proxima etapa.", type: "choice", required: true, options: ["Sim, quero participar de uma reuniao", "Tenho interesse, mas ainda nao sei quando", "Quero apenas conhecer melhor", "Nao tenho interesse em reuniao neste momento"] },
  { field: "preferredMeetingPeriod", title: "Qual o melhor periodo para uma reuniao?", subtitle: "Vamos usar isso para orientar o proximo contato.", type: "choice", options: ["Manha", "Tarde", "Noite", "A combinar"] },
];

const initialAnswers: Record<QuizField, string> = {
  name: "",
  businessName: "",
  phone: "",
  email: "",
  city: "",
  state: "",
  monthlyEnrollments: "",
  salesAttendants: "",
  usesCrm: "",
  runsPaidAds: "",
  monthlyAdSpend: "",
  mainChallenge: "",
  responseTime: "",
  wantsWhatsappAutomation: "",
  meetingInterest: "",
  preferredMeetingPeriod: "",
};

export function LeadCapturePublicForm({ slug }: { slug: string }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers);
  const [contactAuthorized, setContactAuthorized] = useState(false);
  const [privacyPolicyAccepted, setPrivacyPolicyAccepted] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<PublicFormSettings | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextTracking: Record<string, string> = { landing_page_url: window.location.href };
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "campaign_id", "adset_id", "ad_id", "fbclid", "fbc", "fbp"].forEach((key) => {
      const value = params.get(key);
      if (value) nextTracking[key] = value;
    });
    setTracking(nextTracking);
    void fetch(`/api/lead-capture/forms/${slug}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((json: { settings?: PublicFormSettings }) => setSettings(json.settings ?? null))
      .catch(() => setSettings(null));
  }, [slug]);

  const progress = useMemo(() => Math.round(((currentQuestion + 1) / (questions.length + 1)) * 100), [currentQuestion]);
  const question = questions[currentQuestion];
  const isConsentStep = currentQuestion >= questions.length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contactAuthorized || !privacyPolicyAccepted) {
      setStatus("Confirme as autorizacoes para concluir.");
      return;
    }

    setStatus("Enviando diagnostico...");
    const payload = {
      ...answers,
      monthlyEnrollments: parseEnrollments(answers.monthlyEnrollments),
      salesAttendants: parseAttendants(answers.salesAttendants),
      monthlyAdSpend: Number(answers.monthlyAdSpend || 0),
      contactAuthorized,
      privacyPolicyAccepted,
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

  function goNext() {
    if (!isConsentStep && question.required && !answers[question.field].trim()) {
      setStatus("Responda esta pergunta para continuar.");
      return;
    }
    setStatus("");
    setCurrentQuestion((current) => Math.min(questions.length, current + 1));
  }

  function choose(field: QuizField, value: string) {
    setAnswers((current) => ({ ...current, [field]: value }));
    setStatus("");
  }

  if (result?.ok) {
    const qualified = result.qualificationStatus === "qualified";
    return (
      <main className="public-form-shell quiz-shell">
        <section className="public-form-card result quiz-result">
          <span className="public-form-logo">fxphub</span>
          <h1>{qualified ? "Sua autoescola foi selecionada para a proxima etapa!" : "Obrigado pelo seu interesse na FXP Assessoria"}</h1>
          <p>
            {qualified
              ? "Obrigado pelas informacoes. Identificamos que sua autoescola possui perfil para conhecer as solucoes da FXP Assessoria."
              : "Analisamos as informacoes enviadas e registramos seus dados para futuras ofertas e conteudos mais compativeis com sua realidade."}
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
    <main className="public-form-shell quiz-shell">
      <div className="quiz-top-progress"><i style={{ width: `${progress}%` }} /></div>
      <form className="public-form-card quiz-card" onSubmit={handleSubmit}>
        <header className="quiz-mobile-top">
          <button
            aria-label="Voltar"
            disabled={currentQuestion === 0}
            type="button"
            onClick={() => setCurrentQuestion((current) => Math.max(0, current - 1))}
          >
            {"\u2190"}
          </button>
          <span className="quiz-brand-mark" aria-label="FXP Assessoria" />
        </header>

        <div className="quiz-progress-head">
          <span>{isConsentStep ? "Confirmacao" : `Pergunta ${currentQuestion + 1} de ${questions.length}`}</span>
          <strong>{progress}%</strong>
        </div>

        {!isConsentStep ? (
          <section className="quiz-question-card">
            <h2>{question.title}</h2>
            <p>{question.subtitle}</p>
            {question.type === "choice" ? (
              <div className="quiz-options">
                {question.options?.map((option) => (
                  <button
                    className={answers[question.field] === option ? "selected" : ""}
                    key={option}
                    type="button"
                    onClick={() => choose(question.field, option)}
                  >
                    <i />
                    <span>{option}</span>
                  </button>
                ))}
              </div>
            ) : question.type === "textarea" ? (
              <textarea
                autoFocus
                className="quiz-input"
                value={answers[question.field]}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.field]: event.target.value }))}
                rows={5}
              />
            ) : (
              <input
                autoFocus
                className="quiz-input"
                type={question.type}
                value={answers[question.field]}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.field]: event.target.value }))}
              />
            )}
          </section>
        ) : (
          <section className="quiz-question-card quiz-consent-card">
            <span className="quiz-question-index">OK</span>
            <h2>Confirme para enviar seu diagnostico</h2>
            <p>Usaremos seus dados apenas para contato comercial da FXP e continuidade do atendimento.</p>
            <label className="public-check"><input checked={contactAuthorized} onChange={(event) => setContactAuthorized(event.target.checked)} type="checkbox" /> Autorizo contato da FXP pelo WhatsApp.</label>
            <label className="public-check"><input checked={privacyPolicyAccepted} onChange={(event) => setPrivacyPolicyAccepted(event.target.checked)} type="checkbox" /> Aceito a politica de privacidade e tratamento de dados.</label>
            {settings?.privacyPolicyUrl ? <a className="public-policy-link" href={settings.privacyPolicyUrl} target="_blank">Abrir politica de privacidade</a> : null}
          </section>
        )}

        {status ? <p className="form-error">{status}</p> : null}

        <div className="public-form-actions quiz-actions">
          <button className="secondary quiz-back-bottom" disabled={currentQuestion === 0} type="button" onClick={() => setCurrentQuestion((current) => Math.max(0, current - 1))}>Voltar</button>
          {!isConsentStep ? <button type="button" onClick={goNext}>Continuar</button> : <button type="submit">Enviar diagnostico</button>}
        </div>
      </form>
    </main>
  );
}

function parseEnrollments(value: string) {
  if (value === "11 a 20") return 15;
  if (value === "21 a 40") return 30;
  if (value === "Acima de 40") return 45;
  return 10;
}

function parseAttendants(value: string) {
  if (value === "1 atendente") return 1;
  if (value === "2 ou mais atendentes") return 2;
  return 0;
}
