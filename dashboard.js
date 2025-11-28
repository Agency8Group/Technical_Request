// 대시보드 JavaScript
import { 
  saveRequest, 
  addQnAMessage, 
  subscribeQnA, 
  subscribeConnection,
  db,
  ref,
  onValue,
  get,
  set,
  push,
  serverTimestamp,
  auth,
  getCurrentUser,
  logoutUser
} from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

// 전역 변수
let currentRequests = [];
let currentQnA = [];
let currentDepartments = [];
let currentUser = null;

// DOM 요소들 (지연 로딩)
let navItems, contentSections, connDot, connText;
const CONNECTION_STATUS_DELAY_MS = 2500;
let connectionStatusTimeout = null;
let connectionStateDetermined = false;

const MIN_LOADING_DISPLAY_MS = 500;
let loadingOverlayVisibleAt = 0;
let loadingOverlayHideTimer = null;

// DOM 요소들 (지연 로딩)
let totalRequestsEl, pendingRequestsEl, completedRequestsEl, totalQnAEl, completionRateEl;
let loadingOverlay;
let newRequestBtn, requestForm, requestFormElement, cancelBtn, submitBtn, statusMsg;
let qnaQuestion, qnaRequesterName, submitQuestionBtn, qnaList;
let saveDeptBtn, deptStatus;
let exportRequestsBtn;
let newMenuName, newSubMenuName, newMenuDescription, addRowBtn, menuTableBody, exportGuideBtn, importGuideBtn, excelFileInput, refreshGuideBtn, guideDisplay, guideStats;
let hasPerformedInitialRefresh = false;

// PIN 관련 변수
const CORRECT_PIN = '000000';
let currentPin = '';
  let pinAttempts = 0;
  const MAX_ATTEMPTS = 3;
  let currentPinAction = null; // 현재 PIN 입력으로 실행할 액션

// 초기화
document.addEventListener('DOMContentLoaded', function() {
  console.log('대시보드 초기화 시작');
  
  try {
    // DOM 요소들 초기화
    initializeDOMElements();
    
    // 로딩 오버레이 초기 숨김
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
    
    // 기본 UI 초기화
    initializeNavigation();
    initializeNavigationTooltips();
    initializeConnectionStatus();
    initializeRefreshButton();
    initializeMenuGuide();
    initializeNoticePopup();
    initializeWorkGuideModal();
    initializePinModal();
    initializeDownloadSelectionModal();
    initializeThemeToggle();
    
    // 필터링 기능 초기화
    initializeRequestFilters();
    initializeAccordion();
    setNow();
    
    // 인증 초기화 (마지막에)
    initializeAuth();
    
    console.log('대시보드 초기화 완료');
  } catch (error) {
    console.error('대시보드 초기화 오류:', error);
    showError('시스템 초기화 중 오류가 발생했습니다.');
  }
});

// DOM 요소들 초기화
function initializeDOMElements() {
  navItems = document.querySelectorAll('.nav-item');
  contentSections = document.querySelectorAll('.content-section');
  connDot = document.getElementById('connDot');
  connText = document.getElementById('connText');
  
  // 통계 요소들
  totalRequestsEl = document.getElementById('totalRequests');
  pendingRequestsEl = document.getElementById('pendingRequests');
  completedRequestsEl = document.getElementById('completedRequests');
  totalQnAEl = document.getElementById('totalQnA');
  completionRateEl = document.getElementById('completionRate');
  
  // 로딩 오버레이
  loadingOverlay = document.getElementById('loadingOverlay');
  
  // 폼 관련 요소들
  newRequestBtn = document.getElementById('newRequestBtn');
  requestForm = document.getElementById('requestForm');
  requestFormElement = document.getElementById('requestFormElement');
  cancelBtn = document.getElementById('cancelBtn');
  submitBtn = document.getElementById('submitBtn');
  statusMsg = document.getElementById('statusMsg');
  
  // QnA 관련 요소들
  qnaQuestion = document.getElementById('qnaQuestion');
  qnaRequesterName = document.getElementById('qnaRequesterName');
  submitQuestionBtn = document.getElementById('submitQuestionBtn');
  qnaList = document.getElementById('qnaList');
  
  // QnA 상태 필터
  const qnaStatusFilter = document.getElementById('qnaStatusFilter');
  if (qnaStatusFilter) {
    qnaStatusFilter.addEventListener('change', () => {
      updateQnAList();
    });
  }
  
  // 새로고침 버튼
  const refreshQnABtn = document.getElementById('refreshQnABtn');
  if (refreshQnABtn) {
    refreshQnABtn.addEventListener('click', () => {
      loadData();
      showSuccess('질의응답 목록이 새로고침되었습니다.');
    });
  }
  
  // 부서 관련 요소들
  saveDeptBtn = document.getElementById('saveDeptBtn');
  deptStatus = document.getElementById('deptStatus');
  
  // 아코디언 요소들 (테이블에서 아코디언으로 변경)
  exportRequestsBtn = document.getElementById('exportRequestsBtn');
  
  // 메뉴 가이드 요소들
  newMenuName = document.getElementById('newMenuName');
  newSubMenuName = document.getElementById('newSubMenuName');
  newMenuDescription = document.getElementById('newMenuDescription');
  addRowBtn = document.getElementById('addRowBtn');
  menuTableBody = document.getElementById('menuTableBody');
  exportGuideBtn = document.getElementById('exportGuideBtn');
  importGuideBtn = document.getElementById('importGuideBtn');
  excelFileInput = document.getElementById('excelFileInput');
  refreshGuideBtn = document.getElementById('refreshGuideBtn');
  guideDisplay = document.getElementById('guideDisplay');
  guideStats = document.getElementById('guideStats');
  
}

// 인증 초기화
function initializeAuth() {
  console.log('인증 초기화 시작');
  
  onAuthStateChanged(auth, (user) => {
    console.log('인증 상태 변경:', user ? user.email : '로그아웃');
    
    if (user) {
      currentUser = user;
      console.log('사용자 로그인:', user.email);
      
      // 사용자 인터페이스 업데이트
      updateUserInterface();
      
    // 인증 완료 후 기능들 초기화
    setTimeout(() => {
      initializeRequestForm();
      initializeQnA();
      initializeDepartments();
      initializeExportButtons();
      initializeModals();
      runInitialRefresh();
    }, 100);
      
    } else {
      console.log('로그인되지 않음 - 로그인 페이지로 리다이렉트');
      window.location.href = 'index.html';
    }
  });
}

// 사용자 인터페이스 업데이트
function updateUserInterface() {
  // 사용자 이메일 표시
  const userEmailEl = document.getElementById('userEmail');
  if (userEmailEl) {
    userEmailEl.textContent = currentUser.email;
  }

  // 모든 사용자가 동일한 기능 사용 가능
  // (역할별 UI 제어 제거로 단순화)
  
  // 로그아웃 버튼 초기화 (모든 사용자)
  initializeLogoutButton();
}

// 로그아웃 버튼 초기화
function initializeLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('정말 로그아웃하시겠습니까?')) {
        try {
          logoutBtn.disabled = true;
          logoutBtn.innerHTML = '<span class="logout-icon">⏳</span><span>로그아웃 중...</span>';
          
          await logoutUser();
          window.location.href = 'index.html';
        } catch (error) {
          console.error('로그아웃 오류:', error);
          alert('로그아웃 중 오류가 발생했습니다.');
          logoutBtn.disabled = false;
          logoutBtn.innerHTML = '<span class="logout-icon">🚪</span><span>로그아웃</span>';
        }
      }
    });
  }
}

// 네비게이션 초기화
function initializeNavigation() {
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      switchSection(section);
    });
  });
  
  // ERP/WMS 도움말 말풍선 이벤트 리스너
  const erpHelpBubble = document.getElementById('erpHelpBubble');
  if (erpHelpBubble) {
    erpHelpBubble.addEventListener('click', (e) => {
      e.stopPropagation(); // 네비게이션 클릭 이벤트 방지
      showErpAccessModal();
    });
  }
}

// 섹션 전환
function switchSection(sectionName) {
  // 네비게이션 활성화
  navItems.forEach(item => {
    item.classList.remove('active');
    if (item.dataset.section === sectionName) {
      item.classList.add('active');
    }
  });

  // 콘텐츠 섹션 전환
  contentSections.forEach(section => {
    section.classList.remove('active');
    if (section.id === sectionName) {
      section.classList.add('active');
    }
  });

  // 섹션별 데이터 로드
  if (sectionName === 'overview') {
    updateStats();
    updateRecentActivity();
  } else if (sectionName === 'requests') {
    updateRequestsTable();
  } else if (sectionName === 'qna') {
    updateQnAList();
  } else if (sectionName === 'menu-guide') {
    loadMenuGuide();
  } else if (sectionName === 'erp-wms') {
    // ERP/WMS 섹션 진입 시 전체화면 모드 활성화
    const erpSection = document.getElementById('erp-wms');
    if (erpSection) {
      erpSection.classList.add('fullscreen-mode');
      document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
    }
  } else {
    // 다른 섹션으로 이동 시 ERP/WMS 전체화면 모드 비활성화
    const erpSection = document.getElementById('erp-wms');
    if (erpSection) {
      erpSection.classList.remove('fullscreen-mode');
      document.body.style.overflow = 'auto'; // 스크롤 복원
    }
  }
}

// 연결 상태 UI 업데이트
function updateConnectionIndicator(connected, { message, final } = {}) {
  if (!connDot || !connText) return;
  connDot.classList.toggle('on', connected);
  connText.textContent = message ?? (connected ? '정상 연결' : '오프라인');

  if (final) {
    connectionStateDetermined = true;
    if (connectionStatusTimeout) {
      clearTimeout(connectionStatusTimeout);
      connectionStatusTimeout = null;
    }
  }
}

// 연결 상태 초기화
function initializeConnectionStatus() {
  if (!connDot || !connText) return;

  connectionStateDetermined = false;
  if (connectionStatusTimeout) {
    clearTimeout(connectionStatusTimeout);
    connectionStatusTimeout = null;
  }

  const initialOnlineState = navigator.onLine;
  const initialMessage = initialOnlineState ? '브라우저 네트워크 연결됨' : '네트워크 연결 없음';
  updateConnectionIndicator(initialOnlineState, { message: initialMessage });

  subscribeConnection((connected) => {
    console.log('Firebase 연결 상태:', connected ? '정상 연결' : '오프라인');
    updateConnectionIndicator(connected, { final: true });
  });

  window.addEventListener('online', () => {
    updateConnectionIndicator(true, { message: '브라우저 네트워크 연결됨' });
  });
  window.addEventListener('offline', () => {
    updateConnectionIndicator(false, { message: '브라우저 네트워크 끊김' });
  });

  if (!connectionStateDetermined) {
    connectionStatusTimeout = setTimeout(() => {
      if (!connectionStateDetermined && connText) {
        connText.textContent = 'Firebase 연결을 확인 중입니다...';
      }
    }, CONNECTION_STATUS_DELAY_MS);
  }
}

// 요청 폼 초기화
function initializeRequestForm() {
  if (!newRequestBtn || !requestForm || !cancelBtn || !requestFormElement) return;
  
  newRequestBtn.addEventListener('click', () => {
    requestForm.style.display = requestForm.style.display === 'none' ? 'block' : 'none';
    if (requestForm.style.display === 'block') {
      requestForm.scrollIntoView({ behavior: 'smooth' });
    }
  });

  cancelBtn.addEventListener('click', () => {
    requestForm.style.display = 'none';
    requestFormElement.reset();
    setNow();
  });

  requestFormElement.addEventListener('submit', handleRequestSubmit);
}

