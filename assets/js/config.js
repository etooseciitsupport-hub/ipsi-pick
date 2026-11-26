// 배포 주소 설정 — 진로설계(jinro-dash)·상담 진단실(Expert-Course)이 어디 있는지 이 파일 한 곳에서만 정한다
/*
  같은 GitHub 계정 아래 나란히 배포했다면 그대로 두세요 (상대 경로).
  다른 계정·도메인에 배포했다면 절대 주소로 바꾸세요. 끝의 / 는 있어도 없어도 됩니다.
    jinroBase: 'https://etooseci.github.io/jinro-dash/',
    ecBase:    'https://etooseci.github.io/Expert-Course/',
  주소가 이 앱과 다른 출처이면 두 앱의 브라우저 저장값은 읽을 수 없습니다.
  그때는 진로설계·진단실에서 내보낸 JSON 파일을 '파일 불러오기'로 넣습니다.
*/
window.IPSI_CONFIG = {
  jinroBase: '../jinro-dash/',
  ecBase: '../Expert-Course/',
};
