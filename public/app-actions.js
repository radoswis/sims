"use strict";

/* ================= AKCJE ================= */
const A={
  update:async()=>{
    // Najpierw sprawdź, czy serwer odpowiada — bez sieci nie kasujemy cache (inaczej aplikacja nie wstanie offline).
    // /api/ omija Service Workera, więc odpowiedź (nawet 405) oznacza prawdziwe połączenie z serwerem.
    try{await fetch("/api/state",{method:"HEAD",cache:"no-store"});}catch(e){return toast("Brak połączenia z serwerem — spróbuj, gdy będzie internet.");}
    toast("Pobieram najnowszą wersję…");try{const r=await navigator.serviceWorker?.getRegistration();if(r)await r.update();const k=await caches.keys();await Promise.all(k.map(x=>caches.delete(x)));}catch(e){}location.reload();},
  go:el=>go(el.dataset.v),
  setCompareRange:el=>{compareRangeStart=Math.max(1,+el.dataset.v);render();},
  openRoundModal:el=>openRoundModal(el.dataset.fam,+el.dataset.round),
  closeRoundModal:()=>closeRoundModal(),
  openFamFromCompare:el=>{curFam=el.dataset.id;go("family");},
  toggleRoundN:el=>{
    const f=fam(el.dataset.fam),round=+el.dataset.round,day=+el.dataset.day;
    if(!f)return;
    markDay(f,"births",round,day,!getFamilyBirthDays(f,round).includes(day));
    if(+round===+S.round){
      const bTask=f.tasks.find(t=>isBirthTask(t)),left=(f.births[round]||[]);
      if(bTask){bTask.done=left.length>0;if(left.length)bTask.day=left[0];else delete bTask.day;}
    }
    save();closeRoundModal();render();openRoundModal(f.id,round);
  },
  toggleRoundS:el=>{
    const f=fam(el.dataset.fam),round=+el.dataset.round,day=+el.dataset.day;
    if(!f)return;
    const on=!getFamilyCollegeDays(f,round).includes(day);
    markDay(f,"colleges",round,day,on);
    const left=f.colleges[round]||[];
    // Tok studiów: start w tej rundzie (bieżącej) albo usunięcie startu, od którego liczą się trwające studia.
    if(on&&+round===+S.round)f.college={active:true,startRound:round,startDay:left[0],days:1};
    else if(!on&&f.college&&+f.college.startRound===+round)f.college=left.length?Object.assign(f.college,{startDay:left[0]}):null;
    if(+round===+S.round){
      const cTask=f.tasks.find(t=>isCollegeTask(t));
      if(cTask){cTask.done=left.length>0;if(left.length)cTask.day=left[0];else delete cTask.day;}
    }
    save();closeRoundModal();render();openRoundModal(f.id,round);
  },
  pick:el=>pick(+el.dataset.i),
  play:()=>{const f=S.families[sel];if(f.status==="todo"){f.status="prog";save();}curFam=f.id;go("family");},
  endRound:()=>{
    S.round++;
    S.families.forEach(f=>{
      f.status="todo";f.day=1;
      // Studia trwają 2 dni gry; historia startu zostaje w f.colleges, a zadanie w nowej rundzie jest puste
      // (znacznik S pokazuje tylko faktyczne pójście na studia, tok studiów widać w panelu rodziny).
      if(f.college&&f.college.active){
        if(f.college.days<2){f.college.days++;}
        else{f.college=null;}
      }
      f.tasks.forEach(t=>{t.done=false;delete t.day;});
    });
    save();sel=0;compareRangeStart=null;render();toast("Zaczyna się runda "+S.round);
  },
  addFamily:()=>{if(S.families.length>=MAX_FAM)return toast("Osiągnięto limit "+MAX_FAM+" rodzin.");familySheet(null);},
  editFamily:()=>familySheet(fam(curFam)),
  setStatus:el=>{fam(curFam).status=el.dataset.v;save();render();},
  setDay:el=>{const f=fam(curFam);f.day=+el.dataset.v;if(f.status==="todo")f.status="prog";save();render();},
  setCollegeDay:el=>{
    const f=fam(curFam),d=+el.dataset.v;
    if(!f.college){f.college={active:true,startRound:S.round,startDay:f.day||1,days:d};markDay(f,"colleges",S.round,f.college.startDay,true);
      const colTask=f.tasks.find(t=>isCollegeTask(t));if(colTask){colTask.done=true;colTask.day=f.college.startDay;}}
    else f.college.days=d;
    save();render();
  },
  toggleTask:el=>{
    const f=fam(curFam);
    const t=f.tasks.find(t=>t.id===el.dataset.id);
    if(!t)return;
    t.done=el.checked;
    el.closest(".check").classList.toggle("done",t.done);
    if(t.done){
      t.day=f.day||1;
      if(isBirthTask(t))markDay(f,"births",S.round,t.day,true);
      if(isCollegeTask(t)){
        f.college={active:true,startRound:S.round,startDay:t.day,days:1};
        markDay(f,"colleges",S.round,t.day,true);
      }
    }else{
      const d=t.day;delete t.day;
      // Usuwamy tylko dzień tego zadania (nie całą rundę) i tylko gdy żadne inne zaznaczone zadanie go nie używa.
      const used=k=>f.tasks.some(x=>x.id!==t.id&&x.done&&k(x)&&+(x.day||1)===+d);
      if(isBirthTask(t)&&d&&!used(isBirthTask))markDay(f,"births",S.round,+d,false);
      if(isCollegeTask(t)){
        if(d&&!used(isCollegeTask))markDay(f,"colleges",S.round,+d,false);
        if(f.college&&+f.college.startRound===+S.round)f.college=null; // trwające studia z poprzedniej rundy zostają
      }
    }
    save();render();
  },
  delTask:el=>{const f=fam(curFam);f.tasks=f.tasks.filter(t=>t.id!==el.dataset.id);save();render();},
  finishFamily:()=>{const f=fam(curFam);f.status="done";f.day=4;save();
    const n=S.families.length,i=S.families.indexOf(f);let next=i;for(let k=1;k<=n;k++){const j=(i+k)%n;if(S.families[j].status!=="done"){next=j;break;}}
    view="home";render();
    const left=S.families.filter(x=>x.status!=="done").length;
    if(next!==i)setTimeout(()=>pick(next),350);
    toast(left?`${f.name} gotowi. Następni: ${S.families[next].name}`:"Wszystkie domy zrobione. Możesz zakończyć rundę.");},
  newSim:el=>simSheet(newSim({fam:el.dataset.fam||"",last:el.dataset.fam?guessLast(fam(el.dataset.fam)):""})),
  newDead:()=>simSheet(newSim({dead:true})),
  pickSim:()=>pickSimSheet(),
  pickSimDo:el=>{const s=sim(el.dataset.id),f=fam(curFam);if(!s||!f)return;s.fam=f.id;save();closeSheet();render();toast(full(s)+" dołącza do: "+f.name);},
  openSim:el=>simSheet(sim(el.dataset.id)),
  rmPhoto:()=>{editing.photo="";const b=$("#photoBtn");b.style.setProperty("--c",simColor(editing));b.textContent=ini(editing.first+" "+editing.last);},
  closeSheet:()=>closeSheet(),
  treeSel:el=>{if(dragged){dragged=false;return;}treeSel=el.dataset.id||null;treeCmp=null;kinQ="";render();},
  treeAdd:el=>treeAdd(el.dataset.v),
  zoom:el=>{const vp=$("#vp");zoomAt(+el.dataset.v,vp.clientWidth/2,vp.clientHeight/2);},
  fit:()=>{fitTree();applyT();},
  delSim:el=>confirmTap(el,"Na pewno usunąć?",()=>{const id=editing.id;S.sims=S.sims.filter(s=>s.id!==id);S.sims.forEach(o=>{if(o.spouse===id)o.spouse="";o.romances=o.romances.filter(x=>x!==id);o.ex=(o.ex||[]).filter(x=>x!==id);o.parents=o.parents.map(p=>p===id?"":p);});save();closeSheet();render();toast("Usunięto Sima");}),
  delFamily:el=>confirmTap(el,"Na pewno? Simowie zostaną bez rodziny",()=>{const id=curFam;S.families=S.families.filter(f=>f.id!==id);S.sims.forEach(s=>{if(s.fam===id)s.fam="";});save();closeSheet();sel=0;go("home");toast("Usunięto rodzinę");}),
  export:()=>downloadJSON(S,"runda"+S.round),
  clearAll:el=>confirmTap(el,"Na pewno? Dane trafią do kopii",async()=>{await addBackup(S,"przed wyczyszczeniem");S={v:1,hood:S.hood||"Miłowo",round:1,families:[],sims:[],rules:"",lots:[]};save();sel=0;go("home");toast("Wyczyszczono dane (kopia w Notatniku)");}),
  restoreBackup:el=>confirmTap(el,"Na pewno przywrócić?",async()=>{const l=(await idbGet("backups"))||[],b=l[+el.dataset.i];if(!b)return toast("Nie znaleziono kopii.");
    await addBackup(S,"przed przywróceniem kopii");S=b.state;migrateS();save();sel=0;go("home");toast("Przywrócono kopię z "+fmtDate(b.at));}),
  exportBackup:async el=>{const l=(await idbGet("backups"))||[],b=l[+el.dataset.i];if(b)downloadJSON(b.state,"kopia-"+b.at.slice(0,10));}
};
function downloadJSON(state,suffix){try{const b=new Blob([JSON.stringify(state)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);
  a.download=("rotacja-"+(state.hood||"otoczenie")+"-"+suffix).replace(/[\\/:*?"<>|]/g,"_")+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);toast("Kopia pobrana");}catch(e){toast("Nie udało się pobrać kopii.");}}
const fmtDate=iso=>{try{return new Date(iso).toLocaleString("pl-PL",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});}catch(e){return iso;}};
function guessLast(f){const m=S.sims.find(s=>s.fam===f.id&&s.last);return m?m.last:"";}
function confirmTap(el,msg,fn){if(el.dataset.confirm==="1")return fn();el.dataset.confirm="1";const o=el.textContent;el.textContent=msg;setTimeout(()=>{if(el.isConnected){el.dataset.confirm="0";el.textContent=o;}},3500);}

document.addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;if(el.tagName==="INPUT"&&el.type==="checkbox"){A[el.dataset.act](el);return;}e.preventDefault();A[el.dataset.act]&&A[el.dataset.act](el);});
document.addEventListener("input",e=>{const b=e.target.dataset.bind;if(!b)return;const v=e.target.value;
  if(b==="note"){const f=fam(curFam);f.notes[S.round+"-"+f.day]=v;}
  else if(b==="hood"||b==="rules")S[b]=v;
    save(6000);});
document.addEventListener("change",e=>{if(e.target.id==="treeFam"){treeFam=e.target.value;treeFit=true;render();}
  if(e.target.id==="importFile"){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d||!Array.isArray(d.families)||!Array.isArray(d.sims))throw 0;addBackup(S,"przed wczytaniem pliku").then(()=>{S=d;migrateS();save();sel=0;go("home");toast("Wczytano kopię: runda "+S.round);});}catch(x){toast("To nie jest plik kopii z tej aplikacji.");}e.target.value="";};r.readAsText(file);}});
