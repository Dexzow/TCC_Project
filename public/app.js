let isRegisterMode = false;
let currentModuleId = null;

function toggleAuthTab(mode) {
  isRegisterMode = mode === 'register';
  const nameField = document.getElementById('field-name');
  const nameInput = document.getElementById('auth-name');
  const errorEl = document.getElementById('auth-error');

  errorEl.classList.add('hidden');
  nameField.classList.toggle('hidden', !isRegisterMode);
  nameInput.required = isRegisterMode;

  document.getElementById('auth-submit-btn').innerText = isRegisterMode ? 'Criar Conta Grátis' : 'Acessar Manual';
  
  document.getElementById('tab-login').className = !isRegisterMode 
    ? 'w-1/2 py-2 text-sm font-bold rounded-md bg-emerald-500 text-slate-900' 
    : 'w-1/2 py-2 text-sm font-bold rounded-md text-slate-400';
    
  document.getElementById('tab-register').className = isRegisterMode 
    ? 'w-1/2 py-2 text-sm font-bold rounded-md bg-emerald-500 text-slate-900' 
    : 'w-1/2 py-2 text-sm font-bold rounded-md text-slate-400';
}

async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('auth-name').value.trim();
  const errorEl = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit-btn');

  errorEl.classList.add('hidden');

  if (isRegisterMode && !name) {
    errorEl.innerText = 'Por favor, digite seu nome.';
    errorEl.classList.remove('hidden');
    return;
  }

  const endpoint = isRegisterMode ? '/api/register' : '/api/login';
  const payload = isRegisterMode ? { name, email, password } : { email, password };

  submitBtn.disabled = true;
  submitBtn.innerText = 'Processando...';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.innerText = data.error || 'Erro ao autenticar.';
      errorEl.classList.remove('hidden');
    } else {
      await loadDashboard();
    }
  } catch (err) {
    console.error(err);
    errorEl.innerText = 'Erro de conexão com o servidor. Verifique se o Node está rodando.';
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = isRegisterMode ? 'Criar Conta Grátis' : 'Acessar Manual';
  }
}

async function logout() {
  await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  location.reload();
}

async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard', { credentials: 'same-origin' });
    if (!res.ok) return;

    const { user, modules } = await res.json();

    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('user-nav').classList.remove('hidden');

    document.getElementById('nav-username').innerText = user.name;
    document.getElementById('nav-level').innerText = user.level;
    document.getElementById('nav-xp').innerText = user.xp;
    document.getElementById('dash-level').innerText = user.level;

    const xpInCurrentLevel = user.xp % 300;
    document.getElementById('dash-xp-progress').innerText = xpInCurrentLevel;
    document.getElementById('xp-bar').style.width = `${(xpInCurrentLevel / 300) * 100}%`;

    const container = document.getElementById('view-modules');
    container.innerHTML = '';

    modules.forEach(mod => {
      const card = document.createElement('div');
      card.className = `p-5 rounded-2xl border ${mod.completed ? 'bg-slate-800/50 border-emerald-500/40' : 'bg-slate-800 border-slate-700'} flex flex-col justify-between space-y-4`;
      
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `w-full py-2.5 rounded-lg font-bold text-sm transition ${mod.completed ? 'bg-slate-700 text-emerald-400' : 'bg-emerald-500 text-slate-900 hover:bg-emerald-400'}`;
      btn.innerText = mod.completed ? '✓ Revisar Conteúdo' : 'Iniciar Prática';
      btn.onclick = () => openSimulator(mod);

      card.innerHTML = `
        <div>
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs font-bold px-2.5 py-1 rounded bg-slate-900 text-emerald-400">${mod.category}</span>
            <span class="text-xs font-bold text-amber-400">+${mod.xp_reward} XP</span>
          </div>
          <h3 class="text-lg font-bold text-white">${mod.title}</h3>
          <p class="text-slate-400 text-sm mt-1">${mod.description}</p>
        </div>
      `;
      card.appendChild(btn);
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
  }
}

function switchView(view) {
  ['modules', 'chat', 'ranking'].forEach(v => {
    document.getElementById(`view-${v}`).classList.add('hidden');
    document.getElementById(`btn-view-${v}`).className = 'px-4 py-2 rounded-lg font-bold text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 whitespace-nowrap';
  });
  document.getElementById('simulator-area').classList.add('hidden');
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.getElementById(`btn-view-${view}`).className = 'px-4 py-2 rounded-lg font-bold text-sm bg-emerald-500 text-slate-900 whitespace-nowrap';

  if (view === 'ranking') loadRanking();
}

