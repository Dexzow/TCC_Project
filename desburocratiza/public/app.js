const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
let csrfToken = null;
let currentUser = null;
let completed = new Set();
let quizIndex = 0, quizScore = 0;

async function api(url, options={}) {
  const headers = { ...(options.headers||{}) };
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (csrfToken && options.method && options.method !== "GET") headers["X-CSRF-Token"] = csrfToken;
  const response = await fetch(url, { credentials:"same-origin", ...options, headers });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}
async function init() {
  try {
    const data = await api("/api/csrf");
    csrfToken = data.csrfToken;
    const me = await api("/api/auth/me");
    currentUser = me.user; csrfToken = me.csrfToken;
    await loadProgress();
  } catch {}
  updateAccountUI();
  const params = new URLSearchParams(location.search);
  if (location.pathname === "/verificar" && params.get("token")) verifyEmail(params.get("token"));
}
function updateAccountUI() {
  $("#accountBtn").textContent = currentUser ? "Sair da conta" : "Entrar / Criar conta";
  $("#topAccount").textContent = currentUser ? currentUser.name[0].toUpperCase() : "?";
}
async function loadProgress() {
  if (!currentUser) return;
  try {
    const data = await api("/api/progress");
    completed = new Set(data.progress.map(x=>x.game_key));
    $("#progressCount").textContent = completed.size;
  } catch {}
}
async function saveProgress(key, score=100) {
  if (!currentUser) return;
  try { await api("/api/progress",{method:"POST",body:JSON.stringify({gameKey:key,score})}); await loadProgress(); } catch {}
}
const modal = $("#modal"), content = $("#modalContent");
function showModal(html) { content.innerHTML=html; modal.classList.add("open"); modal.setAttribute("aria-hidden","false"); }
function closeModal(){modal.classList.remove("open");modal.setAttribute("aria-hidden","true")}
$("#modalClose").addEventListener("click",closeModal);
modal.addEventListener("click",e=>{if(e.target===modal)closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});

