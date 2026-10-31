const works = [
 {id:1,image:'01-hooded-portrait.webp',name:'Hooded portrait',cat:'portraits',category:'Portraits & Figures',ratio:'portrait'},
 {id:2,image:'02-crowned-figure.webp',name:'Crowned figure',cat:'portraits',category:'Portraits & Figures',ratio:'portrait'},
 {id:3,image:'03-checkered-vase-flowers.webp',name:'Flowers in a checkered vase',cat:'florals',category:'Flowers & Color',ratio:'landscape'},
 {id:4,image:'04-bread-and-fish.webp',name:'Bread and fish',cat:'still-life',category:'Still Life',ratio:'portrait'},
 {id:5,image:'05-walker-with-sheep.webp',name:'Walker with sheep',cat:'landscapes',category:'Landscapes & Reflection',ratio:'portrait'},
 {id:6,image:'06-landscape-winding-path.webp',name:'Winding landscape',cat:'landscapes',category:'Landscapes & Reflection',ratio:'portrait'},
 {id:7,image:'07-blue-yellow-florals.webp',name:'Yellow flowers on blue',cat:'florals',category:'Flowers & Color',ratio:'portrait'},
 {id:8,image:'08-floral-portrait-green.webp',name:'Floral portrait on green',cat:'portraits',category:'Portraits & Figures',ratio:'portrait'},
 {id:9,image:'09-red-floral-abstract.webp',name:'Red abstract florals',cat:'abstract',category:'Abstract Expressions',ratio:'portrait'},
 {id:10,image:'10-purple-flowers.webp',name:'Purple flowers',cat:'florals',category:'Flowers & Color',ratio:'portrait'}
];
const $ = (s)=>document.querySelector(s);
const img = (work)=>'./artworks/'+work.image;
const grid=$('#art-grid');
function renderGrid(filter='all'){
 const visible=filter==='all'?works:works.filter(w=>w.cat===filter);
 grid.innerHTML=visible.map(w=>`<button type="button" class="art-card" data-id="${w.id}" aria-label="View ${w.name}"><span class="art-image ${w.ratio}"><img src="${img(w)}" alt="Original artwork: ${w.name}" loading="lazy"></span><span class="art-caption"><span><strong>${w.name}</strong><small>${w.category}</small></span><span class="art-card-icon" aria-hidden="true">↗</span></span></button>`).join('');
 grid.querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',()=>openArt(Number(b.dataset.id))));
}
renderGrid();
document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{
 document.querySelectorAll('.filter').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});
 btn.classList.add('active');btn.setAttribute('aria-pressed','true');renderGrid(btn.dataset.filter);
}));
let active=works[0];
function openArt(id){const w=works.find(v=>v.id===id);if(!w)return;active=w;$('#modal-img').src=img(w);$('#modal-img').alt='Original artwork: '+w.name;$('#modal-title').textContent=w.name;$('#modal-number').textContent=String(w.id).padStart(2,'0')+' / 10';$('#modal-category').textContent=w.category;$('#art-modal').showModal()}
$('#close-art').addEventListener('click',()=>$('#art-modal').close());$('#art-modal').addEventListener('click',e=>{if(e.target===$('#art-modal'))$('#art-modal').close()});
const categories=[
 {id:'arrival',name:'Welcome & Featured',works:[1]},
 {id:'portraits',name:'Portraits & Figures',works:[2,8]},
 {id:'florals',name:'Flowers & Color',works:[3,7,10]},
 {id:'still-life',name:'Still Life',works:[4]},
 {id:'landscapes',name:'Landscapes & Reflection',works:[5,6]},
 {id:'abstract',name:'Abstract Expressions',works:[9]},
 {id:'collecting',name:'Artist & Collecting',works:[8]}
];
let room=0, roomArtwork=0;
$('#walk-room-list').innerHTML=categories.map((c,i)=>`<button class="walk-room-btn ${i===0?'selected':''}" data-room="${i}" aria-pressed="${i===0}"><span>${String(i+1).padStart(2,'0')}</span><strong>${c.name}</strong><span aria-hidden="true">↗</span></button>`).join('');
function renderRoom(){const c=categories[room];const art=works.find(w=>w.id===c.works[roomArtwork]);$('#walk-image').src=img(art);$('#walk-image').alt=art.name+' by Sarah Norris Gyening';$('#art-wall-label').textContent=art.name;$('#room-floor-label').textContent=String(room+1).padStart(2,'0')+' / '+c.name.toUpperCase();$('#walk-count').textContent=String(roomArtwork+1).padStart(2,'0')+' / '+String(c.works.length).padStart(2,'0');document.querySelectorAll('.walk-room-btn').forEach((b,i)=>{b.classList.toggle('selected',i===room);b.setAttribute('aria-pressed',String(i===room))});}
$('#walk-room-list').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{room=Number(b.dataset.room);roomArtwork=0;renderRoom()}));
$('#walk-prev').addEventListener('click',()=>{roomArtwork--;if(roomArtwork<0){room=(room+categories.length-1)%categories.length;roomArtwork=categories[room].works.length-1}renderRoom()});
$('#walk-next').addEventListener('click',()=>{roomArtwork++;if(roomArtwork>=categories[room].works.length){room=(room+1)%categories.length;roomArtwork=0}renderRoom()});
renderRoom();
const select=$('#inquiry-work'); select.innerHTML=works.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
function openInquiry(){const m=$('#art-modal');if(m.open)m.close();select.value=String(active.id);$('#copy-feedback').textContent='';$('#inquiry-dialog').showModal()}
$('#open-inquiry').addEventListener('click',openInquiry);$('#modal-inquire').addEventListener('click',openInquiry);$('#close-inquiry').addEventListener('click',()=>$('#inquiry-dialog').close());$('#inquiry-dialog').addEventListener('click',e=>{if(e.target===$('#inquiry-dialog'))$('#inquiry-dialog').close()});
$('#copy-inquiry').addEventListener('click',async()=>{const w=works.find(w=>w.id===Number(select.value));const name=$('#inquiry-name').value.trim();const message=$('#inquiry-message').value.trim();const out=`Artwork inquiry — ${w.name}\n\n${message}${name?'\n\nFrom: '+name:''}`; try{await navigator.clipboard.writeText(out);$('#copy-feedback').textContent='Copied. Share this message with Sarah using your preferred contact method.';}catch{const t=document.createElement('textarea');t.value=out;document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();$('#copy-feedback').textContent=ok?'Copied. Share this message with Sarah.':'Unable to copy automatically. Please select and copy your message manually.';}});
const toggle=$('.menu-toggle');toggle.addEventListener('click',()=>{const nav=$('#mobile-menu');const open=nav.hidden;nav.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close menu':'Open menu')});$('#mobile-menu').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{$('#mobile-menu').hidden=true;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open menu')}));
$('#year').textContent=new Date().getFullYear();