// 요청 제출 처리
async function handleRequestSubmit(e) {
  e.preventDefault();
  
  if (!currentUser) {
    showError('로그인이 필요합니다.');
    return;
  }
  
  const btn = submitBtn;
  btn.disabled = true;
  btn.textContent = '전송 중...';
  showLoading('요청을 처리 중입니다...');

  try {
    const formData = new FormData(requestFormElement);
    const payload = {
      title: formData.get('title').trim(),
      developmentType: formData.get('developmentType'),
      requesterName: formData.get('requesterName').trim(),
      // 개발자가 설정할 기본값들
      priority: '보통',           // 기본 우선순위
      expectedDuration: '1주일',  // 기본 예상기간
      status: '접수',             // 기본 상태
      requester: currentUser.email,
      createdAt: formData.get('createdAt'),
      detail: formData.get('detail').trim(),
      photos: await processFiles(formData.getAll('photo')),
      excel: await processExcelFile(formData.get('excel')),
      generation: '2차'          // 신규 요청은 2차로 구분
    };

    // 필수 항목 검증 (사용자 입력 필드만)
    if (!payload.title || !payload.detail || !payload.developmentType || !payload.requesterName) {
      showError('필수 항목을 입력하세요: 제목, 상세내용, 개발유형, 요청자 이름');
      return;
    }

    const key = await saveRequest(payload);
    console.log('요청 저장 성공:', key);

    showSuccess('요청이 등록되었습니다.');
    requestForm.style.display = 'none';
    requestFormElement.reset();
    setNow();
    
    // 데이터 새로고침
    setTimeout(() => {
      loadData();
      updateRequestsTable();
    }, 500);

  } catch (err) {
    console.error('요청 저장 오류:', err);
    showError('요청 등록 중 오류가 발생했습니다: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '요청 등록';
  }
}

// 파일 처리
async function processFiles(files) {
  const photos = [];
  for (const file of files) {
    if (file && file.size > 0 && file.size <= 10 * 1024 * 1024) {
      photos.push({
        name: file.name,
        type: file.type,
        size: file.size,
        data: await fileToBase64(file)
      });
    }
  }
  return photos;
}

// 엑셀 파일 처리
async function processExcelFile(file) {
  if (file && file.size > 0 && file.size <= 10 * 1024 * 1024) {
    return {
      name: file.name,
      type: file.type,
      size: file.size,
      data: await fileToBase64(file)
    };
  }
  return null;
}

// Base64 변환
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // 전체 데이터 URL 반환
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// QnA 초기화
function initializeQnA() {
  console.log('QnA 초기화 시작');
  
  if (!submitQuestionBtn || !qnaQuestion || !qnaRequesterName) {
    console.warn('QnA 요소를 찾을 수 없음');
    return;
  }
  
  // 질문 등록 이벤트 리스너
  submitQuestionBtn.addEventListener('click', async () => {
    await handleQuestionSubmit();
  });

  // QnA 실시간 구독
  subscribeQnA((qnaData) => {
    console.log('QnA 데이터 업데이트:', qnaData.length, '개');
    currentQnA = qnaData;
    updateQnAList();
    updateStats();
  });
}

// 질문 제출 처리
async function handleQuestionSubmit() {
  const question = qnaQuestion.value.trim();
  const requesterName = qnaRequesterName.value.trim();
  
  if (!requesterName) {
    showError('요청자 이름을 입력해주세요.');
    return;
  }
  
  if (!question) {
    showError('질문을 입력해주세요.');
    return;
  }

  if (!currentUser) {
    showError('로그인이 필요합니다.');
    return;
  }

  try {
    submitQuestionBtn.disabled = true;
    submitQuestionBtn.textContent = '등록 중...';
    
    await addQnAMessage({
      question,
      answer: '',
      status: '답변대기',
      requester: currentUser.email,
      requesterName: requesterName
    });
    
    qnaQuestion.value = '';
    qnaRequesterName.value = '';
    showSuccess('질문이 등록되었습니다.');
    
  } catch (err) {
    console.error('질문 등록 오류:', err);
    showError('질문 등록 중 오류가 발생했습니다: ' + err.message);
  } finally {
    submitQuestionBtn.disabled = false;
    submitQuestionBtn.textContent = '질문 등록';
  }
}

// QnA 목록 업데이트
function updateQnAList() {
  if (!qnaList) return;
  
  qnaList.innerHTML = '';
  
  // 상태 필터 값 읽기
  const qnaStatusFilter = document.getElementById('qnaStatusFilter');
  const filterVal = qnaStatusFilter ? qnaStatusFilter.value : 'all';

  // 통계 업데이트
  const qnaStats = document.getElementById('qnaStats');
  if (qnaStats) {
    qnaStats.textContent = `총 ${currentQnA.length}건`;
  }
  
  if (currentQnA.length === 0) {
    qnaList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--muted);">
        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-bottom: 16px;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
        </svg>
        <p>아직 등록된 질문이 없습니다.</p>
        <p style="font-size: 14px; margin-top: 8px;">위의 폼을 통해 첫 번째 질문을 등록해보세요!</p>
      </div>
    `;
    return;
  }
  
  // 최신 질문이 위로 오도록 정렬 (createdAt 기준 내림차순)
  // 필터 적용 후 정렬
  const filtered = currentQnA.filter(item => {
    if (filterVal === 'all') return true;
    return (item.status || '답변대기') === filterVal;
  });

  const sortedQnA = [...filtered].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA; // 최신이 위로
  });
  
  if (sortedQnA.length === 0) {
    qnaList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--muted);">
        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-bottom: 16px;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
        </svg>
        <p>해당 조건의 항목이 없습니다.</p>
      </div>
    `;
    return;
  }

  sortedQnA.forEach(item => {
    const qnaItem = document.createElement('div');
    qnaItem.className = 'qna-item';
    
    const isAnswered = item.status === '답변완료';
    const answerText = item.answer || '답변 대기 중...';
    
    // 모든 사용자가 답변 입력 가능 (답변완료가 아닌 경우만)
    let answerSection = '';
    if (!isAnswered) {
      answerSection = `
        <div class="qna-answer-form">
          <div class="form-group">
            <label for="answererName_${item.id}">답변자 이름</label>
            <input type="text" id="answererName_${item.id}" placeholder="답변자 이름을 입력하세요" required>
          </div>
          <div class="form-group">
            <label for="answerInput_${item.id}">답변 내용</label>
            <textarea class="answer-input" id="answerInput_${item.id}" placeholder="답변을 입력하세요..." data-qna-id="${item.id}" rows="3"></textarea>
          </div>
          <button class="btn btn-primary btn-sm" onclick="submitAnswer('${item.id}')">
            <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
            </svg>
            답변 등록
          </button>
        </div>
      `;
    }
    
    // 답변자 정보 표시
    let answererInfo = '';
    if (isAnswered && item.answeredBy) {
      const answererName = item.answeredByName || item.answeredBy.split('@')[0];
      answererInfo = `
        <span class="qna-answerer">
          <strong>답변자: ${answererName}</strong>
          <span class="qna-answer-date">${formatDate(item.answeredAt)}</span>
        </span>
      `;
    }

    qnaItem.innerHTML = `
      <div class="qna-question">${item.question}</div>
      <div class="qna-answer">${answerText}</div>
      ${answerSection}
      <div class="qna-meta">
        <span class="qna-requester">
          <strong>${item.requesterName || '익명'}</strong>
          <span class="qna-email">(${item.requester})</span>
        </span>
        <span>${formatDate(item.createdAt)}</span>
        <span class="qna-status ${isAnswered ? 'answered' : 'pending'}">
          ${isAnswered ? '✅ 답변완료' : '⏳ 답변대기'}
        </span>
      </div>
      ${answererInfo}
    `;
    
    qnaList.appendChild(qnaItem);
  });
}

// 부서 초기화
function initializeDepartments() {
  console.log('부서 초기화 시작');
  
  // 체크박스 이벤트
  const noMoreRequests = document.getElementById('noMoreRequests');
  const autoComment = document.getElementById('autoComment');
  
  if (noMoreRequests && autoComment) {
    noMoreRequests.addEventListener('change', () => {
      if (noMoreRequests.checked) {
        autoComment.innerHTML = `
          <div style="text-align: left;">
            <div style="font-size: 16px; font-weight: 700; color: #10b981; margin-bottom: 8px;">
              ✅ 모든 개발 요청이 완료되었습니까?
            </div>
            <div style="font-size: 14px; line-height: 1.5; color: var(--fg-secondary);">
              다음 개발 완료 시까지 추가 개발 요청은 지연될 수 있습니다.<br>
              <strong>정말로 모든 요청사항이 완료되었는지 다시 한번 확인후 <br>
              아래 부서 확인 저장 버튼을 눌러 완료해주세요.</strong>
            </div>
          </div>
        `;
        autoComment.classList.add('show');
        
        // 부서 확인 저장 버튼 표시 (순차 애니메이션)
        const saveDeptBtn = document.getElementById('saveDeptBtn');
        if (saveDeptBtn) {
          saveDeptBtn.style.display = 'block';
          saveDeptBtn.style.opacity = '0';
          saveDeptBtn.style.transform = 'translateY(20px)';
          
          setTimeout(() => {
            saveDeptBtn.style.opacity = '1';
            saveDeptBtn.style.transform = 'translateY(0)';
          }, 200);
        }
      } else {
        autoComment.textContent = '';
        autoComment.classList.remove('show');
        
        // 부서 확인 저장 버튼 숨기기
        const saveDeptBtn = document.getElementById('saveDeptBtn');
        if (saveDeptBtn) {
          saveDeptBtn.style.display = 'none';
        }
      }
    });
  }

  // 부서 선택 시 완료 카드 표시
  const departmentSelect = document.getElementById('departmentSelect');
  const completionCardContainer = document.getElementById('completionCardContainer');
  const selectedDeptName = document.getElementById('selectedDeptName');
  
  if (departmentSelect && completionCardContainer && selectedDeptName) {
    departmentSelect.addEventListener('change', () => {
      const selectedDept = departmentSelect.value;
      if (selectedDept) {
        selectedDeptName.textContent = selectedDept;
        completionCardContainer.style.display = 'block';
        
        // 다른 요소들과 일관된 애니메이션 적용
        setTimeout(() => {
          completionCardContainer.classList.add('show');
        }, 100);
      } else {
        // 부드러운 페이드아웃 애니메이션
        completionCardContainer.classList.remove('show');
        
        setTimeout(() => {
          completionCardContainer.style.display = 'none';
        }, 400);
        
        // 체크박스 상태 초기화
        const noMoreRequests = document.getElementById('noMoreRequests');
        const autoComment = document.getElementById('autoComment');
        if (noMoreRequests) noMoreRequests.checked = false;
        if (autoComment) {
          autoComment.textContent = '';
          autoComment.classList.remove('show');
        }
      }
    });
  }
  

  // 저장 버튼 이벤트
  const saveDeptBtn = document.getElementById('saveDeptBtn');
  const deptStatus = document.getElementById('deptStatus');
  
  if (saveDeptBtn && deptStatus && departmentSelect) {
    saveDeptBtn.addEventListener('click', async () => {
      const selectedDept = departmentSelect.value;
      const comment = noMoreRequests.checked ? '더 이상 요청할 것이 없습니다.' : '';
      
      if (!selectedDept) {
        setDeptStatus('부서를 선택해주세요.', 'error');
        return;
      }
      
      // 중복 확인 체크
      const existingDept = currentDepartments.find(dept => dept.department === selectedDept);
      if (existingDept) {
        setDeptStatus(`❌ ${selectedDept} 부서는 이미 확인이 완료되었습니다. (${formatDate(existingDept.createdAt)})`, 'error');
        return;
      }
      
      try {
        saveDeptBtn.disabled = true;
        saveDeptBtn.textContent = '저장 중...';
        
        // 데이터베이스에 부서 확인 데이터 저장
        const deptData = {
          department: selectedDept,
          comment: comment,
          requester: currentUser.email,
          createdAt: serverTimestamp(),
          noMoreRequests: noMoreRequests.checked
        };
        
        // 부서 확인 데이터를 데이터베이스에 저장
        const deptRef = ref(db, '/requests/부서확인');
        const newDeptRef = push(deptRef);
        await set(newDeptRef, deptData);
        
        // 완료 상태에 따른 메시지
        if (noMoreRequests.checked) {
          setDeptStatus(`✅ ${selectedDept} 부서 확인이 완료되었습니다! (개발사 전달 준비 완료)`, 'success');
        } else {
          setDeptStatus(`부서 확인이 저장되었습니다: ${selectedDept}${comment ? ' - ' + comment : ''}`, 'success');
        }
        
        // 폼 리셋
        departmentSelect.value = '';
        noMoreRequests.checked = false;
        autoComment.textContent = '';
        autoComment.classList.remove('show');
        
        // 부서 확인 저장 버튼 숨기기
        saveDeptBtn.style.display = 'none';
        
        // 완료 카드 숨기기
        const completionCardContainer = document.getElementById('completionCardContainer');
        if (completionCardContainer) {
          completionCardContainer.style.display = 'none';
          completionCardContainer.style.opacity = '0';
          completionCardContainer.style.transform = 'translateY(20px)';
        }
        
        // 데이터 새로고침
        loadData();
        
        // 부서 진행률 즉시 업데이트
        updateDepartmentProgress();
        
        // 부서 선택 옵션 업데이트
        updateDepartmentSelectOptions();
        
      } catch (error) {
        console.error('부서 확인 저장 오류:', error);
        setDeptStatus('부서 확인 저장 중 오류가 발생했습니다: ' + error.message, 'error');
      } finally {
        saveDeptBtn.disabled = false;
        saveDeptBtn.textContent = '부서 확인 저장';
      }
    });
  }
  
  console.log('부서 초기화 완료');
}

// PIN 모달 초기화
function initializePinModal() {
  console.log('PIN 모달 초기화 시작');
  
  const pinModal = document.getElementById('pinModal');
  const pinInput = document.getElementById('pinInput');
  const pinKeys = document.querySelectorAll('.pin-key[data-key]');
  const pinClear = document.getElementById('pinClear');
  const pinBackspace = document.getElementById('pinBackspace');
  const pinCancel = document.getElementById('pinCancel');
  const pinConfirm = document.getElementById('pinConfirm');
  const pinError = document.getElementById('pinError');
  
  if (!pinModal) return;
  
  // PIN 키패드 이벤트
  pinKeys.forEach(key => {
    key.addEventListener('click', () => {
      const digit = key.getAttribute('data-key');
      addPinDigit(digit);
    });
  });
  
  // 지우기 버튼
  if (pinClear) {
    pinClear.addEventListener('click', clearPin);
  }
  
  // 백스페이스 버튼
  if (pinBackspace) {
    pinBackspace.addEventListener('click', removeLastPinDigit);
  }
  
  // 취소 버튼
  if (pinCancel) {
    pinCancel.addEventListener('click', closePinModal);
  }
  
  // 확인 버튼
  if (pinConfirm) {
    pinConfirm.addEventListener('click', verifyPin);
  }
  
  // 키보드 입력 지원
  if (pinInput) {
    pinInput.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
      e.target.value = value;
      currentPin = value;
      updatePinDisplay();
      updatePinConfirmButton();
    });
  }
  
  // 모달 외부 클릭 시 닫기
  pinModal.addEventListener('click', (e) => {
    if (e.target === pinModal) {
      closePinModal();
    }
  });
  
  console.log('PIN 모달 초기화 완료');
}

// 다크모드 토글 초기화
function initializeThemeToggle() {
  console.log('다크모드 토글 초기화 시작');
  
  const themeToggle = document.getElementById('themeToggle');
  const themeToggleText = document.querySelector('.theme-toggle-text');
  
  if (!themeToggle) return;
  
  // 저장된 테마 설정 불러오기
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);
  
  // 토글 버튼 이벤트
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  });
  
  // 시스템 다크모드 감지
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addListener((e) => {
    if (!localStorage.getItem('theme')) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });
  
  console.log('다크모드 토글 초기화 완료');
}

// 테마 설정 함수
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // 토글 버튼 텍스트 업데이트
  const themeToggleText = document.querySelector('.theme-toggle-text');
  if (themeToggleText) {
    themeToggleText.textContent = theme === 'dark' ? '라이트모드' : '다크모드';
  }
  
  // 테마 변경 애니메이션
  document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
  
  console.log(`테마 변경: ${theme}`);
}

// PIN 숫자 추가
function addPinDigit(digit) {
  if (currentPin.length < 6) {
    currentPin += digit;
    updatePinDisplay();
    updatePinConfirmButton();
  }
}

// PIN 마지막 숫자 제거
function removeLastPinDigit() {
  if (currentPin.length > 0) {
    currentPin = currentPin.slice(0, -1);
    updatePinDisplay();
    updatePinConfirmButton();
  }
}

// PIN 전체 지우기
function clearPin() {
  currentPin = '';
  updatePinDisplay();
  updatePinConfirmButton();
  hidePinError();
}

