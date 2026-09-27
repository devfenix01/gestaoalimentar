// =======================================================
// SIGAE | Aplicação Client-Side com SSE e Proteção JWT
// =======================================================

let appState = null;
let authToken = localStorage.getItem('sigae_token') || null;
let currentUser = null;
let sseConnection = null;
let html5QrCodeScanner = null;
let currentFichaMatricula = null;

document.addEventListener('DOMContentLoaded', () => {
  verificarSessao();
});

// Conexão em tempo real Server-Sent Events (SSE)
function conectarSSE() {
  if (sseConnection) {
    try { sseConnection.close(); } catch {}
  }

  const tokenParam = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
  sseConnection = new EventSource(`/api/stream${tokenParam}`);

  sseConnection.onopen = () => {
    atualizarIndicadorStatus(true, 'Sincronizado');
  };

  sseConnection.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'INIT' || data.type === 'STATE_UPDATE') {
        appState = data.state;
        renderizarTudo();
      }
    } catch (err) {
      console.error('Erro SSE:', err);
    }
  };

  sseConnection.onerror = () => {
    atualizarIndicadorStatus(false, 'Reconectando...');
  };
}

async function dispararAcaoSegura(action, payload = {}) {
  if (!authToken) {
    showToast('Sessão expirada. Faça login novamente.', 'error');
    handleLogout();
    return null;
  }

  try {
    const res = await fetch('/api/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ action, payload })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na operação.');
    return data;
  } catch (err) {
    showToast(err.message, 'error');
    return null;
  }
}

function atualizarIndicadorStatus(online, texto) {
  const dot = document.getElementById('sync-status-dot');
  const txt = document.getElementById('sync-status-text');
  if (dot && txt) {
    dot.className = online ? 'w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' : 'w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping';
    txt.textContent = texto;
  }
}

// Controle de Login e Perfil
let perfilSelecionadoLogin = 'estudante';

