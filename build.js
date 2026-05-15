// Build script: assembles index.html from the extracted CSS + a freshly
// written React app that integrates Supabase and adds an admin panel.
// Run: node build.js  -> writes index.html
const fs = require('fs');
const path = require('path');

const tpl = fs.readFileSync(path.join(__dirname, 'template_decoded.html'), 'utf8');

// CSS = everything between the FIRST `:root {` and the LAST `</style>`.
// (The @font-face block before :root pointed at bundle UUIDs — we replace it
//  with a Google Fonts @import.)
const cssStart = tpl.indexOf(':root {');
const cssEnd = tpl.lastIndexOf('</style>');
if (cssStart < 0 || cssEnd < 0) throw new Error('css markers not found');
const baseCss = tpl.slice(cssStart, cssEnd);

const FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');";

const EXTRA_CSS = `
/* === Added: admin gear + admin overlay === */
.admin-gear {
  background: transparent;
  border: 0;
  color: var(--sz-fg-muted);
  font-size: 18px;
  width: 32px; height: 32px;
  border-radius: 50%;
  display: inline-grid; place-items: center;
  margin-left: 8px;
  opacity: .6;
  transition: opacity var(--sz-duration-base) var(--sz-ease), background var(--sz-duration-base) var(--sz-ease);
}
.admin-gear:hover { opacity: 1; background: var(--sz-bg-muted); }
.admin-footer { display: flex; align-items: center; justify-content: center; gap: 4px; }

.admin-login-form { display: flex; flex-direction: column; gap: 14px; max-width: 360px; margin: 0 auto; }
.admin-login-form label { font: var(--sz-type-detail-medium); color: var(--sz-fg-muted); text-transform: uppercase; letter-spacing: .06em; }
.admin-login-form input {
  padding: 10px 14px;
  border: 1px solid var(--sz-border);
  border-radius: var(--sz-radius-md);
  background: var(--sz-bg);
  font: var(--sz-type-p-ui);
  color: var(--sz-fg);
  width: 100%;
}
.admin-login-form input:focus { outline: 0; border-color: var(--sz-primary); box-shadow: var(--sz-shadow-focus); }
.admin-error { color: var(--sz-danger); font: var(--sz-type-subtle); padding: 10px 14px; background: var(--sz-danger-bg); border-radius: var(--sz-radius-md); }
.admin-success { color: var(--sz-green-900); font: var(--sz-type-subtle); padding: 10px 14px; background: var(--sz-success-bg); border-radius: var(--sz-radius-md); }

.admin-list { display: flex; flex-direction: column; gap: 10px; }
.admin-row {
  display: grid; grid-template-columns: 1fr auto; gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--sz-border-subtle);
  border-radius: var(--sz-radius-md);
  background: var(--sz-bg);
}
.admin-row-meta { min-width: 0; }
.admin-row-name { font: var(--sz-type-p-ui-medium); color: var(--sz-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-row-sub { font: var(--sz-type-detail); color: var(--sz-fg-muted); margin-top: 2px; }
.admin-row-actions { display: flex; gap: 6px; flex-shrink: 0; }
.admin-row-actions button {
  padding: 6px 10px;
  border-radius: var(--sz-radius-full);
  border: 1px solid var(--sz-border-subtle);
  background: var(--sz-bg);
  font: var(--sz-type-detail-medium);
  color: var(--sz-fg);
}
.admin-row-actions button:hover { background: var(--sz-bg-muted); }
.admin-row-actions button.danger { color: var(--sz-danger); }
.admin-row-actions button.danger:hover { background: var(--sz-danger-bg); }

.admin-empty { text-align: center; padding: 32px; color: var(--sz-fg-muted); font: var(--sz-type-subtle); }

/* === Modal width override for admin view === */
.modal.wide { max-width: 880px; }

@media (max-width: 720px) {
  .admin-row { grid-template-columns: 1fr; }
  .admin-row-actions { justify-content: flex-end; }
}
`;

