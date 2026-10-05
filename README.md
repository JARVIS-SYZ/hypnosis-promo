# 최면 앱 홍보 팝업 운영

관리 페이지: `https://jarvis-syz.github.io/hypnosis-promo/`

앱은 최면 화면에 들어갈 때 `https://jarvis-syz.github.io/hypnosis-promo/promotion.json`을 새로 읽습니다. 등록된 데이터가 없거나 팝업을 꺼 둔 경우에는 아무것도 표시하지 않습니다. 이 주소는 [promotionConfig.ts](./promotionConfig.ts)에 들어 있으므로 **이 기능을 처음 배포할 때만** 앱 업데이트가 필요합니다. 이후 홍보 내용과 이미지는 관리 페이지에서 바꾸면 됩니다.

## 관리 준비

1. GitHub 저장소 `JARVIS-SYZ/hypnosis-promo`에서 **Settings → Pages**를 열고 배포 소스를 **Deploy from a branch**, 브랜치 `main`, 폴더 `/docs`로 설정합니다. 게시가 끝나면 위 관리 페이지 주소를 엽니다.
2. GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens**에서 토큰을 만듭니다. Repository access는 **Only select repositories**에서 `hypnosis-promo`만 선택하고, Repository permissions의 **Contents: Read and write**만 추가합니다. 토큰은 안전한 곳에 보관하고 다른 사람과 공유하지 마세요.
3. 관리 페이지에서 토큰을 입력하고 **불러오기**를 누릅니다. 토큰은 페이지 메모리에만 남으며 브라우저 저장소에 저장하지 않습니다. 페이지를 다시 열면 재입력해야 합니다.
4. 이미지, 제목, 버튼 문구, HTTPS 이동 주소를 입력하고 **팝업 켜기 → 저장하기**를 누릅니다. 끄려면 스위치를 끄고 저장합니다.

GitHub Pages에 변경 내용이 게시되기까지 잠시 걸릴 수 있습니다. 게시 후 앱에서 최면 화면을 다시 열면 새 내용이 반영됩니다. 사용자가 **닫기**를 누르면 다음 진입에 다시 표시되고, **오늘 하루 보지 않기**를 누르면 같은 홍보는 기기의 현지 날짜가 바뀔 때까지 표시되지 않습니다. 새 홍보를 저장하면 새 ID가 부여되어 이전 홍보의 숨김 기록에 영향을 받지 않습니다.

이미지는 JPG, PNG, WebP 형식으로 3MB까지 올릴 수 있습니다. 등록한 이미지는 공개 저장소와 GitHub Pages에서 누구나 볼 수 있으므로 홍보에 사용할 공개 이미지만 올리세요.
