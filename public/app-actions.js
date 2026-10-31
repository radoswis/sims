"use strict";

/* ================= AKCJE ================= */
const A={
  go:el=>go(el.dataset.v),
  pick:el=>pick(+el.dataset.i),
  play:()=>{const f=S.families[sel];if(f.status==="todo"){f.status="prog";save();}curFam=f.id;go("family");},
  endRound:()=>{S.round++;S.families.forEach(f=>{f.status="todo";f.day=1;f.tasks.forEach(t=>t.done=false);});save();sel=0;render();toast("Zaczyna się runda "+S.round);},
  addFamily:()=>{if(S.families.length>=MAX_FAM)return toast("Osiągnięto limit "+MAX_FAM+" rodzin.");familySheet(null);},
  editFamily:()=>familySheet(fam(curFam)),
  setStatus:el=>{fam(curFam).status=el.dataset.v;save();render();},
  setDay:el=>{const f=fam(curFam);f.day=+el.dataset.v;if(f.status==="todo")f.status="prog";save();render();},
  toggleTask:el=>{const t=fam(curFam).tasks.find(t=>t.id===el.dataset.id);t.done=el.checked;el.closest(".check").classList.toggle("done",t.done);save();},
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
  delLot:el=>{S.lots=S.lots.filter(l=>l.id!==el.dataset.id);save();render();},
  export:()=>{try{const b=new Blob([JSON.stringify(S)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="rotacja-"+(S.hood||"otoczenie")+"-runda"+S.round+".json";document.body.append(a);a.click();a.remove();toast("Kopia pobrana");}catch(e){toast("Nie udało się pobrać kopii.");}},
  clearAll:el=>confirmTap(el,"Na pewno? Tego nie da się cofnąć",()=>{S={v:1,hood:S.hood||"Miłowo",round:1,families:[],sims:[],rules:"",lots:[]};save();sel=0;go("home");toast("Wyczyszczono dane");})
};
function guessLast(f){const m=S.sims.find(s=>s.fam===f.id&&s.last);return m?m.last:"";}
function confirmTap(el,msg,fn){if(el.dataset.confirm==="1")return fn();el.dataset.confirm="1";const o=el.textContent;el.textContent=msg;setTimeout(()=>{if(el.isConnected){el.dataset.confirm="0";el.textContent=o;}},3500);}

document.addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;if(el.tagName==="INPUT"&&el.type==="checkbox"){A[el.dataset.act](el);return;}e.preventDefault();A[el.dataset.act]&&A[el.dataset.act](el);});
document.addEventListener("input",e=>{const b=e.target.dataset.bind;if(!b)return;const v=e.target.value;
  if(b==="note"){const f=fam(curFam);f.notes[S.round+"-"+f.day]=v;}
  else if(b==="hood"||b==="rules")S[b]=v;
    save();});
document.addEventListener("change",e=>{if(e.target.id==="treeFam"){treeFam=e.target.value;treeFit=true;render();}
  if(e.target.id==="importFile"){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d||!Array.isArray(d.families)||!Array.isArray(d.sims))throw 0;S=d;S.lots=S.lots||[];migrateS();save();sel=0;go("home");toast("Wczytano kopię: runda "+S.round);}catch(x){toast("To nie jest plik kopii z tej aplikacji.");}};r.readAsText(file);}});
document.addEventListener("submit",e=>{e.preventDefault();const t=e.target.dataset.form;
  if(t==="task"){const i=$("#newTask"),v=i.value.trim();if(!v)return;fam(curFam).tasks.push({id:uid(),t:v,done:false});save();render();$("#newTask").focus();}
  if(t==="lot"){const n=$("#lotName").value.trim();if(!n)return;S.lots.push({id:uid(),name:n,owner:$("#lotOwner").value.trim(),level:$("#lotLvl").value});save();render();}
  if(t==="family"){const name=$("#fName").value.trim();if(!name)return;const color=(document.querySelector('input[name=fColor]:checked')||{}).value||COLORS[0];const id=e.target.dataset.id;
    if(id){const f=fam(id);f.name=name;f.color=color;}else{if(S.families.length>=MAX_FAM){closeSheet();return toast("Osiągnięto limit "+MAX_FAM+" rodzin.");}const f=newFamily(name,S.families.length);f.color=color;S.families.push(f);sel=S.families.length-1;}
    save();closeSheet();render();toast("Zapisano rodzinę "+name);}
  if(t==="sim"){if(!$("#sFirst").value.trim()){$("#sFirst").focus();return;}saveSim();}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheet();if(view!=="home"||document.querySelector(".sheetBg")||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const n=S.families.length;if(!n)return;
  if(e.key==="ArrowRight")pick((sel+1)%n);if(e.key==="ArrowLeft")pick((sel-1+n)%n);});
let rz=0;addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>{if(view==="home")sizeStage();if(view==="tree"){applyT();}},120);});

/* ================= START ================= */
openDB().then(d=>{db=d;return load();}).then(d=>{S=d&&Array.isArray(d.families)&&!d.sample?d:empty();migrateS();save();
  const firstTodo=S.families.findIndex(f=>f.status!=="done");sel=firstTodo<0?0:firstTodo;render();});
try{if("serviceWorker" in navigator&&location.protocol==="https:"&&!/claude/.test(location.hostname))navigator.serviceWorker.register("/sw.js").catch(()=>{});}catch(e){}
