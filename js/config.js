// GitHub Pages용 기본값: 사용자가 본인 OpenAI 키를 입력해 브라우저에서 직접 호출
window.CONFIG = {
    stt: {
      mode: 'openai',      // 'openai' | 'webspeech' | 'remote'
      language: 'ko',      // Whisper 언어 힌트 (원하면 'en')
      saveKeyLocally: false // 사용자가 체크하면 true로 바뀜
      // remote 모드시 endpoint: 'https://your-worker.example.workers.dev/api/stt'
    }
  };
  