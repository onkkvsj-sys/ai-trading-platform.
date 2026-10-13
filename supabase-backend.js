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
  const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW XK'.split(' ').concat(['OTHER']);
  function countryName(code) {
    if (code === 'OTHER') return document.documentElement.lang === 'es' ? 'Otro / Otra región' : 'Other / Other region';
    try { return new Intl.DisplayNames([document.documentElement.lang || 'en'], {type:'region'}).of(code) || code; } catch { return code; }
  }
  function countryFlag(code) {
    if (!code || code.length !== 2 || code === 'OTHER') return '🌐';
    return String.fromCodePoint(...[...code.toUpperCase()].map(c=>127397+c.charCodeAt(0)));
  }
  function countryOptionsHtml(selected='') {
    return '<option value="">'+(document.documentElement.lang==='es'?'Selecciona un país':'Select country')+'</option>'+COUNTRY_CODES.map(code=>'<option value="'+code+'" '+(code===selected?'selected':'')+'>'+countryFlag(code)+' '+safe(countryName(code))+'</option>').join('');
  }
  function refreshCountrySelects() {
    ['authCountry','profileCountry'].forEach(id=>{const el=document.getElementById(id);if(el){const value=el.value;el.innerHTML=countryOptionsHtml(value);el.value=value;}});
  }
  window.apexRefreshCountries = refreshCountrySelects;
  const css = document.createElement('style');
  css.textContent = `
    #authGate{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(ellipse at 70% 0%,#17334a 0,transparent 50%),#08111f}
    #authCard{width:min(440px,100%);background:linear-gradient(145deg,#132132,#0c1725);border:1px solid #2a4054;border-radius:22px;padding:26px;box-shadow:0 24px 80px #0008}
    #authCard input{width:100%;background:#081421;border:1px solid #2a3b50;border-radius:10px;padding:12px;color:#edf4fb;outline:none}
    #authCard input:focus,#authCard select:focus{border-color:#43e0b0}#authCard select{width:100%;background:#081421;border:1px solid #2a3b50;border-radius:10px;padding:12px;color:#edf4fb;outline:none}
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
        <div id="authNameWrap" class="hidden"><label class="muted text-xs block mb-2">Display name</label><input id="authName" autocomplete="name" maxlength="80" placeholder="Your name"></div><div id="authCountryWrap" class="hidden"><label class="muted text-xs block mb-2">Choose your country</label><select id="authCountry" required><option value="">Select country</option><option value="NG">🇳🇬 Nigeria</option><option value="MX">🇲🇽 Mexico</option><option value="US">🇺🇸 United States</option><option value="GB">🇬🇧 United Kingdom</option><option value="ES">🇪🇸 Spain</option><option value="CO">🇨🇴 Colombia</option><option value="AR">🇦🇷 Argentina</option><option value="BR">🇧🇷 Brazil</option><option value="CA">🇨🇦 Canada</option><option value="GH">🇬🇭 Ghana</option><option value="KE">🇰🇪 Kenya</option><option value="ZA">🇿🇦 South Africa</option><option value="IN">🇮🇳 India</option><option value="PH">🇵🇭 Philippines</option><option value="OTHER">🌐 Other</option></select></div>
        <div id="authEmailWrap"><label class="muted text-xs block mb-2">Email address</label><input id="authEmail" type="email" autocomplete="email" required placeholder="you@example.com"></div>
        <div><label class="muted text-xs block mb-2">Password</label><input id="authPassword" type="password" autocomplete="current-password" required minlength="8" placeholder="At least 8 characters"></div>
        <button id="authSubmit" class="authSubmit" type="submit">Sign in securely</button>
      </form>
      <button id="authReset" class="muted text-xs underline mt-4" type="button">Forgot password?</button>
      <p id="authStatus" class="muted text-xs leading-relaxed mt-4" aria-live="polite"></p>
      <p class="muted text-[11px] leading-relaxed mt-5">Market orders in this workspace are simulated. Never share your password or bank details in messages.</p>
    </div>`;
  document.body.appendChild(gate);
  refreshCountrySelects();
  document.getElementById('layout').classList.add('hidden');
  async function showVisitorWelcomeReceipt() {
    const modal=document.getElementById('welcomeGiftModal');
    if (!modal || localStorage.getItem('apex-welcome-visitor-shown')) return;
    const { data } = await client.from('app_settings').select('value').eq('key','welcome_gift').maybeSingle();
    const gift=data?.value || {amount:250,title:'Apex Demo Credit',terms:'Demo-only credit for exploring the platform. No cash value; not a deposit and not withdrawable.'};
    document.getElementById('giftModalGiftTitle').textContent=gift.title || 'Welcome gift';
    document.getElementById('giftModalAmount').textContent=money(gift.amount);
    document.getElementById('giftModalTerms').textContent=gift.terms || 'Welcome to your private workspace.';
    const close=()=>{modal.classList.add('hidden');localStorage.setItem('apex-welcome-visitor-shown','1');};
    document.getElementById('giftModalClose').onclick=close;
    document.getElementById('giftModalContinue').onclick=close;
    modal.classList.remove('hidden');
  }
  showVisitorWelcomeReceipt().catch(()=>{});
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
    document.getElementById('authCountryWrap').classList.toggle('hidden', mode !== 'signup');
    document.getElementById('authCountry').required = mode === 'signup';
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
    const country_code = document.getElementById('authCountry').value;
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
        const { data, error } = await client.auth.signUp({ email, password, options: { data: { display_name, country_code }, emailRedirectTo: location.origin + location.pathname } });
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
    const { data: access, error: accessError } = await client.rpc('current_account_access_status');
    if (accessError) throw accessError;
    if (!access?.exists || access?.is_blocked || access?.deleted) {
      const blockedMessage = access?.is_blocked
        ? 'This account has been blocked by the administrator. Contact support if you believe this is a mistake.'
        : 'This account is no longer available. Contact support for assistance.';
      await client.auth.signOut();
      user = null; profile = null; cloudReady = false;
      document.getElementById('layout').classList.add('hidden');
      document.getElementById('authGate').classList.remove('hidden');
      statusLine(blockedMessage, true);
      return;
    }
    const { data: found, error: profileErr } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (profileErr) throw profileErr;
    if (found) {
      profile = found;
      const metaCountry = user.user_metadata?.country_code || '';
      const metaName = user.user_metadata?.display_name || '';
      if ((!profile.country_code && metaCountry) || (!profile.display_name && metaName)) {
        const patch = {};
        if (!profile.country_code && metaCountry) patch.country_code = metaCountry;
        if (!profile.display_name && metaName) patch.display_name = metaName;
        const { data: updated, error } = await client.from('profiles').update({...patch,updated_at:new Date().toISOString()}).eq('id',user.id).select('*').single();
        if (!error && updated) profile = updated;
      }
    } else {
      const { data: created, error } = await client.from('profiles').insert({ id: user.id, display_name: user.user_metadata?.display_name || '', country_code: user.user_metadata?.country_code || '', role: 'customer' }).select('*').single();
      if (error) throw error;
      profile = created;
    }
    state.role = profile.role === 'admin' ? 'admin' : 'customer';
    window.apexCurrentRole = state.role;
    const languageControl = document.getElementById('languageSelect');
    if (languageControl) languageControl.classList.toggle('hidden', state.role === 'admin');
    if (state.role === 'admin' && window.apexSetLanguage) window.apexSetLanguage('en');
    document.getElementById('roleBtn').textContent = 'Account: ' + state.role;
    setupProfileUI();
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
    setupProfileUI();
    setupWelcomeReceipt();
    setupMessageRealtime();
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
      const [giftRes, requestsRes, messagesRes, ordersRes, activityRes, profilesRes, withdrawalsRes] = await Promise.all([
        client.from('app_settings').select('value').eq('key','welcome_gift').maybeSingle(),
        client.from('topup_requests').select('*').order('created_at',{ascending:true}),
        client.from('messages').select('*').order('created_at',{ascending:true}),
        client.from('simulated_orders').select('*').order('created_at',{ascending:true}),
        client.from('activity_events').select('*').order('created_at',{ascending:false}).limit(300),
        client.from('profiles').select('id,display_name,role,created_at,country_code,avatar_path,is_blocked,blocked_at,blocked_reason,deleted_at'),
        client.from('withdrawal_requests').select('*').order('created_at',{ascending:true})
      ]);
      for (const r of [giftRes,requestsRes,messagesRes,ordersRes,activityRes,profilesRes,withdrawalsRes]) if (r.error) throw r.error;
      if (giftRes.data?.value) state.gift = giftRes.data.value;
      state.requests = (requestsRes.data || []).map(r => ({id:r.id,amount:Number(r.amount),note:r.note,time:r.created_at,status:r.status[0].toUpperCase()+r.status.slice(1),reviewedAt:r.reviewed_at}));
      state.withdrawals = (withdrawalsRes.data || []).map(r => ({id:r.id,user_id:r.user_id,amount:Number(r.amount),currency:r.currency,bank_country:r.bank_country,bank_name:r.bank_name,account_holder:r.account_holder,account_number:r.account_number,status:r.status,eligibility_note:r.eligibility_note,time:r.created_at,reviewedAt:r.reviewed_at}));
      state.customers = (profilesRes.data || []).map(p => ({id:p.id,display_name:p.display_name || '',role:p.role || 'customer',country_code:p.country_code || '',avatar_path:p.avatar_path || '',created_at:p.created_at || '',is_blocked:!!p.is_blocked,blocked_at:p.blocked_at||null,blocked_reason:p.blocked_reason||'',deleted_at:p.deleted_at||null}));
      if (state.role === 'admin') state.customers = await Promise.all(state.customers.map(async c => { if (!c.avatar_path) return c; const { data: signed } = await client.storage.from('profile-photos').createSignedUrl(c.avatar_path,3600); return {...c,avatar_url:signed?.signedUrl || ''}; }));
      const profMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id,p.display_name || '']));
      if (profile?.avatar_path) { const { data: avatar } = await client.storage.from('profile-photos').createSignedUrl(profile.avatar_path, 3600); profile.avatar_url = avatar?.signedUrl || ''; }
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
  let profilePhotoObjectUrl = '';
  let messageChannel = null;
  function setAvatar(el, url, fallback) {
    if (!el) return;
    el.innerHTML = url ? '<img alt="Profile photo" src="'+safe(url)+'">' : safe((fallback || 'A').slice(0,1).toUpperCase());
  }
  async function setupProfileUI() {
    if (!user || !profile) return;
    const name = profile.display_name || user.user_metadata?.display_name || '';
    const country = profile.country_code || user.user_metadata?.country_code || '';
    const nameInput = document.getElementById('profileDisplayName');
    const countryInput = document.getElementById('profileCountry');
    if (nameInput && document.activeElement !== nameInput) nameInput.value = name;
    if (countryInput && document.activeElement !== countryInput) countryInput.value = country;
    let avatarUrl = profile.avatar_url || '';
    if (profile.avatar_path && !avatarUrl) {
      const { data } = await client.storage.from('profile-photos').createSignedUrl(profile.avatar_path, 3600);
      avatarUrl = data?.signedUrl || '';
      profile.avatar_url = avatarUrl;
    }
    setAvatar(document.getElementById('profileAvatarButton'), avatarUrl, name);
    setAvatar(document.getElementById('profileAvatarPreview'), avatarUrl, name);
    setAvatar(document.getElementById('profileHeroAvatar'), avatarUrl, name);
    const heroName=document.getElementById('profileHeroName');if(heroName)heroName.textContent=name||'Your profile';
    const heroSub=document.getElementById('profileHeroSub');if(heroSub)heroSub.textContent=state.role==='admin'?'Manage your administrator identity and account security.':'Manage your customer identity and workspace preferences.';
    const heroRole=document.getElementById('profileHeroRole');if(heroRole)heroRole.textContent=state.role==='admin'?'PRIVATE ADMIN ACCOUNT':'CUSTOMER ACCOUNT';
    const flags={NG:'🇳🇬 Nigeria',MX:'🇲🇽 Mexico',US:'🇺🇸 United States',GB:'🇬🇧 United Kingdom',ES:'🇪🇸 Spain',CO:'🇨🇴 Colombia',AR:'🇦🇷 Argentina',BR:'🇧🇷 Brazil',CA:'🇨🇦 Canada',GH:'🇬🇭 Ghana',KE:'🇰🇪 Kenya',ZA:'🇿🇦 South Africa',IN:'🇮🇳 India',PH:'🇵🇭 Philippines',OTHER:'🌐 Other'};
    const heroCountry=document.getElementById('profileHeroCountry');if(heroCountry)heroCountry.textContent=flags[country]||'COUNTRY NOT SET';
    const heroEyebrow=document.getElementById('profileHeroEyebrow');if(heroEyebrow)heroEyebrow.textContent=state.role==='admin'?'APEX · PRIVATE ADMIN PROFILE':'APEX · CUSTOMER PROFILE';
    const photoInput = document.getElementById('profilePhotoInput');
    if (photoInput) photoInput.onchange = async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { toastSafe('Choose a JPG, PNG or WebP image.'); photoInput.value=''; return; }
      if (file.size > 5*1024*1024) { toastSafe('Profile photos must be 5 MB or smaller.'); photoInput.value=''; return; }
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = user.id+'/avatar-'+Date.now()+'.'+ext;
      const { error: uploadError } = await client.storage.from('profile-photos').upload(path,file,{contentType:file.type,upsert:false});
      if (uploadError) { toastSafe('Photo upload failed: '+uploadError.message); return; }
      const { error } = await client.from('profiles').update({avatar_path:path,updated_at:new Date().toISOString()}).eq('id',user.id);
      if (error) { toastSafe('Photo uploaded but profile could not be updated: '+error.message); return; }
      profile.avatar_path=path; profile.avatar_url='';
      await setupProfileUI();
      log('Profile photo updated','Profile picture changed');
      toastSafe('Profile picture updated.');
    };
    const notifyBtn=document.getElementById('enableNotifications');
    if (notifyBtn) notifyBtn.onclick=async()=>{if (!('Notification' in window)) return toastSafe('This browser does not support system notifications. In-app alerts will still work.'); const permission=await Notification.requestPermission(); toastSafe(permission==='granted'?'Message notifications enabled.':'Notifications were not enabled. In-app alerts will still work.');};
    const form = document.getElementById('profileForm');
    if (form) form.onsubmit = async e => {
      e.preventDefault();
      if (!user) return;
      const display_name = document.getElementById('profileDisplayName').value.trim().slice(0,80);
      const country_code = document.getElementById('profileCountry').value;
      if (!display_name || !country_code) return toastSafe('Enter your display name and choose your country.');
      const status = document.getElementById('profileStatus');
      status.textContent='Saving…';
      const { data, error } = await client.from('profiles').update({display_name,country_code,updated_at:new Date().toISOString()}).eq('id',user.id).select('*').single();
      if (error) { status.textContent=''; return toastSafe('Profile could not be saved: '+error.message); }
      profile={...profile,...data};
      await client.auth.updateUser({data:{display_name,country_code}});
      status.textContent='Profile saved successfully.';
      await setupProfileUI();
      await reloadAndToast('Your profile has been updated.');
    };
    const avatarButton = document.getElementById('profileAvatarButton');
    if (avatarButton) avatarButton.onclick = () => go('profile');
  }
  function setupWelcomeReceipt() {
    const modal=document.getElementById('welcomeGiftModal');
    if (!modal || !user || state.role !== 'customer') return;
    const key='apex-welcome-receipt-'+user.id;
    if (localStorage.getItem('apex-welcome-visitor-shown')) { localStorage.setItem(key,'1'); return; }
    const gift=state.gift || {amount:0,title:'Welcome',terms:''};
    document.getElementById('giftModalGiftTitle').textContent=gift.title || 'Welcome gift';
    document.getElementById('giftModalAmount').textContent=money(gift.amount);
    document.getElementById('giftModalTerms').textContent=gift.terms || 'Welcome to your private workspace.';
    const close=()=>{modal.classList.add('hidden');localStorage.setItem(key,'1');};
    document.getElementById('giftModalClose').onclick=close;
    document.getElementById('giftModalContinue').onclick=close;
    if (!localStorage.getItem(key)) modal.classList.remove('hidden');
  }
  function setupMessageRealtime() {
    if (!user) return;
    if (messageChannel) { client.removeChannel(messageChannel); messageChannel=null; }
    messageChannel=client.channel('apex-message-alerts-'+user.id+'-'+state.role)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},payload=>{
        const m=payload.new || {};
        if (!m.id || m.sender_id===user.id) return;
        const relevant=state.role==='admin' || m.conversation_owner_id===user.id;
        if (!relevant) return;
        const onMessages=document.getElementById('page-messages')?.classList.contains('active');
        if (!onMessages) {
          state.unreadMessages=(Number(state.unreadMessages)||0)+1;
          const badge=document.getElementById('unreadCount');
          if (badge) { badge.textContent=String(state.unreadMessages); badge.classList.remove('hidden'); }
        }
        const title=state.role==='admin'?'New customer message':'New message from Apex support';
        toastSafe('✦ '+title+' — tap Messages to open your secure inbox.');
        if ('Notification' in window && Notification.permission==='granted') {
          try { new Notification(title,{body:'You have a new message in Apex Terminal.'}); } catch {}
        }
        loadCloud();
      }).subscribe();
  }
  const clearUnread=()=>{state.unreadMessages=0;const badge=document.getElementById('unreadCount');if(badge){badge.textContent='0';badge.classList.add('hidden')}};
  document.querySelectorAll('[data-page="messages"]').forEach(el=>el.addEventListener('click',clearUnread));
  document.getElementById('page-messages')?.addEventListener('click',clearUnread);
  const toastEl=document.getElementById('toast');if(toastEl){toastEl.style.cursor='pointer';toastEl.title='Open messages';toastEl.addEventListener('click',()=>{if(user)go('messages')})}
  function renderAdminSummary() {
    if (state.role !== 'admin') return;
    const customerRows=(state.customers||[]).filter(c=>c.role==='customer');
    const pendingRows=(state.requests||[]).filter(r=>String(r.status).toLowerCase()==='pending');
    const allMessages=(state.messages||[]).slice().sort((a,b)=>new Date(b.time||0)-new Date(a.time||0));
    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=String(value)};
    set('adminStatCustomers',customerRows.length);set('adminStatRequests',pendingRows.length);set('adminStatMessages',allMessages.length);
    set('adminLiveCustomers',customerRows.length);set('adminLiveRequests',pendingRows.length);
    set('adminLiveMarkets',Object.keys(state.prices||{}).filter(k=>Number(state.prices[k]?.usd)>0).length);
    set('adminLiveMessages',allMessages.length);set('adminChartCustomers',customerRows.length);
    set('adminChartActivity',(state.activity||[]).length);set('adminChartPending',pendingRows.length);
    const clock=document.getElementById('adminLiveClock');if(clock)clock.textContent=new Date().toLocaleTimeString();
    const dayKey=d=>{const x=new Date(d);return Number.isNaN(x.getTime())?'':x.toISOString().slice(0,10)};
    const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return dayKey(d)});
    const activityCounts=days.map(day=>(state.activity||[]).filter(a=>dayKey(a.time||a.created_at)===day).length);
    const requestCounts=days.map(day=>(state.requests||[]).filter(a=>dayKey(a.time||a.created_at)===day).length);
    const pathFor=values=>{const max=Math.max(1,...values);return values.map((v,i)=>{const x=8+i*(584/6);const y=155-(v/max)*105;return (i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}).join(' ')};
    const ap=document.getElementById('adminActivityPath'),rp=document.getElementById('adminRequestPath');
    if(ap)ap.setAttribute('d',pathFor(activityCounts));if(rp)rp.setAttribute('d',pathFor(requestCounts));
    const list=document.getElementById('adminConversationList');
    if(list){
      const owners=[...new Set(allMessages.map(m=>m.conversation).filter(Boolean))];
      const recent=owners.map(owner=>({owner,last:allMessages.find(m=>m.conversation===owner),customer:customerRows.find(c=>c.id===owner),title:(state.conversations||[]).find(c=>c.id===owner)?.title||customerRows.find(c=>c.id===owner)?.display_name||'Customer '+String(owner).slice(0,8)}))
        .sort((a,b)=>new Date(b.last?.time||0)-new Date(a.last?.time||0)).slice(0,4);
      set('adminConversationSub',allMessages.length+' message'+(allMessages.length===1?'':'s')+' across '+owners.length+' customer conversation'+(owners.length===1?'':'s'));
      list.innerHTML=recent.length?recent.map(row=>{
        const m=row.last||{}, initial=(row.title||'C').trim().slice(0,1).toUpperCase();
        const snippet=(m.text||m.name||(m.type?'Attachment':'No message text')).slice(0,100);
        const sender=m.sender==='admin'?'Sent by admin':'Customer message';
        const date=m.time?new Date(m.time).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'Recent message';
        const avatar=row.customer?.avatar_url?'<img alt="Customer profile" src="'+safe(row.customer.avatar_url)+'">':initial;
        return '<div class="admin-conversation-row"><div class="admin-conversation-avatar">'+avatar+'</div><div class="admin-conversation-main"><strong>'+safe(row.title)+'</strong><p>'+safe(snippet)+'</p><small>'+safe(date)+' · '+safe(sender)+'</small></div><button class="admin-conversation-open" type="button" data-admin-open-conversation="'+safe(row.owner)+'" aria-label="Open conversation">↗</button></div>';
      }).join(''):'<div class="muted p-5 text-sm">No customer messages yet. New conversations will appear here.</div>';
      list.querySelectorAll('[data-admin-open-conversation]').forEach(btn=>btn.onclick=()=>{state.activeConversation=btn.dataset.adminOpenConversation;go('messages');if(typeof renderMessages==='function')renderMessages()});
    }
    const view=document.getElementById('adminViewMessages');if(view)view.onclick=()=>go('messages');
    const find=document.getElementById('adminFindCustomer');if(find)find.onclick=()=>{const el=document.getElementById('adminCustomers');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})};
  }
  async function manageCustomerAccount(action, id, reason='') {
    if (state.role !== 'admin' || !user) return toastSafe('Administrator access required.');
    const customer=(state.customers||[]).find(c=>c.id===id);
    if (!customer || customer.role!=='customer') return toastSafe('Only customer accounts can be managed here.');
    if (id===user.id) return toastSafe('You cannot block or delete your own administrator account.');
    const labels={block:'Block this customer? They will be signed out and will not be able to access the workspace until unblocked.',unblock:'Restore this customer account? They will be able to sign in again.',delete:'Permanently delete this customer account? Their profile, messages, and demo activity will be removed. This cannot be undone.'};
    if (!window.confirm(labels[action]||'Continue with this account action?')) return;
    if (action==='block' && !reason && typeof window.prompt==='function') reason=window.prompt('Optional reason for blocking this account:','')||'';
    const buttons=[...document.querySelectorAll('[data-account-action][data-account-id="'+CSS.escape(id)+'"]')];
    buttons.forEach(btn=>{btn.disabled=true;btn.dataset.originalText=btn.textContent;btn.textContent='Please wait…'});
    try {
      const {data,error}=await client.functions.invoke('manage-customer-account',{body:{action,userId:id,reason}});
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Account action failed.');
      log('Customer account '+action,customer.display_name+' · '+id.slice(0,8));
      await reloadAndToast(action==='block'?'Customer blocked. They can no longer access the workspace.':action==='unblock'?'Customer access restored.':'Customer account permanently deleted.');
    } catch(err) {
      toastSafe('Account action failed: '+(err.message||'Please try again.'));
      buttons.forEach(btn=>{btn.disabled=false;btn.textContent=btn.dataset.originalText||btn.textContent});
    }
  }
  function renderCustomers() {
    const target = document.getElementById('adminCustomers');
    if (!target) return;
    if (state.role !== 'admin') { target.innerHTML = ''; return; }
    const rows = (state.customers || []).filter(c=>!c.deleted_at);
    target.innerHTML = rows.length ? rows.map(c => {
      const isAdmin=c.role==='admin', blocked=!!c.is_blocked;
      const status=isAdmin?'ADMINISTRATOR':blocked?'BLOCKED':'ACTIVE';
      const avatar=c.avatar_url?'<img alt="Customer profile" src="'+safe(c.avatar_url)+'">':safe((c.display_name||'C').slice(0,1).toUpperCase());
      return `
      <article class="admin-customer-card">
        <div class="admin-customer-head">
          <div class="admin-customer-avatar">${avatar}</div>
          <div class="flex-1 min-w-0"><div class="admin-customer-name">${safe(c.display_name||'Customer')}</div><div class="admin-customer-meta">${safe(c.country_code||'Country not set')} · Joined ${safe(c.created_at?new Date(c.created_at).toLocaleDateString():'date unavailable')}</div><div class="admin-customer-meta break-all">ID: ${safe(c.id)}</div></div>
          <span class="admin-account-status ${blocked?'blocked':''}">${status}</span>
        </div>
        ${!isAdmin ? `
        <form class="admin-account-edit" data-customer-form="${safe(c.id)}">
          <div class="admin-account-fields">
            <div><label>DISPLAY NAME</label><input class="field" name="display_name" maxlength="80" value="${safe(c.display_name)}" placeholder="Customer name"></div>
            <div><label>COUNTRY</label><select class="field" name="country_code">${countryOptionsHtml(c.country_code)}</select></div>
          </div>
          <div class="admin-account-actions">
            <button class="btn btn-primary" type="submit">Save profile</button>
            <button class="btn ${blocked?'btn-primary':'btn-warn'}" type="button" data-account-action="${blocked?'unblock':'block'}" data-account-id="${safe(c.id)}">${blocked?'Unblock account':'Block account'}</button>
            <button class="btn btn-danger" type="button" data-account-action="delete" data-account-id="${safe(c.id)}">Delete account</button>
          </div>
          ${blocked&&c.blocked_reason?'<p class="admin-customer-meta mt-3">Block reason: '+safe(c.blocked_reason)+'</p>':''}
        </form>` : '<p class="admin-customer-meta mt-4">Administrator accounts are protected from customer block/delete actions.</p>'}
      </article>`;
    }).join('') : '<div class="muted py-5">No customer accounts found.</div>';
    target.querySelectorAll('[data-customer-form]').forEach(form => form.onsubmit = async e => {
      e.preventDefault();
      if (state.role !== 'admin' || !user) return toastSafe('Administrator access required.');
      const id=form.dataset.customerForm, formData=new FormData(form);
      const display_name=String(formData.get('display_name')||'').trim().slice(0,80);
      const country_code=String(formData.get('country_code')||'');
      if(!display_name||!country_code)return toastSafe('Enter the display name and country.');
      const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Saving…';
      const {error}=await client.from('profiles').update({display_name,country_code,updated_at:new Date().toISOString()}).eq('id',id);
      if(error){button.disabled=false;button.textContent='Save profile';return toastSafe('Customer profile could not be saved: '+error.message);}
      log('Customer profile updated','Profile settings updated for account '+id.slice(0,8));
      await reloadAndToast('Customer profile saved.');
    });
    target.querySelectorAll('[data-account-action]').forEach(btn=>btn.onclick=()=>manageCustomerAccount(btn.dataset.accountAction,btn.dataset.accountId));
  }
  renderAll = function() { originalRenderAll(); renderCustomers(); renderAdminSummary(); renderWithdrawalAdmin(); };
  // Bank selector preview and withdrawal request gate. Practice P/L is never treated as cash.
  const withdrawCountryEl=document.getElementById('withdrawCountry');
  const withdrawBankEl=document.getElementById('withdrawBank');
  const withdrawHolderEl=document.getElementById('withdrawHolder');
  const withdrawAccountEl=document.getElementById('withdrawAccount');
  function updateWithdrawalPreview(){
    const bank=document.getElementById('withdrawBank')?.value||'Choose your bank';
    const country=document.getElementById('withdrawCountry')?.value||'Nigeria';
    const holder=document.getElementById('withdrawHolder')?.value.trim()||'Account holder will appear here';
    const raw=document.getElementById('withdrawAccount')?.value.replace(/\D/g,'')||'';
    document.getElementById('withdrawPreviewBank').textContent=bank;
    document.getElementById('withdrawPreviewCountry').textContent=country;
    document.getElementById('withdrawPreviewHolder').textContent=holder;
    document.getElementById('withdrawPreviewAccount').textContent=raw.length?'•••• •••• '+raw.slice(-4):'•••• ••••';
  }
  function refreshWithdrawalCountryOptions(){
    if(!withdrawCountryEl)return;
    const previous=withdrawCountryEl.value||'Nigeria';
    const names=COUNTRY_CODES.map(code=>({code,name:code==='OTHER'?'Other / Other region':new Intl.DisplayNames(['en'],{type:'region'}).of(code)||code,label:code==='OTHER'?'Other / Other region':new Intl.DisplayNames([document.documentElement.lang||'en'],{type:'region'}).of(code)||code}));
    withdrawCountryEl.innerHTML=names.map(c=>'<option value="'+safe(c.name)+'" data-code="'+c.code+'">'+countryFlag(c.code)+' '+safe(c.label)+'</option>').join('');
    withdrawCountryEl.value=names.some(c=>c.name===previous)?previous:(names.find(c=>c.code==='NG')?.name||'Nigeria');
  }
  function refreshBankOptions(){
    const country=withdrawCountryEl.value;
    const lists={
      'Nigeria':['Access Bank','Citibank Nigeria','Ecobank Nigeria','Fidelity Bank','First Bank of Nigeria','First City Monument Bank (FCMB)','Globus Bank','GTBank','Keystone Bank','Moniepoint','OPay','PalmPay','Polaris Bank','Providus Bank','Stanbic IBTC','Sterling Bank','SunTrust Bank','UBA','Union Bank','Unity Bank','Wema Bank','Zenith Bank'],
      'Mexico':['BBVA México','Banorte','Citibanamex','HSBC México','Santander México','Scotiabank México'],
      'United States':['Bank of America','Capital One','Chase','Citibank','PNC Bank','U.S. Bank','Wells Fargo'],
      'United Kingdom':['Barclays','HSBC UK','Lloyds Bank','Monzo','NatWest','Revolut','Santander UK','Starling Bank']
    };
    const list=lists[country]||['Other bank — availability must be confirmed by support'];
    withdrawBankEl.innerHTML='<option value="">Choose your bank</option>'+list.map(b=>'<option value="'+safe(b)+'">'+safe(b)+'</option>').join('');
    updateWithdrawalPreview();
  }
  withdrawCountryEl?.addEventListener('change',refreshBankOptions);
  [withdrawBankEl,withdrawHolderEl,withdrawAccountEl].forEach(el=>el?.addEventListener('input',updateWithdrawalPreview));
  withdrawBankEl?.addEventListener('change',updateWithdrawalPreview);
  refreshWithdrawalCountryOptions();
  refreshBankOptions();
  document.getElementById('withdrawForm').onsubmit=async e=>{
    e.preventDefault();
    const amount=Number(document.getElementById('withdrawAmount').value);
    const bank_country=withdrawCountryEl.value;
    const bank_name=withdrawBankEl.value;
    const account_holder=withdrawHolderEl.value.trim();
    const account_number=withdrawAccountEl.value.replace(/[\\s-]/g,'');
    if(!user||!Number.isFinite(amount)||amount<=0)return toastSafe('Enter a valid withdrawal amount and sign in.');
    if(!bank_name||account_holder.length<2||!/^[A-Za-z0-9]{6,34}$/.test(account_number))return toastSafe('Check the selected bank, account holder name, and account number.');
    const {data:approvedTopups,error:topupError}=await client.from('topup_requests').select('id').eq('user_id',user.id).eq('status','approved').limit(1);
    if(topupError)return toastSafe('Could not verify top-up eligibility. Please try again.');
    if(!approvedTopups||approvedTopups.length===0){
      const result=document.getElementById('withdrawResult');result.classList.remove('hidden');
      result.innerHTML='<div class="flex items-start gap-3"><div class="receipt-check">!</div><div><strong>Top up before requesting a withdrawal</strong><p class="text-sm mt-2">There is no approved top-up request on this account yet. Submit a top-up request first. Administrator approval must still be checked against the actual payment before any cash withdrawal can be processed.</p><button type="button" id="goTopUpFromWithdrawal" class="btn mt-4">＋ Go to Add funds</button></div></div>';
      document.getElementById('goTopUpFromWithdrawal').onclick=()=>{document.getElementById('topupForm').scrollIntoView({behavior:'smooth',block:'center'});document.getElementById('topupAmount').focus({preventScroll:true})};
      result.scrollIntoView({behavior:'smooth',block:'center'});return;
    }
    const eligibility_note='Received and held for administrator review. Actual payment and available cash must be verified before any payout.';
    const payload={user_id:user.id,amount,currency:'USD',bank_country,bank_name,account_holder,account_number,status:'pending',eligibility_note};
    const {data:savedRequest,error}=await client.from('withdrawal_requests').insert(payload).select('id,created_at').single();
    if(error)return toastSafe('Withdrawal request could not be saved: '+error.message);
    const reference=String(savedRequest.id).slice(0,8).toUpperCase();
    log('Withdrawal request received',money(amount)+' to '+bank_name+' · held for administrator review');
    const result=document.getElementById('withdrawResult');result.classList.remove('hidden');
    const flag=withdrawCountryEl.selectedOptions[0]?.textContent.split(' ')[0]||'🌐';
    result.innerHTML='<div class="flex items-start gap-3"><div class="receipt-check">✓</div><div class="flex-1 min-w-0"><div class="eyebrow" style="color:#6ee7b7">REQUEST RECEIPT · AI TRADING BOT</div><h3 class="text-xl font-bold mt-1">Withdrawal request received successfully</h3><p class="text-sm mt-2">Your request has been saved and placed on hold for administrator review. This confirms receipt of your request, not that a bank transfer has been sent.</p><div class="receipt-reference mt-4">REFERENCE · '+safe(reference)+'</div><div class="grid grid-cols-2 gap-3 mt-4"><div class="rounded-xl p-3" style="background:#101b2b"><div class="muted text-xs">Requested amount</div><div class="font-bold text-lg mt-1">'+money(amount)+'</div></div><div class="rounded-xl p-3" style="background:#101b2b"><div class="muted text-xs">Current status</div><div class="font-bold mt-1" style="color:#fcd34d">On hold</div></div></div><div class="rounded-xl p-3 mt-3" style="background:#101b2b"><div class="font-semibold">'+safe(bank_name)+'</div><div class="muted text-xs mt-1">'+safe(flag)+' '+safe(bank_country)+' · '+safe(account_holder)+'</div><div class="muted text-xs mt-1">Account ending '+safe(account_number.slice(-4))+'</div><div class="muted text-xs mt-1">'+new Date(savedRequest.created_at||Date.now()).toLocaleString()+'</div></div><p class="muted text-xs mt-3">No cash is moved by this receipt. An administrator must verify settled funds and a working payout provider before any payment is marked complete.</p><button type="button" id="printWithdrawalReceipt" class="btn mt-3">Print / Save receipt</button></div></div>';
    document.getElementById('printWithdrawalReceipt').onclick=()=>window.print();
    document.getElementById('withdrawForm').reset();refreshBankOptions();updateWithdrawalPreview();
    await reloadAndToast('Withdrawal request received. It is on hold for administrator review; no transfer has been sent.');
    result.scrollIntoView({behavior:'smooth',block:'center'});
  };
  // Render private withdrawal requests in the administrator control room.
  function renderWithdrawalAdmin(){
    const target=document.getElementById('adminWithdrawals');
    if(!target||state.role!=='admin')return;
    const rows=Array.isArray(state.withdrawals)?state.withdrawals:[];
    target.innerHTML=rows.length?rows.slice().reverse().map(r=>'<div class="table-row py-4"><div class="flex flex-wrap justify-between gap-3"><div><div class="font-semibold">'+safe(money(r.amount))+' · '+safe(r.bank_name)+'</div><div class="muted text-xs mt-1">'+safe(r.account_holder)+' · '+safe(r.bank_country)+' · account ending '+safe(String(r.account_number||'').slice(-4))+'</div><div class="muted text-xs mt-1">'+safe(r.user_id.slice(0,8))+' · '+new Date(r.time).toLocaleString()+'</div></div><span class="pill" style="background:#352a25;color:#ffd59a">'+safe(r.status)+'</span></div><p class="muted text-xs mt-2">'+safe(r.eligibility_note)+'</p></div>').join(''):'<div class="muted py-5">No withdrawal eligibility checks yet.</div>';
  }

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
    if (state.role === 'admin' && !['admin','messages','profile'].includes(page)) {
      toastSafe('That page belongs to the customer workspace.');
      return;
    }
    const result = originalGo(page);
    const languageControl = document.getElementById('languageSelect');
    if (languageControl) languageControl.classList.toggle('hidden', state.role === 'admin');
    window.apexCurrentRole = state.role;
    const backButton = document.getElementById('pageBackBtn');
    if (backButton) backButton.style.visibility = (page === 'overview' || page === 'admin') ? 'hidden' : 'visible';
    return result;
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
