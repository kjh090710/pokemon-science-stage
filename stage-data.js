// 화면과 제어창이 함께 사용하는 공연 순서와 음향 타이밍입니다.
window.STAGE_SHOW = Object.freeze({
  channelName: 'pokemon-stage-v3',
  gateMs: 4000,
  gateLeadMs: 180,
  musicFadeMs: 900,
  images: {
    '00-lab': '00-lab-professor.png',
    '02-route': '02-route-pokemon.png',
    '03-gate': '03-gate-forest-closed.png',
    '06-sea': '06-sea-pokemon.png',
    '07-lake': '07-lake-pink.png'
  },
  cues: [
    {id:'standby', chapter:'공연 시작 대기', blackout:true, actionLabel:'공연 시작 대기', note:'칠판에 UV 종이를 붙이고 로사의 주머니에 손전등을 준비. 지우는 몬스터볼을 준비. 공연 화면과 무대 조명 모두 암전. 다음 버튼으로 개막곡 재생.'},
    {id:'opening-song', chapter:'PPT 1 · 개막곡', blackout:true, audio:'friends', actionLabel:'우리는 모두 친구 · 가사 있음 재생', note:'가사 있는 「우리는 모두 친구」가 서서히 커지며 재생. 노래가 끝날 때까지 암전 유지. 다음 버튼은 연구실 화면과 조명 ON 시점.'},
    {id:'lab-intro', actionLabel:'개막곡 종료 · 연구실로', chapter:'PPT 1 · 1장 연구실', bg:'00-lab', note:'조명 ON. 박사님·지우·웅이 소개. 지우와 웅이 퇴장 뒤 로켓단 등장까지 연구실 유지.'},
    {id:'uv-blackout', chapter:'PPT 2 · UV 단서 암전', blackout:true, note:'갑자기 불이 꺼질 때 클릭. 실제 칠판의 UV 단서 “호수”를 보여주며 암전 유지. 로켓단이 퇴장한 뒤 다음 버튼으로 반주 재생.'},
    {id:'act1-song', chapter:'PPT 2 · 1장 후 반주', blackout:true, audio:'instrumental', actionLabel:'우리는 모두 친구 · 가사 없음 재생', note:'칠판 정리와 2장 실험 세팅 동안 반주 재생, 암전 유지. 다음 버튼으로 숲길을 띄우며 조명 ON.'},
    {id:'forest', actionLabel:'반주 종료 · 숲길로', chapter:'PPT 3–4 · 2장 숲길', bg:'02-route', note:'조명 ON. 보라색 용액 비커 4개·식초·베이킹소다·안내문 준비. 안내문은 배우가 펼쳐 읽음. 가짜 메타몽을 찾을 때까지 이 배경 유지.'},
    {id:'gate-closed', chapter:'PPT 5 · 닫힌 관문', bg:'03-gate', note:'웅이가 마지막 가짜 메타몽을 가리킬 때 클릭. 지우가 메타몽을 잡은 직후 다음 버튼으로 문과 효과음을 동시에 시작.'},
    {id:'gate-open', chapter:'PPT 5 · 문 열림', bg:'03-gate', visual:'door', audio:'door', actionLabel:'문 열기 · 효과음 재생', note:'문 열림과 효과음이 동시에 시작해 4초 뒤 함께 끝남. 반쯤 열린 상태 유지. 지우·웅이와 로켓단이 모두 퇴장하면 다음 버튼.'},
    {id:'act2-song', chapter:'PPT 6 · 2장 후 암전', blackout:true, audio:'route', actionLabel:'암전 · Route 216 재생', note:'조명 OFF. Route 216 재생. 테이블 외곽의 실험 장치를 가운데로 옮겨 3장 준비. 다음 버튼으로 바다와 조명 ON.'},
    {id:'sea-arrival', actionLabel:'Route 216 종료 · 바다로', chapter:'PPT 7–8 · 3장 바다', bg:'06-sea', note:'조명 ON. 바다 도착과 꼬부기 단서 안내문. 배우가 안내문을 펼쳐 읽음. 꼬부기를 함께 부른 뒤 다음 버튼으로 첫 실험 암전.'},
    {id:'fluorescein', chapter:'PPT 9 · 플루오레세인 암전', blackout:true, note:'조명 OFF 후 용액을 관에 흘려보냄. 플루오레세인의 초록빛을 확인하고 꼬부기 소리를 들은 뒤 다음 버튼으로 바다·조명 ON.'},
    {id:'sea-return', chapter:'PPT 10 · 바다 복귀', bg:'06-sea', note:'조명 ON. 웅이가 두 번째 유리병을 발견하고 섞기 직전에 다음 버튼으로 암전.'},
    {id:'luminol', chapter:'PPT 11 · 루미놀 암전', blackout:true, note:'조명 OFF 후 두 용액을 섞어 파란빛을 보여줌. 꼬부기가 등장하는 순간 다음 버튼으로 바다·조명 ON.'},
    {id:'squirtle', chapter:'PPT 12 · 꼬부기와 바다', bg:'06-sea', note:'꼬부기 등장과 동시에 조명 ON. 꼬부기를 잡고 지우 일행이 퇴장하면 다음 버튼.'},
    {id:'act3-song', chapter:'PPT 13 · 3장 후 암전', blackout:true, audio:'route', actionLabel:'암전 · Route 216 재생', note:'조명 OFF, Route 216 재생. 녹말·아이오딘·비타민 C 용액과 플라즈마볼로 4장 호수 실험 세팅.'},
    {id:'lake-clear', actionLabel:'Route 216 종료 · 호수로', chapter:'PPT 14 · 4장 맑은 호수', bg:'07-lake', note:'조명 ON. 연분홍빛 호수 유지. 로켓단이 등장한 뒤 로이가 아이오딘을 넣는 순간 다음 버튼.'},
    {id:'lake-dark', chapter:'PPT 15 · 검게 변한 호수', bg:'07-lake', lake:'dark', note:'아이오딘을 넣으면 물과 주변 풍경이 어두워짐. 피카츄 등장 후 무대 앞쪽 두 줄 조명 OFF → 백만 볼트에 조명 점멸과 플라즈마볼 돌진 동시 → 로켓단 퇴장 뒤 조명 모두 ON. 이 동안 화면은 검은 호수 유지. 비타민 C를 넣을 때 다음 버튼.'},
    {id:'lake-restored', chapter:'PPT 16 · 맑아진 호수', bg:'07-lake', note:'비타민 C를 넣으면 연분홍빛 맑은 호수로 돌아옴. 관객 반응 뒤 웅이가 “호수에서 뭔가 나오고 있어!”라고 할 때 다음 버튼으로 Farewell 재생.'},
    {id:'mew-arrival', chapter:'PPT 16 · 뮤 등장', bg:'07-lake', audio:'farewell', actionLabel:'Farewell 재생 · 뮤 등장', note:'같은 호수 화면에서 Farewell 재생. 뮤가 나타나 지우의 말을 듣고 고개를 끄덕이는 순간 다음 버튼으로 음악만 종료.'},
    {id:'mew-agrees', chapter:'PPT 16 · 뮤와 친구가 됨', bg:'07-lake', actionLabel:'Farewell 종료', note:'호수 배경은 유지하고 Farewell만 서서히 종료. 지우의 “해냈다! 드디어 도감을 완성했어!”가 끝난 뒤 다음 버튼으로 PPT 17 암전.'},
    {id:'act4-song', chapter:'PPT 17 · 4장 후 암전', blackout:true, audio:'instrumental', actionLabel:'암전 · 우리는 모두 친구 반주 재생', note:'조명 OFF, 가사 없는 「우리는 모두 친구」 재생. 5장 귀환 준비가 끝나면 다음 버튼으로 연구실·조명 ON.'},
    {id:'lab-finale', actionLabel:'반주 종료 · 연구실 귀환', chapter:'PPT 18 · 5장 연구실 귀환', bg:'00-lab', note:'조명 ON. 지우 일행과 뮤가 박사님에게 돌아옴. “과학은 작은 호기심에서 시작된다!” 뒤 퇴장하면 다음 버튼으로 암전.'},
    {id:'curtain', chapter:'5장 후 · 커튼콜 암전', blackout:true, note:'무대 조명 OFF 후 로사·로이 합류. 커튼콜 인사는 현장 조명으로 진행하고 다시 암전, 박사님만 남음. 퀴즈 시작 때 다음 버튼.'},
    {id:'quiz', chapter:'박사님의 포켓몬 퀴즈쇼', bg:'00-lab', note:'퀴즈 1–3번은 연구실 유지. 문제·정답은 배우가 말함. 마지막 플라즈마볼 문제 직전에 다음 버튼으로 암전.'},
    {id:'quiz-blackout', chapter:'퀴즈 4번 · 최종 암전', blackout:true, note:'조명 OFF. 박사님이 플라즈마볼을 켜고 손가락을 가져다대며 마지막 퀴즈. 마지막 인사와 공연 종료까지 검은 화면 유지.'}
  ]
});
