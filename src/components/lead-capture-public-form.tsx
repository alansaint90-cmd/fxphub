"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import atendimentoIaImage from "../../public/assets/diagnostico-atendimento-ia.png";
import metaAdsImage from "../../public/assets/diagnostico-meta-ads.png";
import fxpHubLogo from "../../public/assets/fxp-hub-logo.png";

type LeadDiagnosticStatus = "HOT" | "WARM" | "DISQUALIFIED";
type QuizView = "intro" | "quiz" | "processing" | "result";
type QuizField =
  | "name"
  | "businessName"
  | "role"
  | "paidTraffic"
  | "paidTrafficReason"
  | "currentDailyLeads"
  | "desiredDailyLeads"
  | "attendanceStructure"
  | "responseTime"
  | "mainChallenge"
  | "strategyOpenness"
  | "meetingInterest"
  | "phone"
  | "email";

interface SubmitResult {
  ok?: boolean;
  leadId?: string;
  qualificationStatus?: "qualified" | "unqualified";
  diagnosticStatus?: LeadDiagnosticStatus;
  diagnosticSummary?: string;
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

interface QuizQuestion {
  field: QuizField;
  title: string;
  subtitle?: string;
  type: "text" | "email" | "tel" | "choice";
  placeholder?: string;
  options?: string[];
  context?: string[];
  when?: (answers: Record<QuizField, string>) => boolean;
}

const stoppedTrafficReasons = [
  "Nao tivemos o retorno esperado.",
  "Recebiamos contatos, mas poucos viravam matriculas.",
  "A agencia ou gestor nao entregou o esperado.",
  "O atendimento nao conseguia acompanhar os leads.",
  "O investimento ficou alto para o retorno.",
  "Outro.",
];

const activeTrafficReasons = [
  "Quero gerar mais oportunidades.",
  "Quero melhorar a qualidade dos leads.",
  "Quero aumentar a conversao em matriculas.",
  "Preciso melhorar o atendimento dos leads.",
  "Quero reduzir o custo dos resultados.",
  "Quero uma estrategia mais completa.",
];

const questions: QuizQuestion[] = [
  { field: "name", title: "Como voce se chama?", placeholder: "Digite seu primeiro nome", type: "text" },
  { field: "businessName", title: "Qual e o nome da sua autoescola?", placeholder: "Digite o nome da sua autoescola", type: "text" },
  {
    field: "role",
    title: "Qual e o seu papel na empresa?",
    type: "choice",
    options: ["Dono(a)", "Socio(a)", "Gestor(a)", "Responsavel pelo marketing ou comercial", "Funcionario(a)", "Outro"],
  },
  {
    field: "paidTraffic",
    title: "Voce ja utilizou trafego pago para atrair novos alunos?",
    subtitle: "Meta Ads, Instagram Ads, Facebook Ads ou Google Ads.",
    type: "choice",
    options: ["Sim, utilizamos atualmente.", "Ja utilizamos, mas paramos.", "Nunca utilizamos."],
  },
  {
    field: "paidTrafficReason",
    title: "O que fez voce buscar uma nova solucao mesmo ja investindo?",
    type: "choice",
    options: activeTrafficReasons,
    when: (answers) => answers.paidTraffic === "Sim, utilizamos atualmente.",
  },
  {
    field: "paidTrafficReason",
    title: "Qual foi o principal motivo para interromper suas campanhas?",
    type: "choice",
    options: stoppedTrafficReasons,
    when: (answers) => answers.paidTraffic === "Ja utilizamos, mas paramos.",
  },
  {
    field: "currentDailyLeads",
    title: "Quantos novos interessados chegam por dia no WhatsApp?",
    type: "choice",
    options: ["Nenhum ou quase nenhum.", "1 a 5.", "6 a 10.", "11 a 20.", "Mais de 20."],
  },
  {
    field: "desiredDailyLeads",
    title: "Quantos novos interessados por dia voce gostaria de receber?",
    type: "choice",
    options: ["5 a 10.", "10 a 20.", "20 a 30.", "Mais de 30.", "Quero receber o maximo que minha operacao conseguir atender."],
  },
  {
    field: "attendanceStructure",
    title: "Hoje, quem atende os interessados que chegam pelo WhatsApp?",
    type: "choice",
    options: ["Eu mesmo(a).", "Uma pessoa responsavel.", "Temos uma equipe de atendimento.", "Ninguem exclusivamente.", "Temos automacao ou Inteligencia Artificial."],
  },
  {
    field: "responseTime",
    title: "Quanto tempo normalmente leva para responder um novo interessado?",
    type: "choice",
    options: ["Imediatamente.", "Ate 5 minutos.", "Entre 5 e 30 minutos.", "Mais de 30 minutos.", "As vezes so respondemos horas depois.", "Nao sei."],
  },
  {
    field: "mainChallenge",
    title: "Qual e o principal desafio para aumentar as matriculas?",
    type: "choice",
    options: [
      "Poucas pessoas entrando em contato.",
      "Muitos contatos, mas poucas matriculas.",
      "Demora no atendimento.",
      "Falta de acompanhamento dos interessados.",
      "Dependencia de indicacao.",
      "Nao temos uma estrategia previsivel para gerar novos alunos.",
    ],
  },
  {
    field: "strategyOpenness",
    title: "Se identificarmos uma estrategia melhor, voce estaria disposto(a) a implementar?",
    type: "choice",
    options: [
      "Sim, estou buscando exatamente isso.",
      "Sim, se fizer sentido para minha realidade.",
      "Talvez, quero entender primeiro.",
      "Nao tenho interesse em mudar minha estrategia atual.",
    ],
  },
  {
    field: "meetingInterest",
    title: "Voce tem interesse em conversar por cerca de 15 minutos com nosso especialista?",
    subtitle: "A analise inicial e gratuita e sem compromisso.",
    type: "choice",
    context: [
      "Com base nas suas respostas, podemos identificar oportunidades especificas para melhorar a geracao e o aproveitamento de novos clientes na sua autoescola.",
      "Nessa conversa, mostramos um metodo que combina trafego pago, atendimento com IA e estrategias para transformar mais oportunidades em matriculas.",
    ],
    options: ["Sim, quero receber minha analise gratuita.", "Tenho interesse, mas preciso combinar outro momento.", "Nao tenho interesse em conversar."],
  },
  { field: "phone", title: "Entraremos em contato utilizando as informacoes abaixo", subtitle: "Informe seu WhatsApp para continuar com Fausto.", type: "tel", placeholder: "Seu WhatsApp com DDD" },
  { field: "email", title: "Qual e o seu melhor e-mail?", subtitle: "Opcional, para receber materiais e confirmacoes.", type: "email", placeholder: "Digite seu melhor email" },
];

const initialAnswers: Record<QuizField, string> = {
  name: "",
  businessName: "",
  role: "",
  paidTraffic: "",
  paidTrafficReason: "",
  currentDailyLeads: "",
  desiredDailyLeads: "",
  attendanceStructure: "",
  responseTime: "",
  mainChallenge: "",
  strategyOpenness: "",
  meetingInterest: "",
  phone: "",
  email: "",
};

const processingMessages = [
  "Analisando sua operacao...",
  "Comparando seu cenario atual com oportunidades de crescimento...",
  "Identificando possiveis gargalos...",
  "Preparando seu diagnostico...",
];

export function LeadCapturePublicForm({ slug }: { slug: string }) {
  const [view, setView] = useState<QuizView>("intro");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers);
  const [contactAuthorized, setContactAuthorized] = useState(true);
  const [privacyPolicyAccepted, setPrivacyPolicyAccepted] = useState(true);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<PublicFormSettings | null>(null);
  const [processingIndex, setProcessingIndex] = useState(0);

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

