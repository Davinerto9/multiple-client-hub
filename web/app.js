const BASE = 'http://localhost:3000/api';

// === STATE ===
const state = { me:null, active:null, users:[], groups:[], pollId:null };

// === helpers ===
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// 🔧 Refs globales para que showLogin / enterApp los vean
let loginView, appView, meLabel, userList, groupList, chatTitle, chatType, messages, debugOut, inputMsg;

window.addEventListener('DOMContentLoaded', init);

function init() {
  // asignación aquí
  loginView = $('#loginView');
  appView   = $('#appView');
  meLabel   = $('#me');
  userList  = $('#userList');
  groupList = $('#groupList');
  chatTitle = $('#chatTitle');
  chatType  = $('#chatType');
  messages  = $('#messages');
  debugOut  = $('#debugOut');
  inputMsg  = $('#messageInput');

  const saved = localStorage.getItem('chat.me');
  if (saved) { state.me = saved; enterApp(); } else showLogin();

  $('#loginBtn')   && ($('#loginBtn').onclick   = onLogin);
  $('#logoutBtn')  && ($('#logoutBtn').onclick  = onLogout);
  $('#newGroupBtn')&& ($('#newGroupBtn').onclick= onCreateGroup);
  $('#addUserBtn') && ($('#addUserBtn').onclick = () => addUser($('#addUserInput').value.trim()));
  $('#addGroupBtn')&& ($('#addGroupBtn').onclick= () => addGroup($('#addGroupInput').value.trim()));
  $('#sendBtn')    && ($('#sendBtn').onclick    = sendMessage);
  $('#historyBtn') && ($('#historyBtn').onclick = () => fetchHistory(true));
  if (inputMsg) inputMsg.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

  console.log('UI lista ✅');
}

function showLogin(){
  loginView.classList.remove('hidden');
  appView.classList.add('hidden');
  $('#loginName').focus();
}

function enterApp(){
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  meLabel.textContent = state.me;
  if(state.users.length===0) addUser('daniel');
  if(state.groups.length===0) addGroup('general');
  selectFirstIfNone(); // asegúrate de tener definida esta función
}

function onLogin(){
  const name = $('#loginName').value.trim();
  if(!name) return;
  state.me = name;
  localStorage.setItem('chat.me', name);
  enterApp();
}

function onLogout(){
  localStorage.removeItem('chat.me');
  clearInterval(state.pollId);
  state.pollId = null;
  state.active = null;
  messages.innerHTML = '';
  showLogin();
}

// === LISTAS LATERALES ===
function addUser(name){
  if(!name || state.users.includes(name)) return;
  state.users.push(name);
  renderUsers();
}

function addGroup(name){
  if(!name || state.groups.includes(name)) return;
  state.groups.push(name);
  renderGroups();
}

function renderUsers(){
  userList.innerHTML = '';
  state.users.forEach(u=>{
    const li = document.createElement('li');
    li.innerHTML = `👤 <span>${u}</span>`;
    li.onclick = ()=>selectChat('user', u);
    if(state.active && state.active.type==='user' && state.active.id===u) li.classList.add('active');
    userList.appendChild(li);
  });
}

function renderGroups(){
  groupList.innerHTML = '';
  state.groups.forEach(g=>{
    const li = document.createElement('li');
    li.innerHTML = `👥 <span>${g}</span>`;
    li.onclick = ()=>selectChat('group', g);
    if(state.active && state.active.type==='group' && state.active.id===g) li.classList.add('active');
    groupList.appendChild(li);
  });
}

function selectFirstIfNone(){
  if(!state.active){
    if(state.groups.length) selectChat('group', state.groups[0]);
    else if(state.users.length) selectChat('user', state.users[0]);
  }
}

// === SELECCIÓN DE CHAT ===
function selectChat(type, id){
  state.active = { type, id };
  chatTitle.textContent = id;
  chatType.textContent = type==='group' ? 'Group Chat' : 'Direct Message';
  renderUsers();
  renderGroups();
  messages.innerHTML = '';
  fetchHistory();
  // polling cada 2s
  clearInterval(state.pollId);
  state.pollId = setInterval(fetchHistory, 2000);
}

