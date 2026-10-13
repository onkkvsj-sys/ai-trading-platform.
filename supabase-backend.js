/* Apex Terminal backend: Supabase Auth + persistent customer data.
   Publishable key only; never put service-role keys in browser code. */
(() => {
  const SUPABASE_URL = 'https://jyztynjxivznjqnncyev.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_z-pgfGJznQXBIW-po2b5aw_SOLca91R';
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  let user = null;
  let profile = null;
  let cloudReady = false;
  let loadingCloud = false;
  const originalLog = log;
  const originalSave = save;
  const originalRenderFunding = renderFunding;
  const originalRenderMessages = renderMessages;
  const originalRenderAll = renderAll;
  const statusLine = (msg, bad=false) => {
    const el = document.getElementById('authStatus');
    if (el) { el.textContent = msg || ''; el.style.color = bad ? '#ffb7c2' : '#91a1b7'; }
  };
  const safe = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const css = document.createElement('style');
  css.textContent = `
    #authGate{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(ellipse at 70% 0%,#17334a 0,transparent 50%),#08111f}
    #authCard{width:min(440px,100%);background:linear-gradient(145deg,#132132,#0c1725);border:1px solid #2a4054;border-radius:22px;padding:26px;box-shadow:0 24px 80px #0008}
    #authCard input{width:100%;background:#081421;border:1px solid #2a3b50;border-radius:10px;padding:12px;color:#edf4fb;outline:none}
    #authCard input:focus{border-color:#43e0b0}
    #authGate .authSwitch{border:1px solid #2c4057;border-radius:10px;padding:10px 12px;flex:1;font-size:13px}
    #authGate .authSwitch.active{background:#1b3442;color:#7fe8c8;border-color:#3b6b68}
    #authGate .authSubmit{background:linear-gradient(120deg,#24bd91,#43e0b0);color:#05251e;border:0;border-radius:10px;padding:12px;width:100%;font-weight:800}
  `;
  document.head.appendChild(css);
  const gate = document.createElement('div');
  gate.id = 'authGate';
  gate.innerHTML = `
    <div id="authCard">
      <div class="flex items-center gap-3 mb-6"><div class="w-11 h-11 rounded-xl flex items-center justify-center font-black text-[#06251e]" style="background:linear-gradient(140deg,#43e0b0,#7cbaff)">A</div><div><div class="font-bold tracking-wide">APEX <span class="green">TERMINAL</span></div><div class="muted text-[10px] tracking-widest mt-1">PRIVATE MARKETS WORKSPACE</div></div></div>
      <h1 id="authTitle" class="text-2xl font-bold">Welcome back</h1>
      <p id="authDescription" class="muted text-sm mt-2 mb-5">Sign in to access your private workspace.</p>
      <div class="flex gap-2 mb-5"><button id="authLoginTab" class="authSwitch active" type="button">Sign in</button><button id="authSignupTab" class="authSwitch" type="button">Create account</button></div>
      <form id="authForm" class="space-y-4">
        <div id="authNameWrap" class="hidden"><label class="muted text-xs block mb-2">Display name</label><input id="authName" autocomplete="name" maxlength="80" placeholder="Your name"></div>
        <div id="authEmailWrap"><label class="muted text-xs block mb-2">Email address</label><input id="authEmail" type="email" autocomplete="email" required placeholder="you@example.com"></div>
        <div><label class="muted text-xs block mb-2">Password</label><input id="authPassword" type="password" autocomplete="current-password" required minlength="8" placeholder="At least 8 characters"></div>
        <button id="authSubmit" class="authSubmit" type="submit">Sign in securely</button>
      </form>
      <button id="authReset" class="muted text-xs underline mt-4" type="button">Forgot password?</button>
      <p id="authStatus" class="muted text-xs leading-relaxed mt-4" aria-live="polite"></p>
      <p class="muted text-[11px] leading-relaxed mt-5">Market orders in this workspace are simulated. Never share your password or bank details in messages.</p>
    </div>`;
  document.body.appendChild(gate);
  document.getElementById('layout').classList.add('hidden');
  let authMode = 'login';
  function setAuthMode(mode) {
    authMode = mode;
    const recovery = mode === 'recovery';
    document.getElementById('authLoginTab').classList.toggle('hidden', recovery);
    document.getElementById('authSignupTab').classList.toggle('hidden', recovery);
    document.getElementById('authEmailWrap').classList.toggle('hidden', recovery);
    document.getElementById('authEmail').required = !recovery;
    document.getElementById('authLoginTab').classList.toggle('active', mode === 'login');
    document.getElementById('authSignupTab').classList.toggle('active', mode === 'signup');
    document.getElementById('authNameWrap').classList.toggle('hidden', mode !== 'signup');
    document.getElementById('authTitle').textContent = recovery ? 'Set a new password' : mode === 'login' ? 'Welcome back' : 'Create your account';
    document.getElementById('authDescription').textContent = recovery ? 'Choose a new password for your account.' : mode === 'login' ? 'Sign in to access your private workspace.' : 'Create a private customer account.';
    document.getElementById('authSubmit').textContent = recovery ? 'Update password' : mode === 'login' ? 'Sign in securely' : 'Create account';
    document.getElementById('authReset').classList.toggle('hidden', mode !== 'login');
    document.getElementById('authPassword').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    document.getElementById('authPassword').placeholder = recovery ? 'Enter a new password' : 'At least 8 characters';
    statusLine('');
  }
  document.getElementById('authLoginTab').onclick = () => setAuthMode('login');
  document.getElementById('authSignupTab').onclick = () => setAuthMode('signup');
  document.getElementById('authForm').onsubmit = async e => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const display_name = document.getElementById('authName').value.trim();
    const submit = document.getElementById('authSubmit');
    submit.disabled = true; submit.textContent = 'Please wait…'; statusLine('');
    try {
      if (authMode === 'recovery') {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        statusLine('Password updated. Sign in with your new password.');
        await client.auth.signOut();
        setAuthMode('login');
      } else if (authMode === 'signup') {
        const { data, error } = await client.auth.signUp({ email, password, options: { data: { display_name }, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (data.session) await activate(data.session.user);
        else statusLine('Account created. Check your email to confirm it, then return here to sign in.');
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await activate(data.user);
      }
    } catch (err) { statusLine(err.message || 'Could not complete sign-in.', true); }
    finally { submit.disabled = false; submit.textContent = authMode === 'recovery' ? 'Update password' : authMode === 'login' ? 'Sign in securely' : 'Create account'; }
  };
  document.getElementById('authReset').onclick = async () => {
    const email = document.getElementById('authEmail').value.trim();
    if (!email) return statusLine('Enter your email address first.', true);
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    statusLine(error ? error.message : 'If this email is registered, a password-reset link has been sent.');
  };
  function toastSafe(msg) { if (typeof toast === 'function') toast(msg); }
  async function activate(nextUser) {
    user = nextUser;
    if (!user) return;
    statusLine('Loading your private account…');
    const { data: found, error: profileErr } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (profileErr) throw profileErr;
    if (found) profile = found;
    else {
      const { data: created, error } = await client.from('profiles').insert({ id: user.id, display_name: user.user_metadata?.display_name || '', role: 'customer' }).select('*').single();
      if (error) throw error;
      profile = created;
    }
    state.role = profile.role === 'admin' ? 'admin' : 'customer';
    document.getElementById('roleBtn').textContent = 'Account: ' + state.role;
    document.getElementById('roleBtn').disabled = true;
    if (!document.getElementById('signOutBtn')) {
      const signOut = document.createElement('button');
      signOut.id = 'signOutBtn'; signOut.className = 'btn'; signOut.textContent = 'Sign out';
      signOut.onclick = async () => { signOut.disabled = true; await client.auth.signOut(); location.reload(); };
      document.querySelector('.header-right').insertBefore(signOut, document.querySelector('.header-right').lastElementChild);
    }
    document.getElementById('switchCustomer').classList.add('hidden');
    document.getElementById('switchAdmin').classList.add('hidden');
    document.getElementById('resetPreview').classList.add('hidden');
    document.getElementById('authGate').classList.add('hidden');
    document.getElementById('layout').classList.remove('hidden');
    cloudReady = true;
    await loadCloud();
    // Keep the workspaces separate after every authenticated login.
    document.querySelectorAll('.customer-only').forEach(el => el.classList.toggle('hidden', state.role === 'admin'));
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', state.role !== 'admin'));
    go(state.role === 'admin' ? 'admin' : 'overview');
    renderAll();
    statusLine('');
  }
  async function loadCloud() {
    if (!user || loadingCloud) return;
    loadingCloud = true;
    try {
      const [giftRes, requestsRes, messagesRes, ordersRes, activityRes, profilesRes] = await Promise.all([
        client.from('app_settings').select('value').eq('key','welcome_gift').maybeSingle(),
        client.from('topup_requests').select('*').order('created_at',{ascending:true}),
        client.from('messages').select('*').order('created_at',{ascending:true}),
        client.from('simulated_orders').select('*').order('created_at',{ascending:true}),
        client.from('activity_events').select('*').order('created_at',{ascending:false}).limit(300),
        client.from('profiles').select('id,display_name,role,created_at')
      ]);
      for (const r of [giftRes,requestsRes,messagesRes,ordersRes,activityRes,profilesRes]) if (r.error) throw r.error;
      if (giftRes.data?.value) state.gift = giftRes.data.value;
      state.requests = (requestsRes.data || []).map(r => ({id:r.id,amount:Number(r.amount),note:r.note,time:r.created_at,status:r.status[0].toUpperCase()+r.status.slice(1),reviewedAt:r.reviewed_at}));
      state.customers = (profilesRes.data || []).map(p => ({id:p.id,display_name:p.display_name || '',role:p.role || 'customer',created_at:p.created_at || ''}));
      const profMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id,p.display_name || '']));
      state.messages = await Promise.all((messagesRes.data || []).map(async m => {
        let data = '';
        if (m.attachment_path) {
          const { data: signed } = await client.storage.from('chat-attachments').createSignedUrl(m.attachment_path, 3600);
          data = signed?.signedUrl || '';
        }
        return {id:m.id,conversation:m.conversation_owner_id,sender:m.sender_id===user.id?state.role:(state.role==='admin'?'customer':'admin'),text:m.body||'',data,type:m.attachment_mime||'',name:m.attachment_name||'',time:m.created_at};
      }));
      const owners = [...new Set((messagesRes.data || []).map(m => m.conversation_owner_id))];
      state.conversations = state.role === 'admin'
        ? owners.map(id => ({id,title:profMap[id] || 'Customer '+id.slice(0,8),createdAt:''}))
        : [{id:user.id,title:'Support conversation',createdAt:''}];
      if (state.role === 'admin' && !state.activeConversation && state.conversations.length) state.activeConversation = state.conversations[0].id;
      if (state.role === 'customer') state.activeConversation = user.id;
      state.orders = (ordersRes.data || []).map(o => ({id:o.id,asset:o.asset_id,symbol:({bitcoin:'BTC',ethereum:'ETH',solana:'SOL',ripple:'XRP',binancecoin:'BNB'})[o.asset_id] || o.asset_id.toUpperCase(),side:o.side,amount:Number(o.notional_usd),price:Number(o.reference_price),time:o.created_at,status:o.status==='closed'?'Closed':o.status==='cancelled'?'Cancelled':'Open',realizedPnl:Number(o.realized_pnl)||0}));
      state.realizedPnl = state.orders.filter(o=>o.status==='Closed').reduce((s,o)=>s+o.realizedPnl,0);
      state.activity = (activityRes.data || []).map(a=>({id:a.id,time:a.created_at,type:a.event_type,detail:a.details?.detail||'',amount:a.details?.amount||''}));
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch (err) {
      console.error('Cloud load failed', err);
      toastSafe('Some account data could not load. Check Supabase policies and connection.');
    } finally {
      loadingCloud = false;
      renderAll();
    }
  }
  log = function(type, detail, amount='') {
    originalLog(type, detail, amount);
    if (cloudReady && user) {
      client.from('activity_events').insert({user_id:user.id,actor_id:user.id,event_type:type,details:{detail,amount}})
        .then(({error})=>{if(error)console.error('Activity save failed',error)});
    }
  };
  async function reloadAndToast(message) {
    await loadCloud();
    renderAll();
    if (message) toastSafe(message);
  }
  function renderCustomers() {
    const target = document.getElementById('adminCustomers');
    if (!target) return;
    if (state.role !== 'admin') { target.innerHTML = ''; return; }
    const rows = state.customers || [];
    target.innerHTML = rows.length ? rows.map(c => `
      <form class="table-row py-4 flex flex-wrap items-end gap-3" data-customer-form="${safe(c.id)}">
        <div class="flex-1 min-w-[180px]">
          <label class="muted text-xs block mb-2">Display name</label>
          <input class="field" name="display_name" maxlength="80" value="${safe(c.display_name)}" placeholder="Customer name">
          <div class="muted text-[10px] mt-2 break-all">Account ID: ${safe(c.id)} · Role: ${safe(c.role)}</div>
        </div>
        <button class="btn btn-primary" type="submit">Save customer</button>
      </form>`).join('') : '<div class="muted py-5">No customer accounts found.</div>';
    target.querySelectorAll('[data-customer-form]').forEach(form => form.onsubmit = async e => {
      e.preventDefault();
      if (state.role !== 'admin' || !user) return toastSafe('Administrator access required.');
      const id = form.dataset.customerForm;
      const display_name = String(new FormData(form).get('display_name') || '').trim().slice(0,80);
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      const { error } = await client.from('profiles').update({display_name,updated_at:new Date().toISOString()}).eq('id',id);
      button.disabled = false;
      if (error) return toastSafe('Customer profile update failed: '+error.message);
      log('Customer profile updated','Display name updated for account '+id.slice(0,8));
      await reloadAndToast('Customer display name saved.');
    });
  }
  renderAll = function() { originalRenderAll(); renderCustomers(); };
  // The top-up request is stored in the database and remains pending until an admin reviews it.
  document.getElementById('topupForm').onsubmit = async e => {
    e.preventDefault();
    const amount = Number(document.getElementById('topupAmount').value);
    const note = document.getElementById('topupNote').value.trim();
    if (!user || !Number.isFinite(amount) || amount <= 0) return toastSafe('Enter a valid amount and sign in.');
    const { error } = await client.from('topup_requests').insert({user_id:user.id,amount,currency:'USD',note,status:'pending'});
    if (error) return toastSafe('Request could not be saved: '+error.message);
    log('Top-up requested', money(amount)+' · pending administrator review', money(amount));
    document.getElementById('topupForm').reset();
    await reloadAndToast('Top-up request saved. No funds were moved.');
  };
  // Review updates request status only. It never credits a balance or claims payment was verified.
  reviewRequest = async function(id, status) {
    if (state.role !== 'admin') return toastSafe('Administrator access required.');
    const statusValue = status.toLowerCase();
    const { error } = await client.from('topup_requests').update({status:statusValue,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq('id',id).eq('status','pending');
    if (error) return toastSafe('Request review failed: '+error.message);
    log('Top-up request '+statusValue, 'Request status updated; no funds were moved.');
    await reloadAndToast('Request marked '+statusValue+'. No balance was credited.');
  };
  // Gift terms are global and stored in the database, not only this browser.
  document.getElementById('giftForm').onsubmit = async e => {
    e.preventDefault();
    if (state.role !== 'admin') return toastSafe('Administrator access required.');
    const amount = Number(document.getElementById('giftAmount').value);
    if (!Number.isFinite(amount) || amount < 0) return toastSafe('Enter a valid gift amount.');
    const value = {amount,title:document.getElementById('giftTitle').value.trim()||'Welcome credit',terms:document.getElementById('giftTerms').value.trim()};
    const { error } = await client.from('app_settings').upsert({key:'welcome_gift',value,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'key'});
    if (error) return toastSafe('Gift settings could not be saved: '+error.message);
    state.gift=value; log('Welcome gift updated','Global preview gift settings updated');
    renderAll(); toastSafe('Welcome gift settings saved for all accounts.');
  };
  // Only real administrator profiles may open the management page.
  const originalGo = go;
  go = function(page) {
    if (page === 'admin' && state.role !== 'admin') { toastSafe('Administrator access required.'); return; }
    if (state.role === 'admin' && !['admin','messages'].includes(page)) {
      toastSafe('That page belongs to the customer workspace.');
      return;
    }
    return originalGo(page);
  };
  document.getElementById('roleBtn').onclick = () => toastSafe('Account role is verified by Supabase; it cannot be switched from this button.');
  document.getElementById('switchCustomer').onclick = () => toastSafe('Use a separate customer account to preview the customer view.');
  document.getElementById('switchAdmin').onclick = () => toastSafe('Admin role must be assigned securely to the account owner.');
  document.getElementById('resetPreview').onclick = () => toastSafe('Local reset is disabled for signed-in accounts; cloud data is retained.');
  document.getElementById('newConversation').onclick = () => {
    if (state.role === 'customer') { state.activeConversation=user.id; if (!state.conversations.some(c=>c.id===user.id)) state.conversations=[{id:user.id,title:'Support conversation'}]; renderMessages(); }
    else toastSafe('A customer must start a conversation first.');
  };
  document.getElementById('messageForm').onsubmit = async e => {
    e.preventDefault();
    if (!user) return;
    const text = document.getElementById('messageText').value.trim();
    const file = document.getElementById('attachment').files[0];
    const owner = state.role === 'admin' ? state.activeConversation : user.id;
    if (!owner) return toastSafe('Select a customer conversation first.');
    if (!text && !file) return;
    let attachment_path = null, attachment_mime = null, attachment_name = null;
    if (file) {
      if (file.size > 10*1024*1024) return toastSafe('Attachments must be 10 MB or smaller.');
      if (!(file.type.startsWith('image/') || file.type.startsWith('audio/'))) return toastSafe('Only photo and audio attachments are supported.');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-90);
      attachment_path = owner+'/'+crypto.randomUUID()+'-'+safeName;
      const { error: uploadError } = await client.storage.from('chat-attachments').upload(attachment_path,file,{contentType:file.type,upsert:false});
      if (uploadError) return toastSafe('Attachment upload failed: '+uploadError.message);
      attachment_mime=file.type; attachment_name=file.name;
    }
    const { error } = await client.from('messages').insert({
      conversation_owner_id:owner,sender_id:user.id,body:text,attachment_path,attachment_mime,attachment_name
    });
    if (error) return toastSafe('Message could not be sent: '+error.message);
    document.getElementById('messageText').value='';
    document.getElementById('attachment').value='';
    document.getElementById('attachmentName').textContent='';
    log('Message sent',(state.role==='admin'?'Admin':'Customer')+' · '+(text||attachment_name||'attachment'));
    await reloadAndToast('Message sent.');
  };
  // Persist simulated orders in the database; these are not exchange orders.
  document.getElementById('placeOrder').onclick = async () => {
    const id=document.getElementById('tradeAsset').value, amount=Number(document.getElementById('tradeAmount').value), p=price(id);
    const a=assets.find(x=>x[0]===id);
    if(!p) return toastSafe('No current price available. Refresh the market feed first.');
    if(!Number.isFinite(amount)||amount<=0) return toastSafe('Enter a valid order size.');
    if(amount>totalBalance()) return toastSafe('Order size exceeds simulated buying power.');
    const {error}=await client.from('simulated_orders').insert({user_id:user.id,asset_id:id,side:document.getElementById('tradeSide').value,notional_usd:amount,reference_price:p,execution_mode:'simulated',status:'open'});
    if(error) return toastSafe('Simulated order could not be saved: '+error.message);
    log('Simulated order placed',document.getElementById('tradeSide').value.toUpperCase()+' '+a[1]+' at '+fmtPrice(p),money(amount));
    await reloadAndToast('Simulated order saved. No exchange order was sent.');
  };
  closeOrder = async function(id) {
    const o=state.orders.find(x=>x.id===id&&x.status==='Open');
    if(!o) return;
    const pnl=Number(orderPnl(o).toFixed(2));
    const {error}=await client.from('simulated_orders').update({status:'closed',realized_pnl:pnl,closed_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id).eq('status','open');
    if(error) return toastSafe('Could not close simulated position: '+error.message);
    log('Simulated position closed',o.symbol+' · realized P/L '+(pnl>=0?'+':'−')+money(Math.abs(pnl)));
    await reloadAndToast('Simulated position closed.');
  };
  // Do not allow preview-only role switching or local reset to bypass cloud authentication.
  window.apexSupabase = client;
  window.apexSignOut = async () => { await client.auth.signOut(); location.reload(); };
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      setTimeout(() => { document.getElementById('layout').classList.add('hidden'); document.getElementById('authGate').classList.remove('hidden'); setAuthMode('recovery'); statusLine('Enter a new password below.'); }, 0);
      return;
    }
    if (event === 'SIGNED_OUT') {
      user=null; profile=null; cloudReady=false;
      document.getElementById('layout').classList.add('hidden');
      document.getElementById('authGate').classList.remove('hidden');
    }
    // Defer network work until after the auth callback releases the client's internal lock.
    if (session?.user && !user) setTimeout(async () => {
      if (user) return;
      try { await activate(session.user); }
      catch (err) { user=null; console.error(err); statusLine('Account setup failed: '+(err.message||'unknown error'),true); }
    }, 0);
  });
  client.auth.getSession().then(async ({data,error}) => {
    if (error) return statusLine(error.message,true);
    if (data.session?.user && !user) {
      try { await activate(data.session.user); }
      catch (err) { user=null; console.error(err); statusLine('Account setup failed: '+(err.message||'unknown error'),true); }
    }
  });
})();
