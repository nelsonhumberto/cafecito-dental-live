import './style.css';
const $=id=>document.getElementById(id), api='https://cafecito-live-studio-2235-live.twil.io/state';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initial=Object.fromEntries(['transcript','identityIcon','appointmentContent','eventList'].map(id=>[id,$(id).innerHTML]));
let token=sessionStorage.getItem('cafecito-presenter')||'', mode='idle', current=null, generation=0, timers=[], lastRevision='';
const hash=new URLSearchParams(location.hash.slice(1));
if(hash.has('presenter')) {token=hash.get('presenter');sessionStorage.setItem('cafecito-presenter',token);history.replaceState(null,'',location.pathname);}

// Preserve DOM nodes (and their animations/scroll positions) on unchanged polls.
const markupCache=new WeakMap();
function setMarkup(id,html){const el=$(id);if(markupCache.get(el)===html)return false;el.innerHTML=html;markupCache.set(el,html);return true;}

function toast(t){$('toast').textContent=t;$('toast').classList.add('visible');setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function stop(){generation++;timers.forEach(clearTimeout);timers=[];}
function dateLabel(a){return new Date(a.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});}
function timeLabel(a){const [h,m]=a.time.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
function check(id,done,label,failed=false){const el=$(id);el.className=done?'done':failed?'fail':'';el.querySelector('.check-icon').textContent=done?'✓':failed?'×':'○';el.querySelector('small').textContent=label;}
function render(s){
 current=s; const rehearsal=mode==='rehearsal', verified=!!s?.patient, newPatient=s?.verification==='new_patient';
 $('modeDot').className='status-dot '+(rehearsal?'rehearsal':s?.status==='active'?'live':'');
 $('modeLabel').textContent=rehearsal?'REHEARSAL · SIMULATED':s?.status==='active'?'LIVE CALL':s?'CALL COMPLETE':mode==='live'?'WAITING FOR A CALL':'READY WHEN YOU ARE';
 $('connectionText').textContent=rehearsal?'A scripted preview of the experience':mode==='live'?'Connected to your cloud receptionist':'Connect your presenter view or try a rehearsal';
 $('transcriptBadge').textContent=rehearsal?'Rehearsal':'Live transcript';
 $('mayaState').textContent=s?.status==='ended'?'Conversation complete':({speaking:'Maya is speaking',thinking:'Checking the back office',listening:'Listening to the caller'}[s?.agent_state]||'Your AI receptionist');
 $('wave').classList.toggle('speaking',s?.agent_state==='speaking');
 $('feedFoot').textContent=rehearsal?'Scripted demo · no call placed':s?'Live captions · may contain errors':'Waiting for a conversation';
 const rows=s?.transcripts||[], nearBottom=$('transcript').scrollHeight-$('transcript').scrollTop-$('transcript').clientHeight<80;
 const revision=(s?.id||'')+':'+(s?.revision??0);
 if(lastRevision!==revision){setMarkup('transcript',rows.length?rows.map(r=>`<div class="message ${r.role==='assistant'?'assistant':'user'}"><span class="speaker">${r.role==='assistant'?'MAYA':'CALLER'}${r.final?'':' · listening'}</span><p class="bubble">${esc(r.text)}</p></div>`).join(''):initial.transcript);if(nearBottom)$('transcript').scrollTop=$('transcript').scrollHeight;lastRevision=revision;}
 document.querySelector('.identity').classList.toggle('verified',verified);
 setMarkup('identityIcon',verified?esc(s.patient.name.split(' ').map(n=>n[0]).slice(0,2).join('')):initial.identityIcon);
 $('identityTag').textContent=verified?(newPatient?'NEW DEMO PATIENT':'IDENTITY VERIFIED'):'PRIVATE UNTIL VERIFIED';
 $('patientTitle').textContent=verified?(newPatient?'Welcome, '+s.patient.salutation:'Welcome back, '+s.patient.salutation):s?.verification==='checking'?'One moment…':'A little trust first.';
 $('patientSubtitle').textContent=verified?s.patient.name+' · Fictional patient record':'Patient details stay locked until identity is confirmed.';
 $('privacyBadge').textContent=verified?(newPatient?'Intake':'Verified'):s?.verification==='failed'?'Try again':'Protected';
 $('privacyBadge').className='pill '+(verified?'success':'');
 check('nameCheck',verified,verified?'Matched':'Pending');check('dobCheck',verified&&!newPatient,newPatient?'Not required':verified?'Matched':s?.verification==='failed'?'No match':'Pending',s?.verification==='failed');check('recordCheck',verified,verified?'Unlocked':'Locked');
 $('verificationChecks').hidden=newPatient;
 $('intakeDetails').hidden=!newPatient;
 document.querySelector('.identity').classList.toggle('intake-mode',newPatient);
 if(newPatient){
  const intake=s.patient.intake||{};
  setMarkup('intakeDetails',`<div class="intake-heading">NEW PATIENT INTAKE <span>Optional details</span></div>`+['address','insurance'].map(field=>{
   const entry=intake[field]||{status:'pending',value:''};
   const label={pending:'Not asked yet',provided:'Self-reported',skipped:'Skipped · keep going',not_available:'Not available · keep going'}[entry.status]||'Not asked yet';
   return `<div class="intake-field"><span>${field==='address'?'Address':'Insurance company / plan'}</span><strong>${esc(entry.status==='provided'?entry.value:label)}</strong><small>${entry.status==='provided'?'✓ '+label:entry.status==='pending'?'Optional':'✓ Optional — booking can continue'}</small></div>`;
  }).join(''));
 }
 $('patientDetails').hidden=!verified||newPatient;if(verified){$('balance').textContent=s.patient.balance;$('insurance').textContent=s.patient.insurance;}
 $('privacyNote').textContent=newPatient?'Fictional new-patient profile created with caller consent.':'Demo identity check: name + date of birth. Not production-grade authentication.';
 const a=s?.appointment, proposal=s?.proposal, booked=!!a?.confirmation;
 const kinds=(s?.events||[]).map(e=>e.kind), cancelled=!a&&kinds.lastIndexOf('cancelled')>kinds.lastIndexOf('booked');
 $('appointmentBadge').textContent=proposal?(proposal.replaces?'Move awaiting confirmation':'Awaiting confirmation'):booked?'Confirmed':a?'Upcoming':cancelled?'Cancelled':verified?'No visit booked':'Locked';$('appointmentBadge').className='pill '+(booked?'success':proposal?'warm':'');
 setMarkup('appointmentContent',a?`<div class="visit"><div class="visit-date"><div class="date-tile"><span>${esc(new Date(a.date+'T12:00:00').toLocaleDateString('en-US',{month:'short'}))}</span><strong>${esc(Number(a.date.slice(-2)))}</strong></div><div><h3>${esc(timeLabel(a))}</h3><p>${esc(dateLabel(a))}</p></div></div><div class="visit-row"><span>VISIT</span><strong>${esc(a.service.replaceAll('_',' '))}</strong></div><div class="visit-row"><span>DENTIST</span><strong>${esc(a.dentist)}</strong></div><div class="visit-row"><span>TIME ZONE</span><strong>Eastern time</strong></div>${booked?`<div class="confirmed-note">✓ Confirmed · ${esc(a.confirmation)}</div>`:''}</div>`:cancelled?'<div class="appointment-empty"><h3>Visit cancelled.</h3><p>Your previous demo appointment was released.</p></div>':verified?'<div class="appointment-empty"><h3>A fresh start.</h3><p>Maya can find a visit that fits.</p></div>':initial.appointmentContent);
 $('proposalCard').hidden=!proposal;if(proposal){const p=proposal.appointment;setMarkup('proposalCard',`<small>PROPOSED NEW VISIT</small><p>${esc(dateLabel(p))} · ${esc(timeLabel(p))}</p><span>${esc(p.dentist)} · ${proposal.replaces?'Your original visit stays in place until you say yes.':'Waiting for the caller to say yes.'}</span>`);}
 const slots=s?.slots||[], showSlots=verified&&slots.length&&!proposal&&kinds.lastIndexOf('availability')>Math.max(kinds.lastIndexOf('booked'),kinds.lastIndexOf('cancelled'));
 $('availableSlots').hidden=!showSlots;
 if(showSlots)setMarkup('availableSlots',`<div class="intake-heading">AVAILABLE OPENINGS <span>Eastern time</span></div>`+slots.slice(0,3).map(slot=>`<div class="slot-option"><strong>${esc(dateLabel(slot))} · ${esc(timeLabel(slot))}</strong><span>${esc(slot.dentist)} · ${esc(slot.service.replaceAll('_',' '))}</span></div>`).join('')+`<small>Tell Maya which works for you. Nothing is booked until you confirm.</small>`);
 const events=s?.events||[];setMarkup('eventList',events.length?[...events].reverse().slice(0,5).map(e=>`<div class="event ${['verified','booked'].includes(e.kind)?'success':''}"><strong>${esc(e.title)}</strong><time>${new Date(e.at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</time><p>${esc(e.detail)}</p></div>`).join(''):initial.eventList);
 const progress=booked?4:verified?3:s?.verification==='checking'||s?.verification==='failed'?2:s?1:0;document.querySelectorAll('.journey-step').forEach(el=>{el.classList.toggle('done',Number(el.dataset.step)<progress||booked);el.classList.toggle('active',Number(el.dataset.step)===progress);});
}
async function request(){const res=await fetch(api+($('callSelect').value?'?call='+encodeURIComponent($('callSelect').value):''),{method:'POST',body:new URLSearchParams({presenter_key:token}),signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error(res.status===401?'Presenter key was not accepted.':'Live feed temporarily unavailable.');return res.json();}
async function connect(){stop();mode='live';const gen=generation;async function poll(){try{const data=await request();if(gen!==generation)return;const selected=$('callSelect').value;setMarkup('callSelect','<option value="">Follow newest call</option>'+data.calls.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${new Date(c.started_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · ${esc(c.status)}</option>`).join(''));$('callSelect').value=selected;render(data.session);$('connectBtn').textContent='◉ Live connected';}catch(e){if(gen!==generation)return;$('modeLabel').textContent='CONNECTION INTERRUPTED';$('connectionText').textContent=e.message;$('modeDot').className='status-dot';}if(gen===generation)timers.push(setTimeout(poll,1200));}poll();}
$('connectBtn').onclick=()=>token?connect():$('connectDialog').showModal();
$('connectForm').onsubmit=async e=>{e.preventDefault();token=$('presenterKey').value.trim();try{await request();sessionStorage.setItem('cafecito-presenter',token);$('connectDialog').close();connect();}catch(err){$('connectError').textContent=err.message;}};
$('callSelect').onchange=()=>{if(mode==='live')connect();};
$('scenariosBtn').onclick=()=>$('scenariosDialog').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('scrollBtn').onclick=()=>$('transcript').scrollTo({top:$('transcript').scrollHeight,behavior:'smooth'});
$('fullBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Use your browser’s full-screen command.');}};
$('lockBtn').onclick=()=>{stop();token='';sessionStorage.removeItem('cafecito-presenter');mode='idle';render(null);$('connectBtn').textContent='◉ Connect live';toast('Presenter view locked');};
setInterval(()=>{const seconds=current?Math.max(0,Math.floor(((current.status==='ended'?current.updated_at:Date.now())-current.started_at)/1000)):0;$('duration').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');},1000);
$('rehearseBtn').onclick=()=>{
 stop();mode='rehearsal';lastRevision='';const now=Date.now(), day=new Date();day.setDate(day.getDate()+((2-day.getDay()+7)%7||7));const iso=d=>d.toLocaleDateString('en-CA'), next=new Date(day);next.setDate(next.getDate()+2);
 const s={id:'rehearsal',started_at:now,updated_at:now,status:'active',verification:'unverified',transcripts:[],events:[],revision:0,agent_state:'speaking'};
 const event=(kind,title,detail)=>s.events.push({kind,title,detail,at:Date.now()});const say=(role,text)=>{s.agent_state=role==='assistant'?'speaking':'listening';s.transcripts.push({id:String(s.transcripts.length),role,text,final:true});};
 const steps=[()=>{event('call_started','Demo call connected','This is a scripted rehearsal.');say('assistant','Thank you for calling Cafecito Dental. I’m Maya, your AI receptionist. How can I help?');},()=>say('user','Hi, this is Nelson Medina. I need to move my appointment.'),()=>say('assistant','Of course. Before I pull up your visit, could you confirm your date of birth?'),()=>{say('user','June fifteenth, nineteen eighty-five.');s.verification='checking';event('checking','Verifying identity','Checking the fictional name and date of birth.');},()=>{s.verification='verified';s.patient={name:'Nelson Medina',salutation:'Mr. Medina',balance:'$85.00',insurance:'Sample Dental PPO'};s.appointment={date:iso(day),time:'10:30',service:'cleaning',dentist:'Dr. Sofia Reyes'};event('verified','Patient verified','Demo record unlocked.');say('assistant','Welcome back, Mr. Medina! I see your upcoming cleaning with Dr. Reyes. Is that the visit you’d like to move?');},()=>say('user','Yes. Something after five, same dentist, if possible.'),()=>{event('availability','Schedule checked','Matched evening availability with Dr. Reyes.');say('assistant','I can do Thursday at five thirty with Dr. Reyes. Would that work?');},()=>{s.proposal={appointment:{date:iso(next),time:'17:30',service:'cleaning',dentist:'Dr. Sofia Reyes'},replaces:s.appointment};event('proposal','New visit proposed','Original appointment retained until confirmation.');say('user','That sounds great. Go ahead and confirm it.');},()=>{s.appointment={...s.proposal.appointment,confirmation:'CAF-001'};s.proposal=null;event('booked','Appointment confirmed','The fictional schedule has been updated.');say('assistant','You’re all set, Mr. Medina. Thursday at five thirty with Dr. Reyes. Anything else I can help with?');},()=>{s.status='ended';event('call_ended','Rehearsal complete','Ready to try a real conversation? Connect live and call the number above.');}];
 steps.forEach((fn,i)=>timers.push(setTimeout(()=>{fn();s.revision++;s.updated_at=Date.now();render(s);},i*4500)));
};
render(null);if(token)connect();

$('headerToggle').onclick=()=>{const collapsed=document.body.classList.toggle('intro-collapsed');$('headerToggle').setAttribute('aria-expanded',String(!collapsed));$('headerToggle').textContent=collapsed?'Show intro ↓':'Hide intro ↑';};