// === MENSAJERÍA ===
async function sendMessage(){
  if(!state.active || !state.me) return;
  const text = inputMsg.value.trim();
  if(!text) return;

  try{
    let res;
    if(state.active.type==='user'){
      res = await post('/send-user', { from:state.me, to:state.active.id, message:text });
    }else{
      res = await post('/send-group', { from:state.me, group:state.active.id, message:text });
    }
    debug(`SEND → ${JSON.stringify(res)}`);
    inputMsg.value = '';
    // optimista: agrega mi burbuja
    pushBubble({sender:state.me, text, ts:new Date().toISOString()});
    // forzar refresh de historial para ver la respuesta/eco
    fetchHistory();
  }catch(e){
    debug('ERROR send: '+e.message);
  }
}

async function onCreateGroup(){
  const name = prompt('Nombre del grupo:');
  if(!name) return;
  try{
    const resp = await post('/create-group', { creator:state.me, groupName:name.trim() });
    addGroup(name.trim());
    debug(`create-group → ${JSON.stringify(resp)}`);
  }catch(e){ debug('ERROR create-group: '+e.message); }
}

// === HISTORIAL ===
async function fetchHistory(forceScroll){
  if(!state.active) return;
  try{
    let data;
    if(state.active.type==='user'){
      const q = `?u1=${encodeURIComponent(state.me)}&u2=${encodeURIComponent(state.active.id)}`;
      data = await get('/history-user'+q);
    }else{
      const q = `?group=${encodeURIComponent(state.active.id)}`;
      data = await get('/history-group'+q);
    }
    renderHistoryArray(Array.isArray(data)?data:[]);
    if(forceScroll) messages.scrollTop = messages.scrollHeight;
  }catch(e){
    debug('ERROR history: '+e.message);
  }
}

function renderHistoryArray(lines){
  messages.innerHTML = '';
  lines.forEach(line=>{
    const parsed = parseLine(line);
    if(!parsed) return;
    pushBubble(parsed);
  });
}

function pushBubble({sender, text, ts}){
  const me = (sender||'').toLowerCase() === (state.me||'').toLowerCase();
  const el = document.createElement('div');
  el.className = 'bubble'+(me?' me':'');
  const time = ts ? fmtTime(ts) : fmtTime(new Date().toISOString());
  el.innerHTML = `<div class="meta">${sender} · ${time}</div><div class="text"></div>`;
  el.querySelector('.text').textContent = text;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
}

// Historial de archivos/DB trae líneas como:
// "[2025-11-08 14:28:55] daniel en unos: hola"
// "[2025-11-08 14:25:00] david -> daniel: hola"
function parseLine(line){
  // timestamp
  const tsMatch = line.match(/^\[([^\]]+)\]\s+(.*)$/);
  if(!tsMatch) return null;
  const ts = tsMatch[1];
  const rest = tsMatch[2];

  // privado: "A -> B: msg"
  let m = rest.match(/^(\S+)\s*->\s*(\S+):\s*(.+)$/);
  if(m){
    const sender = m[1], text = m[3];
    return { sender, text, ts };
  }
  // grupo: "A en G: msg"
  m = rest.match(/^(\S+)\s+en\s+(\S+):\s*(.+)$/);
  if(m){
    const sender = m[1], text = m[3];
    return { sender, text, ts };
  }
  return null;
}

function fmtTime(ts){
  const d = new Date(ts.replace(' ','T'));
  return d.toLocaleTimeString();
}

// === HTTP helpers ===
async function get(path){
  const r = await fetch(BASE+path);
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}
async function post(path, body){
  const r = await fetch(BASE+path, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body||{})
  });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

function debug(s){
  debugOut.classList.remove('hidden');
  debugOut.textContent = (s+'\n'+debugOut.textContent).slice(0,8000);
}