document.addEventListener("submit",e=>{e.preventDefault();const t=e.target.dataset.form;
  if(t==="task"){const i=$("#newTask"),v=i.value.trim();if(!v)return;fam(curFam).tasks.push({id:uid(),t:v,done:false});save();render();$("#newTask").focus();}
  if(t==="family"){const name=$("#fName").value.trim();if(!name)return;const color=(document.querySelector('input[name=fColor]:checked')||{}).value||COLORS[0];const id=e.target.dataset.id;
    if(id){const f=fam(id);f.name=name;f.color=color;}else{if(S.families.length>=MAX_FAM){closeSheet();return toast("Osiągnięto limit "+MAX_FAM+" rodzin.");}const f=newFamily(name,S.families.length);f.color=color;S.families.push(f);sel=S.families.length-1;}
    save();closeSheet();render();toast("Zapisano rodzinę "+name);}
  if(t==="sim"){if(!$("#sFirst").value.trim()){$("#sFirst").focus();return;}saveSim();}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheet();if(view!=="home"||document.querySelector(".sheetBg")||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const n=S.families.length;if(!n)return;
  if(e.key==="ArrowRight")pick((sel+1)%n);if(e.key==="ArrowLeft")pick((sel-1+n)%n);});
let rz=0;addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>{if(view==="home")sizeStage();if(view==="tree"){applyT();}},120);});

/* ================= START ================= */
openDB().then(async d=>{db=d;const sy=await idbGet("sync");if(sy){SY.rev=sy.rev||0;SY.dirty=!!sy.dirty;}return load();}).then(d=>{S=d&&Array.isArray(d.families)&&!d.sample?d:empty();migrateS();idbPut("state",S);
  const firstTodo=S.families.findIndex(f=>f.status!=="done");sel=firstTodo<0?0:firstTodo;render();pull();});
try{if("serviceWorker" in navigator&&location.protocol==="https:"&&!/claude/.test(location.hostname))navigator.serviceWorker.register("/sw.js").catch(()=>{});}catch(e){}