  useEffect(() => {
    if (view !== "processing") return;
    const interval = window.setInterval(() => {
      setProcessingIndex((current) => Math.min(processingMessages.length - 1, current + 1));
    }, 500);
    return () => window.clearInterval(interval);
  }, [view]);

  const visibleQuestions = useMemo(() => questions.filter((item) => !item.when || item.when(answers)), [answers]);
  const question = visibleQuestions[currentQuestion] ?? visibleQuestions[0];
  const progress = useMemo(() => Math.round(((currentQuestion + 1) / visibleQuestions.length) * 100), [currentQuestion, visibleQuestions.length]);
  const canSubmit = currentQuestion === visibleQuestions.length - 1;

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!validateCurrentQuestion()) return;
    if (!contactAuthorized || !privacyPolicyAccepted) {
      setStatus("Confirme as autorizacoes para concluir.");
      return;
    }

    setView("processing");
    setProcessingIndex(0);
    setStatus("");

    const payload = {
      ...answers,
      salesAttendants: parseAttendance(answers.attendanceStructure),
      runsPaidAds: answers.paidTraffic,
      wantsWhatsappAutomation: answers.attendanceStructure.includes("Inteligencia Artificial") ? "Sim" : "Nao informado",
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
      await wait(2000);
      setResult(json);
      setStatus(json.ok ? "" : json.error ?? "Nao foi possivel enviar.");
      setView("result");
    } catch {
      await wait(800);
      setStatus("Erro ao enviar formulario.");
      setView("quiz");
    }
  }

  async function handleWhatsappClick() {
    if (!result?.leadId || !result.whatsappUrl) return;
    await fetch(`/api/lead-capture/leads/${result.leadId}/click`, { method: "POST" });
    window.location.href = result.whatsappUrl;
  }

  function validateCurrentQuestion() {
    if (question.field === "email") return true;
    if (!answers[question.field].trim()) {
      setStatus("Responda esta pergunta para continuar.");
      return false;
    }
    if (question.field === "phone" && answers.phone.replace(/\D/g, "").length < 10) {
      setStatus("Informe um WhatsApp valido com DDD.");
      return false;
    }
    setStatus("");
    return true;
  }

  function goNext() {
    if (!validateCurrentQuestion()) return;
    if (canSubmit) {
      void handleSubmit();
      return;
    }
    setCurrentQuestion((current) => Math.min(visibleQuestions.length - 1, current + 1));
  }

  function goBack() {
    if (view === "intro") return;
    if (currentQuestion === 0) {
      setView("intro");
      return;
    }
    setCurrentQuestion((current) => Math.max(0, current - 1));
  }

  function choose(field: QuizField, value: string) {
    setAnswers((current) => ({ ...current, [field]: value }));
    setStatus("");
    window.setTimeout(() => {
      setCurrentQuestion((current) => Math.min(visibleQuestions.length - 1, current + 1));
    }, 180);
  }

  if (view === "intro") {
    return (
      <main className="public-form-shell quiz-shell fxp-diagnostic-shell">
        <IntroScreen onStart={() => setView("quiz")} settings={settings} />
      </main>
    );
  }

  if (view === "processing") {
    return (
      <main className="public-form-shell quiz-shell fxp-diagnostic-shell">
        <ProcessingScreen message={processingMessages[processingIndex]} />
      </main>
    );
  }

  if (view === "result") {
    const qualified = result?.qualificationStatus === "qualified";
    return (
      <main className="public-form-shell quiz-shell fxp-diagnostic-shell">
        {qualified ? (
          <QualifiedResult answers={answers} result={result} onWhatsappClick={handleWhatsappClick} />
        ) : (
          <UnqualifiedResult />
        )}
      </main>
    );
  }

  return (
    <main className="public-form-shell quiz-shell fxp-diagnostic-shell">
      <ProgressBar progress={progress} />
      <form className="public-form-card quiz-card fxp-quiz-card" onSubmit={handleSubmit}>
        <header className="quiz-mobile-top fxp-quiz-top">
          <button aria-label="Voltar" type="button" onClick={goBack}>{"\u2190"}</button>
          <BrandMark />
          <span />
        </header>

        <div className="fxp-step-label">Etapa {currentQuestion + 1} de {visibleQuestions.length}</div>
        <QuestionView answers={answers} onChange={setAnswers} onChoose={choose} question={question} />

        {question.field === "email" ? (
          <div className="fxp-consent">
            <label><input checked={contactAuthorized} onChange={(event) => setContactAuthorized(event.target.checked)} type="checkbox" /> Autorizo contato da FXP pelo WhatsApp.</label>
            <label><input checked={privacyPolicyAccepted} onChange={(event) => setPrivacyPolicyAccepted(event.target.checked)} type="checkbox" /> Aceito a politica de privacidade.</label>
            {settings?.privacyPolicyUrl ? <a href={settings.privacyPolicyUrl} target="_blank">Abrir politica de privacidade</a> : null}
          </div>
        ) : null}

        {status ? <p className="form-error">{status}</p> : null}

        <div className="public-form-actions quiz-actions">
          <button type="button" onClick={goNext}>{canSubmit ? "Concluir diagnostico" : "Continuar"}</button>
        </div>
      </form>
    </main>
  );
}