function setLoginProfile(p) {
  perfilSelecionadoLogin = p;
  const btnAluno = document.getElementById('btn-login-aluno');
  const btnGestor = document.getElementById('btn-login-gestor');
  const title = document.getElementById('login-title');
  const lblUser = document.getElementById('lbl-login-user');
  const inputUser = document.getElementById('login-input-user');

  if (p === 'estudante') {
    btnAluno.className = 'flex-1 py-1.5 text-center text-xs font-bold rounded bg-white shadow-sm text-gray-800 flex items-center justify-center gap-1.5';
    btnGestor.className = 'flex-1 py-1.5 text-center text-xs font-semibold text-gray-500 flex items-center justify-center gap-1.5 hover:text-gray-800';
    title.textContent = 'Entrar como estudante';
    lblUser.textContent = 'Matrícula / Usuário';
    inputUser.placeholder = 'Ex: 202510704213';
  } else {
    btnGestor.className = 'flex-1 py-1.5 text-center text-xs font-bold rounded bg-white shadow-sm text-gray-800 flex items-center justify-center gap-1.5';
    btnAluno.className = 'flex-1 py-1.5 text-center text-xs font-semibold text-gray-500 flex items-center justify-center gap-1.5 hover:text-gray-800';
    title.textContent = 'Entrar como gestor';
    lblUser.textContent = 'Usuário Gestor';
    inputUser.placeholder = 'Ex: admin';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const userIdentifier = document.getElementById('login-input-user').value.trim();
  const senha = document.getElementById('login-input-pass').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIdentifier, senha, perfil: perfilSelecionadoLogin })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao autenticar.');

    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('sigae_token', authToken);
    localStorage.setItem('sigae_user', JSON.stringify(currentUser));

    conectarSSE();
    iniciarAplicacao();
    showToast(`Bem-vindo(a), ${currentUser.nome}!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function verificarSessao() {
  const savedUser = localStorage.getItem('sigae_user');
  if (authToken && savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      conectarSSE();
      iniciarAplicacao();
      return;
    } catch {
      handleLogout();
    }
  }
}

function handleLogout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('sigae_token');
  localStorage.removeItem('sigae_user');
  document.getElementById('screen-app').classList.add('hidden');
  document.getElementById('screen-login').classList.remove('hidden');
  if (html5QrCodeScanner) {
    try { html5QrCodeScanner.clear(); } catch {}
  }
  if (sseConnection) {
    try { sseConnection.close(); } catch {}
  }
  showToast('Sessão finalizada com sucesso.', 'info');
}

function togglePasswordVisibility() {
  const input = document.getElementById('login-input-pass');
  const icon = document.getElementById('btn-toggle-pass');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-regular fa-eye-slash absolute right-3 top-2.5 text-gray-400 text-xs cursor-pointer';
  } else {
    input.type = 'password';
    icon.className = 'fa-regular fa-eye absolute right-3 top-2.5 text-gray-400 text-xs cursor-pointer';
  }
}

function iniciarAplicacao() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');

  document.getElementById('lbl-user-name').textContent = currentUser.nome;
  document.getElementById('lbl-user-role').textContent = currentUser.perfil === 'gestor' ? 'Gestor' : 'Estudante';
  document.getElementById('lbl-user-avatar').textContent = currentUser.nome.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

  const adminEls = document.querySelectorAll('.admin-only');
  const alunoEls = document.querySelectorAll('.estudante-only');

  if (currentUser.perfil === 'gestor') {
    adminEls.forEach(el => el.classList.remove('hidden'));
    alunoEls.forEach(el => el.classList.add('hidden'));
    switchTab('tab-painel');
  } else {
    adminEls.forEach(el => el.classList.add('hidden'));
    alunoEls.forEach(el => el.classList.remove('hidden'));
    switchTab('tab-alimentacao');
  }
  renderizarTudo();
}

function switchTab(id) {
  document.querySelectorAll('.tab-content').forEach(tc => {
    tc.classList.remove('active', 'block');
    tc.classList.add('hidden');
  });
  document.querySelectorAll('nav button').forEach(btn => {
    btn.classList.remove('active', 'border-b-2', 'border-emerald-700', 'text-emerald-800');
  });

  const tab = document.getElementById(id);
  const navBtn = document.getElementById(`nav-${id}`);
  if (tab) {
    tab.classList.remove('hidden');
    tab.classList.add('active', 'block');
  }
  if (navBtn) {
    navBtn.classList.add('active', 'border-b-2', 'border-emerald-700', 'text-emerald-800');
  }
}

function renderizarTudo() {
  if (!appState) return;
  renderCardapio();
  renderMural();
  carregarParametros();

  if (currentUser) {
    if (currentUser.perfil === 'gestor') {
      renderPainelContadores();
      renderTabelaReservas();
      renderTabelaEstudantes();
      renderHistoricoAcessos();
      renderLiberacoes();
    } else {
      renderBotoesAgendamentoSemana();
      verificarQuestionario();
    }
  }
}

function renderCardapio() {
  const c = appState.cardapio;
  if (!c) return;
  document.getElementById('cardapio-prato').textContent = c.prato;
  document.getElementById('cardapio-acompanhamento').textContent = c.acompanhamento;
  document.getElementById('cardapio-salada').textContent = c.salada;
  document.getElementById('cardapio-sobremesa').textContent = c.sobremesa;
  document.getElementById('cardapio-lanche-tarde').textContent = c.lancheTarde;
  document.getElementById('cardapio-lanche-noite').textContent = c.lancheNoite;

  if (currentUser?.perfil === 'gestor') {
    document.getElementById('edt-cardapio-prato').value = c.prato;
    document.getElementById('edt-cardapio-acompanhamento').value = c.acompanhamento;
    document.getElementById('edt-cardapio-salada').value = c.salada;
    document.getElementById('edt-cardapio-sobremesa').value = c.sobremesa;
    document.getElementById('edt-cardapio-lanche-tarde').value = c.lancheTarde;
    document.getElementById('edt-cardapio-lanche-noite').value = c.lancheNoite;
  }
}

async function handleSalvarCardapio(e) {
  e.preventDefault();
  const payload = {
    prato: document.getElementById('edt-cardapio-prato').value,
    acompanhamento: document.getElementById('edt-cardapio-acompanhamento').value,
    salada: document.getElementById('edt-cardapio-salada').value,
    sobremesa: document.getElementById('edt-cardapio-sobremesa').value,
    lancheTarde: document.getElementById('edt-cardapio-lanche-tarde').value,
    lancheNoite: document.getElementById('edt-cardapio-lanche-noite').value
  };
  const res = await dispararAcaoSegura('ATUALIZAR_CARDAPIO', payload);
  if (res) showToast('Cardápio atualizado e sincronizado!', 'success');
}

function carregarParametros() {
  const p = appState.parametros;
  if (!p) return;
  document.getElementById('param-campus').value = p.campus;
  document.getElementById('param-capacidade').value = p.capacidade;
  document.getElementById('param-limite-reserva').value = p.limiteReserva;
  document.getElementById('param-limite-cancelar').value = p.limiteCancelar;
  document.getElementById('param-abertura').value = p.abertura;
  document.getElementById('param-fechamento').value = p.fechamento;
  document.getElementById('param-msg-aut').value = p.msgAut;
  document.getElementById('param-msg-sem').value = p.msgSem;
  document.getElementById('param-msg-reg').value = p.msgReg;

  document.getElementById('lbl-abertura').textContent = p.abertura;
  document.getElementById('lbl-fechamento').textContent = p.fechamento;
}

async function handleSalvarParametros(e) {
  e.preventDefault();
  const payload = {
    campus: document.getElementById('param-campus').value,
    capacidade: document.getElementById('param-capacidade').value,
    limiteReserva: document.getElementById('param-limite-reserva').value,
    limiteCancelar: document.getElementById('param-limite-cancelar').value,
    abertura: document.getElementById('param-abertura').value,
    fechamento: document.getElementById('param-fechamento').value,
    msgAut: document.getElementById('param-msg-aut').value,
    msgSem: document.getElementById('param-msg-sem').value,
    msgReg: document.getElementById('param-msg-reg').value
  };
  const res = await dispararAcaoSegura('ATUALIZAR_PARAMETROS', payload);
  if (res) showToast('Parâmetros gravados com sucesso!', 'success');
}

function renderBotoesAgendamentoSemana() {
  if (!currentUser || currentUser.perfil !== 'estudante') return;

  const hoje = new Date();
  const diaSemana = hoje.getDay();
  const nomes = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

  for (let i = 1; i <= 5; i++) {
    const btn = document.getElementById(`btn-week-${i}`);
    if (!btn) continue;
    const diff = i - diaSemana;
    const d = new Date();
    d.setDate(hoje.getDate() + diff);
    const dataIso = d.toISOString().split('T')[0];

    const temReserva = (appState.reservas || []).some(r => r.matricula === currentUser.matricula && r.data === dataIso && r.situacao === 'Ativa');
    if (temReserva) {
      btn.className = 'p-3 border-2 border-emerald-600 bg-emerald-50 rounded-lg text-center font-bold text-emerald-800 transition text-xs shadow-sm';
      btn.innerHTML = `<span>${nomes[i]}</span><span class="block text-[10px] text-emerald-600 mt-1"><i class="fa-solid fa-check"></i> Reservado</span>`;
    } else {
      btn.className = 'p-3 border border-gray-200 bg-white rounded-lg text-center hover:bg-emerald-50 transition text-xs font-bold text-gray-700';
      btn.innerHTML = `<span>${nomes[i]}</span><span class="block text-[10px] text-gray-400 mt-1">Disponível</span>`;
    }
  }
}

async function toggleAgendamentoDia(index) {
  const hoje = new Date();
  const diff = index - hoje.getDay();
  const d = new Date();
  d.setDate(hoje.getDate() + diff);
  const dataIso = d.toISOString().split('T')[0];

  const res = await dispararAcaoSegura('TOGGLE_RESERVA', { data: dataIso });
  if (res) showToast('Reserva atualizada com sucesso!', 'success');
}

function renderMural() {
  const container = document.getElementById('container-mural-doacoes');
  if (!container) return;
  const hojeIso = new Date().toISOString().split('T')[0];
  const vagas = (appState.mural || []).filter(m => m.data === hojeIso && m.status === 'Disponivel');

  if (vagas.length === 0) {
    container.innerHTML = `<p class="text-xs text-gray-400 italic py-3 text-center">Nenhuma vaga solidária no mural hoje.</p>`;
    return;
  }

  container.innerHTML = vagas.map(v => `
    <div class="flex items-center justify-between border border-pink-200 bg-pink-50 p-3 rounded-lg text-xs">
      <div>
        <span class="font-bold text-gray-800">Doação (${v.cursoDoador})</span>
        <p class="text-[10px] text-gray-500">${new Date(v.dataCriacao).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
      </div>
      <button onclick="resgatarVagaMural('${v.id}')" class="bg-pink-600 hover:bg-pink-700 text-white font-bold px-3 py-1.5 rounded shadow">
        Resgatar
      </button>
    </div>
  `).join('');
}

async function doarMinhaReservaHoje() {
  const hojeIso = new Date().toISOString().split('T')[0];
  const res = await dispararAcaoSegura('DOAR_MURAL', { data: hojeIso });
  if (res) showToast('Refeição doada ao mural!', 'success');
}

async function resgatarVagaMural(muralId) {
  const hojeIso = new Date().toISOString().split('T')[0];
  const res = await dispararAcaoSegura('RESGATAR_MURAL', { muralId, data: hojeIso });
  if (res) showToast('Vaga do mural resgatada com sucesso!', 'success');
}

function abrirQRCodeEstudanteLogado() {
  if (!currentUser) return;
  const hojeIso = new Date().toISOString().split('T')[0];

  document.getElementById('qr-modal-nome').textContent = currentUser.nome;
  document.getElementById('qr-modal-mat').textContent = currentUser.matricula;
  document.getElementById('qr-modal-data').textContent = `Validade: ${hojeIso}`;

  const container = document.getElementById('qrcode-container');
  container.innerHTML = '';

  new QRCode(container, {
    text: JSON.stringify({ matricula: currentUser.matricula, data: hojeIso }),
    width: 180,
    height: 180,
    colorDark: '#064e3b',
    colorLight: '#ffffff'
  });

  document.getElementById('modal-qrcode').classList.remove('hidden');
  document.getElementById('modal-qrcode').classList.add('flex');
}

function toggleModalQRCode(mostrar) {
  document.getElementById('modal-qrcode').classList.toggle('hidden', !mostrar);
  document.getElementById('modal-qrcode').classList.toggle('flex', mostrar);
}

function baixarQRCode() {
  const img = document.querySelector('#qrcode-container img');
  if (!img) return;
  const a = document.createElement('a');
  a.href = img.src;
  a.download = `QRCode-${currentUser.matricula}.png`;
  a.click();
}

function abrirModalTablet() {
  document.getElementById('modal-tablet').classList.remove('hidden');
  document.getElementById('modal-tablet').classList.add('flex');

  setTimeout(() => {
    try {
      if (!html5QrCodeScanner) html5QrCodeScanner = new Html5Qrcode('reader');
      html5QrCodeScanner.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          try {
            const p = JSON.parse(decodedText);
            if (p.matricula) processarLeitura(p.matricula);
          } catch {
            processarLeitura(decodedText.trim());
          }
        },
        () => {}
      ).catch(() => {
        showToast('Não foi possível iniciar a câmera.', 'error');
      });
    } catch {}
  }, 300);
}

function fecharModalTablet() {
  if (html5QrCodeScanner) {
    try { html5QrCodeScanner.stop().then(() => html5QrCodeScanner.clear()).catch(() => {}); } catch {}
  }
  document.getElementById('modal-tablet').classList.add('hidden');
  document.getElementById('modal-tablet').classList.remove('flex');
}

async function processarLeitura(matricula) {
  if (!matricula) return;
  fecharModalTablet();

  const hojeIso = new Date().toISOString().split('T')[0];
  const res = await dispararAcaoSegura('VALIDAR_ENTRADA_REFEITORIO', { matricula, data: hojeIso });
  if (!res) return;

  const modalRes = document.getElementById('modal-resultado-refeitorio');
  const icon = document.getElementById('res-icon');
  const title = document.getElementById('res-title');
  const student = document.getElementById('res-student');
  const msg = document.getElementById('res-msg');
  const alertBox = document.getElementById('res-health-alert');

  modalRes.className = 'fixed inset-0 flex items-center justify-center p-6 z-50';
  alertBox.classList.add('hidden');
  student.textContent = res.estudante.nome || matricula;

  if (res.resultado === 'Autorizado') {
    modalRes.classList.add('bg-emerald-950/95');
    icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    title.textContent = 'AUTORIZADO';
    msg.textContent = appState.parametros.msgAut;
    if (res.estudante.restricao && res.estudante.restricao !== 'Nenhuma') {
      alertBox.classList.remove('hidden');
      document.getElementById('res-health-text').textContent = `Restrição: ${res.estudante.restricao}`;
    }
  } else if (res.resultado === 'JaRegistrado') {
    modalRes.classList.add('bg-amber-950/95');
    icon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    title.textContent = 'JÁ REGISTRADO';
    msg.textContent = appState.parametros.msgReg;
  } else {
    modalRes.classList.add('bg-red-950/95');
    icon.innerHTML = '<i class="fa-solid fa-ban"></i>';
    title.textContent = 'BARRADO / SEM RESERVA';
    msg.textContent = appState.parametros.msgSem;
  }
}

function fecharResultadoRefeitorio() {
  document.getElementById('modal-resultado-refeitorio').className = 'fixed inset-0 hidden items-center justify-center p-6 z-50';
}

function renderPainelContadores() {
  const hoje = new Date().toISOString().split('T')[0];
  const reservasHoje = (appState.reservas || []).filter(r => r.data === hoje);
  const ativas = reservasHoje.filter(r => r.situacao === 'Ativa').length;
  const servidas = reservasHoje.filter(r => r.situacao === 'Servida').length;
  const canceladas = reservasHoje.filter(r => r.situacao === 'Cancelada').length;
  const acessosHoje = (appState.acessos || []).filter(a => a.data.startsWith(hoje));
  const barrados = acessosHoje.filter(a => a.resultado === 'Barrado' || a.resultado === 'Bloqueado').length;
  const comLiberacao = acessosHoje.filter(a => a.tipoAcesso === 'LiberacaoExcepcional').length;

  document.getElementById('cnt-reservas-ativas').textContent = ativas;
  document.getElementById('cnt-refeicoes-servidas').textContent = servidas;
  document.getElementById('cnt-com-liberacao').textContent = comLiberacao;
  document.getElementById('cnt-reservas-sem-entrada').textContent = ativas;
  document.getElementById('cnt-sem-reserva').textContent = barrados;
  document.getElementById('cnt-cancelamentos').textContent = canceladas;
  document.getElementById('cnt-presentes').textContent = servidas + comLiberacao;
  document.getElementById('cnt-total-hoje').textContent = ativas + servidas;
  document.getElementById('lbl-data-hoje').textContent = new Date().toLocaleDateString('pt-BR');
}

function renderTabelaReservas() {
  const tbody = document.getElementById('tbl-reservas');
  if (!tbody) return;
  const lista = appState.reservas || [];

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 italic">Nenhuma reserva cadastrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(r => `
    <tr class="hover:bg-gray-50">
      <td class="p-3">${r.data}</td>
      <td class="p-3 font-mono font-bold text-emerald-800">${r.matricula}</td>
      <td class="p-3 font-semibold">${r.nome}</td>
      <td class="p-3">${r.curso}</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${r.situacao === 'Ativa' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}">${r.situacao}</span></td>
      <td class="p-3 text-center"><i class="fa-solid fa-shield-halved text-emerald-700"></i></td>
    </tr>
  `).join('');
}

function renderTabelaEstudantes() {
  const tbody = document.getElementById('tbl-estudantes');
  if (!tbody) return;
  const lista = appState.estudantes || [];

  tbody.innerHTML = lista.map(e => `
    <tr class="hover:bg-gray-50">
      <td class="p-3 font-mono font-bold text-emerald-800">${e.matricula}</td>
      <td class="p-3 font-semibold">${e.nome}</td>
      <td class="p-3">${e.curso}</td>
      <td class="p-3">${e.restricao}</td>
      <td class="p-3 font-bold text-emerald-700">100%</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${e.bloqueado ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}">${e.bloqueado ? 'Bloqueado' : 'Ativo'}</span></td>
      <td class="p-3 text-center flex items-center justify-center gap-2">
        <button onclick="abrirFichaAluno('${e.matricula}')" class="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded" title="Ficha do Estudante"><i class="fa-solid fa-id-card"></i></button>
        ${e.bloqueado ? `<button onclick="desbloquearEstudante('${e.matricula}')" class="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-1 rounded">Desbloquear</button>` : ''}
        <button onclick="excluirEstudante('${e.matricula}')" class="text-xs bg-red-50 hover:bg-red-100 text-red-700 font-bold px-2 py-1 rounded" title="Excluir"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    </tr>
  `).join('');
}

function abrirFichaAluno(matricula) {
  const est = (appState.estudantes || []).find(e => e.matricula === matricula);
  if (!est) return;

  currentFichaMatricula = matricula;
  document.getElementById('ficha-nome').textContent = est.nome;
  document.getElementById('ficha-mat').textContent = est.matricula;
  document.getElementById('ficha-curso').textContent = est.curso;
  document.getElementById('ficha-restricao').textContent = est.restricao;
  document.getElementById('ficha-assiduidade').textContent = '100%';

  const quest = (appState.questionarios_secure || []).find(q => q.matricula === matricula);
  const questStatus = document.getElementById('ficha-questionario-status');
  const questConteudo = document.getElementById('ficha-quest-conteudo');
  const questData = document.getElementById('ficha-quest-data');

  if (quest) {
    questStatus.textContent = 'Respondido';
    questStatus.className = 'font-bold text-xs text-emerald-700';
    questData.textContent = new Date(quest.dataEnvio).toLocaleString('pt-BR');
    try {
      const dec = JSON.parse(decodeURIComponent(atob(quest.payloadCriptografado)));
      questConteudo.innerHTML = Object.entries(dec).map(([k, v]) => `
        <div class="py-1"><span class="font-bold text-gray-700">${k}:</span> <span>${Array.isArray(v) ? v.join(', ') : v}</span></div>
      `).join('');
    } catch {
      questConteudo.innerHTML = `<span class="text-red-500">Erro ao decodificar respostas.</span>`;
    }
  } else {
    questStatus.textContent = 'Pendente';
    questStatus.className = 'font-bold text-xs text-amber-600';
    questData.textContent = '';
    questConteudo.innerHTML = `<span class="text-gray-400 italic">Questionário ainda não preenchido.</span>`;
  }

  const boxBloq = document.getElementById('ficha-box-bloqueio');
  if (boxBloq) boxBloq.classList.toggle('hidden', !est.bloqueado);

  const tblAcessos = document.getElementById('ficha-tbl-acessos');
  const logs = (appState.acessos || []).filter(a => a.matricula === matricula).slice(0, 5);
  tblAcessos.innerHTML = logs.length ? logs.map(a => `
    <tr><td class="p-2">${new Date(a.data).toLocaleString('pt-BR')}</td><td class="p-2 font-bold ${a.resultado === 'Autorizado' ? 'text-emerald-700' : 'text-red-600'}">${a.resultado}</td></tr>
  `).join('') : `<tr><td colspan="2" class="p-2 text-center text-gray-400 italic">Nenhum acesso registrado.</td></tr>`;

  toggleModalFichaAluno(true);
}

function toggleModalFichaAluno(mostrar) {
  const m = document.getElementById('modal-ficha-aluno');
  m.classList.toggle('hidden', !mostrar);
  m.classList.toggle('flex', mostrar);
}

async function desbloquearEstudanteGestor() {
  if (!currentFichaMatricula) return;
  await desbloquearEstudante(currentFichaMatricula);
  toggleModalFichaAluno(false);
}

async function excluirEstudante(matricula) {
  if (!confirm(`Confirma a exclusão definitiva do estudante ${matricula}?`)) return;
  const res = await dispararAcaoSegura('EXCLUIR_ESTUDANTE', { matricula });
  if (res) showToast('Estudante excluído com sucesso.', 'info');
}

async function desbloquearEstudante(matricula) {
  const res = await dispararAcaoSegura('DESBLOQUEAR_ESTUDANTE', { matricula });
  if (res) showToast('Estudante desbloqueado com sucesso!', 'success');
}

function renderHistoricoAcessos() {
  const tbody = document.getElementById('tbl-acessos');
  if (!tbody) return;
  const lista = appState.acessos || [];

  tbody.innerHTML = lista.map(a => `
    <tr class="hover:bg-gray-50">
      <td class="p-3">${new Date(a.data).toLocaleString('pt-BR')}</td>
      <td class="p-3 font-semibold">${a.estudante}</td>
      <td class="p-3 font-mono">${a.matricula}</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${a.resultado === 'Autorizado' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}">${a.resultado}</span></td>
      <td class="p-3 text-center"><i class="fa-solid fa-lock text-gray-400"></i></td>
    </tr>
  `).join('');
}

function renderLiberacoes() {
  const tbody = document.getElementById('tbl-liberacoes');
  if (!tbody) return;
  const lista = appState.liberacoes || [];

  tbody.innerHTML = lista.map(l => `
    <tr class="hover:bg-gray-50">
      <td class="p-3">${l.data}</td>
      <td class="p-3">${l.tipo}</td>
      <td class="p-3 font-mono">${l.matricula}</td>
      <td class="p-3 font-semibold">${l.nome}</td>
      <td class="p-3">${l.motivo}</td>
      <td class="p-3 text-center"><i class="fa-solid fa-check text-emerald-700"></i></td>
    </tr>
  `).join('');
}

async function handleSalvarLiberacao(e) {
  e.preventDefault();
  const payload = {
    tipo: document.getElementById('lib-tipo').value,
    matricula: document.getElementById('lib-matricula').value.trim() || 'Visitante',
    nome: document.getElementById('lib-nome').value.trim(),
    motivo: document.getElementById('lib-motivo').value.trim()
  };
  const res = await dispararAcaoSegura('SALVAR_LIBERACAO', payload);
  if (res) {
    showToast('Liberação concedida com sucesso!', 'success');
    e.target.reset();
  }
}

function verificarQuestionario() {
  const respondido = (appState.questionarios_secure || []).some(q => q.matricula === currentUser.matricula);
  const b = document.getElementById('quest-status-badge');
  if (!b) return;
  b.textContent = respondido ? 'Respondido' : 'Pendente';
  b.className = respondido ? 'bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded' : 'bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded';
}

async function handleSalvarQuestionario(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  data['q3_dias'] = Array.from(document.querySelectorAll('input[name="q3"]:checked')).map(c => c.value);
  data['q16_comentario'] = document.getElementById('q16-text').value;

  const payloadCriptografado = btoa(encodeURIComponent(JSON.stringify(data)));
  const res = await dispararAcaoSegura('SALVAR_QUESTIONARIO', { payloadCriptografado });
  if (res) {
    showToast('Questionário criptografado com sucesso!', 'success');
    verificarQuestionario();
  }
}

// Modal Primeiro Acesso
function toggleModalPrimeiroAcesso(m) {
  document.getElementById('modal-primeiro-acesso').classList.toggle('hidden', !m);
  document.getElementById('modal-primeiro-acesso').classList.toggle('flex', m);
}

function alternarCamposPrimeiroAcesso() {
  const tipo = document.getElementById('pa-tipo').value;
  const isGestor = tipo === 'gestor';
  
  document.getElementById('box-pa-curso').classList.toggle('hidden', isGestor);
  document.getElementById('box-pa-restricao').classList.toggle('hidden', isGestor);
  
  const lblUser = document.getElementById('lbl-pa-user');
  const inputUser = document.getElementById('pa-user');
  
  if (isGestor) {
    lblUser.textContent = 'Nome de Usuário / Identificador';
    inputUser.placeholder = 'Ex: gestor.alimentos';
  } else {
    lblUser.textContent = 'Matrícula (12 dígitos)';
    inputUser.placeholder = 'Ex: 202510704213';
  }
}

async function handleCadastrarPrimeiroAcesso(e) {
  e.preventDefault();
  const tipo = document.getElementById('pa-tipo').value;
  const user = document.getElementById('pa-user').value.trim();
  const nome = document.getElementById('pa-nome').value.trim();
  const pass = document.getElementById('pa-pass').value;
  const curso = document.getElementById('pa-curso').value;
  const restricao = document.getElementById('pa-restricao').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tipo, 
        user, 
        nome, 
        senha: pass, 
        curso: tipo === 'estudante' ? curso : 'Administração', 
        restricao: tipo === 'estudante' ? restricao : 'Nenhuma' 
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao criar conta.');

    showToast(data.message || 'Conta criada com sucesso! Faça login.', 'success');
    toggleModalPrimeiroAcesso(false);
    e.target.reset();

    setLoginProfile(tipo);
    document.getElementById('login-input-user').value = user;
    document.getElementById('login-input-pass').value = '';
    document.getElementById('login-input-pass').focus();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function toggleModalEstudante(m) {
  document.getElementById('modal-estudante').classList.toggle('hidden', !m);
  document.getElementById('modal-estudante').classList.toggle('flex', m);
}

async function handleCadastrarEstudante(e) {
  e.preventDefault();
  const payload = {
    matricula: document.getElementById('new-estudante-mat').value.trim(),
    nome: document.getElementById('new-estudante-nome').value.trim(),
    curso: document.getElementById('new-estudante-curso').value,
    restricao: document.getElementById('new-estudante-restricao').value,
    senha: document.getElementById('new-estudante-pass').value
  };

  const res = await dispararAcaoSegura('CADASTRAR_ESTUDANTE', payload);
  if (res) {
    showToast('Estudante cadastrado com sucesso!', 'success');
    toggleModalEstudante(false);
    e.target.reset();
  }
}

async function limparColecaoDados(colecao, label) {
  if (!confirm(`Confirma a exclusão de [${label}]?`)) return;
  const res = await dispararAcaoSegura('LIMPAR_COLECAO', { colecao });
  if (res) showToast(`${label} limpo com sucesso.`, 'info');
}

function exportCSV(tipo) {
  let csv = "data:text/csv;charset=utf-8,";
  if (tipo === 'reservas') {
    csv += "Data,Matricula,Estudante,Curso,Situacao\r\n";
    (appState.reservas || []).forEach(r => csv += `"${r.data}","${r.matricula}","${r.nome}","${r.curso}","${r.situacao}"\r\n`);
  } else if (tipo === 'acessos') {
    csv += "DataHora,Matricula,Estudante,Resultado\r\n";
    (appState.acessos || []).forEach(a => csv += `"${a.data}","${a.matricula}","${a.estudante}","${a.resultado}"\r\n`);
  }
  const a = document.createElement("a");
  a.href = encodeURI(csv);
  a.download = `sigae-${tipo}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

function toggleDarkMode() {
  document.body.classList.toggle('bg-gray-900');
  document.body.classList.toggle('text-gray-100');
}

function showToast(msg, tipo = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  const cores = { success: 'bg-emerald-800 text-white', error: 'bg-red-800 text-white', info: 'bg-slate-800 text-white' };
  t.className = `${cores[tipo]} px-4 py-3 rounded-lg shadow-xl text-xs font-semibold flex items-center justify-between gap-3 pointer-events-auto transition-all duration-300 translate-y-2 opacity-0`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.classList.remove('translate-y-2', 'opacity-0'), 10);
  setTimeout(() => {
    t.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => t.remove(), 300);
  }, 4000);
}