// Inline Seazone-style mark (navy circle with white S + coral dot)
const LOGO_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32" width="120" height="32">
      <g transform="translate(0 0)">
        <circle cx="14" cy="16" r="12" fill="#080E32"/>
        <text x="14" y="21" text-anchor="middle" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-weight="700" font-size="14" fill="#FFFFFF">S</text>
        <circle cx="22" cy="8" r="2.4" fill="#F1605D"/>
      </g>
      <text x="34" y="21" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-weight="600" font-size="15" fill="#080E32" letter-spacing="0.5">Seazone</text>
    </svg>`
  );

const SUPABASE_URL = 'https://fsqybshlmqpbeprkvkei.supabase.co';
const SUPABASE_PUBLISHABLE = 'sb_publishable_WvimhJCgNLGFF119OtHWsQ_BselyvEA';

const APP_JS = String.raw`
/* SUPABASE — only the publishable (anon) key is here.
   service_role / sb_secret MUST NEVER be embedded in this file.
   RLS policies on the responses table protect data. */
const SUPABASE_URL = "__SUPABASE_URL__";
const SUPABASE_PUBLISHABLE = "__SUPABASE_PUBLISHABLE__";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sz-admin-auth' },
});

const { useState, useEffect, useRef, useCallback } = React;

const STORAGE_KEY = "seazone-cs-onboarding-desafio-v2";

const PROPERTIES = [
  { id: "GAR1102", code: "GAR 1102", city: "Garopaba",      days: 65, stage: "Vistoria reagendada 2x",    profile: "Reclamação aberta na Ouvidoria", lastContact: "Há 3 dias", status: "em-risco", statusLabel: "Em risco" },
  { id: "SPJ0303", code: "SPJ 0303", city: "Florianópolis", days: 42, stage: "Aguardando fotos",          profile: "1ª implantação, ansioso",         lastContact: "Há 6 dias", status: "atencao",  statusLabel: "Em fluxo" },
  { id: "CAN0414", code: "CAN 0414", city: "Canasvieiras",  days: 19, stage: "Pronto para ativação",      profile: "Proprietário sumido",             lastContact: "Há 9 dias", status: "travado",  statusLabel: "Travado" },
  { id: "BLN1208", code: "BLN 1208", city: "Bombinhas",     days: 12, stage: "Coleta de chaves",          profile: "Investidor com 4 imóveis",        lastContact: "Há 3 dias", status: "em-fluxo", statusLabel: "Em fluxo" },
  { id: "ITP0507", code: "ITP 0507", city: "Itapema",       days: 28, stage: "Adequação enxoval",         profile: "Idoso, prefere ligação",          lastContact: "Há 3 dias", status: "em-fluxo", statusLabel: "Em fluxo" },
];

const DEFAULT_STATE = {
  candidato: { nome: "", email: "" },
  t1: { ordem: ["GAR1102", "SPJ0303", "CAN0414", "BLN1208", "ITP0507"], justificativa: "" },
  t2: { mensagem: "", plano: "" },
  t3: { mensagem_proprietario: "", mensagem_operacao: "" },
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed,
      candidato: { ...DEFAULT_STATE.candidato, ...(parsed.candidato || {}) },
      t1: { ...DEFAULT_STATE.t1, ...(parsed.t1 || {}) },
      t2: { ...DEFAULT_STATE.t2, ...(parsed.t2 || {}) },
      t3: { ...DEFAULT_STATE.t3, ...(parsed.t3 || {}) },
    };
  } catch (e) { return DEFAULT_STATE; }
}