function IntroScreen({ onStart }: { onStart: () => void; settings: PublicFormSettings | null }) {
  return (
    <section className="fxp-intro">
      <BrandMark />
      <h1>Atraia mais potenciais clientes para o WhatsApp da sua autoescola e transforme oportunidades em novas matriculas.</h1>
      <p className="fxp-intro-subtitle">
        Faca o diagnostico e descubra como a FXP pode unir trafego pago, geracao de demanda e Inteligencia Artificial para colocar mais potenciais alunos no seu WhatsApp e ajudar sua autoescola a vender mais matriculas todos os dias.
      </p>
      <div className="fxp-intro-media-grid">
        <figure>
          <img src={metaAdsImage.src} alt="Resultados de campanhas no gerenciador de anuncios" />
          <figcaption>Campanhas gerando demanda e novas oportunidades de matricula.</figcaption>
        </figure>
        <figure>
          <img src={atendimentoIaImage.src} alt="Central de atendimento com IA no WhatsApp" />
          <figcaption>Inteligencia Artificial apoiando as conversas no WhatsApp e permitindo atender mais potenciais alunos.</figcaption>
        </figure>
      </div>
      <small>Responda com dados reais. Ao final, se o perfil for compativel, voce podera conversar com Fausto gratuitamente.</small>
      <button type="button" onClick={onStart}>Iniciar meu diagnostico</button>
    </section>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return <div className="quiz-top-progress fxp-progress"><i style={{ width: `${progress}%` }} /></div>;
}

function BrandMark() {
  return <img className="fxp-brand-logo" src={fxpHubLogo.src} alt="FXP Hub" />;
}

function QuestionView({
  answers,
  onChange,
  onChoose,
  question,
}: {
  answers: Record<QuizField, string>;
  onChange: (answers: Record<QuizField, string>) => void;
  onChoose: (field: QuizField, value: string) => void;
  question: QuizQuestion;
}) {
  return (
    <section className="quiz-question-card fxp-question-card">
      {question.context ? (
        <div className="fxp-context-card">
          {question.context.map((line) => <p key={line}>{line}</p>)}
        </div>
      ) : null}
      <h2>{question.title}</h2>
      {question.subtitle ? <p>{question.subtitle}</p> : null}
      {question.type === "choice" ? (
        <div className="quiz-options fxp-options">
          {question.options?.map((option) => (
            <button className={answers[question.field] === option ? "selected" : ""} key={option} type="button" onClick={() => onChoose(question.field, option)}>
              <i />
              <span>{option}</span>
            </button>
          ))}
        </div>
      ) : (
        <input
          autoFocus
          className="quiz-input fxp-input"
          placeholder={question.placeholder}
          type={question.type}
          value={answers[question.field]}
          onChange={(event) => onChange({ ...answers, [question.field]: event.target.value })}
        />
      )}
    </section>
  );
}

function ProcessingScreen({ message }: { message: string }) {
  return (
    <section className="fxp-processing">
      <BrandMark />
      <div className="fxp-orbit"><i /><i /><i /></div>
      <h1>{message}</h1>
      <p>Seu diagnostico esta sendo preparado pela FXP.</p>
    </section>
  );
}

function QualifiedResult({ answers, result, onWhatsappClick }: { answers: Record<QuizField, string>; result: SubmitResult | null; onWhatsappClick: () => void }) {
  return (
    <section className="public-form-card result quiz-result fxp-result-card">
      <BrandMark />
      <span className="fxp-kicker">Diagnostico concluido</span>
      <h1>SEU DIAGNOSTICO FOI CONCLUIDO!</h1>
      <p>Com base nas suas respostas, identificamos oportunidades para melhorar a geracao e o aproveitamento de novos clientes na sua autoescola.</p>
      <div className="fxp-personal-card">
        <strong>Ola, {answers.name}.</strong>
        <p>Com base nas informacoes fornecidas sobre a {answers.businessName}, identificamos oportunidades que podem ser exploradas na sua operacao.</p>
        <span>Status: {result?.diagnosticStatus || "WARM"} | Score: {result?.score ?? 0}</span>
      </div>
      <ul>
        <li>Geracao de novos interessados atraves do trafego pago.</li>
        <li>Atendimento rapido utilizando Inteligencia Artificial.</li>
        <li>Estrategias para transformar mais oportunidades em matriculas.</li>
      </ul>
      <button type="button" onClick={onWhatsappClick}>Falar com Fausto agora</button>
    </section>
  );
}

function UnqualifiedResult() {
  return (
    <section className="public-form-card result quiz-result fxp-result-card">
      <BrandMark />
      <span className="fxp-kicker">Diagnostico concluido</span>
      <h1>DIAGNOSTICO CONCLUIDO</h1>
      <p>Obrigado por dedicar alguns minutos para realizar o diagnostico da FXP.</p>
      <p>Com base nas respostas fornecidas, identificamos que neste momento o perfil ainda nao atende aos requisitos para avancar para uma analise estrategica individual.</p>
      <p>Caso esse cenario mude no futuro, teremos prazer em realizar uma nova avaliacao.</p>
    </section>
  );
}

function parseAttendance(value: string) {
  if (value === "Temos uma equipe de atendimento.") return 3;
  if (value === "Uma pessoa responsavel.") return 1;
  if (value === "Temos automacao ou Inteligencia Artificial.") return 2;
  return 0;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
