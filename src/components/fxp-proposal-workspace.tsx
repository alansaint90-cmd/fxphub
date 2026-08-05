"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  defaultProposalData,
  encodeProposalData,
  FxpProposalData,
  onlyDigits,
  PROPOSAL_TEMPLATE_ID,
} from "@/lib/proposals/fxp-proposal";

interface FxpProposalWorkspaceProps {
  initialData?: FxpProposalData;
  publicMode?: boolean;
}

const featureCards = [
  ["Design responsivo", "Experiencia adaptada para celular, tablet e computador."],
  ["Contato estrategico", "Botoes posicionados para facilitar chamadas e mensagens."],
  ["Galeria profissional", "Imagens organizadas para transmitir mais confianca."],
  ["Fotos da empresa", "Apoio visual real para aproximar cliente e marca."],
];

const benefits = [
  "Maior credibilidade",
  "Mais facilidade para encontrar a empresa",
  "Centralizacao das informacoes",
  "Mais oportunidades de contato",
  "Fortalecimento da marca",
  "Base para campanhas de marketing",
  "Disponibilidade 24 horas",
  "Melhor experiencia para o cliente",
];

const implementationSteps = ["Aprovacao", "Envio das informacoes", "Personalizacao", "Revisao", "Publicacao", "Infraestrutura"];

export function FxpProposalWorkspace() {
  const [data, setData] = useState<FxpProposalData>(defaultProposalData);
  const [generatedLink, setGeneratedLink] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = `${window.location.origin}/propostas/${PROPOSAL_TEMPLATE_ID}?data=${encodeProposalData(data)}`;
    setGeneratedLink(url);
  }

  function updateField(field: keyof FxpProposalData, value: string) {
    setData((current) => ({ ...current, [field]: value }));
  }

  return (
    <article className="proposal-workspace">
      <section className="proposal-builder-panel">
        <header>
          <span className="eyebrow">Gerador de Propostas FXP</span>
          <h2>Template oficial: {PROPOSAL_TEMPLATE_ID}</h2>
          <p>Preencha os dados do cliente e gere uma proposta comercial personalizada preservando o modelo visual da FXP.</p>
        </header>

        <form className="proposal-builder-form" onSubmit={handleSubmit}>
          <div className="proposal-form-grid">
            <ProposalInput label="Nome da empresa" value={data.companyName} onChange={(value) => updateField("companyName", value)} />
            <ProposalInput label="Segmento" value={data.segment} onChange={(value) => updateField("segment", value)} />
            <ProposalInput label="Logo da empresa (URL)" value={data.companyLogoUrl} onChange={(value) => updateField("companyLogoUrl", value)} />
            <ProposalInput label="WhatsApp" value={data.whatsapp} onChange={(value) => updateField("whatsapp", onlyDigits(value))} />
            <ProposalInput label="Instagram" value={data.instagram} onChange={(value) => updateField("instagram", value)} />
            <ProposalInput label="Google Maps" value={data.googleMapsUrl} onChange={(value) => updateField("googleMapsUrl", value)} />
            <ProposalInput label="Link da demonstracao" value={data.demoUrl} onChange={(value) => updateField("demoUrl", value)} />
            <ProposalInput label="Print desktop do site" value={data.desktopImageUrl} onChange={(value) => updateField("desktopImageUrl", value)} />
            <ProposalInput label="Imagem mobile do site" value={data.mobileImageUrl} onChange={(value) => updateField("mobileImageUrl", value)} />
            <ProposalInput label="Antes/depois no Google" value={data.googleBeforeAfterImageUrl} onChange={(value) => updateField("googleBeforeAfterImageUrl", value)} />
            <ProposalInput label="Valor original" value={data.originalImplementationValue} onChange={(value) => updateField("originalImplementationValue", value)} />
            <ProposalInput label="Valor promocional" value={data.promotionalImplementationValue} onChange={(value) => updateField("promotionalImplementationValue", value)} />
            <ProposalInput label="Infraestrutura mensal" value={data.monthlyInfrastructureValue} onChange={(value) => updateField("monthlyInfrastructureValue", value)} />
            <ProposalInput label="Prazo" value={data.implementationDeadline} onChange={(value) => updateField("implementationDeadline", value)} />
            <ProposalInput label="Validade da proposta" value={data.proposalValidity} onChange={(value) => updateField("proposalValidity", value)} />
          </div>
          <label className="proposal-textarea-field">
            <span>Observacoes comerciais</span>
            <textarea value={data.commercialNotes} onChange={(event) => updateField("commercialNotes", event.target.value)} />
          </label>
          <button type="submit">Gerar proposta</button>
        </form>

        {generatedLink ? (
          <div className="proposal-generated-link">
            <span>Link publico da proposta</span>
            <input readOnly value={generatedLink} />
            <div>
              <button type="button" onClick={() => navigator.clipboard?.writeText(generatedLink)}>Copiar link</button>
              <a href={generatedLink} target="_blank">Abrir proposta</a>
            </div>
          </div>
        ) : null}
      </section>

      <FxpProposalTemplate data={data} previewMode />
    </article>
  );
}