function authModal(mode="login") {
  const signup = mode==="register";
  showModal(`<div class="eyebrow muted">SUA JORNADA, SEU PROGRESSO</div><h2>${signup?"Crie sua conta":"Que bom ter você de volta!"}</h2><p>${signup?"Cadastre-se para salvar suas missões e conquistas.":"Entre para continuar de onde parou."}</p>
  <form id="authForm">${signup?'<label>Como podemos te chamar?</label><input name="name" required minlength="2" maxlength="60" placeholder="Seu nome">':''}
  <label>E-mail</label><input name="email" type="email" required maxlength="160" placeholder="voce@email.com">
  <label>Senha</label><input name="password" type="password" required minlength="10" maxlength="128" placeholder="Pelo menos 10 caracteres">
  ${signup?'<small class="form-hint">Sua conta só será liberada depois da confirmação do e-mail.</small>':''}
  <button class="primary-btn" type="submit">${signup?"Criar conta":"Entrar"} ↗</button></form>
  <span class="form-switch" id="authSwitch">${signup?"Já tem conta? Entrar":"Ainda não tem conta? Criar uma"}</span>
  <span class="form-switch" id="resendLink" style="display:block">Precisa de outro link de verificação?</span><div id="authFeedback"></div>`);
  $("#authSwitch").onclick=()=>authModal(signup?"login":"register");
  $("#resendLink").onclick=()=>showModal(`<h2>Reenviar verificação</h2><p>Informe o e-mail usado no cadastro.</p><form id="resendForm"><label>E-mail</label><input name="email" type="email" required><button class="primary-btn">Enviar link</button></form><div id="authFeedback"></div>`);
  $("#authForm").onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target), payload=Object.fromEntries(f.entries());
    try{
      const d=await api(`/api/auth/${signup?"register":"login"}`,{method:"POST",body:JSON.stringify(payload)});
      if(signup){$("#authFeedback").innerHTML=`<div class="notice">${escapeHTML(d.message)}</div>`;e.target.reset();}
      else{currentUser=d.user;csrfToken=d.csrfToken;await loadProgress();updateAccountUI();closeModal();}
    }catch(err){$("#authFeedback").innerHTML=`<div class="notice">${escapeHTML(err.message)}</div>`;}
  };
  const rf=$("#resendLink");
  if(rf) rf.onclick=()=>{showModal(`<h2>Reenviar verificação</h2><p>Informe o e-mail usado no cadastro.</p><form id="resendForm"><label>E-mail</label><input name="email" type="email" required><button class="primary-btn">Enviar link</button></form><div id="authFeedback"></div>`);$("#resendForm").onsubmit=async e=>{e.preventDefault();try{const d=await api("/api/auth/resend",{method:"POST",body:JSON.stringify({email:new FormData(e.target).get("email")})});$("#authFeedback").innerHTML=`<div class="notice">${escapeHTML(d.message)}</div>`}catch(err){$("#authFeedback").textContent=err.message}}};
}
async function verifyEmail(token){
  showModal("<h2>Confirmando seu e-mail...</h2><p>Um instante, estamos validando seu link.</p>");
  try{const d=await api(`/api/auth/verify?token=${encodeURIComponent(token)}`);content.innerHTML=`<h2>Conta desbloqueada! ✨</h2><p>${escapeHTML(d.message)}</p><button class="primary-btn" id="goLogin">Fazer login</button>`;$("#goLogin").onclick=()=>authModal("login");history.replaceState({}, "", "/");}
  catch(e){content.innerHTML=`<h2>Não foi dessa vez</h2><p>${escapeHTML(e.message)}</p><button class="primary-btn" id="retry">Voltar</button>`;$("#retry").onclick=closeModal;}
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("#accountBtn").onclick=()=>currentUser?logout():authModal("login");
$("#topAccount").onclick=()=>currentUser?showModal(`<h2>Olá, ${escapeHTML(currentUser.name)}!</h2><p>${escapeHTML(currentUser.email)}</p><button class="primary-btn" id="logoutBtn">Sair da conta</button>`):authModal("login");
async function logout(){try{await api("/api/auth/logout",{method:"POST",body:"{}"});}catch{}currentUser=null;csrfToken=null;completed.clear();$("#progressCount").textContent="0";updateAccountUI();closeModal();}

const simulators = {
holerite:()=>showModal(`<div class="eyebrow muted">SIMULADOR 01 · TRABALHO</div><h2>Holerite interativo</h2><p>Brinque com um salário fictício e veja como descontos e benefícios aparecem. Os valores são didáticos, não um cálculo oficial de folha.</p><label>Salário bruto (R$)</label><input id="salary" type="number" min="0" max="100000" value="3000" step="100"><label>Desconto ilustrativo de INSS (%)</label><input id="inssRate" type="range" class="range" min="0" max="14" value="9"><div class="result-box"><div>Salário bruto <b id="gross">R$ 3.000,00</b></div><p>INSS ilustrativo: <span id="inss">R$ 270,00</span></p><p>IRRF (não calculado neste exemplo): consulte a tabela vigente.</p><hr><small>Estimativa após o desconto selecionado</small><br><strong id="net">R$ 2.730,00</strong></div><div class="notice">FGTS é depósito feito pelo empregador e, em regra, não é desconto do salário do trabalhador. O cálculo real do INSS é progressivo.</div><button class="primary-btn" id="finish">Entendi! Concluir missão ✓</button>`),
juros:()=>showModal(`<div class="eyebrow muted">SIMULADOR 02 · FINANÇAS</div><h2>Juros do cartão: o efeito bola de neve</h2><p>Veja um exemplo hipotético de saldo que fica no rotativo. A taxa real varia por instituição e período.</p><label>Valor da compra / dívida (R$)</label><input id="debt" type="number" value="500" min="1" max="100000"><label>Juros mensais hipotéticos: <b id="rateText">15%</b></label><input id="rate" type="range" min="1" max="25" value="15" class="range"><label>Meses sem quitar o saldo</label><input id="months" type="range" min="1" max="12" value="6" class="range"><div class="result-box"><small>Saldo estimado ao final</small><br><strong id="debtResult">R$ 1.156,52</strong><p id="debtDetail">R$ 500,00 × (1 + juros)⁶</p></div><div class="notice">Simulação simplificada, sem pagamentos, tarifas ou regras específicas do cartão. Compare o CET e procure alternativas de renegociação.</div><button class="primary-btn" id="finish">Concluir missão ✓</button>`),
ir:()=>{quizIndex=0;quizScore=0;renderIR()},
aluguel:()=>showModal(`<div class="eyebrow muted">SIMULADOR 04 · MORADIA</div><h2>Detetive do contrato</h2><p>Leia as cláusulas fictícias e descubra o que merece sua atenção. Um contrato real deve ser analisado por inteiro.</p><div class="result-box"><b>CLÁUSULA 08 — GARANTIA</b><p>“O locatário entregará ao locador caução em dinheiro equivalente a três meses de aluguel, depositada em caderneta de poupança, conforme legislação aplicável.”</p><b>O que é caução?</b><p>Uma garantia para cobrir obrigações previstas no contrato. A forma, o limite e a devolução precisam respeitar a lei.</p></div><div class="choice-row"><button class="choice" data-contract="ok">Parece uma garantia, vou conferir os detalhes</button><button class="choice" data-contract="alert">Isso é golpe com certeza!</button></div><div id="contractFeedback"></div><button class="primary-btn" id="finish">Concluir missão ✓</button>`),
curriculo:()=>showModal(`<div class="eyebrow muted">SIMULADOR 05 · CARREIRA</div><h2>Seu currículo, sem complicação</h2><p>Preencha os campos. O botão gera uma versão limpa para imprimir ou salvar como PDF.</p><form id="cvForm"><label>Nome completo</label><input name="name" required maxlength="80"><label>E-mail e telefone</label><input name="contact" required maxlength="120" placeholder="email@exemplo.com · (11) 99999-9999"><label>Cidade / Estado</label><input name="city" maxlength="80"><label>Objetivo profissional</label><input name="objective" required maxlength="180" placeholder="Ex.: Jovem aprendiz na área administrativa"><label>Formação</label><textarea name="education" rows="2" maxlength="500"></textarea><label>Experiência, projetos ou habilidades</label><textarea name="experience" rows="3" maxlength="1000"></textarea><button class="primary-btn">Gerar currículo para PDF ↗</button></form><div class="notice">Dica: use palavras verdadeiras da vaga e não invente experiências. Nunca existe garantia de aprovação em ATS.</div>`)
};
function updateSalary(){const gross=Math.max(0,Number($("#salary")?.value)||0),rate=Number($("#inssRate")?.value||0)/100,discount=gross*rate;$("#gross").textContent=brl(gross);$("#inss").textContent=brl(discount);$("#net").textContent=brl(gross-discount)}
function updateDebt(){const principal=Math.max(0,Number($("#debt")?.value)||0),rate=Number($("#rate")?.value||0),months=Number($("#months")?.value||1),total=principal*Math.pow(1+rate/100,months);$("#rateText").textContent=rate+"%";$("#debtResult").textContent=brl(total);$("#debtDetail").textContent=`${brl(principal)} × (1 + ${rate}%)${months}`;}
function brl(n){return Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function finish(key){saveProgress(key);const b=$("#finish");if(b){b.textContent="Missão concluída! ✓";b.disabled=true}}
function renderIR(){
 const qs=[["Você teve renda tributável no ano?","Sim","Não"],["Sua renda anual ultrapassou o limite de obrigatoriedade definido pela Receita para aquele ano?","Sim","Não","Não sei"],["Você teve rendimentos isentos, não tributáveis ou tributados exclusivamente na fonte acima do limite oficial?","Sim","Não","Não sei"],["Você possuía bens ou direitos acima do limite de obrigatoriedade em 31 de dezembro?","Sim","Não","Não sei"],["Você realizou operações ou se enquadra em alguma outra hipótese prevista pela Receita?","Sim","Não","Não sei"]];
 const q=qs[quizIndex];showModal(`<div class="eyebrow muted">SIMULADOR 03 · IMPOSTOS · PERGUNTA ${quizIndex+1}/5</div><h2>Imposto de Renda sem juridiquês</h2><div class="question">${q[0]}</div><div class="choice-row">${q.slice(1).map(v=>`<button class="choice" data-ir="${escapeHTML(v)}">${escapeHTML(v)}</button>`).join("")}</div><div class="notice">A obrigatoriedade depende dos critérios oficiais do ano-calendário. Este roteiro é educativo e não substitui a consulta às regras da Receita Federal.</div><div id="irFeedback"></div>`);
 $$("[data-ir]").forEach(btn=>btn.onclick=()=>{const answer=btn.dataset.ir;if(answer==="Sim")quizScore++;quizIndex++;if(quizIndex<5)renderIR();else showModal(`<div class="eyebrow muted">RESULTADO DO SEU ROTEIRO</div><h2>Você concluiu a triagem!</h2><div class="result-box"><strong>${quizScore}/5</strong><p>respostas “Sim” identificadas.</p></div><p>Isso não determina se você precisa declarar. Confira os critérios e limites do exercício correspondente no site oficial da Receita Federal. Se ficou em dúvida, procure orientação qualificada.</p><button class="primary-btn" id="finish">Concluir atividade ✓</button>`);});
 $("#finish")?.addEventListener("click",()=>finish("ir"));
}
function openSimulator(key){if(!simulators[key])return;simulators[key]();if(key==="holerite"){setTimeout(()=>{$("#salary").oninput=updateSalary;$("#inssRate").oninput=updateSalary;updateSalary();$("#finish").onclick=()=>finish(key)},0)}if(key==="juros"){setTimeout(()=>{$$("#debt,#rate,#months").forEach(el=>el.oninput=updateDebt);updateDebt();$("#finish").onclick=()=>finish(key)},0)}if(key==="aluguel"){setTimeout(()=>{$$("[data-contract]").forEach(b=>b.onclick=()=>{$("#contractFeedback").innerHTML=`<div class="notice">${b.dataset.contract==="ok"?"Boa! Caução é uma modalidade de garantia prevista em lei, mas confira valor, depósito, condições e devolução.":"Não dá para afirmar que é golpe só por esse trecho. Verifique a lei, o contrato completo, a identificação das partes e desconfie de pressão ou pagamentos sem comprovante."}</div>`});$("#finish").onclick=()=>finish(key)},0)}if(key==="curriculo"){setTimeout(()=>$("#cvForm").onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const w=window.open("","_blank");if(!w){alert("Permita pop-ups para gerar o currículo.");return}w.document.write(`<!doctype html><html><head><title>Currículo - ${escapeHTML(d.name)}</title><style>body{font:14px Arial;color:#182b42;max-width:780px;margin:50px auto;line-height:1.5}h1{font-size:26px;border-bottom:2px solid #183b67;padding-bottom:12px}h2{font-size:14px;text-transform:uppercase;margin-top:25px;color:#183b67}p{white-space:pre-wrap}</style></head><body><h1>${escapeHTML(d.name)}</h1><p>${escapeHTML(d.contact)} · ${escapeHTML(d.city)}</p><h2>Objetivo</h2><p>${escapeHTML(d.objective)}</p><h2>Formação</h2><p>${escapeHTML(d.education)}</p><h2>Experiência, projetos e habilidades</h2><p>${escapeHTML(d.experience)}</p><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();saveProgress("curriculo")},0)}}
$$("[data-open]").forEach(b=>b.addEventListener("click",()=>openSimulator(b.dataset.open)));
$$("[data-jump]").forEach(b=>b.addEventListener("click",()=>openSimulator(b.dataset.jump)));
$$("[data-game]").forEach(b=>b.addEventListener("click",()=>startGame(b.dataset.game)));
function startGame(type){const games={
mitos:{title:"Verdade ou cilada?",key:"mitos",q:[["FGTS é descontado do salário do trabalhador.","Cilada","Verdade",1],["O banco deve informar as tarifas dos serviços contratados.","Verdade","Cilada",0],["Pagar só o mínimo do cartão pode gerar juros sobre o saldo.","Verdade","Cilada",0],["Você deve entregar sua senha bancária para conseguir um emprego.","Cilada","Verdade",0],["Um currículo deve conter informações verdadeiras.","Verdade","Cilada",0]]},
holeriteQuiz:{title:"Detetive do holerite",key:"holeriteQuiz",q:[["O FGTS é normalmente depositado por quem?","Empregador","Trabalhador",0],["O salário líquido é...","O valor após descontos","O valor antes dos descontos",0],["Hora extra deve observar regras legais e/ou coletivas.","Verdadeiro","Falso",0]]},
orcamento:{title:"Orçamento relâmpago",key:"orcamento",q:[["Sobrou R$ 200 no mês. Qual escolha protege melhor seu orçamento?","Guardar parte para imprevistos","Gastar tudo porque sobrou",0],["Uma compra parcelada cabe no bolso só porque a parcela é pequena?","Não, avalie o custo total","Sim, sempre",0],["Você não reconhece uma cobrança. O que fazer?","Conferir e contestar nos canais oficiais","Ignorar para não se estressar",0]]}};
 const g=games[type];quizIndex=0;quizScore=0;renderGameQuestion(g);}
function renderGameQuestion(g){const q=g.q[quizIndex];showModal(`<div class="eyebrow muted">MINI GAME · RODADA ${quizIndex+1}/${g.q.length}</div><h2>${g.title}</h2><div class="question">${q[0]}</div><button class="answer" data-answer="0">${q[1]}</button><button class="answer" data-answer="1">${q[2]}</button><div id="gameFeedback"></div>`);$$("[data-answer]").forEach(b=>b.onclick=()=>{const correct=Number(b.dataset.answer)===q[3];if(correct)quizScore++;$("#gameFeedback").innerHTML=`<div class="notice">${correct?"Mandou bem! ✦":"Quase! Aprender também é errar e tentar de novo."}</div><button class="primary-btn" id="nextQuestion">${quizIndex===g.q.length-1?"Ver resultado":"Próxima pergunta"} →</button>`;$$("[data-answer]").forEach(x=>x.disabled=true);$("#nextQuestion").onclick=()=>{quizIndex++;if(quizIndex<g.q.length)renderGameQuestion(g);else{showModal(`<div class="eyebrow muted">FIM DE JOGO</div><h2>Você fez ${quizScore} de ${g.q.length} pontos!</h2><p>${quizScore===g.q.length?"Perfeito! Frederico está orgulhoso.":"Boa tentativa! Revise os temas e jogue de novo."}</p><button class="primary-btn" id="gameDone">Salvar progresso ✓</button>`);$("#gameDone").onclick=()=>{finish(g.key);closeModal()}}}});
}
const guides={
banco:["Como abrir conta no banco sem cair em taxa","1. Compare contas e tarifas antes de aceitar um pacote. 2. Pergunte sobre serviços essenciais gratuitos e quais operações podem ser cobradas. 3. Leia o contrato e confira o quadro de tarifas no site do banco. 4. Não compartilhe senha ou código recebido por SMS. 5. Se aparecer uma cobrança que você não reconhece, conteste pelos canais oficiais e guarde o protocolo.","As regras de serviços essenciais e tarifas podem mudar. Consulte o Banco Central e a tabela oficial da instituição."],
spc:["Seu nome foi para o SPC. E agora?","1. Consulte seu CPF nos canais oficiais de proteção ao crédito. 2. Confira se a dívida é sua e se o valor está correto. 3. Se não reconhecer, conteste e guarde os protocolos. 4. Se a dívida for legítima, compare propostas e o valor total antes de fechar acordo. 5. Guarde o comprovante de pagamento e acompanhe a atualização do cadastro.","Não pague links recebidos por mensagens suspeitas. Acesse os canais digitando o endereço oficial."],
demissao:["Como pedir demissão sem se enrolar","1. Confira seu contrato e converse com a empresa de forma profissional. 2. Formalize o pedido por escrito e guarde uma cópia. 3. Entenda o aviso prévio e como ele afeta as verbas rescisórias. 4. Confira o termo de rescisão, saldo de salário, férias e 13º proporcionais, conforme o caso. 5. Tire dúvidas antes de assinar documentos que não entendeu.","Os efeitos variam conforme contrato, modalidade de desligamento e regras aplicáveis. Procure sindicato ou orientação trabalhista se necessário."]
};
$$("[data-guide]").forEach(b=>b.onclick=()=>{const g=guides[b.dataset.guide];showModal(`<div class="eyebrow muted">GUIA DE BOLSO · 1 MINUTO</div><h2>${g[0]}</h2><div class="result-box"><p>${g[1].replace(/\n/g,"<br>")}</p></div><div class="notice">${g[2]}</div><button class="primary-btn" id="guideDone">Entendi ✓</button>`);$("#guideDone").onclick=closeModal});

const chatPanel=$("#chatPanel");
$("#chatFab").onclick=()=>{chatPanel.hidden=!chatPanel.hidden;if(!chatPanel.hidden&&!currentUser){chatPanel.hidden=true;authModal("login");}};
$("#chatClose").onclick=()=>chatPanel.hidden=true;
$("#chatForm").onsubmit=async e=>{e.preventDefault();const input=$("#chatInput"),message=input.value.trim();if(!message)return;if(!currentUser){authModal("login");return}addChat(message,"user");input.value="";const wait=addChat("Deixa eu consultar meus bigodes...","bot");try{const d=await api("/api/chat",{method:"POST",body:JSON.stringify({message})});wait.textContent=d.reply}catch(err){wait.textContent=err.message}};
function addChat(text,who){const div=document.createElement("div");div.className=`chat-bubble ${who}`;div.textContent=text;$("#chatMessages").append(div);$("#chatMessages").scrollTop=$("#chatMessages").scrollHeight;return div}
init();