// PIN 표시 업데이트
function updatePinDisplay() {
  for (let i = 1; i <= 6; i++) {
    const dot = document.getElementById(`pinDot${i}`);
    if (dot) {
      if (i <= currentPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    }
  }
}

// PIN 확인 버튼 상태 업데이트
function updatePinConfirmButton() {
  const pinConfirm = document.getElementById('pinConfirm');
  if (pinConfirm) {
    pinConfirm.disabled = currentPin.length !== 6;
  }
  }
  
  // PIN 모달 표시
  function showPinModal(action) {
    currentPinAction = action;
    const pinModal = document.getElementById('pinModal');
    if (pinModal) {
      pinModal.classList.add('show');
      document.body.style.overflow = 'hidden';
      resetPinState();
    }
  }
  
  // PIN 검증
  function verifyPin() {
    if (currentPin === CORRECT_PIN) {
      // PIN이 맞으면 해당 액션 실행
      executePinAction();
      closePinModal();
      resetPinState();
  } else {
    pinAttempts++;
    showPinError();
    
    if (pinAttempts >= MAX_ATTEMPTS) {
      alert('PIN 입력 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.');
      closePinModal();
      resetPinState();
    } else {
      clearPin();
    }
    }
  }
  
  // PIN 확인 후 실행할 액션
  function executePinAction() {
    switch (currentPinAction) {
      case 'exportRequests':
        // 다운로드 선택 모달 표시
        showDownloadSelectionModal();
        break;
      case 'exportGuide':
        exportMenuGuideToCSV();
        break;
      case 'importGuide':
        excelFileInput.click();
        break;
      default:
        console.warn('알 수 없는 PIN 액션:', currentPinAction);
    }
  }
  
  // PIN 에러 표시
function showPinError() {
  const pinError = document.getElementById('pinError');
  if (pinError) {
    pinError.style.display = 'flex';
    setTimeout(() => {
      pinError.style.display = 'none';
    }, 3000);
  }
}

// PIN 에러 숨기기
function hidePinError() {
  const pinError = document.getElementById('pinError');
  if (pinError) {
    pinError.style.display = 'none';
  }
}


// PIN 모달 닫기
function closePinModal() {
  const pinModal = document.getElementById('pinModal');
  if (pinModal) {
    pinModal.classList.remove('show');
    resetPinState();
  }
}

// PIN 상태 초기화
function resetPinState() {
  currentPin = '';
  pinAttempts = 0;
  updatePinDisplay();
  updatePinConfirmButton();
  hidePinError();
  
  const pinInput = document.getElementById('pinInput');
  if (pinInput) {
    pinInput.value = '';
  }
}

// 부서 선택 옵션 업데이트 함수 (전역 함수)
function updateDepartmentSelectOptions() {
  const departmentSelect = document.getElementById('departmentSelect');
  if (!departmentSelect) return;
  
  // 모든 옵션을 활성화 상태로 초기화
  const options = departmentSelect.querySelectorAll('option');
  options.forEach(option => {
    if (option.value !== '') {
      option.disabled = false;
      option.textContent = option.value;
    }
  });
  
  // 이미 확인된 부서는 비활성화
  currentDepartments.forEach(dept => {
    const option = departmentSelect.querySelector(`option[value="${dept.department}"]`);
    if (option) {
      option.disabled = true;
      option.textContent = `${dept.department} (완료됨)`;
    }
  });
}

// 로딩 오버레이 숨기기
function hideLoadingOverlay() {
  if (loadingOverlayHideTimer) {
    clearTimeout(loadingOverlayHideTimer);
    loadingOverlayHideTimer = null;
  }

  if (loadingOverlay) {
    loadingOverlay.classList.add('hidden');
    setTimeout(() => {
      if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
      }
    }, 300);
  }
}

function showLoadingOverlay() {
  if (!loadingOverlay) return;
  if (loadingOverlayHideTimer) {
    clearTimeout(loadingOverlayHideTimer);
    loadingOverlayHideTimer = null;
  }
  loadingOverlayVisibleAt = Date.now();
  loadingOverlay.style.display = 'flex';
  loadingOverlay.classList.remove('hidden');
}

// 데이터 로드
async function loadData() {
  console.log('데이터 로드 시작');
  
  try {
    showLoading('데이터를 불러오는 중...');
    
    // 요청 데이터 로드
    const requestsRef = ref(db, '/requests/기술개발요청');
    const requestsSnapshot = await get(requestsRef);
    
    if (requestsSnapshot.exists()) {
      const requestsData = requestsSnapshot.val();
      currentRequests = Object.entries(requestsData).map(([id, data]) => ({
        id,
        ...data,
        // generation 필드가 없으면 기본값 '1차'로 설정 (기존 데이터 호환)
        generation: data.generation || '1차'
      }));
      console.log('요청 데이터 로드:', currentRequests.length, '개');
    } else {
      currentRequests = [];
      console.log('요청 데이터 없음');
    }

    // 부서 확인 데이터 로드
    const deptRef = ref(db, '/requests/부서확인');
    const deptSnapshot = await get(deptRef);
    
    if (deptSnapshot.exists()) {
      const deptData = deptSnapshot.val();
      currentDepartments = Object.entries(deptData).map(([id, data]) => ({
        id,
        ...data
      }));
      console.log('부서 확인 데이터 로드:', currentDepartments.length, '개');
    } else {
      currentDepartments = [];
      console.log('부서 확인 데이터 없음');
    }

    // 통계 및 UI 업데이트
    updateStats();
    updateDepartmentProgress();
    updateRecentActivity();
    updateRequestsTable();
    updateDepartmentsTable();
    updateDepartmentSelectOptions();
    
    showSuccess('데이터 로드 완료');
    
    // 로딩 오버레이 숨기기 (새로고침 버튼 클릭 시에만) - 최소 3초 표시
    if (loadingOverlay && loadingOverlay.style.display !== 'none') {
      const elapsed = Math.max(0, Date.now() - loadingOverlayVisibleAt);
      const delay = Math.max(0, MIN_LOADING_DISPLAY_MS - elapsed);
      if (loadingOverlayHideTimer) {
        clearTimeout(loadingOverlayHideTimer);
      }
      loadingOverlayHideTimer = setTimeout(() => {
        hideLoadingOverlay();
      }, delay);
    }
    
  } catch (err) {
    console.error('데이터 로드 오류:', err);
    hideLoadingOverlay();
    showError('데이터 로드 중 오류가 발생했습니다: ' + err.message);
  }
}

// 통계 업데이트
function updateStats() {
  if (!totalRequestsEl || !pendingRequestsEl || !completedRequestsEl || !totalQnAEl || !completionRateEl) return;
  
  totalRequestsEl.textContent = currentRequests.length;
  
  const pending = currentRequests.filter(req => 
    ['접수', '검토중', '개발중', '테스트중'].includes(req.status)
  ).length;
  pendingRequestsEl.textContent = pending;
  
  const completed = currentRequests.filter(req => req.status === '개발완료').length;
  completedRequestsEl.textContent = completed;
  
  totalQnAEl.textContent = currentQnA.length;
  
  // 요청 완료율 계산
  const totalRequests = currentRequests.length;
  const completionRate = totalRequests > 0 ? Math.round((completed / totalRequests) * 100) : 0;
  completionRateEl.textContent = `${completionRate}%`;
  
  // 부서 확인 완료율 계산
  const allDepartments = [
    '전략기획', '경영관리', '압타밀', '드리미', 
    '레이레이', '고객센터', '마케팅', 'SCM'
  ];
  const completedDepartments = currentDepartments.filter(dept => dept.noMoreRequests).length;
  const departmentProgress = Math.round((completedDepartments / allDepartments.length) * 100);
  
  // 부서 진행률 업데이트
  const departmentProgressEl = document.getElementById('departmentProgress');
  if (departmentProgressEl) {
    departmentProgressEl.textContent = `${departmentProgress}%`;
    
    // 부서 완료 상태에 따른 색상 변경
    const statCard = departmentProgressEl.closest('.stat-card');
    if (statCard) {
      statCard.classList.remove('completed', 'in-progress', 'not-started');
      if (departmentProgress === 100) {
        statCard.classList.add('completed');
      } else if (departmentProgress > 0) {
        statCard.classList.add('in-progress');
      } else {
        statCard.classList.add('not-started');
      }
    }
  }
}

// 최근 활동 업데이트
function updateRecentActivity() {
  const recentActivityList = document.getElementById('recentActivityList');
  recentActivityList.innerHTML = '';
  
  // 최근 요청 5개
  const recentRequests = currentRequests
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5);
  
  recentRequests.forEach(req => {
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    activityItem.innerHTML = `
      <span class="activity-icon">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      </span>
      <div class="activity-content">
        <div class="activity-title">${req.title}</div>
        <div class="activity-time">${formatDate(req.createdAt)} - ${req.status}</div>
      </div>
    `;
    recentActivityList.appendChild(activityItem);
  });
}

// 페이지네이션 상태 관리
const paginationState = {
  generation1: { currentPage: 1, itemsPerPage: 10 },
  generation2: { currentPage: 1, itemsPerPage: 10 }
};

// 팀 이메일 매핑 (요청자 계정 -> 확인부서)
const TEAM_EMAIL_MAP = {
  '전략기획': 'strategy@eibe.co.kr',
  '경영관리': 'management@eibe.co.kr',
  '압타밀': 'aptamil@eibe.co.kr',
  '드리미': 'dreame@eibe.co.kr',
  '레이레이': 'rayray@eibe.co.kr',
  '마케팅': 'maketing@eibe.co.kr',
  'SCM': 'scm@eibe.co.kr',
  'CS(고객센터)': 'cs@eibe.co.kr'
};

function renderTeamRequestCounts() {
  const tbody = document.getElementById('teamRequestsTableBody');
  if (!tbody) return;
  const emailToCount = {};
  // 초기화
  Object.values(TEAM_EMAIL_MAP).forEach(email => {
    emailToCount[email.toLowerCase()] = 0;
  });
  // 집계
  currentRequests.forEach(req => {
    const email = (req.requester || '').toLowerCase();
    if (email && emailToCount.hasOwnProperty(email)) {
      emailToCount[email] += 1;
    }
  });
  // 렌더링 (등록 건수 기준 내림차순 정렬)
  tbody.innerHTML = '';
  // 팀별 데이터를 배열로 변환
  const teamData = Object.keys(TEAM_EMAIL_MAP).map(team => {
    const email = TEAM_EMAIL_MAP[team];
    const count = emailToCount[email.toLowerCase()] || 0;
    return { team, email, count };
  });
  // 등록 건수 기준 내림차순 정렬
  teamData.sort((a, b) => b.count - a.count);
  // 정렬된 순서대로 렌더링
  teamData.forEach(({ team, email, count }) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${team}</td>
      <td>${email}</td>
      <td style="text-align:center; font-variant-numeric: tabular-nums;">${count}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 요청 아코디언 업데이트
function updateRequestsTable() {
  // 1차/2차 요청 분류
  const generation1Requests = currentRequests.filter(req => req.generation === '1차');
  const generation2Requests = currentRequests.filter(req => req.generation === '2차');
  
  // 카운트 업데이트
  const count1El = document.getElementById('generation1Count');
  const count2El = document.getElementById('generation2Count');
  if (count1El) count1El.textContent = generation1Requests.length;
  if (count2El) count2El.textContent = generation2Requests.length;
  
  // 2차 개발요청 목록 렌더링 (페이지네이션 적용) - 위로 올라오도록 먼저 렌더링
  renderGenerationRequests('generation2', generation2Requests);
  
  // 1차 개발요청 목록 렌더링 (페이지네이션 적용)
  renderGenerationRequests('generation1', generation1Requests);
  
  // 기본적으로 2차 아코디언은 열려있고, 1차 아코디언은 닫혀있음
  const accordion1 = document.querySelector('#accordionHeader1')?.closest('.accordion-item');
  const accordion2 = document.querySelector('#accordionHeader2')?.closest('.accordion-item');
  if (accordion2 && !accordion2.classList.contains('active')) {
    accordion2.classList.add('active');
  }

  // 팀별 등록 건수 렌더링
  renderTeamRequestCounts();
}

// 차수별 요청 목록 렌더링 (페이지네이션 포함)
function renderGenerationRequests(generation, requests) {
  const listId = generation === 'generation1' ? 'generation1List' : 'generation2List';
  const paginationId = generation === 'generation1' ? 'generation1Pagination' : 'generation2Pagination';
  const listEl = document.getElementById(listId);
  const paginationEl = document.getElementById(paginationId);
  
  if (!listEl) return;
  
  listEl.innerHTML = '';
  
  if (requests.length === 0) {
    listEl.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--muted);">등록된 ${generation === 'generation1' ? '1차' : '2차'} 개발요청이 없습니다.</div>`;
    if (paginationEl) paginationEl.style.display = 'none';
    return;
  }
  
  // 날짜 내림차순 정렬 (최신순)
  const sorted = [...requests].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
  
  // 페이지네이션 계산
  const state = paginationState[generation];
  const totalPages = Math.ceil(sorted.length / state.itemsPerPage);
  const startIndex = (state.currentPage - 1) * state.itemsPerPage;
  const endIndex = startIndex + state.itemsPerPage;
  const currentPageRequests = sorted.slice(startIndex, endIndex);
  
  // 현재 페이지 요청만 렌더링
  currentPageRequests.forEach(req => {
    const card = createRequestCard(req);
    listEl.appendChild(card);
  });
  
  // 페이지네이션 렌더링
  if (paginationEl) {
    if (sorted.length > state.itemsPerPage) {
      paginationEl.style.display = 'flex';
      renderPagination(generation, state.currentPage, totalPages, sorted.length, state.itemsPerPage);
    } else {
      paginationEl.style.display = 'none';
    }
  }
}

// 페이지네이션 렌더링
function renderPagination(generation, currentPage, totalPages, totalItems, itemsPerPage) {
  const paginationId = generation === 'generation1' ? 'generation1Pagination' : 'generation2Pagination';
  const paginationEl = document.getElementById(paginationId);
  
  if (!paginationEl) return;
  
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  
  const infoDiv = document.createElement('div');
  infoDiv.className = 'pagination-info';
  infoDiv.textContent = `${startItem}-${endItem} / 총 ${totalItems}개`;
  
  const buttonsDiv = document.createElement('div');
  buttonsDiv.className = 'pagination-buttons';
  
  // 이전 페이지 버튼
  const prevBtn = document.createElement('button');
  prevBtn.className = 'pagination-btn';
  prevBtn.textContent = '이전';
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener('click', () => changePage(generation, currentPage - 1));
  buttonsDiv.appendChild(prevBtn);
  
  // 페이지 번호 버튼들
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  if (startPage > 1) {
    const firstBtn = document.createElement('button');
    firstBtn.className = 'pagination-btn';
    firstBtn.textContent = '1';
    firstBtn.addEventListener('click', () => changePage(generation, 1));
    buttonsDiv.appendChild(firstBtn);
    
    if (startPage > 2) {
      const ellipsis = document.createElement('span');
      ellipsis.style.padding = '0 8px';
      ellipsis.style.color = 'var(--muted)';
      ellipsis.textContent = '...';
      buttonsDiv.appendChild(ellipsis);
    }
  }
  
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
    pageBtn.textContent = i.toString();
    pageBtn.addEventListener('click', () => changePage(generation, i));
    buttonsDiv.appendChild(pageBtn);
  }
  
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement('span');
      ellipsis.style.padding = '0 8px';
      ellipsis.style.color = 'var(--muted)';
      ellipsis.textContent = '...';
      buttonsDiv.appendChild(ellipsis);
    }
    
    const lastBtn = document.createElement('button');
    lastBtn.className = 'pagination-btn';
    lastBtn.textContent = totalPages.toString();
    lastBtn.addEventListener('click', () => changePage(generation, totalPages));
    buttonsDiv.appendChild(lastBtn);
  }
  
  // 다음 페이지 버튼
  const nextBtn = document.createElement('button');
  nextBtn.className = 'pagination-btn';
  nextBtn.textContent = '다음';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.addEventListener('click', () => changePage(generation, currentPage + 1));
  buttonsDiv.appendChild(nextBtn);
  
  // 기존 내용 제거 후 새로 추가
  paginationEl.innerHTML = '';
  paginationEl.appendChild(infoDiv);
  paginationEl.appendChild(buttonsDiv);
}