function openSimulator(mod) {
  currentModuleId = mod.id;
  document.getElementById('view-modules').classList.add('hidden');
  const simArea = document.getElementById('simulator-area');
  simArea.classList.remove('hidden');
  document.getElementById('sim-title').innerText = mod.title;

  const content = document.getElementById('sim-content');

  if (mod.content_type === 'holerite') {
    content.innerHTML = `
      <p class="text-slate-300">Clique em cada linha do holerite abaixo para traduzir o que significa na prática:</p>
      <div class="bg-slate-900 p-4 rounded-xl border border-slate-700 font-mono text-xs sm:text-sm space-y-2">
        <div onclick="explainItem('Salário Base: É o valor bruto registrado na sua carteira antes de qualquer desconto.')" class="p-2.5 bg-slate-800 hover:bg-slate-700 rounded cursor-pointer flex justify-between">
          <span>001 - SALÁRIO BASE</span><span class="text-emerald-400">+ R$ 2.500,00</span>
        </div>
        <div onclick="explainItem('INSS (Previdência): Vai para a sua aposentadoria e garante auxílios (doença, maternidade). É descontado direto na fonte.')" class="p-2.5 bg-slate-800 hover:bg-slate-700 rounded cursor-pointer flex justify-between">
          <span>102 - DESCONTO INSS (9%)</span><span class="text-red-400">- R$ 202,00</span>
        </div>
        <div onclick="explainItem('Vale-Transporte: A empresa pode descontar até 6% do seu salário base para custear suas passagens.')" class="p-2.5 bg-slate-800 hover:bg-slate-700 rounded cursor-pointer flex justify-between">
          <span>105 - VALE TRANSPORTE (6%)</span><span class="text-red-400">- R$ 150,00</span>
        </div>
        <div onclick="explainItem('FGTS (8%): NÃO sai do seu salário! É um dinheiro extra que a empresa deposita numa conta sua na Caixa como reserva de emergência.')" class="p-2.5 bg-slate-800 hover:bg-slate-700 rounded cursor-pointer flex justify-between border border-dashed border-amber-500/40">
          <span>999 - DEPÓSITO FGTS (Informativo)</span><span class="text-amber-400">R$ 200,00</span>
        </div>
      </div>
      <div id="holerite-explanation" class="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm">
        👆 Clique em uma linha acima para ver a explicação.
      </div>
    `;
  } else if (mod.content_type === 'curriculo') {
    content.innerHTML = `
      <p class="text-slate-300">Robôs de RH (ATS) rejeitam currículos cheios de gráficos. Preencha abaixo para gerar um texto limpo e otimizado:</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input id="cv-role" placeholder="Cargo desejado (Ex: Jovem Aprendiz ADM)" class="bg-slate-900 border border-slate-700 p-2 rounded text-white">
        <input id="cv-skills" placeholder="3 habilidades (Ex: Excel, Comunicação, Organização)" class="bg-slate-900 border border-slate-700 p-2 rounded text-white">
      </div>
      <button type="button" onclick="generateCV()" class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-xs font-bold">Gerar Resumo Profissional</button>
      <pre id="cv-output" class="bg-slate-900 p-3 rounded-lg text-xs text-emerald-300 whitespace-pre-wrap hidden"></pre>
    `;
  } else {
    content.innerHTML = `
      <div class="bg-slate-900 p-4 rounded-xl space-y-3 text-slate-300 leading-relaxed">
        <p><strong class="text-white">Regra de Ouro:</strong> Nunca assine ou parcele nada sem olhar o <strong>CET (Custo Efetivo Total)</strong>.</p>
        <p>• No cartão de crédito, pagar o mínimo ativa os juros rotativos (os mais altos do mercado, podendo passar de 400% ao ano).</p>
        <p>• Em contratos de aluguel, exija o <strong>Laudo de Vistoria</strong> com fotos antes de pegar as chaves para não pagar por defeitos antigos ao sair.</p>
      </div>
    `;
  }

  document.getElementById('btn-complete-module').onclick = () => completeModule(mod.id);
}

function explainItem(text) {
  document.getElementById('holerite-explanation').innerText = "💡 " + text;
}

function generateCV() {
  const role = document.getElementById('cv-role').value || 'Profissional em início de carreira';
  const skills = document.getElementById('cv-skills').value || 'Proatividade, Pacote Office e Trabalho em Equipe';
  const out = document.getElementById('cv-output');
  out.innerText = `OBJETIVO: ${role.toUpperCase()}\n\nRESUMO PROFISSIONAL:\nProfissional dedicado com foco em resultados e aprendizado rápido. Possuo conhecimentos práticos em ${skills}, buscando contribuir para a eficiência da equipe e crescimento da empresa.`;
  out.classList.remove('hidden');
}

function closeSimulator() {
  document.getElementById('simulator-area').classList.add('hidden');
  document.getElementById('view-modules').classList.remove('hidden');
}

async function completeModule(id) {
  const res = await fetch(`/api/modules/${id}/complete`, { method: 'POST', credentials: 'same-origin' });
  const data = await res.json();
  alert(data.message);
  closeSimulator();
  loadDashboard();
}

async function sendChatMessage(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  const box = document.getElementById('chat-messages');
  box.innerHTML += `<div class="bg-emerald-500 text-slate-900 font-medium p-3 rounded-lg max-w-[85%] ml-auto">${msg}</div>`;
  input.value = '';
  box.scrollTop = box.scrollHeight;

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ message: msg })
  });
  const data = await res.json();

  box.innerHTML += `<div class="bg-slate-700/70 p-3 rounded-lg max-w-[85%] text-slate-200 whitespace-pre-line">${data.reply}</div>`;
  box.scrollTop = box.scrollHeight;
}

async function loadRanking() {
  const res = await fetch('/api/ranking', { credentials: 'same-origin' });
  const users = await res.json();
  const list = document.getElementById('ranking-list');
  list.innerHTML = users.map((u, i) => `
    <div class="flex justify-between items-center p-3 bg-slate-900 rounded-lg border border-slate-700">
      <div class="flex items-center space-x-3">
        <span class="font-black text-emerald-400 w-6">#${i + 1}</span>
        <span class="font-bold text-white">${u.name}</span>
      </div>
      <div class="text-xs font-bold text-slate-400">
        Nível <span class="text-white">${u.level}</span> • <span class="text-emerald-400">${u.xp} XP</span>
      </div>
    </div>
  `).join('');
}

loadDashboard();
