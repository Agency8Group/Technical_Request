// Firebase CDN 초기화 (Realtime Database + Authentication 사용)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-analytics.js";
import { 
  getDatabase, ref, push, set, onValue, serverTimestamp, get 
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { 
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

// OAuth 도메인 경고 무시 (GitHub Pages 배포용)
console.log('초기화 중...');

const firebaseConfig = {
  apiKey: "AIzaSyCymSYdvXJ9dsKURunMLFBakduRLUUEQiA",
  authDomain: "eibedevv2request-68d1e.firebaseapp.com",
  projectId: "eibedevv2request-68d1e",
  storageBucket: "eibedevv2request-68d1e.firebasestorage.app",
  messagingSenderId: "758488713311",
  appId: "1:758488713311:web:55a42ece4c62830c25f3ea",
  measurementId: "G-JPEYX255RB",
  databaseURL: "https://eibedevv2request-68d1e-default-rtdb.asia-southeast1.firebasedatabase.app"
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db = getDatabase(app);
export const auth = getAuth(app);

// 추가 export
export { get, ref, onValue, set, push, serverTimestamp, signInWithEmailAndPassword, signOut };

// 헬퍼: 기술개발 요청 저장
export async function saveRequest(data) {
  try {
    const requestsRef = ref(db, '/requests/기술개발요청');
    const newRef = push(requestsRef);
    const requestData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await set(newRef, requestData);
    console.log('요청 저장 성공:', newRef.key);
    return newRef.key;
  } catch (error) {
    console.error('요청 저장 오류:', error);
    throw error;
  }
}

// 헬퍼: QnA 메시지 추가
export async function addQnAMessage(item) {
  try {
    const listRef = ref(db, '/requests/질의응답요청');
    const newRef = push(listRef);
    const qnaData = {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await set(newRef, qnaData);
    console.log('QnA 메시지 저장 성공:', newRef.key);
    return newRef.key;
  } catch (error) {
    console.error('QnA 메시지 저장 오류:', error);
    throw error;
  }
}

// QnA 구독
export function subscribeQnA(callback) {
  try {
    const listRef = ref(db, '/requests/질의응답요청');
    onValue(listRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const arr = Object.entries(val).map(([id, v]) => ({ id, ...v }));
        arr.sort((a,b) => (a.createdAt||0) - (b.createdAt||0));
        console.log('QnA 데이터 로드:', arr.length, '개');
        callback(arr);
      } else {
        console.log('QnA 데이터 없음');
        callback([]);
      }
    }, (error) => {
      console.error('QnA 구독 오류:', error);
      callback([]);
    });
  } catch (error) {
    console.error('QnA 구독 초기화 오류:', error);
    callback([]);
  }
}

// 연결 상태 구독 (.info/connected)
export function subscribeConnection(callback) {
  const connRef = ref(db, '.info/connected');
  onValue(connRef, (snap) => {
    callback(!!snap.val());
  });
}

// 인증 관련 함수들
export async function loginUser(email, password) {
  try {
    // OAuth 경고 무시하고 이메일/비밀번호 로그인만 사용
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('로그인 성공:', userCredential.user.email);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('로그인 오류:', error.message);
    // Firebase 구체적인 오류 메시지 숨기기
    let genericError = '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.';
    
    // 일반적인 오류 메시지로 변환
    if (error.code === 'auth/user-not-found') {
      genericError = '등록되지 않은 계정입니다.';
    } else if (error.code === 'auth/wrong-password') {
      genericError = '비밀번호가 올바르지 않습니다.';
    } else if (error.code === 'auth/invalid-email') {
      genericError = '이메일 형식이 올바르지 않습니다.';
    } else if (error.code === 'auth/too-many-requests') {
      genericError = '너무 많은 로그인 시도로 인해 일시적으로 차단되었습니다. 잠시 후 다시 시도해주세요.';
    }
    
    return { success: false, error: genericError };
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function getUserRole(email) {
  // 모든 사용자가 동일한 권한을 가짐
  return 'user';
}