// 페이지 변경 함수 (전역 접근 가능하도록 window에 등록)
window.changePage = function(generation, page) {
  const state = paginationState[generation];
  const requests = currentRequests.filter(req => req.generation === (generation === 'generation1' ? '1차' : '2차'));
  const totalPages = Math.ceil(requests.length / state.itemsPerPage);
  
  if (page < 1 || page > totalPages) return;
  
  state.currentPage = page;
  renderGenerationRequests(generation, requests);
  
  // 페이지 변경 시 스크롤을 아코디언 헤더로 이동
  const accordionHeader = document.getElementById(generation === 'generation1' ? 'accordionHeader1' : 'accordionHeader2');
  if (accordionHeader) {
    accordionHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// 요청 카드 생성 함수
function createRequestCard(req) {
  const card = document.createElement('div');
  card.className = 'request-card';
  card.setAttribute('data-detail', req.detail || '');
  card.setAttribute('data-title', req.title || '');
  card.setAttribute('data-requester', req.requesterName || req.requester || '');
  
  card.innerHTML = `
    <div class="request-card-header">
      <h4 class="request-card-title">${escapeHtml(req.title || '제목 없음')}</h4>
      <div class="request-card-badges">
        <span class="priority-badge ${req.priority || '보통'}">${req.priority || '보통'}</span>
        <span class="status-badge ${req.status || '접수'}">${req.status || '접수'}</span>
      </div>
    </div>
    <div class="request-card-body">
      <div class="request-card-info">
        <span class="request-card-label">개발유형</span>
        <span class="request-card-value">${escapeHtml(req.developmentType || '-')}</span>
      </div>
      <div class="request-card-info">
        <span class="request-card-label">작성자</span>
        <span class="request-card-value">${escapeHtml(req.requesterName || req.requester || '-')}</span>
      </div>
      <div class="request-card-info">
        <span class="request-card-label">등록일</span>
        <span class="request-card-value">${formatDate(req.createdAt)}</span>
      </div>
      ${req.expectedDuration ? `
      <div class="request-card-info">
        <span class="request-card-label">예상기간</span>
        <span class="request-card-value">${escapeHtml(req.expectedDuration)}</span>
      </div>
      ` : ''}
    </div>
    <div class="request-card-footer">
      <span style="font-size: 12px; color: var(--muted);">${req.generation || '1차'} 개발요청</span>
      <div class="request-card-actions">
        <button class="btn btn-secondary" onclick="viewRequest('${req.id}')">보기</button>
      </div>
    </div>
  `;
  
  return card;
}

// HTML 이스케이프 함수
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 부서 진행률 업데이트
function updateDepartmentProgress() {
  const progressGrid = document.getElementById('departmentProgressGrid');
  if (!progressGrid) return;
  
  // 모든 부서 목록
  const allDepartments = [
    '전략기획', '경영관리', '압타밀', '드리미', 
    '레이레이', '고객센터', '마케팅', 'SCM'
  ];
  
  progressGrid.innerHTML = '';
  
  allDepartments.forEach(deptName => {
    // 해당 부서의 확인 데이터 찾기
    const deptData = currentDepartments.find(dept => dept.department === deptName);
    
    const progressCard = document.createElement('div');
    progressCard.className = 'progress-card';
    
    let status = 'not-started';
    let statusText = '요청사항 접수중..';
    let statusIcon = '⏳';
    
    if (deptData) {
      if (deptData.noMoreRequests) {
        status = 'completed';
        statusText = '완료 - 개발사 전달';
        statusIcon = '✅';
      } else {
        status = 'not-started';
        statusText = '미완료';
        statusIcon = '⏳';
      }
    }
    
    progressCard.classList.add(status);
    
    progressCard.innerHTML = `
      <div class="progress-header">
        <div class="progress-title">${deptName}</div>
        <div class="progress-status ${status}">
          <span>${statusIcon}</span>
          <span>${statusText}</span>
        </div>
      </div>
    `;
    
    progressGrid.appendChild(progressCard);
  });
  
  // 전체 완료율 계산
  const completedCount = currentDepartments.filter(dept => dept.noMoreRequests).length;
  const totalCount = allDepartments.length;
  const overallProgress = Math.round((completedCount / totalCount) * 100);
  
  // 전체 진행률 표시
  console.log(`전체 부서 확인 진행률: ${overallProgress}% (${completedCount}/${totalCount})`);
  
  // 전체 완료 시 축하 메시지
  if (completedCount === totalCount && completedCount > 0) {
    showSuccess('🎉 모든 부서 확인이 완료되었습니다! 개발사에 전달할 준비가 되었습니다.');
  }
}

// 부서 테이블 업데이트
function updateDepartmentsTable() {
  const deptTableBody = document.getElementById('dataDeptTableBody');
  if (!deptTableBody) return;
  
  deptTableBody.innerHTML = '';
  
  currentDepartments.forEach(dept => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${dept.department || '-'}</td>
      <td><span class="status-badge ${dept.noMoreRequests ? 'success' : 'loading'}">${dept.noMoreRequests ? '완료' : '진행중'}</span></td>
      <td>${dept.comment || '-'}</td>
      <td>${formatDate(dept.createdAt)}</td>
    `;
    deptTableBody.appendChild(row);
  });
}

// 엑셀 내보내기 이벤트 리스너 추가
function initializeExportButtons() {
    if (exportRequestsBtn) {
      exportRequestsBtn.addEventListener('click', () => {
        showPinModal('exportRequests');
      });
    }
  
}

// 다운로드 선택 모달 초기화
function initializeDownloadSelectionModal() {
  const modal = document.getElementById('downloadSelectionModal');
  const closeBtn = document.getElementById('downloadSelectionClose');
  const cancelBtn = document.getElementById('downloadSelectionCancel');
  const confirmBtn = document.getElementById('downloadSelectionConfirm');
  
  if (!modal) return;
  
  // 닫기 버튼
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDownloadSelectionModal);
  }
  
  // 취소 버튼
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeDownloadSelectionModal);
  }
  
  // 확인 버튼
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      const selectedOption = document.querySelector('input[name="downloadType"]:checked');
      if (selectedOption) {
        const value = selectedOption.value;
        closeDownloadSelectionModal();
        downloadRequestsCSV(value);
      }
    });
  }
  
  // 백드롭 클릭 시 닫기
  const backdrop = modal.querySelector('.download-selection-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closeDownloadSelectionModal);
  }
  
  // ESC 키로 닫기
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDownloadSelectionModal();
    }
  });
}

// 다운로드 선택 모달 표시
function showDownloadSelectionModal() {
  const modal = document.getElementById('downloadSelectionModal');
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    // 기본값으로 전체 선택
    document.getElementById('downloadAll').checked = true;
  }
}

// 다운로드 선택 모달 닫기
function closeDownloadSelectionModal() {
  const modal = document.getElementById('downloadSelectionModal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// CSV 다운로드 함수 (generation 필터 파라미터 추가)
function downloadRequestsCSV(generationFilter = 'all') {
  if (!currentRequests || currentRequests.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }
  
  // generation 필터에 따라 데이터 필터링
  let filteredRequests = currentRequests;
  if (generationFilter === '1차') {
    filteredRequests = currentRequests.filter(req => (req.generation || '1차') === '1차');
  } else if (generationFilter === '2차') {
    filteredRequests = currentRequests.filter(req => (req.generation || '1차') === '2차');
  }
  // 'all'이면 전체 데이터 사용
  
  if (filteredRequests.length === 0) {
    alert('선택한 범위에 다운로드할 데이터가 없습니다.');
    return;
  }
  
  // CSV 헤더
  const headers = [
    '번호',
    '차수',
    '제목', 
    '개발유형',
    '상세내용',
    '요청자',
    '상태',
    '우선순위',
    '등록일시',
    '수정일시'
  ];
  
  // CSV 데이터 생성
  const csvData = filteredRequests.map((request, index) => [
    index + 1,
    request.generation || '1차',
    request.title || '',
    request.developmentType || '',
    request.detail || '',
    request.requesterName || '',
    request.status || '',
    request.priority || '',
    request.createdAt ? formatDate(request.createdAt) : '',
    request.updatedAt ? formatDate(request.updatedAt) : ''
  ]);
  
  // CSV 문자열 생성
  const csvContent = [
    headers.join(','),
    ...csvData.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    )
  ].join('\n');
  
  // BOM 추가 (한글 깨짐 방지)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // 파일명에 필터 정보 포함
  let filename = `기술개발요청_${new Date().toISOString().split('T')[0]}`;
  if (generationFilter === '1차') {
    filename += '_1차';
  } else if (generationFilter === '2차') {
    filename += '_2차';
  }
  filename += '.csv';
  
  // 다운로드 실행
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  console.log('CSV 다운로드 완료:', generationFilter, filteredRequests.length, '개');
  showSuccess(`${filteredRequests.length}개의 데이터가 다운로드되었습니다.`);
}

// 엑셀 내보내기 함수
function exportToExcel(data, filename) {
  let excelContent = '';
  
  if (Array.isArray(data)) {
    // 단일 배열 데이터 - 모든 필드 포함
    if (data.length > 0) {
      // 모든 필드를 포함한 헤더 순서 (요청자 정보 + 개발자 처리 정보)
      const orderedHeaders = [
        'title', 'developmentType', 'requesterName', 'detail', 'requester', 'createdAt',
        'priority', 'expectedDuration', 'status', 'developerComment', 'updatedAt', 'updatedBy',
        'excel', 'images', 'photos'
      ];
      
      // 실제 존재하는 헤더만 필터링
      const availableHeaders = orderedHeaders.filter(header => 
        data.some(item => item.hasOwnProperty(header))
      );
      
      // 헤더 한글 매핑 (요청자 정보 + 개발자 처리 정보)
      const headerMap = {
        'title': '제목',
        'developmentType': '개발유형',
        'requesterName': '요청자 이름',
        'detail': '상세내용',
        'requester': '요청자 이메일',
        'createdAt': '요청일시',
        'priority': '우선순위',
        'expectedDuration': '예상개발기간',
        'status': '개발상태',
        'developerComment': '개발자 코멘트',
        'updatedAt': '최종수정일시',
        'updatedBy': '수정자',
        'excel': '첨부엑셀파일',
        'images': '첨부이미지',
        'photos': '첨부사진'
      };
      
      // 한글 헤더로 변환
      const koreanHeaders = availableHeaders.map(header => headerMap[header] || header);
      
      // CSV 형식으로 변환 (쉼표 구분자 사용)
      excelContent += koreanHeaders.join(',') + '\n';
      
      // 데이터 행들
      data.forEach(item => {
        const row = availableHeaders.map(header => {
          let value = item[header];
          
          // 날짜 포맷팅
          if ((header === 'createdAt' || header === 'updatedAt') && value) {
            value = formatDate(value);
          }
          
          // 첨부파일 처리
          if (header === 'excel' && value) {
            if (typeof value === 'object' && value.name) {
              value = value.name;
            } else if (typeof value === 'string') {
              value = '엑셀파일 첨부됨';
            }
          }
          
          if (header === 'images' && value) {
            if (Array.isArray(value) && value.length > 0) {
              // 이미지 파일명들을 모두 나열
              const imageNames = value.map(img => img.name || '이미지').join(', ');
              value = `${value.length}개 이미지: ${imageNames}`;
            } else if (typeof value === 'string') {
              value = '이미지 첨부됨';
            }
          }
          
          if (header === 'photos' && value) {
            if (Array.isArray(value) && value.length > 0) {
              // 사진 파일명들을 모두 나열
              const photoNames = value.map(photo => photo.name || '사진').join(', ');
              value = `${value.length}개 사진: ${photoNames}`;
            } else if (typeof value === 'string') {
              value = '사진 첨부됨';
            }
          }
          
          // 객체나 배열인 경우 JSON 문자열로 변환
          if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
          }
          
          // CSV 이스케이프 처리
          if (typeof value === 'string') {
            // 쉼표, 따옴표, 줄바꿈이 포함된 경우 따옴표로 감싸기
            if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
              value = `"${value.replace(/"/g, '""')}"`;
            }
          }
          
          return value || '';
        });
        excelContent += row.join(',') + '\n';
      });
    }
  } else {
    // 객체 데이터 (여러 테이블)
    Object.keys(data).forEach(tableName => {
      excelContent += `\n=== ${tableName} ===\n`;
      if (data[tableName].length > 0) {
        const headers = Object.keys(data[tableName][0]);
        excelContent += headers.join(',') + '\n';
        
        data[tableName].forEach(item => {
          const row = headers.map(header => {
            let value = item[header];
            if (typeof value === 'object' && value !== null) {
              value = JSON.stringify(value);
            }
            if (typeof value === 'string') {
              // CSV 이스케이프 처리
              if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
                value = `"${value.replace(/"/g, '""')}"`;
              }
            }
            return value || '';
          });
          excelContent += row.join(',') + '\n';
        });
      }
    });
  }
  
  // CSV 파일 다운로드 (쉼표 구분자, UTF-8 BOM)
  const blob = new Blob(['\uFEFF' + excelContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showSuccess(`${filename} 데이터가 CSV 파일로 다운로드되었습니다. (엑셀에서 열면 컬럼별로 자동 분리됩니다)`);
}

// XML 이스케이프 함수
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 유틸리티 함수들
function setNow() {
  const createdAtEl = document.getElementById('createdAt');
  if (createdAtEl) {
    createdAtEl.value = new Date().toLocaleString('ko-KR');
  }
}

function setStatus(msg, type) {
  if (!statusMsg) return;
  
  statusMsg.textContent = msg;
  statusMsg.className = 'status ' + type;
  statusMsg.style.display = 'block';
  if (type !== 'loading') {
    setTimeout(() => statusMsg.style.display = 'none', 6000);
  }
}

// 부서 확인 섹션 전용 상태 메시지 함수
function setDeptStatus(msg, type) {
  const deptStatusEl = document.getElementById('deptStatus');
  if (!deptStatusEl) return;
  
  deptStatusEl.textContent = msg;
  deptStatusEl.className = 'status ' + type;
  deptStatusEl.style.display = 'block';
  if (type !== 'loading') {
    setTimeout(() => deptStatusEl.style.display = 'none', 6000);
  }
}

// 성공 메시지 표시
function showSuccess(message) {
  setStatus(message, 'success');
  console.log('✅ 성공:', message);
}

// 에러 메시지 표시
function showError(message) {
  setStatus(message, 'error');
  console.error('❌ 오류:', message);
}

// 로딩 메시지 표시
function showLoading(message) {
  setStatus(message, 'loading');
  console.log('⏳ 로딩:', message);
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('ko-KR');
}

// 전역 함수들
window.viewRequest = function(id) {
  const request = currentRequests.find(req => req.id === id);
  if (!request) {
    showError('요청을 찾을 수 없습니다.');
    return;
  }
  
  showRequestModal(request);
};

// 모달 표시
function showRequestModal(request) {
  const modal = document.getElementById('requestModal');
  const modalBody = document.getElementById('modalBody');
  
  modalBody.innerHTML = `
    <div class="modal-form">
      <!-- 사용자 요청 정보 -->
      <div class="form-section">
        <h3 class="section-title">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px; margin-right: 8px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
          </svg>
          요청 정보
        </h3>
        <div class="form-grid">
          <div class="form-group">
            <label>제목</label>
            <div class="readonly-field" translate="yes">${request.title || ''}</div>
          </div>
          <div class="form-group">
            <label>개발유형</label>
            <div class="readonly-field" translate="yes">${request.developmentType || ''}</div>
          </div>
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>요청자 이름</label>
            <div class="readonly-field" translate="yes">${request.requesterName || request.requester || ''}</div>
          </div>
          <div class="form-group">
            <label>요청자 계정 (등록 계정)</label>
            <div class="readonly-field">${request.requester || currentUser?.email || '-'}</div>
          </div>
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>등록일시</label>
            <div class="readonly-field">${formatDate(request.createdAt)}</div>
          </div>
          ${request.updatedBy ? `
          <div class="form-group">
            <label>최종 수정자</label>
            <div class="readonly-field">${request.updatedBy}</div>
          </div>
          ` : '<div class="form-group"></div>'}
        </div>
        
        <div class="form-group">
          <label>상세내용</label>
          <div class="readonly-multiline" translate="yes">${request.detail || ''}</div>
        </div>
        
        ${getAttachedFilesHTML(request)}
      </div>
      
      <!-- 개발자 관리 정보 -->
      <div class="form-section developer-section">
        <h3 class="section-title">⚙️ 개발자 관리</h3>
        <div class="developer-note">
          💡 개발자: 아래 정보를 검토하고 필요시 수정하세요
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>우선순위</label>
            <select id="prioritySelect" class="priority-select">
              <option value="긴급" ${request.priority === '긴급' ? 'selected' : ''}>긴급 (1주일 이내)</option>
              <option value="높음" ${request.priority === '높음' ? 'selected' : ''}>높음 (2주일 이내)</option>
              <option value="보통" ${request.priority === '보통' ? 'selected' : ''}>보통 (1개월 이내)</option>
              <option value="낮음" ${request.priority === '낮음' ? 'selected' : ''}>낮음 (2개월 이내)</option>
            </select>
          </div>
          <div class="form-group">
            <label>예상 개발기간</label>
            <select id="durationSelect" class="duration-select">
              <option value="1일" ${request.expectedDuration === '1일' ? 'selected' : ''}>1일</option>
              <option value="2-3일" ${request.expectedDuration === '2-3일' ? 'selected' : ''}>2-3일</option>
              <option value="1주일" ${request.expectedDuration === '1주일' ? 'selected' : ''}>1주일</option>
              <option value="2주일" ${request.expectedDuration === '2주일' ? 'selected' : ''}>2주일</option>
              <option value="1개월" ${request.expectedDuration === '1개월' ? 'selected' : ''}>1개월</option>
              <option value="2개월" ${request.expectedDuration === '2개월' ? 'selected' : ''}>2개월</option>
              <option value="3개월 이상" ${request.expectedDuration === '3개월 이상' ? 'selected' : ''}>3개월 이상</option>
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label>개발상태</label>
          <select id="statusSelect" class="status-select">
            <option value="접수" ${request.status === '접수' ? 'selected' : ''}>접수</option>
            <option value="검토중" ${request.status === '검토중' ? 'selected' : ''}>검토중</option>
            <option value="개발중" ${request.status === '개발중' ? 'selected' : ''}>개발중</option>
            <option value="테스트중" ${request.status === '테스트중' ? 'selected' : ''}>테스트중</option>
            <option value="개발완료" ${request.status === '개발완료' ? 'selected' : ''}>개발완료</option>
            <option value="보류" ${request.status === '보류' ? 'selected' : ''}>보류</option>
            <option value="취소" ${request.status === '취소' ? 'selected' : ''}>취소</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="developerComment">개발자 코멘트/답변</label>
          <textarea id="developerComment" class="developer-comment" placeholder="개발 진행 상황, 완료 내용, 추가 설명 등을 입력하세요..." rows="4" translate="yes">${request.developerComment || ''}</textarea>
          <div class="help">요청자에게 전달할 개발 진행 상황이나 완료 내용을 작성하세요</div>
        </div>
      </div>
    </div>
  `;
  
  // 모달 푸터에 저장 버튼 추가
  const modalFooter = document.querySelector('.modal-footer');
  if (modalFooter) {
    modalFooter.innerHTML = `
      <button class="btn btn-secondary" id="closeModalBtn">닫기</button>
      <button class="btn btn-primary" id="saveStatusBtn" data-request-id="${request.id}">
        <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-right: 8px;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
        </svg>
        개발정보 저장
      </button>
    `;
  }
  
  modal.style.display = 'block';
  
  // 저장 버튼 이벤트 리스너 추가
  initializeStatusSaveButton(request.id);

  // 모달 내 구글 번역 위젯 초기화 (이미 로드된 스크립트 활용)
  try {
    if (window.google && window.google.translate && document.getElementById('google_translate_modal')) {
      // 기존 위젯이 붙어있다면 초기화 전에 비우기
      const target = document.getElementById('google_translate_modal');
      target.innerHTML = '';
      new google.translate.TranslateElement({
        pageLanguage: 'ko',
        includedLanguages: 'ko,zh-CN,zh-TW,en,ja',
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
      }, 'google_translate_modal');
    }
  } catch (e) {
    console.warn('모달 번역 위젯 초기화 실패:', e);
  }
}

// 첨부파일 HTML 생성
function getAttachedFilesHTML(request) {
  let filesHTML = '';
  
  // 이미지 파일들
  if (request.photos && request.photos.length > 0) {
    filesHTML += `
      <div class="form-group">
        <label>첨부 이미지</label>
        <div class="file-list">
          ${request.photos.map((photo, index) => {
            const hasData = photo.data && photo.data.length > 0;
            return `
            <div class="file-item">
              <div class="file-info">
                <span class="file-icon">🖼️</span>
                <div>
                  <div class="file-name">${photo.name || `이미지_${index + 1}`}</div>
                  <div class="file-size">${formatFileSize(photo.size)}</div>
                  ${!hasData ? '<div style="color: #ef4444; font-size: 12px;">⚠️ 파일 데이터 없음</div>' : ''}
                </div>
              </div>
              <button class="download-btn" ${!hasData ? 'disabled' : ''} onclick="${hasData ? `downloadFile('${photo.data}', '${photo.name || `이미지_${index + 1}.jpg`}', 'image')` : 'showError(\'파일 데이터가 없습니다.\')'}">
                ${hasData ? '다운로드' : '데이터 없음'}
              </button>
            </div>
          `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  // 엑셀 파일
  if (request.excel && request.excel.data) {
    const hasData = request.excel.data && request.excel.data.length > 0;
    filesHTML += `
      <div class="form-group">
        <label>첨부 엑셀</label>
        <div class="file-list">
          <div class="file-item">
            <div class="file-info">
              <svg class="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px; margin-right: 8px;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              <div>
                <div class="file-name">${request.excel.name || '엑셀파일.xlsx'}</div>
                <div class="file-size">${formatFileSize(request.excel.size)}</div>
                ${!hasData ? '<div style="color: #ef4444; font-size: 12px;">⚠️ 파일 데이터 없음</div>' : ''}
              </div>
            </div>
            <button class="download-btn" ${!hasData ? 'disabled' : ''} onclick="${hasData ? `downloadFile('${request.excel.data}', '${request.excel.name || '엑셀파일.xlsx'}', 'excel')` : 'showError(\'파일 데이터가 없습니다.\')'}">
              ${hasData ? '다운로드' : '데이터 없음'}
            </button>
          </div>
        </div>
      </div>
    `;
  }
  
  if (!filesHTML) {
    filesHTML = `
      <div class="form-group">
        <label>첨부파일</label>
        <div style="text-align: center; padding: 20px; color: var(--muted);">
          첨부된 파일이 없습니다.
        </div>
      </div>
    `;
  }
  
  return filesHTML;
}

// 파일 다운로드
window.downloadFile = function(data, filename, type) {
  try {
    console.log('다운로드 시도:', { filename, type, dataLength: data ? data.length : 0 });
    
    if (!data) {
      showError('다운로드할 파일 데이터가 없습니다.');
      return;
    }
    
    // Base64 데이터가 data URL 형태인지 확인
    let downloadUrl = data;
    if (!data.startsWith('data:')) {
      // Base64 데이터만 있는 경우 data URL로 변환
      const mimeType = type === 'image' ? 'image/jpeg' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      downloadUrl = `data:${mimeType};base64,${data}`;
    }
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccess(`${filename} 다운로드가 시작되었습니다.`);
  } catch (error) {
    console.error('파일 다운로드 오류:', error);
    showError('파일 다운로드 중 오류가 발생했습니다: ' + error.message);
  }
};

// 파일 크기 포맷팅
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 개발정보 저장 버튼 초기화
function initializeStatusSaveButton(requestId) {
  console.log('저장 버튼 초기화 시작:', requestId);
  
  const saveBtn = document.getElementById('saveStatusBtn');
  const statusSelect = document.getElementById('statusSelect');
  const prioritySelect = document.getElementById('prioritySelect');
  const durationSelect = document.getElementById('durationSelect');
  const developerComment = document.getElementById('developerComment');
  
  console.log('요소들 찾기:', {
    saveBtn: !!saveBtn,
    statusSelect: !!statusSelect,
    prioritySelect: !!prioritySelect,
    durationSelect: !!durationSelect,
    developerComment: !!developerComment
  });
  
  if (saveBtn) {
    // 기존 이벤트 리스너 제거
    saveBtn.removeEventListener('click', saveBtn.clickHandler);
    
    // 새 이벤트 리스너 추가
    saveBtn.clickHandler = async () => {
      console.log('저장 버튼 클릭됨');
      
      const updates = {
        status: statusSelect ? statusSelect.value : '',
        priority: prioritySelect ? prioritySelect.value : '',
        expectedDuration: durationSelect ? durationSelect.value : '',
        developerComment: developerComment ? developerComment.value.trim() : ''
      };
      
      console.log('업데이트할 데이터:', updates);
      await saveRequestUpdates(requestId, updates);
    };
    
    saveBtn.addEventListener('click', saveBtn.clickHandler);
    console.log('저장 버튼 이벤트 리스너 추가 완료');
  } else {
    console.error('저장 버튼을 찾을 수 없습니다');
  }
}

// 요청 개발정보 저장 (우선순위, 예상기간, 개발상태)
async function saveRequestUpdates(requestId, updates) {
  const saveBtn = document.getElementById('saveStatusBtn');
  
  if (!saveBtn) return;
  
  try {
    // 버튼 상태 변경
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="btn-icon">⏳</span>저장 중...';
    
    // 데이터베이스에서 요청 데이터 업데이트
    const requestRef = ref(db, `/requests/기술개발요청/${requestId}`);
    const request = currentRequests.find(r => r.id === requestId);
    
    if (!request) {
      throw new Error('요청을 찾을 수 없습니다.');
    }
    
    // 개발정보 업데이트
    await set(requestRef, {
      ...request,
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.email
    });
    
    // 로컬 데이터 업데이트
    const requestIndex = currentRequests.findIndex(r => r.id === requestId);
    if (requestIndex !== -1) {
      Object.assign(currentRequests[requestIndex], updates);
      currentRequests[requestIndex].updatedAt = Date.now();
      currentRequests[requestIndex].updatedBy = currentUser.email;
    }
    
    // UI 업데이트
    updateRequestsTable();
    updateStats();
    
    // 변경된 항목들을 메시지로 표시
    const changedItems = [];
    if (updates.priority) changedItems.push(`우선순위: ${updates.priority}`);
    if (updates.expectedDuration) changedItems.push(`예상기간: ${updates.expectedDuration}`);
    if (updates.status) changedItems.push(`개발상태: ${updates.status}`);
    if (updates.developerComment) changedItems.push(`개발자 코멘트: ${updates.developerComment.length > 20 ? updates.developerComment.substring(0, 20) + '...' : updates.developerComment}`);
    
    showSuccess(`개발정보가 업데이트되었습니다: ${changedItems.join(', ')}`);
    
    // 버튼 상태 복원
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<span class="btn-icon">💾</span>개발정보 저장';
    
    console.log('개발정보 저장 성공:', requestId, updates);
    
    // 성공 후 모달 즉시 닫기
    setTimeout(() => {
      const modal = document.getElementById('requestModal');
      if (modal) {
        modal.style.display = 'none';
      }
    }, 500); // 0.5초 후 모달 닫기 (성공 메시지 확인 시간)
    
  } catch (error) {
    console.error('개발정보 저장 오류:', error);
    showError('개발정보 저장 중 오류가 발생했습니다: ' + error.message);
    
    // 버튼 상태 복원
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<span class="btn-icon">💾</span>개발정보 저장';
  }
}

// 메뉴 가이드 초기화
function initializeMenuGuide() {
  console.log('메뉴 가이드 초기화 시작');
  
  if (addRowBtn) {
    addRowBtn.addEventListener('click', addNewRow);
  }
  
    if (exportGuideBtn) {
      exportGuideBtn.addEventListener('click', () => {
        showPinModal('exportGuide');
      });
    }
    
    if (importGuideBtn) {
      importGuideBtn.addEventListener('click', () => {
        showPinModal('importGuide');
      });
    }
  
  if (excelFileInput) {
    excelFileInput.addEventListener('change', handleExcelUpload);
  }
  
  
  if (refreshGuideBtn) {
    refreshGuideBtn.addEventListener('click', () => {
      loadMenuGuide();
      showSuccess('메뉴 가이드가 새로고침되었습니다.');
    });
  }
  
  console.log('메뉴 가이드 초기화 완료');
}

// 메뉴 가이드 로드
async function loadMenuGuide() {
  try {
    const guideRef = ref(db, '/menuGuide');
    const snapshot = await get(guideRef);
    
    if (snapshot.exists()) {
      const guideData = snapshot.val();
      const menuRows = guideData.menuRows || [];
      
      renderMenuTable(menuRows);
      updateGuideDisplay(menuRows);
      updateGuideStats(menuRows);
    } else {
      // 기본 메뉴 행들
      const defaultMenuRows = [
        {
          id: '1',
          menuName: '대시보드',
          subMenuName: '개요',
          description: '전체 요청 현황을 한눈에 확인할 수 있습니다. 통계 카드로 요청 건수, 진행 상황, 부서 확인 현황을 표시합니다.',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          menuName: '기술개발',
          subMenuName: '요청 등록',
          description: '새로운 개발 요청을 등록할 수 있습니다. 요청 제목, 개발 유형, 요청자 이름, 상세 내용을 입력하고 첨부 파일(이미지, 엑셀) 업로드가 가능합니다.',
          createdAt: new Date().toISOString()
        },
        {
          id: '3',
          menuName: '기술개발',
          subMenuName: '요청 관리',
          description: '개발자는 우선순위, 예상 기간, 개발 상태를 설정할 수 있습니다. 개발자 코멘트를 통해 진행 상황을 공유할 수 있습니다.',
          createdAt: new Date().toISOString()
        },
        {
          id: '4',
          menuName: '질의응답',
          subMenuName: 'Q&A',
          description: '실시간 질문과 답변을 주고받을 수 있습니다. 질문 등록 후 답변을 기다릴 수 있으며, 답변 완료 시 상태가 자동으로 업데이트됩니다.',
          createdAt: new Date().toISOString()
        },
        {
          id: '5',
          menuName: '메뉴별',
          subMenuName: '상세 설명',
          description: '이 가이드는 수정 가능합니다. 개발자들이 참고할 수 있는 상세 설명을 작성하세요. 메뉴 항목을 추가, 편집, 삭제할 수 있습니다.',
          createdAt: new Date().toISOString()
        },
        {
          id: '6',
          menuName: '부서',
          subMenuName: '최종 확인',
          description: '8개 부서별로 최종 확인을 진행합니다. "더 이상 요청할 것이 없습니다" 체크 시 완료 처리되며, 전체 부서 완료 시 개발사 전달 준비가 완료됩니다.',
          createdAt: new Date().toISOString()
        }
      ];
      
      renderMenuTable(defaultMenuRows);
      updateGuideDisplay(defaultMenuRows);
      updateGuideStats(defaultMenuRows);
    }
  } catch (error) {
    console.error('메뉴 가이드 로드 오류:', error);
    showError('메뉴 가이드 로드 중 오류가 발생했습니다: ' + error.message);
  }
}

// 새 행 추가
async function addNewRow() {
  if (!newMenuName || !newSubMenuName || !newMenuDescription) return;
  
  const menuName = newMenuName.value.trim();
  const subMenuName = newSubMenuName.value.trim();
  const description = newMenuDescription.value.trim();
  
  if (!menuName || !subMenuName || !description) {
    showError('메뉴명, 하위메뉴명, 상세설명을 모두 입력해주세요.');
    return;
  }
  
  const newRow = {
    id: Date.now().toString(),
    menuName: menuName,
    subMenuName: subMenuName,
    description: description,
    createdAt: new Date().toISOString(),
    createdBy: currentUser.email
  };
  
  // 현재 메뉴 행들 가져오기 (데이터베이스에서 직접 가져오기)
  let currentMenuRows = [];
  try {
    const guideRef = ref(db, '/menuGuide');
    const snapshot = await get(guideRef);
    if (snapshot.exists()) {
      const guideData = snapshot.val();
      currentMenuRows = guideData.menuRows || [];
    }
  } catch (error) {
    console.error('기존 데이터 로드 오류:', error);
    // 오류 시 현재 테이블에서 가져오기
    currentMenuRows = getCurrentMenuRows();
  }
  
  currentMenuRows.push(newRow);
  
  // UI 업데이트
  renderMenuTable(currentMenuRows);
  updateGuideDisplay(currentMenuRows);
  updateGuideStats(currentMenuRows);
  
  // 입력 필드 초기화
  newMenuName.value = '';
  newSubMenuName.value = '';
  newMenuDescription.value = '';
  
  // 자동으로 데이터베이스에 저장
  autoSaveMenuGuide(currentMenuRows);
  
  showSuccess('새 행이 추가되었습니다.');
}

// 자동 저장 함수 (백그라운드에서 조용히 저장)
async function autoSaveMenuGuide(menuRows) {
  try {
    const guideRef = ref(db, '/menuGuide');
    await set(guideRef, {
      menuRows: menuRows,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.email
    });
    
    console.log('메뉴 가이드가 자동 저장되었습니다.');
    
  } catch (error) {
    console.error('자동 저장 오류:', error);
    showError('자동 저장 중 오류가 발생했습니다: ' + error.message);
  }
}

// 메뉴 테이블 렌더링
function renderMenuTable(menuRows) {
  if (!menuTableBody) return;
  
  menuTableBody.innerHTML = '';
  
  if (menuRows.length === 0) {
    menuTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: var(--muted);">
          <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-bottom: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <p>아직 메뉴 항목이 없습니다.</p>
          <p style="font-size: 14px; margin-top: 8px;">위의 폼을 통해 첫 번째 메뉴를 추가해보세요!</p>
        </td>
      </tr>
    `;
    return;
  }
  
  menuRows.forEach((row, index) => {
    const tableRow = document.createElement('tr');
    tableRow.dataset.rowId = row.id;
    
    tableRow.innerHTML = `
      <td>
        <span class="menu-row-number">${index + 1}</span>
      </td>
      <td>
        <div class="menu-cell-display" data-field="menuName">${row.menuName || ''}</div>
        <input type="text" class="menu-cell-input" value="${row.menuName || ''}" style="display: none;" data-field="menuName">
      </td>
      <td>
        <div class="menu-cell-display" data-field="subMenuName">${row.subMenuName || ''}</div>
        <input type="text" class="menu-cell-input" value="${row.subMenuName || ''}" style="display: none;" data-field="subMenuName">
      </td>
      <td>
        <div class="menu-cell-display" data-field="description">${row.description || ''}</div>
        <textarea class="menu-cell-textarea" style="display: none;" data-field="description">${row.description || ''}</textarea>
      </td>
      <td>
        <div class="menu-row-actions">
          <button class="btn btn-warning" onclick="editRow('${row.id}')">
            <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 12px; height: 12px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
            편집
          </button>
          <button class="btn btn-danger" onclick="deleteRow('${row.id}')">
            <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 12px; height: 12px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            삭제
          </button>
        </div>
      </td>
    `;
    
    menuTableBody.appendChild(tableRow);
  });
}

// 가이드 표시 영역 업데이트
function updateGuideDisplay(menuRows) {
  if (!guideDisplay) return;
  
  if (menuRows.length === 0) {
    guideDisplay.textContent = '';
    return;
  }
  
  let displayContent = '# 메뉴별 상세 설명\n\n';
  
  menuRows.forEach((row, index) => {
    displayContent += `## ${index + 1}. ${row.menuName} - ${row.subMenuName}\n`;
    displayContent += `${row.description}\n\n`;
  });
  
  guideDisplay.textContent = displayContent;
}

// 가이드 통계 업데이트
function updateGuideStats(menuRows) {
  if (!guideStats) return;
  
  const totalItems = menuRows.length;
  const totalChars = menuRows.reduce((sum, row) => 
    sum + (row.menuName?.length || 0) + (row.subMenuName?.length || 0) + (row.description?.length || 0), 0);
  
  guideStats.textContent = `총 ${totalItems}개 항목 | ${totalChars}자`;
}

// 현재 메뉴 행들 가져오기
function getCurrentMenuRows() {
  const menuRows = [];
  const tableRows = document.querySelectorAll('#menuTableBody tr[data-row-id]');
  
  tableRows.forEach((row, index) => {
    const id = row.dataset.rowId;
    
    // 편집 모드인지 확인 (input/textarea가 보이는지 확인)
    const inputElement = row.querySelector('.menu-cell-input');
    const textareaElement = row.querySelector('.menu-cell-textarea');
    const isEditing = (inputElement && inputElement.style.display === 'block') || 
                     (textareaElement && textareaElement.style.display === 'block');
    
    let menuName, subMenuName, description;
    
    if (isEditing) {
      // 편집 모드: input/textarea의 값 사용
      menuName = row.querySelector('.menu-cell-input[data-field="menuName"]')?.value || '';
      subMenuName = row.querySelector('.menu-cell-input[data-field="subMenuName"]')?.value || '';
      description = row.querySelector('.menu-cell-textarea[data-field="description"]')?.value || '';
    } else {
      // 표시 모드: display 요소의 textContent 사용
      menuName = row.querySelector('.menu-cell-display[data-field="menuName"]')?.textContent?.trim() || '';
      subMenuName = row.querySelector('.menu-cell-display[data-field="subMenuName"]')?.textContent?.trim() || '';
      description = row.querySelector('.menu-cell-display[data-field="description"]')?.textContent?.trim() || '';
    }
    
    menuRows.push({
      id: id,
      menuName: menuName,
      subMenuName: subMenuName,
      description: description,
      createdAt: new Date().toISOString()
    });
  });
  
  return menuRows;
}

// 행 편집
window.editRow = function(rowId) {
  console.log('✏️ editRow 시작:', rowId);
  
  const tableRow = document.querySelector(`[data-row-id="${rowId}"]`);
  if (!tableRow) {
    console.error('❌ 편집할 행을 찾을 수 없습니다:', rowId);
    return;
  }
  
  console.log('✅ 편집할 행 찾음:', tableRow);
  
  // 모든 셀을 편집 모드로 전환
  const displayCells = tableRow.querySelectorAll('.menu-cell-display');
  const inputCells = tableRow.querySelectorAll('.menu-cell-input, .menu-cell-textarea');
  
  console.log('📝 편집 모드 전환:', { displayCells: displayCells.length, inputCells: inputCells.length });
  
  displayCells.forEach(cell => cell.style.display = 'none');
  inputCells.forEach(cell => cell.style.display = 'block');
  
  console.log('✅ 편집 모드 전환 완료');
  
  // 버튼을 저장/취소로 변경
  const actionsCell = tableRow.querySelector('.menu-row-actions');
  if (!actionsCell) {
    console.error('❌ 액션 셀을 찾을 수 없습니다');
    return;
  }
  
  console.log('🔄 버튼을 저장/취소로 변경');
  actionsCell.innerHTML = `
    <button class="btn btn-success" onclick="saveRowEdit('${rowId}')">
      <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 12px; height: 12px;">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      저장
    </button>
    <button class="btn btn-secondary" onclick="cancelRowEdit('${rowId}')">
      <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 12px; height: 12px;">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
      취소
    </button>
  `;
  
  console.log('✅ 버튼 변경 완료');
};

// 행 편집 저장
window.saveRowEdit = async function(rowId) {
  console.log('🔧 saveRowEdit 시작:', rowId);
  
  const tableRow = document.querySelector(`[data-row-id="${rowId}"]`);
  if (!tableRow) {
    console.error('❌ 편집할 행을 찾을 수 없습니다:', rowId);
    showError('편집할 행을 찾을 수 없습니다.');
    return;
  }
  
  console.log('✅ 편집할 행 찾음:', tableRow);
  
  const menuNameInput = tableRow.querySelector('.menu-cell-input[data-field="menuName"]');
  const subMenuNameInput = tableRow.querySelector('.menu-cell-input[data-field="subMenuName"]');
  const descriptionInput = tableRow.querySelector('.menu-cell-textarea[data-field="description"]');
  
  if (!menuNameInput || !subMenuNameInput || !descriptionInput) {
    console.error('❌ 편집 필드를 찾을 수 없습니다:', { menuNameInput, subMenuNameInput, descriptionInput });
    
    // 디버깅을 위해 실제 HTML 구조 확인
    console.log('🔍 테이블 행의 전체 HTML:', tableRow.innerHTML);
    console.log('🔍 메뉴명 셀:', tableRow.querySelector('[data-field="menuName"]'));
    console.log('🔍 하위메뉴명 셀:', tableRow.querySelector('[data-field="subMenuName"]'));
    console.log('🔍 상세설명 셀:', tableRow.querySelector('[data-field="description"]'));
    
    showError('편집 필드를 찾을 수 없습니다.');
    return;
  }
  
  console.log('✅ 편집 필드들 찾음');
  
  const menuName = menuNameInput.value.trim();
  const subMenuName = subMenuNameInput.value.trim();
  const description = descriptionInput.value.trim();
  
  console.log('📝 입력된 값들:', { menuName, subMenuName, description });
  
  if (!menuName || !subMenuName || !description) {
    console.error('❌ 필수 필드가 비어있음');
    showError('메뉴명, 하위메뉴명, 상세설명을 모두 입력해주세요.');
    return;
  }
  
  console.log('🔄 표시 셀 업데이트 시작');
  
  // 표시 셀 업데이트
  tableRow.querySelector('.menu-cell-display[data-field="menuName"]').textContent = menuName;
  tableRow.querySelector('.menu-cell-display[data-field="subMenuName"]').textContent = subMenuName;
  tableRow.querySelector('.menu-cell-display[data-field="description"]').textContent = description;
  
  console.log('✅ 표시 셀 업데이트 완료');
  
  // 편집 모드 해제
  const displayCells = tableRow.querySelectorAll('.menu-cell-display');
  const inputCells = tableRow.querySelectorAll('.menu-cell-input, .menu-cell-textarea');
  
  displayCells.forEach(cell => cell.style.display = 'block');
  inputCells.forEach(cell => cell.style.display = 'none');
  
  console.log('✅ 편집 모드 해제 완료');
  
  // 버튼을 편집/삭제로 변경
  const actionsCell = tableRow.querySelector('.menu-row-actions');
  actionsCell.innerHTML = `
    <button class="btn btn-warning" onclick="editRow('${rowId}')">
      <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 12px; height: 12px;">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
      </svg>
      편집
    </button>
    <button class="btn btn-danger" onclick="deleteRow('${rowId}')">
      <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 12px; height: 12px;">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
      </svg>
      삭제
    </button>
  `;
  
  console.log('✅ 버튼 상태 복원 완료');
  
  // 표시 영역 업데이트
  console.log('🔄 표시 영역 업데이트 시작');
  const currentMenuRows = getCurrentMenuRows();
  console.log('📊 현재 메뉴 행들:', currentMenuRows);
  
  updateGuideDisplay(currentMenuRows);
  updateGuideStats(currentMenuRows);
  
  console.log('✅ 표시 영역 업데이트 완료');
  
  // 자동으로 데이터베이스에 저장
  console.log('💾 데이터베이스 저장 시작');
  try {
    await autoSaveMenuGuide(currentMenuRows);
    console.log('✅ 데이터베이스 저장 완료');
  } catch (error) {
    console.error('❌ 데이터베이스 저장 실패:', error);
    showError('저장 중 오류가 발생했습니다: ' + error.message);
    return;
  }
  
  console.log('🎉 모든 작업 완료');
  showSuccess('행이 수정되었습니다.');
};

// 행 편집 취소
window.cancelRowEdit = function(rowId) {
  const tableRow = document.querySelector(`[data-row-id="${rowId}"]`);
  if (!tableRow) return;
  
  // 편집 모드 해제
  const displayCells = tableRow.querySelectorAll('.menu-cell-display');
  const inputCells = tableRow.querySelectorAll('.menu-cell-input, .menu-cell-textarea');
  
  displayCells.forEach(cell => cell.style.display = 'block');
  inputCells.forEach(cell => cell.style.display = 'none');
  
  // 버튼을 편집/삭제로 변경
  const actionsCell = tableRow.querySelector('.menu-row-actions');
  actionsCell.innerHTML = `
    <button class="btn btn-warning" onclick="editRow('${rowId}')">
      <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 12px; height: 12px;">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
      </svg>
      편집
    </button>
    <button class="btn btn-danger" onclick="deleteRow('${rowId}')">
      <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 12px; height: 12px;">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
      </svg>
      삭제
    </button>
  `;
};

// 행 삭제
window.deleteRow = async function(rowId) {
  if (!confirm('정말로 이 행을 삭제하시겠습니까?')) {
    return;
  }
  
  const tableRow = document.querySelector(`[data-row-id="${rowId}"]`);
  if (tableRow) {
    tableRow.remove();
    
    // 데이터베이스에서 현재 데이터 가져와서 삭제된 행 제외하고 저장
    let currentMenuRows = [];
    try {
      const guideRef = ref(db, '/menuGuide');
      const snapshot = await get(guideRef);
      if (snapshot.exists()) {
        const guideData = snapshot.val();
        currentMenuRows = (guideData.menuRows || []).filter(row => row.id !== rowId);
      }
    } catch (error) {
      console.error('삭제 시 데이터 로드 오류:', error);
      // 오류 시 현재 테이블에서 가져오기
      currentMenuRows = getCurrentMenuRows();
    }
    
    // UI 업데이트
    renderMenuTable(currentMenuRows);
    updateGuideDisplay(currentMenuRows);
    updateGuideStats(currentMenuRows);
    
    // 자동으로 데이터베이스에 저장
    autoSaveMenuGuide(currentMenuRows);
    
    showSuccess('행이 삭제되었습니다.');
  }
};

// 메뉴 가이드 CSV 다운로드
async function exportMenuGuideToCSV() {
  try {
    // 데이터베이스에서 직접 데이터 가져오기
    let currentMenuRows = [];
    try {
      const guideRef = ref(db, '/menuGuide');
      const snapshot = await get(guideRef);
      if (snapshot.exists()) {
        const guideData = snapshot.val();
        currentMenuRows = guideData.menuRows || [];
      }
    } catch (error) {
      console.error('CSV 다운로드 시 데이터 로드 오류:', error);
      // 오류 시 현재 테이블에서 가져오기
      currentMenuRows = getCurrentMenuRows();
    }
    
    if (currentMenuRows.length === 0) {
      showError('다운로드할 메뉴 데이터가 없습니다.');
      return;
    }
    
    // CSV 헤더
    const headers = ['NO.', '메뉴', '하위메뉴', '상세설명'];
    
    // CSV 데이터 생성
    let csvContent = '';
    
    // UTF-8 BOM 추가 (한글 깨짐 방지)
    csvContent += '\uFEFF';
    
    // 헤더 추가
    csvContent += headers.join(',') + '\n';
    
    // 데이터 행 추가
    console.log('CSV 다운로드할 데이터:', currentMenuRows);
    currentMenuRows.forEach((row, index) => {
      console.log(`행 ${index + 1}:`, {
        menuName: row.menuName,
        subMenuName: row.subMenuName,
        description: row.description
      });
      
      const csvRow = [
        index + 1,
        escapeCSVValue(row.menuName || ''),
        escapeCSVValue(row.subMenuName || ''),
        escapeCSVValue(row.description || '')
      ];
      csvContent += csvRow.join(',') + '\n';
    });
    
    // CSV 내용 확인을 위한 콘솔 출력
    console.log('생성된 CSV 내용:', csvContent);
    
    // CSV 파일 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `메뉴별_상세설명_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccess(`메뉴별 상세설명이 CSV 파일로 다운로드되었습니다. (총 ${currentMenuRows.length}개 항목)`);
    
  } catch (error) {
    console.error('CSV 다운로드 오류:', error);
    showError('CSV 다운로드 중 오류가 발생했습니다: ' + error.message);
  }
}

// CSV 값 이스케이프 함수
function escapeCSVValue(value) {
  if (typeof value !== 'string') {
    value = String(value);
  }
  
  // 쉼표, 따옴표, 줄바꿈이 포함된 경우 따옴표로 감싸기
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    // 내부 따옴표는 두 개로 이스케이프
    value = value.replace(/"/g, '""');
    return `"${value}"`;
  }
  
  return value;
}

// Excel 업로드 처리
function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
    showError('Excel 파일(.xlsx, .xls)만 업로드할 수 있습니다.');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      console.log('업로드된 Excel 파일:', workbook);
      
      // 첫 번째 시트 가져오기
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      if (!worksheet) {
        showError('Excel 파일에 시트가 없습니다.');
        return;
      }
      
      // 시트를 JSON으로 변환
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      console.log('Excel 데이터:', jsonData);
      
      if (jsonData.length === 0) {
        showError('Excel 파일에 데이터가 없습니다.');
        return;
      }
      
      // 헤더 확인 (첫 번째 행)
      const headers = jsonData[0];
      if (!headers || headers.length < 4) {
        showError('Excel 파일 형식이 올바르지 않습니다. (NO., 메뉴, 하위메뉴, 상세설명 컬럼 필요)');
        return;
      }
      
      // 데이터 행들 처리 (첫 번째 행은 헤더이므로 제외)
      const dataRows = jsonData.slice(1);
      const menuRows = [];
      
      dataRows.forEach((row, index) => {
        if (row && row.length >= 4) {
          const menuRow = {
            id: Date.now().toString() + '_' + index, // 고유 ID 생성
            menuName: String(row[1] || '').trim(), // 메뉴
            subMenuName: String(row[2] || '').trim(), // 하위메뉴
            description: String(row[3] || '').trim(), // 상세설명
            createdAt: new Date().toISOString(),
            createdBy: currentUser.email
          };
          
          // 빈 행이 아닌 경우만 추가
          if (menuRow.menuName || menuRow.subMenuName || menuRow.description) {
            menuRows.push(menuRow);
          }
        }
      });
      
      if (menuRows.length === 0) {
        showError('업로드할 유효한 데이터가 없습니다.');
        return;
      }
      
      // 기존 데이터와 병합할지 확인
      const confirmMessage = `총 ${menuRows.length}개의 메뉴 항목을 업로드하시겠습니까?\n\n기존 데이터는 유지되고 새 데이터가 추가됩니다.`;
      if (confirm(confirmMessage)) {
        importMenuRows(menuRows);
      }
      
    } catch (error) {
      console.error('Excel 파싱 오류:', error);
      showError('Excel 파일을 읽는 중 오류가 발생했습니다: ' + error.message);
    }
  };
  
  reader.onerror = function() {
    showError('파일을 읽는 중 오류가 발생했습니다.');
  };
  
  reader.readAsArrayBuffer(file);
  
  // 파일 입력 초기화
  event.target.value = '';
}


