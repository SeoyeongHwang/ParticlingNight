// STT backend: OpenAI(브라우저 직호출) + Web Speech + Remote 업로드
(function(){
    const recBtn = document.getElementById('recBtn');
    const statusEl = document.getElementById('status');
    const outEl = document.getElementById('out');
  
    let isRecording = false;
    let mediaRecorder = null;
    let chunks = [];
    let recognition = null;
    let lastTranscript = '';
  
    function setStatus(msg){ statusEl.textContent = msg || ''; }
    function logOut(msg){ outEl.textContent = msg || ''; }
  
    /* ====== OpenAI (browser) ====== */
    async function ensureOpenAIKey(){
      if(!window.__openaiKeyStore){ throw new Error('Key store missing'); }
      return await window.__openaiKeyStore.ensure();
    }
    async function openaiStart(){
      await ensureOpenAIKey();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunks = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      mediaRecorder.onstop = async ()=>{
        try{
          setStatus('Uploading to OpenAI…');
          const blob = new Blob(chunks, { type: 'audio/webm' }); chunks = [];
          const form = new FormData();
          form.append('model', 'whisper-1');  // 최신 스냅샷 사용 시 문서 확인
          const lang = (window.CONFIG?.stt?.language)||'';
          if(lang) form.append('language', lang);
          form.append('file', blob, 'audio.webm');
  
          const key = window.__openaiKeyStore.get();
          const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}` },
            body: form
          });
  
          const ct = res.headers.get('content-type') || '';
          const body = ct.includes('application/json') ? await res.json() : { error: await res.text() };
          if(!res.ok){
            // 401 등에서 키 재입력 유도
            if(res.status === 401){ window.__openaiKeyStore.clear(); }
            throw new Error(body.error?.message || body.error || `HTTP ${res.status}`);
          }
          const t = (body.text||'').trim();
          logOut('Heard: ' + t);
          window.onTranscript && window.onTranscript(t);
          setStatus('Done');
        }catch(e){
          logOut('Error(OpenAI): ' + (e?.message||e));
          setStatus('Failed');
        }
      };
      mediaRecorder.start();
      setStatus('Recording…');
    }
    function openaiStop(){ mediaRecorder && mediaRecorder.stop(); setStatus('Stopping…'); mediaRecorder=null; }
  
    /* ====== Web Speech ====== */
    function webspeechStart(onHeard){
      const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
      if(!Speech){ setStatus('Web Speech API not supported'); return; }
      recognition = new Speech();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = (window.CONFIG?.stt?.language === 'ko') ? 'ko-KR' : 'en-US';
      recognition.onresult = (e)=>{
        const last = e.results.length-1;
        const t = (e.results[last][0]?.transcript || '').trim();
        if(!t || t===lastTranscript) return;
        lastTranscript = t;
        logOut('Heard: ' + t);
        onHeard(t);
      };
      recognition.onerror = (e)=>{ logOut('Speech error: ' + e.error); };
      recognition.start();
      setStatus('Listening (Web Speech)…');
    }
    function webspeechStop(){ recognition && recognition.stop(); recognition=null; }
  
    /* ====== Remote (업로드 → 본인 서버/Workers) ====== */
    async function remoteStart(){
      const ep = window.CONFIG?.stt?.endpoint;
      if(!ep){ setStatus('Missing remote endpoint'); return; }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunks = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      mediaRecorder.onstop = async ()=>{
        try{
          setStatus('Uploading…');
          const blob = new Blob(chunks, { type: 'audio/webm' }); chunks = [];
          const res = await fetch(ep, { method:'POST', headers:{'content-type':'application/octet-stream'}, body: await blob.arrayBuffer() });
          const ct = res.headers.get('content-type') || '';
          const body = ct.includes('application/json') ? await res.json() : { error: await res.text() };
          if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
          const t = (body.text||'').trim();
          logOut('Heard: ' + t);
          window.onTranscript && window.onTranscript(t);
          setStatus('Done');
        }catch(e){ logOut('Error(remote): ' + (e?.message||e)); setStatus('Failed'); }
      };
      mediaRecorder.start();
      setStatus('Recording…');
    }
    function remoteStop(){ mediaRecorder && mediaRecorder.stop(); setStatus('Stopping…'); mediaRecorder=null; }
  
    /* ====== Public controls ====== */
    window.STT = {
      async start(onHeard){
        window.onTranscript = onHeard;
        const mode = (window.CONFIG?.stt?.mode)||'webspeech';
        if(mode==='openai'){
          await openaiStart();
          isRecording = true; recBtn.classList.add('rec'); recBtn.textContent='⏹ Stop';
        }else if(mode==='webspeech'){
          webspeechStart(onHeard);
          isRecording = true; recBtn.classList.add('rec'); recBtn.textContent='⏹ Stop';
        }else if(mode==='remote'){
          await remoteStart();
          isRecording = true; recBtn.classList.add('rec'); recBtn.textContent='⏹ Stop';
        }
      },
      stop(){
        const mode = (window.CONFIG?.stt?.mode)||'webspeech';
        if(mode==='openai') openaiStop();
        else if(mode==='webspeech') webspeechStop();
        else if(mode==='remote') remoteStop();
        isRecording = false; recBtn.classList.remove('rec'); recBtn.textContent='🎙️ Start';
      },
      async toggle(onHeard){
        if(isRecording) this.stop(); else await this.start(onHeard);
      }
    };
  
    recBtn.addEventListener('click', ()=> window.STT.toggle((t)=>{
      (window.handleTranscript||(()=>{}))(t);
    }));
  })();
  