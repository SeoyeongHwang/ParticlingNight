# Who Are You? (p5.js on GitHub Pages)

- 정적 호스팅(GitHub Pages) 전용 구조.
- STT 기본값: **Web Speech API**(브라우저 내).  
  - 크롬/엣지에서 잘 동작, 사파리/파폭은 제한 가능.
- **원격 STT(OpenAI Whisper 등)** 쓰려면 `js/config.js`의
  - `mode: 'remote'`, `endpoint: 'https://…'` 로 설정하세요. (본인 서버/Workers)

## 배포
1. 이 디렉터리 그대로 깃허브 리포에 커밋
2. Settings → Pages → Deploy from branch → `main`/`root` 선택
3. 배포 URL 접속

## 개발 팁
- 에셋은 `/assets` 폴더에 넣고 `loadImage("assets/…")` 등으로 사용
- 모바일/데스크탑 마이크 권한 허용 필요