// 메뉴 행들 가져오기 및 병합
async function importMenuRows(newMenuRows) {
  try {
    // 기존 데이터 가져오기
    let existingMenuRows = [];
    try {
      const guideRef = ref(db, '/menuGuide');
      const snapshot = await get(guideRef);
      if (snapshot.exists()) {
        const guideData = snapshot.val();
        existingMenuRows = guideData.menuRows || [];
      }
    } catch (error) {
      console.error('기존 데이터 로드 오류:', error);
    }
    
    // 새 데이터와 병합
    const mergedMenuRows = [...existingMenuRows, ...newMenuRows];
    
    // 데이터베이스에 저장
    const guideRef = ref(db, '/menuGuide');
    await set(guideRef, {
      menuRows: mergedMenuRows,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.email
    });
    
    // UI 업데이트
    renderMenuTable(mergedMenuRows);
    updateGuideDisplay(mergedMenuRows);
    updateGuideStats(mergedMenuRows);
    
    showSuccess(`Excel 업로드가 완료되었습니다! (${newMenuRows.length}개 항목 추가)`);
    
  } catch (error) {
    console.error('Excel 업로드 저장 오류:', error);
    showError('Excel 업로드 중 오류가 발생했습니다: ' + error.message);
  }
}

window.submitAnswer = async function(qnaId) {
  const answerInput = document.getElementById(`answerInput_${qnaId}`);
  const answererNameInput = document.getElementById(`answererName_${qnaId}`);
  
  const answer = answerInput.value.trim();
  const answererName = answererNameInput.value.trim();
  
  if (!answererName) {
    showError('답변자 이름을 입력해주세요.');
    return;
  }
  
  if (!answer) {
    showError('답변을 입력해주세요.');
    return;
  }
  
  if (!currentUser) {
    showError('로그인이 필요합니다.');
    return;
  }
  
  try {
    const qnaItem = currentQnA.find(q => q.id === qnaId);
    if (!qnaItem) {
      showError('질문을 찾을 수 없습니다.');
      return;
    }
    
    // 데이터베이스에서 해당 QnA 항목 업데이트
    const qnaRef = ref(db, `/requests/질의응답요청/${qnaId}`);
    await set(qnaRef, {
      ...qnaItem,
      answer: answer,
      status: '답변완료',
      answeredBy: currentUser.email,
      answeredByName: answererName,
      answeredAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    showSuccess('답변이 등록되었습니다.');
    answerInput.value = '';
    answererNameInput.value = '';
    
    console.log('답변 등록 성공:', qnaId);
    
  } catch (error) {
    console.error('답변 등록 오류:', error);
    showError('답변 등록 중 오류가 발생했습니다: ' + error.message);
  }
};

// 새로고침 버튼 초기화
function initializeRefreshButton() {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      performRefreshAction({ statusMessage: '데이터를 새로고침했습니다.' });
    });
  }
}