function wordCount(s) {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateExportText(state) {
  const propsById = Object.fromEntries(PROPERTIES.map((p) => [p.id, p]));
  const nome = state.candidato.nome || "(não preenchido)";
  const email = state.candidato.email || "(não preenchido)";
  const data = new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
  const L = [];
  L.push("# Desafio Prático · CS Onboarding · Seazone", "");
  L.push("**Candidato:** " + nome);
  L.push("**E-mail:** " + email);
  L.push("**Enviado em:** " + data, "", "---", "");
  L.push("## Tarefa 01 — Priorização da fila", "", "**Ordem de prioridade:**", "");
  state.t1.ordem.forEach((id, i) => {
    const p = propsById[id]; if (!p) return;
    L.push((i + 1) + ". **" + p.code + "** · " + p.city + " · " + p.days + " dias · " + p.stage);
  });
  L.push("", "**Justificativa:**", "");
  L.push(state.t1.justificativa.trim() || "_(não respondido)_");
  L.push("", "---", "");
  L.push("## Tarefa 02 — Comunicação de retenção", "", "**Resposta ao João Mendes (WhatsApp):**", "");
  L.push(state.t2.mensagem.trim() || "_(não respondido)_");
  L.push("", "---", "");
  L.push("## Tarefa 03 — Conflito interno sob pressão", "", "**Mensagem para a Carla (cliente):**", "");
  L.push(state.t3.mensagem_proprietario.trim() || "_(não respondido)_");
  L.push("", "**Mensagem para Operação (interno):**", "");
  L.push(state.t3.mensagem_operacao.trim() || "_(não respondido)_", "");
  return L.join("\n");
}

// ===== TASKS =====
function Task1Priorizacao({ value, onChange }) {
  const ordem = value.ordem;
  const move = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= ordem.length) return;
    const next = ordem.slice();
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange({ ...value, ordem: next });
  };
  const propsById = Object.fromEntries(PROPERTIES.map((p) => [p.id, p]));
  const isComplete = value.justificativa.trim().length > 80;
  return (
    <article className="task">
      <header className="task-header">
        <div className={"task-num" + (isComplete ? " complete" : "")}>01</div>
        <div className="task-header-text">
          <div className="task-eyebrow">Priorização da fila</div>
          <div className="task-title">É sua primeira segunda-feira. Por onde você começa?</div>
        </div>
        <div className="task-time">~15 min</div>
      </header>
      <div className="task-body">
        <p className="scenario-lead">
          Sua coordenadora acabou de te entregar 5 imóveis em implantação e disse:{" "}
          <em>"Todos esses atendimentos precisam acontecer hoje. Me conta como você vai priorizar."</em>{" "}
          O SLA-meta de ativação é <strong>30 dias</strong>; em alta temporada (dez–fev), cada dia parado pesa no bolso do proprietário.
        </p>
        <div className="callout info">
          <strong>Para referência —</strong> a jornada de implantação segue esta ordem:{" "}
          <span style={{ font: "var(--sz-type-subtle-medium)" }}>
            Coleta de chaves → Vistoria → Enxoval → Adequação → Fotografias → Ativação do anúncio
          </span>
        </div>
        <div className="question">
          <div className="q-label">a. Ordene por prioridade</div>
          <div className="q-text">
            Todos os 5 atendimentos precisam acontecer hoje. Use os controles <strong>↑ ↓</strong>{" "}
            para reordenar. A posição 1 é o seu <strong>primeiro atendimento do dia</strong>.
          </div>
          <div className="prop-list">
            {ordem.map((id, idx) => {
              const p = propsById[id];
              const pclass = idx === 0 ? "priority-1" : idx === 1 ? "priority-2" : idx === 2 ? "priority-3" : "";
              return (
                <div className="prop-row" key={id}>
                  <div className={"prop-rank " + pclass}>{idx + 1}</div>
                  <div className="prop-content">
                    <div>
                      <div className="prop-code">{p.code}</div>
                      <div className="prop-city">{p.city}</div>
                    </div>
                    <div>
                      <div className="prop-main">{p.stage}</div>
                      <div className="prop-sub">{p.profile}</div>
                    </div>
                    <div className="prop-meta">
                      <div className="prop-sub"><strong>{p.days} dias</strong> em implantação</div>
                      <div className="prop-sub">Último contato: {p.lastContact}</div>
                    </div>
                  </div>
                  <div className="prop-controls">
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Mover para cima" title="Mover para cima">↑</button>
                    <button onClick={() => move(idx, 1)} disabled={idx === ordem.length - 1} aria-label="Mover para baixo" title="Mover para baixo">↓</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="ranking-legend">
            <span><i style={{ background: "var(--sz-primary)" }}></i>1ª prioridade</span>
            <span><i style={{ background: "var(--sz-blue-300)" }}></i>2ª</span>
            <span><i style={{ background: "var(--sz-blue-100)" }}></i>3ª</span>
          </div>
        </div>
        <div className="question">
          <div className="q-label">b. Justifique o critério</div>
          <div className="q-text">
            Em poucas linhas, qual foi o critério que orientou sua ordenação? Quais imóveis você
            considera <strong>com maior risco de churn</strong> e por quê?
          </div>
          <textarea
            className="answer"
            maxLength={5000}
            placeholder="Ex.: Comecei pelo GAR porque é o de maior risco — proprietário com reclamação aberta e 65 dias sem ativação. Em seguida..."
            value={value.justificativa}
            onChange={(e) => onChange({ ...value, justificativa: e.target.value })}
          />
          <div className="answer-meta">
            <span>{wordCount(value.justificativa)} palavras</span>
            <span>Sugestão: 60–120 palavras</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function Task2Retencao({ value, onChange }) {
  const isComplete = value.mensagem.trim().length > 80;
  return (
    <article className="task">
      <header className="task-header">
        <div className={"task-num" + (isComplete ? " complete" : "")}>02</div>
        <div className="task-header-text">
          <div className="task-eyebrow">Comunicação de retenção</div>
          <div className="task-title">Um proprietário quer desistir. O que você responde?</div>
        </div>
        <div className="task-time">~15 min</div>
      </header>
      <div className="task-body">
        <p className="scenario-lead">
          <strong>João Mendes</strong>, primeira implantação, imóvel em Bombinhas, <strong>38 dias</strong>{" "}
          em onboarding. A única pendência hoje é o <strong>enxoval</strong>: ele ainda não decidiu se
          compra com nosso fornecedor parceiro ou se compra por conta própria. Sem essa decisão,
          não conseguimos avançar para fotos e ativação. Acabou de te mandar isto pelo WhatsApp:
        </p>
        <div className="wa">
          <div className="wa-header">
            <div className="wa-avatar">JM</div>
            <div>
              <div className="wa-name">João Mendes · BLN 0741</div>
              <div className="wa-sub">online agora</div>
            </div>
          </div>
          <div className="wa-bubbles">
            <div className="wa-bubble">Boa tarde. <span className="wa-time">14h22</span></div>
            <div className="wa-bubble">Pessoal, sinceramente não estou aguentando mais essa demora. Já são quase 6 semanas e meu imóvel ainda não está alugando. <span className="wa-time">14h22</span></div>
            <div className="wa-bubble">Estou pensando em desistir e devolver pra imobiliária tradicional que eu trabalhava antes. Lá pelo menos eu sabia o que tava acontecendo. <span className="wa-time">14h23</span></div>
            <div className="wa-bubble">Me retorna por favor. <span className="wa-time">14h23</span></div>
          </div>
        </div>
        <div className="question">
          <div className="q-label">a. Sua resposta</div>
          <div className="q-text">
            Escreva exatamente o que você enviaria agora pelo WhatsApp. Sem rascunho — texto pronto
            pra colar e enviar.
          </div>
          <div className="wa-input-area">
            <textarea
              maxLength={5000}
              placeholder="Olá, João. Obrigada pela sua honestidade — entendo a frustração..."
              value={value.mensagem}
              onChange={(e) => onChange({ ...value, mensagem: e.target.value })}
            />
            <div className="answer-meta">
              <span>{wordCount(value.mensagem)} palavras</span>
              <span>Sugestão: mensagem direta, 60–150 palavras</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function Task3Conflito({ value, onChange }) {
  const isComplete = value.mensagem_proprietario.trim().length > 60 && value.mensagem_operacao.trim().length > 40;
  return (
    <article className="task">
      <header className="task-header">
        <div className={"task-num" + (isComplete ? " complete" : "")}>03</div>
        <div className="task-header-text">
          <div className="task-eyebrow">Conflito interno sob pressão</div>
          <div className="task-title">Duas frentes para destravar ao mesmo tempo.</div>
        </div>
        <div className="task-time">~20 min</div>
      </header>
      <div className="task-body">
        <p className="scenario-lead">
          <strong>Carla Andrade</strong> tem <strong>6 imóveis</strong> em implantação em
          Florianópolis. Perfil exigente, costuma escalar para a gerência. Hoje, 10h12, ela manda:
        </p>
        <div className="wa">
          <div className="wa-header">
            <div className="wa-avatar" style={{ background: "var(--sz-orange-600)" }}>CA</div>
            <div>
              <div className="wa-name">Carla Andrade · 6 unidades</div>
              <div className="wa-sub">digitando…</div>
            </div>
          </div>
          <div className="wa-bubbles">
            <div className="wa-bubble">Bom dia. Preciso de uma atualização HOJE de cada uma das 6 unidades. <span className="wa-time">10h12</span></div>
            <div className="wa-bubble">Só consigo acompanhar por ligação — por texto perco completamente o fio da meada. <span className="wa-time">10h12</span></div>
            <div className="wa-bubble">Me liga assim que puder. Conto com vocês. <span className="wa-time">10h13</span></div>
          </div>
        </div>
        <div className="callout">
          <strong>Contexto interno que ela não sabe:</strong>{" "}
          a ferramenta de chamadas está oscilando há 2 dias. Das 6 unidades:{" "}
          <strong>3 têm pendências da Seazone</strong> (com Operação), <strong>2 dependem dela</strong>{" "}
          (enxoval e documentos), <strong>1 está pronta para ativação</strong>. O time de Operação
          responde mensagens internas só até as 18h.
        </div>
        <div className="channels">
          <div className="channel">
            <div className="channel-head">
              <div className="channel-icon client">CA</div>
              <div className="channel-meta">
                <div className="channel-title">Para a Carla (WhatsApp)</div>
                <div className="channel-sub">Resposta nos próximos 10 minutos</div>
              </div>
              <span className="channel-tag">Cliente</span>
            </div>
            <div className="channel-body">
              <textarea
                maxLength={5000}
                placeholder="Bom dia, Carla. Recebi sua mensagem e..."
                value={value.mensagem_proprietario}
                onChange={(e) => onChange({ ...value, mensagem_proprietario: e.target.value })}
              />
            </div>
          </div>
          <div className="channel">
            <div className="channel-head">
              <div className="channel-icon ops">OP</div>
              <div className="channel-meta">
                <div className="channel-title">Para Operação (chat interno)</div>
                <div className="channel-sub">Como você coleta as informações das 6 unidades dentro da operação</div>
              </div>
              <span className="channel-tag">Interno</span>
            </div>
            <div className="channel-body">
              <textarea
                maxLength={5000}
                placeholder="Pessoal, preciso de status das 6 unidades da Carla. Contexto: ..."
                value={value.mensagem_operacao}
                onChange={(e) => onChange({ ...value, mensagem_operacao: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

// ===== APP =====
function App() {
  const [state, setState] = useState(loadState);
  const [savedAt, setSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    setSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setSavedAt(new Date()); } catch (e) {}
      setSaving(false);
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [state]);

  const setCandidato = (patch) => setState((s) => ({ ...s, candidato: { ...s.candidato, ...patch } }));
  const setT1 = (v) => setState((s) => ({ ...s, t1: v }));
  const setT2 = (v) => setState((s) => ({ ...s, t2: v }));
  const setT3 = (v) => setState((s) => ({ ...s, t3: v }));

  const t1Done = state.t1.justificativa.trim().length > 80;
  const t2Done = state.t2.mensagem.trim().length > 80;
  const t3Done = state.t3.mensagem_proprietario.trim().length > 60 && state.t3.mensagem_operacao.trim().length > 40;
  const candidatoDone = state.candidato.nome.trim().length > 0 && EMAIL_RX.test(state.candidato.email.trim());
  const completedTasks = [t1Done, t2Done, t3Done].filter(Boolean).length;

  const handleClear = () => {
    if (!confirm("Apagar todas as respostas e começar do zero?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setState(DEFAULT_STATE);
  };

  const exportText = generateExportText(state);

  return (
    <>
      <TopBar saving={saving} savedAt={savedAt} completed={completedTasks} total={3} onExport={() => setShowExport(true)} />
      <div className="shell">
        <Intro candidato={state.candidato} onChange={setCandidato} />
        <Task1Priorizacao value={state.t1} onChange={setT1} />
        <Task2Retencao value={state.t2} onChange={setT2} />
        <Task3Conflito value={state.t3} onChange={setT3} />
        <FinishSection
          candidatoDone={candidatoDone} t1Done={t1Done} t2Done={t2Done} t3Done={t3Done}
          onExport={() => setShowExport(true)} onClear={handleClear}
        />
        <Footer onAdmin={() => setShowAdmin(true)} />
      </div>
      {showExport && (
        <ExportModal
          state={state}
          text={exportText}
          candidato={state.candidato}
          canSubmit={candidatoDone}
          onClose={() => setShowExport(false)}
        />
      )}
      {showAdmin && <AdminModal onClose={() => setShowAdmin(false)} />}
    </>
  );
}

function TopBar({ saving, savedAt, completed, total, onExport }) {
  return (
    <div className="topbar">
      <div className="topbar-brand">
        <img src="__LOGO_DATA_URI__" alt="Seazone" />
        <div className="divider"></div>
        <div className="topbar-title">Desafio Prático · CS Onboarding</div>
      </div>
      <div className="topbar-spacer"></div>
      <div className={"save-status" + (saving ? " saving" : "")}>
        <span className="save-dot"></span>
        {saving ? "Salvando…" : savedAt ? "Salvo automaticamente" : "Pronto"}
      </div>
      <div className="progress-pill"><strong>{completed}</strong> de {total} tarefas</div>
      <button className="btn btn-primary" onClick={onExport}>Finalizar &amp; enviar</button>
    </div>
  );
}

function Intro({ candidato, onChange }) {
  return (
    <section className="intro">
      <div className="eyebrow">Processo Seletivo · 2026</div>
      <h1>Desafio Prático para Analista de CS Onboarding</h1>
      <p className="lead">
        Três situações que você encontraria no seu primeiro mês conosco. Não buscamos respostas
        perfeitas — buscamos a sua forma de pensar, priorizar e se comunicar com proprietários.
      </p>
      <div className="meta-chips">
        <span className="meta-chip"><span className="dot"></span>~1 hora</span>
        <span className="meta-chip"><span className="dot"></span>3 tarefas</span>
        <span className="meta-chip"><span className="dot"></span>Salva automaticamente</span>
        <span className="meta-chip"><span className="dot"></span>Sem gabarito único</span>
      </div>
      <div className="cand-form">
        <div className="field">
          <label htmlFor="nome">Seu nome</label>
          <input id="nome" type="text" maxLength={200} placeholder="Como você gostaria de ser chamada(o)" value={candidato.nome} onChange={(e) => onChange({ nome: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="email">E-mail de contato</label>
          <input id="email" type="email" maxLength={320} placeholder="voce@exemplo.com" value={candidato.email} onChange={(e) => onChange({ email: e.target.value })} />
        </div>
      </div>
      <div className="callout info" style={{ marginTop: 24 }}>
        <strong>Antes de começar:</strong> leia as 3 tarefas até o final. Você pode responder na ordem que
        preferir; tudo é salvo automaticamente. Ao terminar, clique em <em>Finalizar &amp; enviar</em>{" "}
        no topo para gerar o resumo e enviá-lo para a Seazone.
      </div>
    </section>
  );
}

function FinishSection({ candidatoDone, t1Done, t2Done, t3Done, onExport, onClear }) {
  const checks = [
    { label: "Identificação preenchida (nome + e-mail)", done: candidatoDone },
    { label: "Tarefa 01 · Priorização da fila",         done: t1Done },
    { label: "Tarefa 02 · Comunicação de retenção",     done: t2Done },
    { label: "Tarefa 03 · Conflito interno sob pressão", done: t3Done },
  ];
  return (
    <section className="finish">
      <h2>Pronto para enviar?</h2>
      <p>
        Revise o que está completo abaixo. Quando estiver satisfeito, clique em{" "}
        <strong>Gerar resumo para envio</strong> — você poderá enviar diretamente para a Seazone,
        copiar o conteúdo ou baixar como arquivo. Tudo o que você digitou continua salvo localmente também.
      </p>
      <div className="checklist">
        {checks.map((c, i) => (
          <div className={"check-row" + (c.done ? " done" : "")} key={i}>
            <div className="check"></div>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
      <div className="finish-actions">
        <button className="btn btn-primary" onClick={onExport}>Gerar resumo para envio</button>
        <button className="btn btn-ghost" onClick={onClear}>Apagar respostas e recomeçar</button>
      </div>
    </section>
  );
}

function Footer({ onAdmin }) {
  return (
    <footer style={{ marginTop: 64, padding: "32px 0 16px", borderTop: "1px solid var(--sz-border-subtle)", textAlign: "center" }}>
      <div className="admin-footer">
        <p style={{ font: "var(--sz-type-detail)", color: "var(--sz-fg-muted)" }}>
          Seazone · Customer Success Onboarding · Documento de processo seletivo
        </p>
        <button className="admin-gear" onClick={onAdmin} aria-label="Área administradora" title="Área administradora">⚙</button>
      </div>
    </footer>
  );
}

// ===== EXPORT MODAL — with Supabase submit =====
function ExportModal({ state, text, candidato, canSubmit, onClose }) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentId, setSentId] = useState(null);
  const [sendError, setSendError] = useState(null);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (e) { alert("Não consegui copiar automaticamente. Selecione e copie o texto manualmente."); }
  };

  const safeFileBase = (candidato.nome || "candidato").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "candidato";

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "desafio-cs-onboarding-" + safeFileBase + ".md";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (!canSubmit) { setSendError("Preencha nome e e-mail antes de enviar."); return; }
    setSending(true); setSendError(null);
    try {
      const { error } = await sb.from("responses").insert({
        candidato_nome: candidato.nome.trim().slice(0, 200),
        candidato_email: candidato.email.trim().slice(0, 320),
        payload: state,
        resumo_md: text.slice(0, 200000),
      });
      if (error) throw error;
      setSentId(true);
    } catch (e) {
      setSendError(e && e.message ? e.message : "Não foi possível enviar. Tente de novo em alguns segundos.");
    } finally { setSending(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{sentId ? "Resposta enviada para a Seazone" : "Resumo para envio"}</h2>
          <button onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="modal-body">
          {sentId ? (
            <div className="admin-success" style={{ marginBottom: 16 }}>
              ✓ Resposta enviada com sucesso. O time de CS da Seazone receberá a notificação.
            </div>
          ) : (
            <>
              <p style={{ font: "var(--sz-type-subtle)", color: "var(--sz-fg-muted)", marginBottom: 12 }}>
                Confira o resumo abaixo. Clique em <strong>Enviar para a Seazone</strong> para registrar
                oficialmente sua resposta. Você também pode <strong>copiar</strong> ou <strong>baixar</strong>{" "}
                como backup pessoal.
              </p>
              {sendError && <div className="admin-error" style={{ marginBottom: 12 }}>{sendError}</div>}
              {!canSubmit && (
                <div className="callout" style={{ marginTop: 0, marginBottom: 12 }}>
                  <strong>Antes de enviar:</strong> preencha seu nome e um e-mail válido na seção de identificação.
                </div>
              )}
            </>
          )}
          <pre>{text}</pre>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Voltar</button>
          <button className="btn" onClick={handleDownload}>Baixar .md</button>
          <button className="btn" onClick={handleCopy}>{copied ? "Copiado ✓" : "Copiar"}</button>
          {!sentId && (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={sending || !canSubmit}>
              {sending ? "Enviando…" : "Enviar para Seazone"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== ADMIN =====
function AdminModal({ onClose }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    sb.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setChecking(false); } });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { if (mounted) setSession(s); });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={"modal" + (session ? " wide" : "")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{session ? "Painel administrativo" : "Entrar na área administradora"}</h2>
          <button onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="modal-body">
          {checking ? <div className="admin-empty">Carregando…</div>
            : session ? <AdminDashboard session={session} />
            : <AdminLogin />}
        </div>
      </div>
    </div>
  );
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    } catch (ex) {
      setErr("Credenciais inválidas.");
    } finally { setBusy(false); }
  };

  return (
    <form className="admin-login-form" onSubmit={submit} autoComplete="off">
      <p style={{ font: "var(--sz-type-subtle)", color: "var(--sz-fg-muted)" }}>
        Acesso restrito ao time de CS da Seazone.
      </p>
      <div>
        <label htmlFor="adm-email">E-mail</label>
        <input id="adm-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={320} />
      </div>
      <div>
        <label htmlFor="adm-pass">Senha</label>
        <input id="adm-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={200} />
      </div>
      {err && <div className="admin-error">{err}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}

function AdminDashboard({ session }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    const { data, error } = await sb.from("responses").select("id, created_at, candidato_nome, candidato_email, payload, resumo_md").order("created_at", { ascending: false });
    if (error) { setErr(error.message); return; }
    setRows(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onDelete = async (id) => {
    if (!confirm("Apagar esta resposta permanentemente?")) return;
    const { error } = await sb.from("responses").delete().eq("id", id);
    if (error) { alert("Falha ao apagar: " + error.message); return; }
    load();
  };

  const onDownload = (row) => {
    const safe = (row.candidato_nome || "candidato").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "candidato";
    const blob = new Blob([row.resumo_md || ""], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "resposta-" + safe + "-" + row.id.slice(0,8) + ".md";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const signOut = async () => { await sb.auth.signOut(); };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ font: "var(--sz-type-subtle)", color: "var(--sz-fg-muted)" }}>
          Logado como <strong>{session.user.email}</strong>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={load}>Atualizar</button>
          <button className="btn btn-ghost" onClick={signOut}>Sair</button>
        </div>
      </div>
      {err && <div className="admin-error" style={{ marginBottom: 12 }}>{err}</div>}
      {rows === null ? (
        <div className="admin-empty">Carregando respostas…</div>
      ) : rows.length === 0 ? (
        <div className="admin-empty">Nenhuma resposta enviada ainda.</div>
      ) : (
        <div className="admin-list">
          {rows.map((r) => (
            <div className="admin-row" key={r.id}>
              <div className="admin-row-meta">
                <div className="admin-row-name">{r.candidato_nome}</div>
                <div className="admin-row-sub">
                  {r.candidato_email} · {new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </div>
              </div>
              <div className="admin-row-actions">
                <button onClick={() => setViewing(r)}>Ver</button>
                <button onClick={() => onDownload(r)}>Baixar</button>
                <button className="danger" onClick={() => onDelete(r.id)}>Apagar</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {viewing && (
        <div className="modal-backdrop" onClick={() => setViewing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{viewing.candidato_nome}</h2>
              <button onClick={() => setViewing(null)} aria-label="Fechar">×</button>
            </div>
            <div className="modal-body">
              <p style={{ font: "var(--sz-type-subtle)", color: "var(--sz-fg-muted)", marginBottom: 12 }}>
                {viewing.candidato_email} · {new Date(viewing.created_at).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
              </p>
              <pre>{viewing.resumo_md}</pre>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setViewing(null)}>Fechar</button>
              <button className="btn btn-primary" onClick={() => onDownload(viewing)}>Baixar .md</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
`;

const finalApp = APP_JS
  .replace('__SUPABASE_URL__', SUPABASE_URL)
  .replace('__SUPABASE_PUBLISHABLE__', SUPABASE_PUBLISHABLE)
  .replace('__LOGO_DATA_URI__', LOGO_DATA_URI);

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Desafio Prático · Analista de CS Onboarding · Seazone</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- CSP: only allow scripts/styles/fonts from approved CDNs + the Supabase API -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src 'self' data:; connect-src https://${new URL(SUPABASE_URL).host}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'">
<meta name="referrer" content="no-referrer">

<style>
${FONTS_IMPORT}
${baseCss}
${EXTRA_CSS}
</style>
</head>
<body>
<div id="root"></div>

<script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script crossorigin src="https://unpkg.com/@babel/standalone@7.24.7/babel.min.js"></script>
<script crossorigin src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>

<script type="text/babel" data-presets="react">
${finalApp}
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('wrote index.html', html.length, 'bytes');
