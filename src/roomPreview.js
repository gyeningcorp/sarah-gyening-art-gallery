// Lightweight room preview. Keeps photos local and does not claim spatial AR tracking.
export function initRoomPreview(artworks) {
  const style = document.createElement('style');
  style.textContent = [
    '.rp-open, .rp-open body { overflow: hidden !important; }',
    '.rp[hidden], .rp [hidden] { display: none !important; }',
    '.rp { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 10px; background: rgba(16,13,14,.83); box-sizing: border-box; }',
    '.rp * { box-sizing: border-box; }',
    '.rp-dialog { background: #fcfaf8; color: #292122; width: min(96vw,940px); max-height: min(95dvh,940px); display:flex; flex-direction:column; border-radius: 14px; box-shadow: 0 15px 80px #0007; overflow:hidden; font-family: Arial, sans-serif; }',
    '.rp-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 16px; border-bottom:1px solid #dfd5d1; }',
    '.rp-header strong { font-size:18px; font-family:Georgia,serif; font-weight:500; }',
    '.rp-button, .rp select { border:1px solid #cfc3bf; background:#fff; color:#292122; font:inherit; font-size:13px; border-radius:7px; padding:9px 11px; cursor:pointer; }',
    '.rp-button:focus-visible, .rp select:focus-visible, .rp input:focus-visible { outline: 2px solid #b84c47; outline-offset:2px; }',
    '.rp-close { font-size:25px; width:38px; height:38px; line-height:1; }',
    '.rp-tools { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:11px 16px; }',
    '.rp-tools label { font-size:12px; color:#594a48; }',
    '.rp-select { flex:1 1 230px; min-width:0; }',
    '.rp-select select { width:100%; }',
    '.rp-tools .rp-button { flex:0 0 auto; }',
    '.rp-stage { position:relative; width:100%; min-height:210px; height:min(53dvh,530px); overflow:hidden; background:linear-gradient(140deg,#c4b6ac,#eee4dc 45%,#b2a197); touch-action:none; }',
    '.rp-stage::before { content:""; position:absolute; inset:0; background:linear-gradient(90deg,#0001,transparent 40%,#fff2); pointer-events:none; }',
    '.rp-background { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }',
    '.rp-art { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); padding:4px; background:#f9f7f4; border:3px solid #41302a; box-shadow:2px 6px 16px #0006; display:flex; justify-content:center; align-items:center; touch-action:none; cursor:grab; user-select:none; }',
    '.rp-art img { width:100%; height:100%; object-fit:contain; pointer-events:none; display:block; }',
    '.rp-stage.rp-calibrating .rp-art { pointer-events:none; opacity:.7; }',
    '.rp-empty { position:absolute; left:12px; right:12px; top:13px; text-align:center; color:#493a37; font-size:13px; background:#ffffffe8; padding:8px; border-radius:7px; pointer-events:none; }',
    '.rp-footer { padding:11px 16px 14px; display:grid; gap:10px; }',
    '.rp-measure { display:flex; gap:12px; align-items:center; flex-wrap:wrap; font-size:13px; }',
    '.rp-measure strong { font-weight:650; }',
    '.rp-measure input { flex:1 1 140px; min-width:80px; accent-color:#b34d48; }',
    '.rp-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }',
    '.rp-primary { background:#302625; color:white; border-color:#302625; }',
    '.rp-help { font-size:11px; line-height:1.35; color:#655c59; margin:0; }',
    '.rp-status { font-size:12px; min-height:16px; color:#68524b; margin:0; }',
    '.rp [data-room-preview] { cursor:pointer; }',
    '.work .rp-entry { display:block; margin-top:10px; font-size:13px; padding:10px 12px; border:1px solid #ad4b44; background:#fff6f4; color:#6f302c; cursor:pointer; width:100%; text-align:center; font-weight:600; }',
    '.mobile-artwork .rp-entry { align-self:flex-start; font-size:11px; border-radius:4px; border:1px solid #ad4b44; padding:8px; background:#fff6f4; color:#6f302c; cursor:pointer; }',
    '@media (max-width:700px) { .rp { padding:0; } .rp-dialog { width:100vw; height:100dvh; max-height:none; border-radius:0; } .rp-stage { height:auto; flex:1 1 auto; min-height:200px; } .rp-tools { padding:8px 12px; gap:6px; } .rp-tools .rp-button { padding:10px 8px; font-size:12px; } .rp-footer { padding:8px 12px max(12px,env(safe-area-inset-bottom,12px)); } .rp-header { padding:8px 12px; } }'
  ].join('\n');
  document.head.appendChild(style);

  const modal=document.createElement('div');
  modal.className='rp'; modal.hidden=true;
  modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','View Sarah artwork in your room');
  modal.innerHTML = '<div class="rp-dialog">' +
    '<div class="rp-header"><strong>View in Your Room · 8 × 10 in</strong><button type="button" class="rp-button rp-close" id="rpClose" aria-label="Close room preview">×</button></div>' +
    '<div class="rp-tools"><label class="rp-select">Choose painting <select id="rpSelect"></select></label>' +
    '<button class="rp-button" type="button" id="rpUpload">Upload room photo</button>' +
    '<button class="rp-button" type="button" id="rpTake">Take photo</button>' +
    '<button class="rp-button" type="button" id="rpLive">Live camera</button></div>' +
    '<div class="rp-stage" id="rpStage">' +
    '<img id="rpPhoto" class="rp-background" alt="Your room photo" hidden>' +
    '<video id="rpVideo" class="rp-background" autoplay muted playsinline hidden></video>' +
    '<span class="rp-empty" id="rpEmpty">Add a picture of your wall, or open your camera. Drag the painting to position it.</span>' +
    '<div class="rp-art" id="rpArt" aria-label="Drag painting to move it"><img id="rpArtImage" alt="Selected artwork"></div></div>' +
    '<div class="rp-footer"><div class="rp-measure"><strong id="rpDimensions">8 × 10 in (20.3 × 25.4 cm)</strong>' +
    '<label for="rpSize">Preview size</label><input id="rpSize" type="range" min="65" max="260" value="160"></div>' +
    '<div class="rp-actions"><button class="rp-button" type="button" id="rpCalibrate">Calibrate using letter paper</button>' +
    '<button class="rp-button rp-primary" type="button" id="rpSave">Save preview</button></div>' +
    '<p class="rp-status" id="rpStatus" role="status"></p>' +
    '<p class="rp-help">Photos stay on your device. Preview size is adjustable; for a closer estimate, place an 8.5-inch-wide sheet of letter paper against the wall, photograph it, then calibrate by tapping its left and right edges. Live camera is an overlay, not wall-tracked AR.</p></div>' +
    '<input id="rpFile" type="file" accept="image/*" hidden>' +
    '<input id="rpCapture" type="file" accept="image/*" capture="environment" hidden>' +
    '</div>';
  document.body.appendChild(modal);
  const byId=id=>modal.querySelector('#'+id);
  const stage=byId('rpStage'), artBox=byId('rpArt'), artImage=byId('rpArtImage');
  const photo=byId('rpPhoto'), video=byId('rpVideo'), empty=byId('rpEmpty');
  const picker=byId('rpSelect'), slider=byId('rpSize'), status=byId('rpStatus');
  picker.innerHTML=artworks.map(a=>'<option value="'+a.code+'">'+a.title+' · '+a.code+'</option>').join('');
  let current=artworks[0], stream=null, uploadUrl=null, mode='empty', calibrated=0;
  let centerX=.5,centerY=.5, calibrating=false, taps=[], previousFocus=null;
  const setStatus=t=>{status.textContent=t;};
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const getOrientation=()=> {
    if (!artImage.naturalWidth) return false;
    return artImage.naturalWidth>artImage.naturalHeight;
  };
  function updateArt(){
    const land=getOrientation(), wIn=land?10:8, hIn=land?8:10;
    byId('rpDimensions').textContent=wIn+' × '+hIn+' in ('+(wIn*2.54).toFixed(1)+' × '+(hIn*2.54).toFixed(1)+' cm)';
    const width=calibrated ? wIn*calibrated : Number(slider.value);
    artBox.style.width=clamp(width,35,stage.clientWidth*.95)+'px';
    artBox.style.aspectRatio=wIn+'/'+hIn;
    artBox.style.left=(centerX*100)+'%';
    artBox.style.top=(centerY*100)+'%';
    slider.disabled=!!calibrated;
  }
  function selectArt(code){
    current=artworks.find(a=>a.code===code)||artworks[0];
    picker.value=current.code;
    artImage.src='/artworks/'+current.file;
    artImage.alt=current.title+' by Sarah Norris Gyening';
    artImage.onload=updateArt;
    calibrated=0;slider.disabled=false;updateArt();
    if (modal.hidden===false) setStatus('Move the painting to your preferred spot on the wall.');
  }
  function stopCamera(){
    if (stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
    video.pause();video.srcObject=null;
    video.hidden=true;
  }
  function showPhoto(file){
    if (!file) return;
    if (!file.type.startsWith('image/')){setStatus('Please select an image file.');return;}
    stopCamera();
    if(uploadUrl) URL.revokeObjectURL(uploadUrl);
    uploadUrl=URL.createObjectURL(file);
    photo.src=uploadUrl; photo.hidden=false;video.hidden=true;
    empty.hidden=true;mode='photo';calibrated=0;slider.disabled=false;
    centerX=.5;centerY=.5;updateArt();
    setStatus('Move and resize the painting, or calibrate it against letter paper.');
  }
  async function openCamera(){
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      setStatus('Live camera is unavailable. Use Take photo or Upload room photo instead.');
      return;
    }
    try {
      stopCamera();
      stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});
      if(modal.hidden){stopCamera();return;}
      video.srcObject=stream;await video.play();
      photo.hidden=true;video.hidden=false;empty.hidden=true;mode='camera';
      calibrated=0;slider.disabled=false;updateArt();
      setStatus('Live view: drag and resize to preview. This is not anchored AR.');
    } catch(e) {stopCamera();setStatus('Camera not available or permission denied. Try Take photo instead.');}
  }
  function open(code){
    previousFocus=document.activeElement;
    selectArt(code||artworks[0].code);
    modal.hidden=false;document.documentElement.classList.add('rp-open');
    requestAnimationFrame(updateArt);
    byId('rpClose').focus();
  }
  function close(){
    stopCamera();calibrating=false;stage.classList.remove('rp-calibrating');
    modal.hidden=true;document.documentElement.classList.remove('rp-open');
    if(previousFocus && typeof previousFocus.focus==='function')previousFocus.focus({preventScroll:true});
  }
  byId('rpClose').addEventListener('click',close);
  modal.addEventListener('click',e=>{if(e.target===modal)close();});
  document.addEventListener('keydown',e=>{if(!modal.hidden && e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}});
  byId('rpUpload').addEventListener('click',()=>byId('rpFile').click());
  byId('rpTake').addEventListener('click',()=>byId('rpCapture').click());
  for(const id of ['rpFile','rpCapture'])byId(id).addEventListener('change',e=>{showPhoto(e.target.files[0]);e.target.value='';});
  byId('rpLive').addEventListener('click',openCamera);
  picker.addEventListener('change',()=>selectArt(picker.value));
  slider.addEventListener('input',()=>{calibrated=0;updateArt();});
  let drag=null;
  artBox.addEventListener('pointerdown',e=>{
    if(calibrating)return;
    e.preventDefault();drag={x:e.clientX,y:e.clientY,px:centerX,py:centerY};
    artBox.setPointerCapture(e.pointerId);
  });
  artBox.addEventListener('pointermove',e=>{
    if(!drag)return;
    const box=stage.getBoundingClientRect();
    centerX=clamp(drag.px+(e.clientX-drag.x)/box.width,.05,.95);
    centerY=clamp(drag.py+(e.clientY-drag.y)/box.height,.05,.95);
    updateArt();
  });
  artBox.addEventListener('pointerup',()=>{drag=null;});
  artBox.addEventListener('pointercancel',()=>{drag=null;});
  byId('rpCalibrate').addEventListener('click',()=>{
    if(mode!=='photo'){setStatus('Take or upload a still photo with letter paper on your wall before calibrating.');return;}
    calibrating=true;taps=[];stage.classList.add('rp-calibrating');
    setStatus('Tap the left edge of the letter paper, then its right edge (8.5 inches apart).');
  });
  stage.addEventListener('pointerup',e=>{
    if(!calibrating)return;
    const bounds=stage.getBoundingClientRect();
    taps.push(clamp(e.clientX-bounds.left,0,bounds.width));
    if(taps.length===1)setStatus('Now tap the right edge of the sheet of letter paper.');
    if(taps.length===2){
      const px=Math.abs(taps[1]-taps[0]);
      calibrating=false;stage.classList.remove('rp-calibrating');
      if(px<25){setStatus('Those taps were too close. Try again.');return;}
      calibrated=px/8.5;updateArt();
      setStatus('Approximate scale calibrated from 8.5-inch paper. Drag the painting into place.');
    }
  });
  function drawCover(ctx,source,sw,sh,w,h){
    const scale=Math.max(w/sw,h/sh), dw=sw*scale,dh=sh*scale;
    ctx.drawImage(source,(w-dw)/2,(h-dh)/2,dw,dh);
  }
  byId('rpSave').addEventListener('click',()=>{
    if(!artImage.complete || !artImage.naturalWidth){setStatus('The painting is still loading.');return;}
    const ratio=Math.min(2,window.devicePixelRatio||1);
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(stage.clientWidth*ratio);canvas.height=Math.round(stage.clientHeight*ratio);
    const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
    const w=stage.clientWidth,h=stage.clientHeight;
    const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#c4b6ac');bg.addColorStop(.5,'#eee4dc');bg.addColorStop(1,'#b2a197');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    try{
      if(mode==='photo'&&photo.complete&&photo.naturalWidth)drawCover(ctx,photo,photo.naturalWidth,photo.naturalHeight,w,h);
      if(mode==='camera'&&video.videoWidth)drawCover(ctx,video,video.videoWidth,video.videoHeight,w,h);
      const bw=artBox.offsetWidth,bh=artBox.offsetHeight,x=centerX*w-bw/2,y=centerY*h-bh/2;
      ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=12;ctx.shadowOffsetY=7;
      ctx.fillStyle='#f9f7f4';ctx.fillRect(x,y,bw,bh);
      ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
      ctx.strokeStyle='#41302a';ctx.lineWidth=3;ctx.strokeRect(x+1.5,y+1.5,bw-3,bh-3);
      const inset=7,aw=bw-2*inset,ah=bh-2*inset;
      const iw=artImage.naturalWidth,ih=artImage.naturalHeight;
      const scale=Math.min(aw/iw,ah/ih),fw=iw*scale,fh=ih*scale;
      ctx.drawImage(artImage,x+(bw-fw)/2,y+(bh-fh)/2,fw,fh);
    }catch(e){setStatus('Could not save this preview. Try uploading a room photo.');return;}
    canvas.toBlob(blob=>{
      if(!blob){setStatus('Could not save preview.');return;}
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='Sarah-Gyening-'+current.code+'-room-preview.png';
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),2000);
      setStatus('Preview saved to your device.');
    },'image/png');
  });
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-room-preview]');
    if(button){e.preventDefault();open(button.getAttribute('data-room-preview'));}
  });
  window.addEventListener('resize',()=>{if(!modal.hidden)updateArt();});
  selectArt(artworks[0].code);
  return {open,close,isOpen:()=>!modal.hidden};
}