function performRefreshAction({ statusMessage } = {}) {
  showLoadingOverlay();

  if (statusMessage) {
    setStatus(statusMessage, 'success');
  }

  loadData();
}

function runInitialRefresh() {
  if (hasPerformedInitialRefresh) return;
  hasPerformedInitialRefresh = true;
  performRefreshAction();
}

// 공지사항 팝업 초기화
function initializeNoticePopup() {
  const noticePopup = document.getElementById('noticePopup');
  const confirmNotice = document.getElementById('confirmNotice');
  const dontShowToday = document.getElementById('dontShowToday');
  
  if (!noticePopup) return;
  
  // 하루종일 보지 않기 체크 여부 확인
  if (shouldShowNotice()) {
    // 팝업 표시 (페이지 로드 시)
    setTimeout(() => {
      showNoticePopup();
    }, 1000); // 1초 후 표시
  }
  
  // 확인 버튼 이벤트
  if (confirmNotice) {
    confirmNotice.addEventListener('click', () => {
      handleNoticeClose();
    });
  }
  
  // X 버튼 이벤트
  const closeNoticePopup = document.getElementById('closeNoticePopup');
  if (closeNoticePopup) {
    closeNoticePopup.addEventListener('click', () => {
      handleNoticeClose();
    });
  }
  
  // 백드롭 클릭 시 닫기
  const backdrop = noticePopup.querySelector('.notice-popup-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      handleNoticeClose();
    });
  }
  
  // ESC 키로 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && noticePopup.classList.contains('show')) {
      handleNoticeClose();
    }
  });
  
  // 메뉴 편집 키보드 단축키
  document.addEventListener('keydown', (e) => {
    // Ctrl+Enter: 편집 모드에서 저장
    if (e.ctrlKey && e.key === 'Enter') {
      const editingRow = document.querySelector('.menu-cell-input[style*="block"], .menu-cell-textarea[style*="block"]')?.closest('tr');
      if (editingRow) {
        const rowId = editingRow.dataset.rowId;
        if (rowId) {
          saveRowEdit(rowId);
        }
      }
    }
    
    // ESC: 편집 모드에서 취소
    if (e.key === 'Escape') {
      const editingRow = document.querySelector('.menu-cell-input[style*="block"], .menu-cell-textarea[style*="block"]')?.closest('tr');
      if (editingRow) {
        const rowId = editingRow.dataset.rowId;
        if (rowId) {
          cancelRowEdit(rowId);
        }
      }
    }
  });
}

