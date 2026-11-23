# 우리 아기 수첩

앱 열기: https://amerikwano.github.io/baby-calendar/

예방접종·검진 일정, 출산 디데이, 일기와 사진첩, 개월 수별 육아 팁, 출산 혜택을 한곳에 모은 웹앱입니다.

- 휴대폰에서는 공유 메뉴의 "홈 화면에 추가"로 앱처럼 쓸 수 있습니다.
- 입력한 내용과 사진은 쓰는 기기에만 저장됩니다. 설정에서 백업 파일을 만들 수 있습니다.
- 알림은 캘린더 파일(.ics)을 휴대폰 캘린더에 넣으면 울립니다.
- AI 기능은 AI 서버를 따로 배포한 뒤 설정에 접근 코드를 넣어야 켜집니다(서버 주소는 `index.html`의 `AI_URL`). 컴퓨터에서 `ANTHROPIC_API_KEY`를 설정하고 `npm start`로 켜도 됩니다.

## AI 서버 배포 (Cloudflare Workers)

```
npm install
npm run ai:login
npm run ai:deploy
npm run ai:key    # Anthropic API 키 입력
npm run ai:code   # 12자 이상의 접근 코드 입력
```

하루 10회, 한 달 60회까지만 실행됩니다(`worker/wrangler.jsonc`에서 변경).

접종 일정은 질병관리청 표준예방접종일정표(2026) 기준이며, 실제 접종은 의료기관 안내를 먼저 따르세요.
