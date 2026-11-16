// Rendering uses only the approved public result passed in by the Results page.
export function drawResultCard(canvas, data, crest) {
  const width = 1200, rowHeight = 92, rowsStart = 590;
  const breaksY = rowsStart + Math.max(data.frames.length, 1) * rowHeight + 46;
  const height = Math.max(1160, breaksY + 130 + Math.max(data.breaks.length, 1) * 43);
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const green='#073e31', ink='#18372c', muted='#64776b', gold='#d9bd7b';
  function text(value,x,y,size=28,color=ink,align='left',weight='400',family='Arial') {
    ctx.fillStyle=color;ctx.font=`${weight} ${size}px ${family}`;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(String(value),x,y);
  }
  function fitted(value,x,y,maxWidth,size,color=ink,align='left',weight='600') {
    let fontSize=size;ctx.font=`${weight} ${fontSize}px Arial`;
    while(ctx.measureText(value).width>maxWidth && fontSize>18){fontSize--;ctx.font=`${weight} ${fontSize}px Arial`;}
    text(value,x,y,fontSize,color,align,weight);
  }
  function roundRect(x,y,w,h,r,fill) {
    ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.fill();
  }
  ctx.fillStyle='#f3f6f0';ctx.fillRect(0,0,width,height);
  ctx.fillStyle=green;ctx.fillRect(0,0,width,256);
  ctx.fillStyle=gold;ctx.fillRect(0,252,width,4);
  if(crest){ctx.save();ctx.beginPath();ctx.arc(128,123,80,0,Math.PI*2);ctx.clip();ctx.drawImage(crest,48,43,160,160);ctx.restore();}
  text('HIGH PEAK & MARPLE',242,108,47,'#fcf4de','left','500','Georgia');
  text('SNOOKER LEAGUE',242,164,40,'#fcf4de','left','500','Georgia');
  text(`${data.season}  ·  OFFICIAL RESULT`,244,207,19,gold,'left','600');
  const date=new Date(data.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  text(`ROUND ${data.round}`,58,314,22,muted,'left','700');text(date,1142,314,22,muted,'right');
  roundRect(44,345,1112,200,18,'#ffffff');
  text('HOME',78,391,17,muted,'left','700');text('AWAY',1122,391,17,muted,'right','700');
  fitted(data.home,78,453,385,43,green,'left','700');fitted(data.away,1122,453,385,43,green,'right','700');
  text(data.award ? 'AWARDED' : `${data.homeFrames}–${data.awayFrames}`,600,466,data.award?38:98,green,'center','500','Georgia');
  text(`League points ${data.points[0]}–${data.points[1]}`,600,514,23,muted,'center');
  if(data.award) {
    fitted(`Match awarded to ${data.award}`,600,rowsStart+50,1040,30,green,'center');
  } else {
    text('FRAME',62,rowsStart-12,15,muted,'left','700');
    for(let index=0;index<data.frames.length;index++) {
      const frame=data.frames[index],y=rowsStart+index*rowHeight;
      roundRect(44,y,1112,rowHeight-5,9,index%2?'#edf3e8':'#ffffff');
      text(frame.slot,70,y+53,22,muted,'left','700');
      fitted(frame.home,116,y+53,350,29,frame.winner==='home'?green:muted,'left',frame.winner==='home'?'700':'400');
      fitted(frame.away,1122,y+53,350,29,frame.winner==='away'?green:muted,'right',frame.winner==='away'?'700':'400');
      text(frame.awarded?'AWARDED':`${frame.homeScore}–${frame.awayScore}`,600,y+54,frame.awarded?18:30,green,'center','700');
    }
  }
  ctx.fillStyle='#c9ad6e';ctx.fillRect(58,breaksY-8,1084,2);
  text('BREAKS 25+',58,breaksY+40,22,'#8b682c','left','700');
  if(!data.breaks.length)text('No qualifying breaks recorded',58,breaksY+86,25,muted);
  else data.breaks.forEach((entry,index)=>fitted(`${entry.player}   ${entry.values.join(', ')}`,58,breaksY+85+index*43,1070,28,green));
  text('highpeakandmarplesnookerleague.co.uk',600,height-34,20,muted,'center');
  return canvas;
}
let crestPromise;
function loadCrest() {
  return crestPromise ||= new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src='/logo.PNG';});
}
export async function showResultCard(data, trigger) {
  const canvas=document.createElement('canvas');
  drawResultCard(canvas,data,await loadCrest());
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('The result image could not be created. Please try again.');
  const url=URL.createObjectURL(blob);
  const dialog=document.createElement('dialog');dialog.className='result-card-dialog';
  dialog.setAttribute('aria-labelledby','result-card-title');
  dialog.innerHTML='<div class="result-card-heading"><h2 id="result-card-title">Share approved result</h2><button type="button" class="secondary" data-close-card aria-label="Close result card">Close</button></div><img class="result-card-preview" alt="Branded approved match result"><div class="result-card-actions"><button type="button" data-native-share hidden>Share image</button><a class="button secondary" data-download-card>Download image</a></div><p class="result-card-help">Download the image to attach it in WhatsApp.</p>';
  dialog.querySelector('img').src=url;
  const download=dialog.querySelector('[data-download-card]');download.href=url;download.download=data.filename;
  const share=dialog.querySelector('[data-native-share]');
  const file=typeof File==='function'?new File([blob],data.filename,{type:'image/png'}):null;
  let shareable=false;try{shareable=Boolean(file&&navigator.canShare?.({files:[file]})&&navigator.share);}catch{}
  if(shareable){share.hidden=false;dialog.querySelector('.result-card-help').textContent='Share through WhatsApp or another app, or download the image.';}
  share.addEventListener('click',async()=>{try{await navigator.share({files:[file],title:`${data.home} v ${data.away}`});}catch(error){if(error.name!=='AbortError')dialog.querySelector('.result-card-help').textContent='Sharing is unavailable here. Download the image instead.';}});
  function cleanup(){URL.revokeObjectURL(url);dialog.remove();if(trigger?.isConnected)trigger.focus();}
  function close(){if(dialog.open&&dialog.close)dialog.close();else cleanup();}
  dialog.querySelector('[data-close-card]').addEventListener('click',close);
  dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
  dialog.addEventListener('close',cleanup,{once:true});
  document.body.appendChild(dialog);
  if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
  dialog.querySelector('[data-close-card]').focus();
}
