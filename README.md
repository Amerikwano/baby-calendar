# 우리 아기 수첩

앱 열기: https://amerikwano.github.io/baby-calendar/

예방접종·검진 일정, 출산 디데이, 일기와 사진첩, 개월 수별 육아 팁, 출산 혜택을 한곳에 모은 웹앱입니다.

- 휴대폰에서는 공유 메뉴의 "홈 화면에 추가"로 앱처럼 쓸 수 있습니다.
- 입력한 내용과 사진은 쓰는 기기에만 저장됩니다. 설정에서 백업 파일을 만들 수 있습니다.
- 알림은 캘린더 파일(.ics)을 휴대폰 캘린더에 넣으면 울립니다.
- 웹 주소에서는 AI를 쓰지 않으며 무료입니다. 육아 팁은 조사해 둔 자료에서 개월 수에 맞춰 골라 보여줍니다.

## 지역 혜택 자료

`regions/`는 행정안전부 「대한민국 공공서비스(혜택) 정보」(보조금24)에서 출산·육아 사업만 고른 것입니다. 처음 자료는 [goodboxkr/korea-birth-support-2026](https://github.com/goodboxkr/korea-birth-support-2026)(CC BY 4.0)을 정리했습니다. 저장소 Secret에 `DATA_GO_KR_KEY`(공공데이터포털 인증키)를 넣으면 매일 새벽 자동으로 갱신됩니다. 위치를 지역 이름으로 바꿀 때 OpenStreetMap Nominatim을 씁니다(© OpenStreetMap 기여자).

## 선택: AI 서버 (Cloudflare Workers, API 요금 발생)

배포한 주소를 `index.html`의 `AI_URL`에 넣어야 켜집니다.

```
npm install
npm run ai:login
npm run ai:deploy
npm run ai:key    # Anthropic API 키 입력
npm run ai:code   # 12자 이상의 접근 코드 입력
```

하루 10회, 한 달 60회까지만 실행됩니다(`worker/wrangler.jsonc`에서 변경).

접종 일정은 질병관리청 표준예방접종일정표(2026) 기준이며, 실제 접종은 의료기관 안내를 먼저 따르세요.

## 인근 병원 자료
`hospitals.json`은 건강보험심사평가원 「전국 병의원 및 약국 현황」(공공데이터포털, 공공누리 1유형)에서 소아청소년과 전문의가 있는 병원과 보건소만 고른 것입니다. 분기마다 새 파일을 받아 `scripts/make-hospitals.js`로 다시 만듭니다.

## 구글 로그인
`index.html`의 `GOOGLE_ID`에 OAuth 클라이언트 ID를 넣으면 로그인과 드라이브 올리기가 켜집니다. 권한은 `drive.file`만 씁니다.
