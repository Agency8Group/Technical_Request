# Firebase 데이터 구조 및 백엔드 관리 가이드

## 📊 Firebase Realtime Database 구조

### 기본 경로
```
https://eibedevv2request-68d1e-default-rtdb.asia-southeast1.firebasedatabase.app/
```

### 데이터 구조
```
/requests/
├── 기술개발요청/
│   ├── {auto-generated-id}/
│   │   ├── title: "요청 제목"
│   │   ├── developmentType: "개발유형"
│   │   ├── detail: "상세내용"
│   │   ├── requester: "user@example.com"
│   │   ├── createdAt: timestamp
│   │   ├── priority: "우선순위"
│   │   ├── expectedDuration: "예상기간"
│   │   ├── status: "개발상태"
│   │   ├── updatedAt: timestamp
│   │   ├── updatedBy: "수정자"
│   │   ├── excel: {name, size, data}
│   │   └── images: [{name, size, data}]
│   └── ...
├── 질의응답요청/
│   ├── {auto-generated-id}/
│   │   ├── question: "질문내용"
│   │   ├── answer: "답변내용"
│   │   ├── status: "답변대기/답변완료"
│   │   ├── requester: "user@example.com"
│   │   ├── createdAt: timestamp
│   │   └── answeredAt: timestamp
│   └── ...
└── 부서확인/
    ├── {auto-generated-id}/
    │   ├── department: "부서명"
    │   ├── comment: "코멘트"
    │   ├── requester: "user@example.com"
    │   ├── createdAt: timestamp
    │   └── noMoreRequests: boolean
    └── ...
```

## 🔧 백엔드에서 데이터 관리 방법

### 1. Firebase Console 접근
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 `eibedevv2request-68d1e` 선택
3. 왼쪽 메뉴에서 "Realtime Database" 클릭

### 2. 데이터 삭제 방법

#### 개별 데이터 삭제
```
경로: /requests/기술개발요청/{id}
작업: 해당 노드 선택 후 삭제 버튼 클릭
```

#### 전체 카테고리 삭제
```
경로: /requests/기술개발요청
작업: 전체 폴더 선택 후 삭제
```

#### 부서 확인 데이터 삭제
```
경로: /requests/부서확인
작업: 전체 부서 확인 데이터 삭제 가능
```

### 3. 데이터 백업 방법

#### JSON 내보내기
1. Firebase Console에서 "내보내기" 버튼 클릭
2. JSON 형식으로 다운로드
3. 백업 파일로 저장

#### 특정 경로만 내보내기
```bash
# Firebase CLI 사용 시
firebase database:get /requests --project eibedevv2request-68d1e > backup.json
```

## 📱 대시보드 데이터 반영 확인

### 실시간 동기화
- ✅ **기술개발요청**: Firebase 저장 → 즉시 대시보드 반영
- ✅ **질의응답**: Firebase 저장 → 즉시 대시보드 반영  
- ✅ **부서확인**: Firebase 저장 → 즉시 대시보드 반영

### 데이터 로드 함수
```javascript
// 모든 데이터 로드
loadData() → updateStats() + updateDepartmentProgress() + updateRecentActivity()

// 개별 업데이트
updateRequestsTable() // 요청 테이블
updateQnAList()       // Q&A 목록
updateDepartmentsTable() // 부서 테이블
```

### 새로고침 버튼
- ✅ **새로고침 버튼**: `loadData()` 호출하여 모든 데이터 재로드

## 🗑️ 백엔드 삭제 권한

### Firebase Console 권한
- ✅ **프로젝트 소유자**: 모든 데이터 삭제 가능
- ✅ **편집자**: 데이터 수정/삭제 가능
- ✅ **뷰어**: 읽기 전용

### 삭제 시 주의사항
1. **백업 필수**: 삭제 전 반드시 데이터 백업
2. **단계적 삭제**: 전체 삭제보다는 카테고리별 삭제 권장
3. **테스트 환경**: 운영 데이터 삭제 전 테스트 환경에서 확인

## 🔄 데이터 동기화 확인

### 대시보드에서 확인 가능한 항목
1. **통계 카드**: 총 요청, 진행중, 완료, Q&A, 부서 진행률
2. **부서 확인 현황**: 8개 부서별 완료/미완료 상태
3. **최근 활동**: 최근 요청 목록
4. **데이터 테이블**: 요청, Q&A, 부서 확인 상세 목록

### 실시간 업데이트
- ✅ **저장 시**: 즉시 UI 업데이트
- ✅ **수정 시**: 즉시 UI 업데이트  
- ✅ **새로고침**: 모든 데이터 재로드