// 업무 가이드 모달 초기화
function initializeWorkGuideModal() {
  const workGuideModal = document.getElementById('workGuideModal');
  const workGuideBtn = document.getElementById('workGuideBtn');
  const closeWorkGuideModal = document.getElementById('closeWorkGuideModal');
  const backdrop = workGuideModal?.querySelector('.work-guide-backdrop');
  
  if (!workGuideModal) return;
  
  // 업무 가이드 버튼 이벤트
  if (workGuideBtn) {
    workGuideBtn.addEventListener('click', () => {
      showWorkGuideModal();
    });
  }
  
  // 확인 버튼 이벤트
  if (closeWorkGuideModal) {
    closeWorkGuideModal.addEventListener('click', () => {
      hideWorkGuideModal();
    });
  }
  
  // 백드롭 클릭 이벤트
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      hideWorkGuideModal();
    });
  }
  
  // ESC 키로 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && workGuideModal.classList.contains('show')) {
      hideWorkGuideModal();
    }
  });
}

// 업무 가이드 모달 표시
function showWorkGuideModal() {
  const workGuideModal = document.getElementById('workGuideModal');
  if (workGuideModal) {
    workGuideModal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

// 업무 가이드 모달 숨기기
function hideWorkGuideModal() {
  const workGuideModal = document.getElementById('workGuideModal');
  if (workGuideModal) {
    workGuideModal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// 요청 필터링 기능 초기화
function initializeRequestFilters() {
  const statusFilter = document.getElementById('statusFilter');
  const searchInput = document.getElementById('requestSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      const filterValue = e.target.value;
      filterRequests(filterValue);
    });
  }
  
  // 검색 기능
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.trim().toLowerCase();
      searchRequests(searchTerm);
    });
  }
  
  // 검색 초기화
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchRequests('');
      }
    });
  }
}

