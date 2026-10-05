import './university.css';
const $=id=>document.getElementById(id), endpoint='https://cafecito-live-studio-2235-live.twil.io/state';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let token=sessionStorage.getItem('cafecito-presenter')||'', generation=0, timer, revision='', preview=false;
const cache=new Map();
function markup(id,html){if(cache.get(id)!==html){$(id).innerHTML=html;cache.set(id,html);}}
const label=s=>String(s||'waiting').replaceAll('_',' ');
function badge(id,text,good=false,bad=false){$(id).textContent=label(text);$(id).className='badge'+(good?' good':bad?' bad':'');}
function render(s){
 const key=s?`${s.id}:${s.revision}`:'empty';if(key===revision)return;revision=key;
 const u=s?.university||{}, verified=u.verification==='verified', done=u.reset==='completed';
 $('callStatus').textContent=s?.status==='active'?'● CALL ACTIVE':s?'CALL ENDED':'';
 $('agentState').textContent=s?.status==='ended'?'Conversation complete':({speaking:'Maya is speaking',thinking:'Checking the university desk',listening:'Listening to the caller'}[s?.agent_state]||'Your university AI assistant');
 $('studentId').textContent=u.student_id||'— — — — — — — —';
 badge('lookup',u.lookup||'waiting',u.lookup==='matched',u.lookup==='not_found');
 $('studentDob').hidden=!verified||!u.student?.birth_date;
 $('studentDob').textContent=verified&&u.student?.birth_date?'Date of birth · '+new Date(u.student.birth_date+'T12:00:00').toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'}):'';
 $('studentName').textContent=verified?u.student?.name:'Record locked';$('program').textContent=verified?u.student?.program:'Student details appear after a matching ID or successful SMS reply.';
 const direct=u.verification_method==='student_id';
 badge('resetBadge',u.reset||'locked',done);$('resetTitle').textContent=done?'Your temporary password is ready.':verified?'Awaiting your go-ahead.':'Verification comes first.';
 $('resetText').textContent=done?'Six digits generated for this simulated account.':verified?(direct?'Student ID matched. No verification SMS needed.':'SMS reply verified.')+' Maya asks permission to reset.':'Maya verifies the record and asks permission before resetting.';
 $('passwordCard').hidden=!done||!u.temporary_password;$('temporaryPassword').textContent=done?u.temporary_password||'':'';
 const sms=u.sms||'not_requested', passwordSms=u.password_sms||'not_requested';
 badge('smsBadge',direct?'ID matched':sms,verified,['failed','locked','expired','retry','superseded','opted_out'].includes(sms));
 $('smsTitle').textContent=direct?'No recovery text needed.':u.verification_method==='sms_reply'?'Reply received. Check passed.':sms==='not_requested'?'Recovery only when needed.':['failed','undelivered','locked','expired','superseded','opted_out'].includes(sms)?'The check could not complete.':sms==='retry'?'A correction is needed.':'The conversation stays open.';
 $('smsText').textContent=direct?'A matching student ID skips SMS recovery. The temporary password can still be texted with permission after the reset.':u.verification_method==='sms_reply'?'The student ID arrived from the calling phone. The reset still requires confirmation.':sms==='not_requested'?'If the initial student ID fails, Maya offers an SMS recovery check.':sms==='retry'?'Reply with just your student ID.':`Recovery SMS ${label(sms)}${u.destination?' · '+u.destination:''}. The caller stays on the line.`;
 badge('passwordSmsBadge',passwordSms,['delivered','read'].includes(passwordSms),['failed','undelivered'].includes(passwordSms));
 $('smsHint').textContent=preview?'SCRIPTED PREVIEW · No message is sent.':'Password text requires separate consent. Queued is not delivered.';
 [!!u.student_id,verified,done,['queued','sent','delivered','read','declined'].includes(passwordSms)].forEach((v,i)=>$('step'+(i+1)).classList.toggle('done',v));
 const box=$('transcript'), near=box.scrollHeight-box.scrollTop-box.clientHeight<70;
 markup('transcript',s?.transcripts?.length?s.transcripts.map(t=>`<div class="message ${t.role==='user'?'user':''}"><small>${t.role==='user'?'CALLER':'MAYA'}</small><p>${esc(t.text)}</p></div>`).join(''):'<div class="empty"><h3>One call. A way back in.</h3><p>Live captions appear here as the caller and Maya speak.</p></div>');if(near)box.scrollTop=box.scrollHeight;
 markup('events',s?.events?.length?[...s.events].reverse().map(e=>`<div class="event"><strong>${esc(e.title)}</strong><time>${new Date(e.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time><p>${esc(e.detail)}</p></div>`).join(''):'<p class="placeholder">Each step appears here as it happens.</p>');
}
function stop(){generation++;clearTimeout(timer);}
async function request(){const response=await fetch(endpoint,{method:'POST',body:new URLSearchParams({presenter_key:token,use_case:'university',call:$('calls').value}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error(response.status===401?'Presenter key was not accepted.':'Live feed temporarily unavailable.');return response.json();}
function connect(){stop();preview=false;revision='';const gen=generation;async function poll(){try{const data=await request();if(gen!==generation)return;const chosen=$('calls').value;markup('calls','<option value="">Follow newest university call</option>'+data.calls.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${new Date(c.started_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · ${esc(c.status)}</option>`).join(''));$('calls').value=chosen;render(data.session);$('connection').textContent=data.session?'LIVE CLOUD FEED':'CONNECTED · WAITING FOR A UNIVERSITY CALL';$('connect').textContent='● Connected';}catch(e){if(gen!==generation)return;$('connection').textContent=e.message;}if(gen===generation)timer=setTimeout(poll,1200);}poll();}
$('connect').onclick=()=>token?connect():$('access').showModal();$('cancelAccess').onclick=()=>$('access').close();
$('accessForm').onsubmit=async e=>{e.preventDefault();token=$('key').value.trim();try{await request();sessionStorage.setItem('cafecito-presenter',token);$('key').value='';$('access').close();connect();}catch(err){$('error').textContent=err.message;}};
$('calls').onchange=connect;$('lock').onclick=()=>{stop();token='';sessionStorage.removeItem('cafecito-presenter');preview=false;revision='';render(null);$('connection').textContent='PRESENTER VIEW LOCKED';$('connect').textContent='Connect live';};
$('playbook').onclick=()=>$('guide').showModal();$('closeGuide').onclick=()=>$('guide').close();
$('rehearse').onclick=()=>{stop();preview=true;revision='';$('connection').textContent='SCRIPTED PREVIEW · NO SMS SENT';$('connect').textContent='Connect live';const gen=generation;
 const s={id:'preview',revision:0,status:'active',agent_state:'speaking',transcripts:[],events:[],university:{sms:'not_requested',verification:'unverified',reset:'locked'}};
 const say=(role,text)=>s.transcripts.push({role,text});const event=(title,detail)=>s.events.push({title,detail,at:Date.now()});
 const steps=[
 ()=>{say('assistant',"Welcome to Cafecito University password-reset automation. I'm Maya, your AI assistant. Do you have your student ID handy?");event('Call connected','Scripted preview — no SMS sent.');},
 ()=>{say('user','Yes, M123497.');Object.assign(s.university,{student_id:'M123497',lookup:'matched',verification:'verified',verification_method:'student_id',student:{name:'Vanessa Medina',birth_date:'1990-03-03',program:'School of Engineering'},reset:'ready'});event('Student ID verified','SMS recovery skipped.');say('assistant',"Great, thanks Vanessa Medina, you're verified. May I go ahead and reset your password now?");},
 ()=>{say('user','Yes, please.');Object.assign(s.university,{reset:'completed',temporary_password:'483729',change_password_on_login:true});event('Temporary password generated','Example password for this preview only.');say('assistant','Your temporary password is 4, 8, 3, 7, 2, 9. Please change it once you log in. Would you like me to text that password to you?');},
 ()=>{say('user','Yes, send it please.');s.university.password_sms='queued';event('Password text queued','Preview only. No actual message sent.');say('assistant','That text is on its way.');},
 ()=>{s.university.password_sms='delivered';event('Password text delivered','Simulated delivery for the preview.');},
 ()=>{s.status='ended';event('Preview complete','Call the university line to try it live.');}
 ];let index=0;function next(){if(gen!==generation)return;steps[index++]();s.revision++;render(s);if(index<steps.length)timer=setTimeout(next,3500);}next();};
render(null);if(token)connect();