export function FxpProposalPublicPage({ initialData, publicMode = false }: FxpProposalWorkspaceProps) {
  return <FxpProposalTemplate data={initialData ?? defaultProposalData} publicMode={publicMode} />;
}

function ProposalInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function FxpProposalTemplate({ data, previewMode = false, publicMode = false }: { data: FxpProposalData; previewMode?: boolean; publicMode?: boolean }) {
  const whatsappUrl = useMemo(() => {
    const phone = onlyDigits(data.whatsapp || defaultProposalData.whatsapp);
    const text = encodeURIComponent(`Ola! Quero aprovar a proposta da ${data.companyName}.`);
    return `https://wa.me/${phone}?text=${text}`;
  }, [data.companyName, data.whatsapp]);

  const navItems = ["Oportunidade", "Projeto", "Investimento", "FAQ"];

  return (
    <main className={`fxp-proposal-template ${previewMode ? "preview" : ""} ${publicMode ? "public" : ""}`}>
      <a className="proposal-floating-whatsapp" href={whatsappUrl} target="_blank" aria-label="Falar no WhatsApp">W</a>

      <section className="proposal-hero">
        <nav className="proposal-nav">
          <strong>FXP</strong>
          <div>
            {navItems.map((item) => <a href={`#${item.toLowerCase()}`} key={item}>{item}</a>)}
          </div>
          <button type="button" aria-label="Abrir menu"><span /><span /><span /></button>
        </nav>

        <div className="proposal-hero-grid">
          <div className="proposal-hero-copy">
            <div className="proposal-client-pill">
              <span>Assessoria FXP</span>
              <b>Proposta Comercial</b>
              <strong>{data.companyName}</strong>
              {data.companyLogoUrl ? <img src={data.companyLogoUrl} alt={`Logo ${data.companyName}`} /> : <i>{data.companyName.slice(0, 2)}</i>}
            </div>
            <h1>Uma presenca digital profissional para fortalecer a {data.companyName}</h1>
            <p>
              Projeto criado para melhorar a primeira impressao, organizar informacoes importantes e facilitar o contato
              entre sua empresa e novos clientes.
            </p>
            <div className="proposal-hero-actions">
              <a href={data.demoUrl || "#demo"} target={data.demoUrl ? "_blank" : undefined}>Ver demonstracao</a>
              <a className="whatsapp" href={whatsappUrl} target="_blank">Aprovar pelo WhatsApp</a>
            </div>
          </div>

          <div className="proposal-preview-stack">
            <ImageFrame src={data.desktopImageUrl} label="Previa desktop" />
            <ImageFrame src={data.mobileImageUrl} label="Previa mobile" mobile />
          </div>
        </div>
        <div className="proposal-marquee"><span>Presenca digital profissional</span><span>Contato facilitado</span><span>Google mais organizado</span><span>Mais oportunidades comerciais</span></div>
      </section>

      <section id="oportunidade" className="proposal-section proposal-two-col">
        <div>
          <span className="eyebrow">Oportunidade identificada</span>
          <h2>Mais confianca desde o primeiro contato</h2>
        </div>
        <p>
          Empresas do segmento de {data.segment} precisam transmitir seguranca antes mesmo da primeira conversa. Uma
          presenca digital organizada ajuda o cliente a encontrar informacoes, entender os diferenciais e entrar em contato
          com menos atrito.
        </p>
      </section>

      <section id="projeto" className="proposal-section">
        <span className="eyebrow">Apresentacao do projeto</span>
        <h2>Nao e apenas um site. E uma presenca digital organizada.</h2>
        <p>
          A proposta estrutura identidade visual, localizacao, produtos ou servicos, imagens reais, canais de atendimento
          e uma experiencia clara para quem acessa pelo celular ou computador.
        </p>
        <div className="proposal-feature-grid">
          {featureCards.map(([title, text]) => <ProposalCard key={title} title={title} text={text} />)}
        </div>
      </section>

      <section id="demo" className="proposal-section proposal-demo-card">
        <div>
          <span className="eyebrow">Demonstracao do site</span>
          <h2>Clique aqui para abrir o site</h2>
          <p>A demonstracao permite visualizar o resultado esperado antes da contratacao.</p>
        </div>
        <a href={data.demoUrl || "#"} target={data.demoUrl ? "_blank" : undefined}>Ver demonstracao do projeto</a>
      </section>

      <section className="proposal-section proposal-two-col">
        <ImageFrame src={data.googleBeforeAfterImageUrl} label="Presenca no Google" />
        <div>
          <span className="eyebrow">Canais conectados</span>
          <h2>Todos os canais trabalham juntos para facilitar o contato.</h2>
          <div className="proposal-channel-list">
            <a href={whatsappUrl} target="_blank">WhatsApp</a>
            <a href={data.instagram || "#"} target={data.instagram ? "_blank" : undefined}>Instagram</a>
            <a href={data.googleMapsUrl || "#"} target={data.googleMapsUrl ? "_blank" : undefined}>Google Maps</a>
            <span>E-mail</span>
          </div>
        </div>
      </section>

      <section className="proposal-section">
        <span className="eyebrow">Vantagens</span>
        <h2>Beneficios comerciais para a empresa</h2>
        <div className="proposal-benefits-grid">
          {benefits.map((benefit) => <span key={benefit}>{benefit}</span>)}
        </div>
      </section>

      <section className="proposal-section proposal-two-col">
        <div>
          <span className="eyebrow">Experiencia mobile</span>
          <h2>A maior parte das visitas acontece pelo celular.</h2>
          <p>Por isso, o projeto prioriza velocidade, leitura confortavel, botoes acessiveis e navegacao intuitiva.</p>
        </div>
        <ImageFrame src={data.mobileImageUrl} label="Experiencia mobile" mobile />
      </section>

      <section className="proposal-section">
        <span className="eyebrow">Implementacao</span>
        <h2>Processo claro do inicio a publicacao</h2>
        <div className="proposal-step-grid">
          {implementationSteps.map((step, index) => (
            <article key={step}>
              <b>{index + 1} de {implementationSteps.length}</b>
              <strong>{step}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="proposal-section proposal-scope-grid">
        <ScopeList title="Voce recebe" items={["Site personalizado", "Layout moderno", "Responsivo", "WhatsApp", "Google Maps", "Instagram", "SEO basico", "Publicacao", "Certificado SSL", "Dominio configurado"]} />
        <ScopeList title="Nao faz parte" items={["Producao de fotos", "Gestao de redes sociais", "Gestao de anuncios", "Loja virtual", "Sistema com login", "Integracoes nao contratadas"]} />
      </section>

      <section id="investimento" className="proposal-section proposal-investment">
        <div>
          <span className="eyebrow">Investimento</span>
          <h2>Site profissional personalizado</h2>
          <p>Voce so paga apos aprovar o projeto. A demonstracao deixa a decisao mais simples e segura.</p>
        </div>
        <div className="proposal-price-card">
          <span>Implementacao</span>
          <p>De R$ {data.originalImplementationValue} por apenas</p>
          <strong>R$ {data.promotionalImplementationValue}</strong>
          <small>Infraestrutura mensal: R$ {data.monthlyInfrastructureValue}/mes</small>
          <small>Prazo: {data.implementationDeadline}</small>
          <small>Validade: {data.proposalValidity}</small>
          <a href={whatsappUrl} target="_blank">Quero aprovar o projeto</a>
        </div>
      </section>

      <section className="proposal-section">
        <span className="eyebrow">Sobre a FXP</span>
        <h2>Tecnologia acessivel para empresas que querem crescer</h2>
        <p>
          Somos uma assessoria especializada em presenca digital, automacao comercial e solucoes inteligentes para empresas
          que desejam crescer utilizando tecnologia.
        </p>
        <div className="proposal-feature-grid">
          <ProposalCard title="Atendimento personalizado" text="A proposta e ajustada ao contexto comercial da empresa." />
          <ProposalCard title="Entrega rapida" text={`Implementacao prevista em ${data.implementationDeadline}.`} />
          <ProposalCard title="Tecnologia de ponta" text="Base pronta para campanhas, automacoes e evolucoes futuras." />
        </div>
      </section>

      <section id="faq" className="proposal-section">
        <span className="eyebrow">FAQ</span>
        <h2>Perguntas frequentes</h2>
        <div className="proposal-faq-grid">
          {["Quanto tempo leva para publicar?", "Posso solicitar alteracoes?", "Quem fornece as fotos?", "Preciso comprar dominio?", "A mensalidade e obrigatoria?", "Meu site aparece no Google?", "Posso cancelar quando quiser?"].map((question) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>Essa resposta sera alinhada com a equipe FXP de acordo com o escopo aprovado para a {data.companyName}.</p>
            </details>
          ))}
        </div>
      </section>

      <section className="proposal-section proposal-final-cta">
        <h2>Sua empresa merece uma presenca digital a altura da qualidade do seu trabalho.</h2>
        <p>{data.commercialNotes}</p>
        <div>
          <a href={whatsappUrl} target="_blank">Quero aprovar o projeto</a>
          <a className="secondary" href={whatsappUrl} target="_blank">Falar com um consultor</a>
        </div>
      </section>
    </main>
  );
}

function ImageFrame({ src, label, mobile = false }: { src: string; label: string; mobile?: boolean }) {
  return (
    <figure className={`proposal-image-frame ${mobile ? "mobile" : ""}`}>
      {src ? <img src={src} alt={label} /> : <div>{label}</div>}
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function ProposalCard({ title, text }: { title: string; text: string }) {
  return (
    <article>
      <i />
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

function ScopeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  );
}
