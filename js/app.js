/* ====== State & Globals ====== */
let bgPs=[], ctPs=[], spPs=[];
let bgPnum=200, ctNum=200, ctRange=50, spNum=0;
let myColor, spColor, personName="", personNameCalled=false;
let radius, g_radius_lv1, g_radius_lv2, g_radius_lv3;
let Start=false, End=false, endCnt=0, userName="Type Here";
let instructionCnt=0;
let volume=0, volNum=0, volSum=0, volAvg=0, noVolume=0, particleSize=0;

// --- Web Audio fallback (p5.sound 없이 동작)
let audioCtx, analyser, _timeData;
async function initMic() {
  // 사용자 제스처 이후에 호출되는 것이 안전. (startArt()에서 보장)
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AC = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AC();
  const src = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(analyser);
  _timeData = new Uint8Array(analyser.fftSize);
  // RMS 볼륨 함수
  window.__getVolume = function () {
    analyser.getByteTimeDomainData(_timeData);
    let sum = 0;
    for (let i = 0; i < _timeData.length; i++) {
      const v = (_timeData[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / _timeData.length); // 0~1 근사
  };
}


// UI refs
const statusEl = document.getElementById('status');
const outEl = document.getElementById('out');

function setStatus(s){ statusEl.textContent=s||''; }

/* ====== Utilities ====== */
function nameToColor(name){
  let h=0; for(let i=0;i<name.length;i++) h=(h*31 + name.charCodeAt(i))|0;
  h >>>= 0;
  return color((h>>16)&255,(h>>8)&255,h&255);
}
function handleTranscript(t){
  if (!Start) startArt();
  const low = t.toLowerCase();
  if(low.includes('okay') || low==='ok' || low==='okey'){ End=true; return; }
  personName = t;
  spColor = nameToColor(t);
  personNameCalled=false;
}
window.handleTranscript = handleTranscript;

/* ====== Particles ====== */
class BgParticle{
  constructor(x,y,mult,c){ this.pos=createVector(x,y); this.mult=mult; this.c=c; this.traveled=0; this.vel=createVector(random(0.2,1.0),0); this.opacity=0; this.opacityMax=random(80,160); }
  update(){ this.traveled++; this.opacity = this.traveled<100 ? (this.traveled%100)*0.01*this.opacityMax : this.opacityMax; }
  display(){ fill(red(this.c), green(this.c), blue(this.c), this.opacity); noStroke(); ellipse(this.pos.x, this.pos.y, this.vel.x*this.mult*4); }
  move(){ this.pos.x -= this.vel.x*this.mult; }
}
class CtParticle{
  constructor(x,y,vx,vy,r,c,mode){
    this.center=createVector(width/2,height/2);
    this.pos=createVector(x,y);
    this.vel=createVector(vx,vy);
    this.acc=createVector(0,0);
    this.target=createVector(0,0);
    this.maxForce=random(4,8);
    this.c=c; this.range=r; this.size=2; this.appearance=mode;
    this.maxParticleSize=12; this.minParticleSize=4;
    this.calTarget();
  }
  calTarget(){
    const angle=radians(random(360));
    this.target.x = abs(randomGaussian())*this.range*cos(angle)+this.center.x;
    this.target.y = abs(randomGaussian())*this.range*sin(angle)+this.center.y;
  }
  update(){
    const steer=createVector(this.target.x,this.target.y);
    const distance=dist(this.center.x,this.center.y,this.target.x,this.target.y);
    this.size=map(distance,0,this.range*1.2,this.maxParticleSize,this.minParticleSize);
    if(distance>0.5){
      const distThreshold=20;
      steer.sub(this.pos); steer.normalize();
      steer.mult(map(min(distance,distThreshold),0,distThreshold,0,this.maxForce));
      this.acc.add(steer);
    }
  }
  display(){
    const m=this.appearance;
    if(m===0){ this.maxParticleSize=12; this.minParticleSize=6; fill(this.c); noStroke(); ellipse(this.pos.x,this.pos.y,this.size); }
    else if(m===1){ this.maxParticleSize=12; this.minParticleSize=2; stroke(this.c); strokeWeight(1.5); noFill(); ellipse(this.pos.x,this.pos.y,this.size); }
    else if(m===2){ this.maxParticleSize=12; this.minParticleSize=6; fill(this.c); noStroke(); rect(this.pos.x,this.pos.y,this.size,this.size); }
    else if(m===3){ this.maxParticleSize=12; this.minParticleSize=6; fill(this.c); noStroke(); beginShape();
      vertex(this.pos.x,this.pos.y-this.size); vertex(this.pos.x+this.size/2,this.pos.y);
      vertex(this.pos.x,this.pos.y+this.size); vertex(this.pos.x-this.size/2,this.pos.y); endShape(CLOSE); }
  }
  move(){ this.update(); this.vel.mult(0.95); this.vel.add(this.acc); this.pos.add(this.vel); this.acc.mult(0); this.display(); }
}
class SpParticle{
  constructor(x,y,vx,vy,vol,c,mode){
    this.cPos=createVector(x,y);
    this.cVel=createVector(vx,vy);
    this.cAcc=createVector(0,0);
    this.volume=Math.max(1, (vol|0));
    this.c=[]; this.mode=mode;
    this.radius=Math.log(this.volume+1)*10;
    this.pos=[]; this.vel=[]; this.acc=[]; this.target=[];
    for(let i=0;i<this.volume;i++){
      const angle=radians(random(360));
      this.target[i]=createVector(
        abs(randomGaussian())*this.radius/20*cos(angle)+this.cPos.x,
        abs(randomGaussian())*this.radius/20*sin(angle)+this.cPos.y
      );
      this.pos[i]=this.target[i].copy();
      this.vel[i]=createVector(0,0);
      this.acc[i]=createVector(this.cPos.x-this.pos[i].x, this.cPos.y-this.pos[i].y);
      this.c[i]=c;
    }
  }
  update(centerR){
    if((this.cPos.x>=width/2-centerR && this.cPos.x<=width/2+centerR) && (this.cPos.y>=height/2-centerR && this.cPos.y<=height/2+centerR)) return false;
    return true;
  }
  display(){
    for(let i=0;i<this.volume;i++){
      if(this.mode===0){
        fill(red(this.c[i]), green(this.c[i]), blue(this.c[i]), random(100,255)); noStroke();
        circle(this.pos[i].x, this.pos[i].y, map(dist(this.pos[i].x,this.pos[i].y,this.cPos.x,this.cPos.y), this.radius+10,0,1,10));
      }else if(this.mode===1){
        stroke(this.c[i], noise(random(10+i))*255); strokeWeight(random(1.2,2));
        line(this.pos[i].x,this.pos[i].y,this.cPos.x,this.cPos.y);
      }else if(this.mode===2){
        fill(255, random(255)); stroke(this.c[i]); strokeWeight(0.5);
        rect(this.pos[i].x,this.pos[i].y,
          map(dist(this.pos[i].x,this.pos[i].y,this.cPos.x,this.cPos.y), this.radius+20,0,1,6),
          map(dist(this.pos[i].x,this.pos[i].y,this.cPos.x,this.cPos.y), this.radius+20,0,15,1));
      }else if(this.mode===3){
        noStroke(); fill(this.c[i]);
        const r=map(dist(this.pos[i].x,this.pos[i].y,this.cPos.x,this.cPos.y), this.radius+20,0,2,10);
        beginShape();
        vertex(this.pos[i].x,this.pos[i].y-r); vertex(this.pos[i].x+r*0.5,this.pos[i].y);
        vertex(this.pos[i].x,this.pos[i].y+r); vertex(this.pos[i].x-r*0.5,this.pos[i].y);
        endShape(CLOSE);
      }
    }
  }
  move(){
    this.cVel.add(this.cAcc); this.cPos.add(this.cVel);
    for(let i=0;i<this.volume;i++){
      this.vel[i].mult(0.95); this.vel[i].add(this.acc[i]);
      this.pos[i].add(this.cVel); this.pos[i].sub(this.vel[i]); this.acc[i].mult(0);
    }
  }
}

function startArt(){
    if (Start) return;
    Start = true;
    for (let i = 0; i < ctNum; i++) {
      ctPs.push(new CtParticle(width/2, height/2, 0, 0, ctRange, myColor || color(255), 0));
    }
    // 🔊 p5.sound 대신 Web Audio 시작
    if (!window.__getVolume) {
      initMic().catch(e => console.warn('mic init failed:', e));
    }
  }

/* ====== p5 lifecycle ====== */
let cnv;

function setup(){
  cnv = createCanvas(windowWidth, windowHeight);
  const holder = document.getElementById('canvas-holder');
  if (holder) cnv.parent(holder);   // ★ 캔버스를 우리가 만든 자리로 이동

  background(0);
  smooth();

  radius = ctRange/2;
  g_radius_lv1 = ctRange*8;
  g_radius_lv2 = ctRange*5;
  g_radius_lv3 = ctRange*2;

  for(let i=0;i<bgPnum;i++){
    bgPs.push(new BgParticle(random(width), random(height), random(0.1,2.1), color(255)));
  }
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); }

function draw(){
  blendMode(BLEND);
  background(0);

  if(!Start){
    background(0);
    fill((userName==="Type Here"||userName==="")?255: (myColor||color(255)));
    textAlign(CENTER,CENTER);
    textSize(40);
    text("Who are you?\nPlease type in English using your keyboard.", width/2, height/2-130);
    textSize(60); text(userName, width/2, height/2+40);
    textSize(18); fill(255);
    text("Make sure you are in a quiet place now before pressing the ENTER key.\nPlease allow microphone access when prompted.", width/2, height/2+170);

    const trimmed = userName.trim();
    let sum=0; for(let i=0;i<trimmed.length;i++) sum+=trimmed.charCodeAt(i);
    const n = int(map(sum,0,2000,0,16777215));
    myColor = color((n>>16)&255, (n>>8)&255, n&255);

  } else if(Start && !End){
    blendMode(LIGHTEST);
    background(0);

    if(instructionCnt<1500){
      fill(255,255); textSize(16); textAlign(CENTER,TOP);
      text("Name someone that comes to your mind among the people you've met or know!\n(Please wait 3-5 seconds before saying the next one. If nothing happens, please say again.)\nIf there are no more people you want to mention, please say \"Okay!\"", width/2,50);
      instructionCnt++;
    } else if(instructionCnt<1755){
      fill(255, 255-(instructionCnt-1500)); textSize(16); textAlign(CENTER,TOP);
      text("Name someone that comes to your mind among the people you've met or know!\n(Please wait 3-5 seconds before saying the next one. If nothing happens, please say again.)\nIf there are no more people you want to mention, please say \"Okay!\"", width/2,50);
      instructionCnt++;
    }

    for(let i=bgPs.length-1;i>=0;i--){
      const p=bgPs[i]; p.display(); p.update(); p.move();
      if(p.pos.x<0){ bgPs.splice(i,1); bgPs.push(new BgParticle(width+10, random(height), random(0,2.1), color(255))); }
    }

    for(let i=0;i<ctPs.length;i++){
      const c=ctPs[i];
      if(c.range<ctRange){ c.range=ctRange; c.calTarget(); }
      c.move();
    }

    if(frameCount%60===0 && ctPs.length>0){
      const base=ctPs[0];
      for(let i=0;i<5;i++) ctPs.push(new CtParticle(width/2, height/2, 0,0, ctRange, base.c, base.appearance));
    }

    fill(myColor); textSize(18); textAlign(CENTER,CENTER);
    text(userName, width/2, height/2 + g_radius_lv3 + 100);

    if (window.__getVolume) {
      volume = window.__getVolume();  // 0~1 근사
      if (volume > 0.01) {
        noVolume = 0;
        volNum++; volSum += volume; volAvg = volSum / volNum;
        particleSize = int(map(volAvg, 0.01, 0.1, 40, 100)); // 임계/스케일은 기존 유지
      } else {
        noVolume++;
      }
      if (noVolume > 100) { volNum = 0; volSum = 0; }
    }

    if(!personNameCalled && personName){
      addStar(volAvg, particleSize, spColor); personNameCalled=true; particleSize=0;
    }

    for(let i=spPs.length-1;i>=0;i--){
      const sp=spPs[i];
      if(!sp.update(radius)){
        ctRange += 2;
        for(let j=0;j<sp.volume/2;j++){
          if(ctPs.length>j){
            const c=ctPs[j];
            c.calTarget();
            ctPs.push(new CtParticle(width/2,height/2,0,0,ctRange, sp.c[0], sp.mode));
          }
        }
        for(let k=0;k<ctPs.length;k++) ctPs[k].appearance = sp.mode;
        spPs.splice(i,1); continue;
      }
      if(sp.cPos.x<0||sp.cPos.x>width||sp.cPos.y<0||sp.cPos.y>height){ spPs.splice(i,1); continue; }

      const d = dist(sp.cPos.x, sp.cPos.y, width/2, height/2);
      if(d<=g_radius_lv1 && d>g_radius_lv2){
        sp.cAcc = p5.Vector.sub(createVector(width/2,height/2), sp.cPos); sp.cAcc.normalize(); sp.cAcc.div(100); sp.cAcc.y/=2;
      }else if(d<=g_radius_lv2 && d>g_radius_lv3){
        sp.cAcc = p5.Vector.sub(createVector(width/2,height/2), sp.cPos); sp.cAcc.normalize(); sp.cAcc.div(50); sp.cAcc.y/=2;
        if(frameCount%30===0 && ctPs.length>0){
          const c=ctPs[0];
          ctPs.push(new CtParticle(width/2,height/2,0,0,ctRange, sp.c[0], c.appearance));
          for(let j=0;j<min(5,sp.volume);j++) sp.c[sp.volume-j-1]=c.c;
        }
        if(frameCount%120===0) ctRange+=1;
      }else if(d<=g_radius_lv3){
        sp.cAcc = p5.Vector.sub(createVector(width/2,height/2), sp.cPos); sp.cAcc.normalize(); sp.cAcc.div(10); sp.cAcc.y/=2;
        if(frameCount%60===0){ for(let j=0;j<sp.volume/5;j++) if(ctPs.length>0){ const c=ctPs[0]; ctPs.push(new CtParticle(width/2,height/2,0,0,ctRange, sp.c[0], c.appearance)); } }
        if(frameCount%120===0) ctRange+=1;
      }else{ sp.cAcc.mult(0); }

      sp.display(); sp.move();
    }

  } else if(End){
    background(0);
    for(let i=bgPs.length-1;i>=0;i--){
      const p=bgPs[i]; p.opacityMax-=2; p.display(); p.update(); p.move();
      if(p.pos.x<0) bgPs.splice(i,1);
    }
    for(let i=0;i<ctPs.length;i++){
      const c=ctPs[i]; c.acc.mult(-1e-15); c.vel.add(c.acc.mult(1e-9)); c.pos.add(c.vel); c.update(); c.display();
    }
    if(endCnt===150){
      fill(220); textSize(14); textAlign(LEFT,BOTTOM);
      text(`< ${userName} with ${spNum} memorable beings >, ${year()}.\np5.js (GitHub Pages), ${width} x ${height} pixels.`, 50, height-50);
      textAlign(RIGHT,BOTTOM);
      text("Thank you for enjoying! +_+", width-50, height-50);
      noLoop();
    }
    endCnt++;
  }
}

function keyTyped(){
  if(!Start){
    if(key.length===1){
      if(userName==="Type Here") userName="";
      userName+=key;
    } else if(key===' ') userName+=' ';
  }
  return false;
}
function keyPressed(){
  if(!Start && keyCode===BACKSPACE){
    if(userName.length>0) userName=userName.substring(0,userName.length-1);
    return false;
  }
  if(keyCode===ENTER){
    if (!Start && userName !== "Type Here" && userName !== "") {
      startArt();               // ★ 공용 시작 함수 사용
      STT.start(handleTranscript);
      setStatus((window.CONFIG?.stt?.mode)==='webspeech' ? 'Listening (Web Speech)…' : 'Recording…');
    } else if (Start) {
      End = true; STT.stop();
    }      
  }
}

function addStar(vol,size,colorset){
  let startH=random(height);
  while(startH < height/2 - g_radius_lv1 || startH > height/2 + g_radius_lv1) startH=random(height);
  let mode=0;
  if(vol<0.035) mode=0;
  else if(vol<0.045) mode=1;
  else if(vol<0.055) mode=3;
  else mode=2;
  spPs.push(new SpParticle(width, startH, -random(1,2), 0, size||50, colorset, mode));
  spNum++;
}

// ===== Safety boot: p5가 로드됐는데도 캔버스가 없다면 강제 생성
window.addEventListener('load', () => {
    setTimeout(() => {
      if (!document.querySelector('canvas') && typeof createCanvas === 'function') {
        const fallback = createCanvas(windowWidth, windowHeight);
        const holder = document.getElementById('canvas-holder');
        if (holder) fallback.parent(holder);
      }
    }, 0);
  });