// 아코디언 토글 기능 초기화
function initializeAccordion() {
  const accordionHeader1 = document.getElementById('accordionHeader1');
  const accordionHeader2 = document.getElementById('accordionHeader2');
  
  if (accordionHeader1) {
    accordionHeader1.addEventListener('click', () => {
      const accordionItem = accordionHeader1.closest('.accordion-item');
      if (accordionItem) {
        accordionItem.classList.toggle('active');
      }
    });
  }
  
  if (accordionHeader2) {
    accordionHeader2.addEventListener('click', () => {
      const accordionItem = accordionHeader2.closest('.accordion-item');
      if (accordionItem) {
        accordionItem.classList.toggle('active');
      }
    });
  }
  
  // 기본적으로 2차 아코디언은 열려있음 (위에 있으므로)
  const accordion2 = accordionHeader2?.closest('.accordion-item');
  if (accordion2) {
    accordion2.classList.add('active');
  }
}

// 요청 검색 함수 (아코디언 구조용, 페이지네이션 고려)
function searchRequests(searchTerm) {
  // 검색 시 페이지를 1페이지로 리셋
  paginationState.generation1.currentPage = 1;
  paginationState.generation2.currentPage = 1;
  
  // 전체 데이터 다시 렌더링 (검색 필터링은 데이터 레벨에서 처리)
  if (!searchTerm) {
    // 검색어가 없으면 전체 데이터 다시 렌더링
    updateRequestsTable();
    return;
  }
  
  // 검색어가 있으면 필터링된 데이터로 다시 렌더링
  const generation1Requests = currentRequests.filter(req => {
    if (req.generation !== '1차') return false;
    const searchLower = searchTerm.toLowerCase();
    return (req.title || '').toLowerCase().includes(searchLower) ||
           (req.detail || '').toLowerCase().includes(searchLower) ||
           (req.requesterName || req.requester || '').toLowerCase().includes(searchLower) ||
           (req.developmentType || '').toLowerCase().includes(searchLower);
  });
  
  const generation2Requests = currentRequests.filter(req => {
    if (req.generation !== '2차') return false;
    const searchLower = searchTerm.toLowerCase();
    return (req.title || '').toLowerCase().includes(searchLower) ||
           (req.detail || '').toLowerCase().includes(searchLower) ||
           (req.requesterName || req.requester || '').toLowerCase().includes(searchLower) ||
           (req.developmentType || '').toLowerCase().includes(searchLower);
  });
  
  // 필터링된 데이터로 렌더링
  renderGenerationRequests('generation1', generation1Requests);
  renderGenerationRequests('generation2', generation2Requests);
  
  // 검색 결과가 있으면 해당 아코디언 펼치기
  const accordion1 = document.querySelector('#accordionHeader1')?.closest('.accordion-item');
  const accordion2 = document.querySelector('#accordionHeader2')?.closest('.accordion-item');
  
  if (generation1Requests.length > 0 && accordion1) {
    accordion1.classList.add('active');
  }
  if (generation2Requests.length > 0 && accordion2) {
    accordion2.classList.add('active');
  }
  
  console.log(`검색 결과: 1차 ${generation1Requests.length}개, 2차 ${generation2Requests.length}개 (검색어: "${searchTerm}")`);
}

// 텍스트 하이라이트 함수
function highlightText(element, searchTerm) {
  const text = element.textContent;
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  const highlightedText = text.replace(regex, '<mark class="search-highlight">$1</mark>');
  element.innerHTML = highlightedText;
}

// 하이라이트 제거 함수
function removeHighlight(element) {
  const marks = element.querySelectorAll('mark.search-highlight');
  marks.forEach(mark => {
    mark.outerHTML = mark.textContent;
  });
}

// 요청 필터링 함수 (페이지네이션 고려)
function filterRequests(status) {
  // 필터링 시 페이지를 1페이지로 리셋
  paginationState.generation1.currentPage = 1;
  paginationState.generation2.currentPage = 1;
  
  // 필터링된 데이터로 다시 렌더링
  const generation1Requests = currentRequests.filter(req => {
    if (req.generation !== '1차') return false;
    return status === 'all' || req.status === status;
  });
  
  const generation2Requests = currentRequests.filter(req => {
    if (req.generation !== '2차') return false;
    return status === 'all' || req.status === status;
  });
  
  // 필터링된 데이터로 렌더링
  renderGenerationRequests('generation1', generation1Requests);
  renderGenerationRequests('generation2', generation2Requests);
  
  // 필터링 결과가 있으면 해당 아코디언 펼치기
  const accordion1 = document.querySelector('#accordionHeader1')?.closest('.accordion-item');
  const accordion2 = document.querySelector('#accordionHeader2')?.closest('.accordion-item');
  
  if (generation1Requests.length > 0 && accordion1) {
    accordion1.classList.add('active');
  }
  if (generation2Requests.length > 0 && accordion2) {
    accordion2.classList.add('active');
  }
  
  console.log(`필터링 결과: 1차 ${generation1Requests.length}개, 2차 ${generation2Requests.length}개 (${status === 'all' ? '전체' : status})`);
}

// 공지사항 표시 여부 확인
function shouldShowNotice() {
  const today = new Date().toDateString();
  const lastHiddenDate = localStorage.getItem('noticeHiddenDate');
  
  // 오늘 날짜와 마지막으로 숨긴 날짜가 다르면 표시
  return lastHiddenDate !== today;
}

// 공지사항 닫기 처리
function handleNoticeClose() {
  const dontShowToday = document.getElementById('dontShowToday');
  
  // 하루종일 보지 않기 체크박스가 체크되어 있으면
  if (dontShowToday && dontShowToday.checked) {
    const today = new Date().toDateString();
    localStorage.setItem('noticeHiddenDate', today);
  }
  
  hideNoticePopup();
}

// 공지사항 팝업 표시
function showNoticePopup() {
  const noticePopup = document.getElementById('noticePopup');
  if (noticePopup) {
    noticePopup.classList.add('show');
    document.body.style.overflow = 'hidden'; // 스크롤 방지
  }
}

// 공지사항 팝업 숨기기
function hideNoticePopup() {
  const noticePopup = document.getElementById('noticePopup');
  if (noticePopup) {
    noticePopup.classList.remove('show');
    document.body.style.overflow = ''; // 스크롤 복원
  }
}

// 모달 초기화
function initializeModals() {
  // 요청 상세보기 모달
  const requestModal = document.getElementById('requestModal');
  const closeModal = document.getElementById('closeModal');
  
  if (closeModal) {
    closeModal.addEventListener('click', () => {
      requestModal.style.display = 'none';
    });
  }
  
  // 모달 외부 클릭 시 닫기
  if (requestModal) {
    requestModal.addEventListener('click', (e) => {
      if (e.target === requestModal) {
        requestModal.style.display = 'none';
      }
    });
  }
  
  // ESC 키로 모달 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (requestModal && requestModal.style.display === 'block') {
        requestModal.style.display = 'none';
      }
    }
  });
  
  // 동적으로 생성되는 닫기 버튼 이벤트 위임
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'closeModalBtn') {
      requestModal.style.display = 'none';
    }
  });

  // AI 가이드 팝업
  const openAIGuideBtn = document.getElementById('openAIGuideBtn');

  if (openAIGuideBtn) {
    openAIGuideBtn.addEventListener('click', () => {
      const url = 'https://chatgpt.com/g/g-68a3d48e15d0819195906b06fb1ab594-dongsu-mulryu-wms-gaideu';
      const w = 980; 
      const h = 760;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      window.open(url, 'aiGuidePopup', `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    });
  }

  // ERP/WMS 접속 안내 모달 이벤트
  initializeErpAccessModal();
}


// ERP/WMS 접속 안내 모달 초기화
function initializeErpAccessModal() {
  const erpAccessModal = document.getElementById('erpAccessModal');
  const closeErpAccessModal = document.getElementById('closeErpAccessModal');
  const openErpDirectLink = document.getElementById('openErpDirectLink');
  const copyErpLink = document.getElementById('copyErpLink');
  const copyButtons = document.querySelectorAll('[data-copy]');

  // 닫기 버튼 클릭
  if (closeErpAccessModal) {
    closeErpAccessModal.addEventListener('click', () => {
      hideErpAccessModal();
    });
  }

  // 직접 접속하기 버튼 클릭
  if (openErpDirectLink) {
    openErpDirectLink.addEventListener('click', () => {
      window.open('http://platform.ytzhiheng.com/#/', '_blank');
      hideErpAccessModal();
    });
  }

  // 링크 복사 버튼 클릭
  if (copyErpLink) {
    copyErpLink.addEventListener('click', () => {
      copyToClipboard('http://platform.ytzhiheng.com/#/');
    });
  }

  // 계정 정보 복사 버튼들
  copyButtons.forEach(button => {
    button.addEventListener('click', () => {
      const textToCopy = button.getAttribute('data-copy');
      copyToClipboard(textToCopy);
    });
  });

  // 모달 외부 클릭 시 닫기
  if (erpAccessModal) {
    erpAccessModal.addEventListener('click', (e) => {
      if (e.target === erpAccessModal || e.target.classList.contains('erp-access-backdrop')) {
        hideErpAccessModal();
      }
    });
  }

  // ESC 키로 모달 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (erpAccessModal && erpAccessModal.classList.contains('show')) {
        hideErpAccessModal();
      }
    }
  });
}

// ERP 접속 모달 표시
function showErpAccessModal() {
  const erpAccessModal = document.getElementById('erpAccessModal');
  if (erpAccessModal) {
    erpAccessModal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

// ERP 접속 모달 숨기기
function hideErpAccessModal() {
  const erpAccessModal = document.getElementById('erpAccessModal');
  if (erpAccessModal) {
    erpAccessModal.classList.remove('show');
    document.body.style.overflow = 'auto';
  }
}

// 클립보드에 복사
function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showCopySuccess();
    }).catch(() => {
      fallbackCopyToClipboard(text);
    });
  } else {
    fallbackCopyToClipboard(text);
  }
}

// 폴백 복사 방법
function fallbackCopyToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
    showCopySuccess();
  } catch (err) {
    console.error('복사 실패:', err);
  }
  
  document.body.removeChild(textArea);
}

// 복사 성공 알림
function showCopySuccess() {
  // 간단한 토스트 알림
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--success);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10001;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    animation: slideInRight 0.3s ease-out;
  `;
  toast.textContent = '클립보드에 복사되었습니다!';
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 2000);
}

// 네비게이션 툴팁 기능
function initializeNavigationTooltips() {
  const navItems = document.querySelectorAll('.nav-item');
  const tooltip = document.getElementById('navTooltip');
  const tooltipTitle = document.getElementById('tooltipTitle');
  const tooltipDescription = document.getElementById('tooltipDescription');
  
  // 각 네비게이션 메뉴별 툴팁 데이터
  const tooltipData = {
    'overview': {
      title: '대시보드',
      description: '개발 요청 처리 현황과 부서별 최종 승인 상태를<br>한눈에 확인할 수 있는 통합 모니터링 화면입니다.'
    },
    'erp-wms': {
      title: 'ERP/WMS',
      description: '도입 예정인 ERP/WMS 시스템의 구조와 기능을<br>미리 체험해볼 수 있는 미리보기 공간입니다.'
    },
    'requests': {
      title: '기술개발 요청',
      description: '업무 중 발견한 개선사항이나 새로운 기능 개발을<br>요청하고 진행 상황을 추적할 수 있습니다.'
    },
    'qna': {
      title: '질의응답',
      description: '시스템 사용법, 기능 문의, 개선 의견 등을<br>자유롭게 질문하고 답변을 받을 수 있습니다.'
    },
    'menu-guide': {
      title: '메뉴별 상세 설명',
      description: 'ERP/WMS 시스템의 각 메뉴별 기능과 사용법을<br>상세히 안내하는 참고 가이드 자료입니다.'
    },
    'departments': {
      title: '부서 최종 확인',
      description: '부서별 개발 요청 완료 여부를 최종 점검하고<br>2차 개발 단계로 진행하기 위한 승인 체크포인트입니다.'
    }
  };

  // 마우스 호버 이벤트 추가
  navItems.forEach(item => {
    const section = item.getAttribute('data-section');
    const data = tooltipData[section];
    
    if (data) {
      item.addEventListener('mouseenter', () => {
        tooltipTitle.textContent = data.title;
        tooltipDescription.innerHTML = data.description;
        tooltip.classList.add('show');
      });
      
      item.addEventListener('mouseleave', () => {
        tooltip.classList.remove('show');
      });
    }
  });
}
