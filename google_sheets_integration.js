// ===== Google Apps Script for 동수 기술개발 요청 접수 =====

// ===== 설정 (배포 전에 수정하세요) =====
const SPREADSHEET_ID = '1ApsByrE5KTdKY9l-oq4eLS3ltCZmx-vHCv7BE3IMKHQ'; // Google Sheets ID
const SHEET_NAME = '요청접수'; // 1시트 이름
const SENDER_EMAIL = 'yoonwhan0@gmail.com';
const SENDER_PASSWORD = 'e w i y x n c t t e l r o k i w'; // Gmail 앱 비밀번호
const RECEIVER_EMAILS = [
  'jyh@eibe.co.kr'
];
const TEAMROOM_WEBHOOK_URL = 'https://teamroom.nate.com/api/webhook/7e59317b/IUW0aJ9YE12uElmMRo8byoOA';

// ===== 메인 함수 (웹 앱에서 호출됨) =====
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: '동수 기술개발 요청 시스템이 정상적으로 작동 중입니다.'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    // 요청 데이터 파싱
    const requestData = JSON.parse(e.postData.contents);
    
    // 1. Google Sheets에 데이터 저장
    saveToSheet(requestData);
    
    // 2. 이메일로 사진과 엑셀 파일 전송
    sendEmailWithAttachments(requestData);
    
    // 3. 팀룸 웹훅으로 알림 전송
    sendTeamroomNotification(requestData);
    
    // 4. 성공 응답
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: '요청이 성공적으로 접수되었습니다.'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error('오류:', error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== Google Sheets에 데이터 저장 =====
function saveToSheet(data) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    // 시트가 없으면 생성
    const newSheet = spreadsheet.insertSheet(SHEET_NAME);
    // 헤더 설정
    newSheet.getRange(1, 1, 1, 7).setValues([['접수일시', '요청자', '개발유형', '메뉴위치', '요청내용', '사진파일', '엑셀파일']]);
    newSheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  }
  
  const targetSheet = sheet || spreadsheet.getSheetByName(SHEET_NAME);
  
  // 데이터 행 추가
  const rowData = [
    new Date().toLocaleString('ko-KR'),
    data.requester,
    data.developmentType || '',
    data.menuLocation,
    data.requestContent,
    data.photos ? data.photos.map(p => p.name).join(', ') : '',
    data.excel ? data.excel.name : ''
  ];
  
  targetSheet.appendRow(rowData);
}

// ===== 엑셀 파일을 새로운 시트로 저장 =====
function saveExcelToSheet(data) {
  if (!data.excel) return;
  
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 엑셀 파일명에서 시트명 생성 (특수문자 제거)
  const sheetName = data.excel.name.replace(/[^a-zA-Z0-9가-힣]/g, '_').substring(0, 20);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const finalSheetName = `${sheetName}_${timestamp}`;
  
  try {
    // Base64 데이터를 바이트 배열로 변환
    const excelBytes = Utilities.base64Decode(data.excel.data);
    const blob = Utilities.newBlob(excelBytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data.excel.name);
    
    // 임시 파일로 저장
    const tempFile = DriveApp.createFile(blob);
    
    // 엑셀 파일을 Google Sheets로 변환
    const convertedFile = Drive.Files.copy({
      title: finalSheetName,
      mimeType: MimeType.GOOGLE_SHEETS
    }, tempFile.getId());
    
    // 임시 파일 삭제
    DriveApp.getFileById(tempFile.getId()).setTrashed(true);
    
    // 성공 로그
    console.log(`엑셀 파일이 시트로 변환되었습니다: ${finalSheetName}`);
    
  } catch (error) {
    console.error('엑셀 파일 처리 오류:', error);
  }
}

// ===== 이메일 전송 (안정적인 대용량 첨부파일 지원) =====
function sendEmailWithAttachments(data) {
  try {
    console.log('=== 이메일 전송 프로세스 시작 ===');
    console.log(`요청자: ${data.requester}`);
    console.log(`사진 파일 수: ${data.photos ? data.photos.length : 0}개`);
    console.log(`엑셀 파일: ${data.excel ? data.excel.name : '없음'}`);
    
    const subject = `[동수 기술개발 요청] ${data.requester} - ${data.developmentType || '기타'} - ${data.menuLocation}`;
    
    let body = `
[동수 기술개발 요청 접수]

[요청 정보]
• 요청자: ${data.requester}
• 개발유형: ${data.developmentType || '기타'}
• 메뉴위치: ${data.menuLocation}
• 접수일시: ${new Date().toLocaleString('ko-KR')}

[요청내용]
${data.requestContent}

---
이 메일은 자동으로 생성되었습니다.
    `;
    
    const attachments = [];
    let totalSize = 0;
    const MAX_EMAIL_SIZE = 25 * 1024 * 1024; // 25MB 제한
    
    // 사진 파일들 안전하게 첨부
    if (data.photos && data.photos.length > 0) {
      body += `\n[첨부된 사진]: ${data.photos.length}개\n`;
      console.log(`사진 파일 ${data.photos.length}개 처리 시작...`);
      
      for (let i = 0; i < data.photos.length; i++) {
        try {
          const photo = data.photos[i];
          console.log(`사진 ${i+1}/${data.photos.length} 처리 중: ${photo.name}`);
          
          // 파일 크기 체크
          if (photo.size > 10 * 1024 * 1024) { // 10MB 이상
            console.warn(`사진 ${photo.name}이 너무 큽니다 (${Math.round(photo.size/1024/1024)}MB). 건너뜁니다.`);
            body += `• ${photo.name} (파일이 너무 커서 제외됨)\n`;
            continue;
          }
          
          // Base64 데이터 검증
          if (!photo.data || photo.data.length === 0) {
            console.warn(`사진 ${photo.name}의 데이터가 비어있습니다. 건너뜁니다.`);
            body += `• ${photo.name} (데이터 오류로 제외됨)\n`;
            continue;
          }
          
          // 메모리 부족 방지를 위한 지연
          Utilities.sleep(100);
          
          const photoBytes = Utilities.base64Decode(photo.data);
          const photoBlob = Utilities.newBlob(photoBytes, photo.type || 'image/jpeg', photo.name);
          
          // 총 크기 체크
          if (totalSize + photoBlob.getBytes().length > MAX_EMAIL_SIZE) {
            console.warn(`이메일 크기 제한 초과. ${photo.name} 이후 파일들은 제외됩니다.`);
            body += `• ${photo.name} (이메일 크기 제한으로 제외됨)\n`;
            break;
          }
          
          attachments.push(photoBlob);
          totalSize += photoBlob.getBytes().length;
          console.log(`사진 ${i+1} 첨부 완료: ${photo.name} (${Math.round(photoBlob.getBytes().length/1024)}KB)`);
          body += `• ${photo.name}\n`;
          
        } catch (photoError) {
          console.error(`사진 ${i+1} 처리 실패:`, photoError);
          body += `• ${data.photos[i].name} (처리 오류로 제외됨)\n`;
        }
      }
    }
    
    // 엑셀 파일 안전하게 첨부
    if (data.excel) {
      console.log(`엑셀 파일 처리 시작: ${data.excel.name}`);
      
      try {
        // 파일 크기 체크
        if (data.excel.size > 10 * 1024 * 1024) { // 10MB 이상
          console.warn(`엑셀 파일 ${data.excel.name}이 너무 큽니다 (${Math.round(data.excel.size/1024/1024)}MB). 건너뜁니다.`);
          body += `\n[첨부된 엑셀]: ${data.excel.name} (파일이 너무 커서 제외됨)\n`;
        } else {
          // Base64 데이터 검증
          if (!data.excel.data || data.excel.data.length === 0) {
            console.warn(`엑셀 파일 ${data.excel.name}의 데이터가 비어있습니다. 건너뜁니다.`);
            body += `\n[첨부된 엑셀]: ${data.excel.name} (데이터 오류로 제외됨)\n`;
          } else {
            // 메모리 부족 방지를 위한 지연
            Utilities.sleep(200);
            
            const excelBytes = Utilities.base64Decode(data.excel.data);
            const excelBlob = Utilities.newBlob(excelBytes, data.excel.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data.excel.name);
            
            // 총 크기 체크
            if (totalSize + excelBlob.getBytes().length > MAX_EMAIL_SIZE) {
              console.warn(`이메일 크기 제한 초과. 엑셀 파일은 제외됩니다.`);
              body += `\n[첨부된 엑셀]: ${data.excel.name} (이메일 크기 제한으로 제외됨)\n`;
            } else {
              attachments.push(excelBlob);
              totalSize += excelBlob.getBytes().length;
              console.log(`엑셀 파일 첨부 완료: ${data.excel.name} (${Math.round(excelBlob.getBytes().length/1024)}KB)`);
              body += `\n[첨부된 엑셀]: ${data.excel.name}\n`;
            }
          }
        }
      } catch (excelError) {
        console.error(`엑셀 파일 처리 실패:`, excelError);
        body += `\n[첨부된 엑셀]: ${data.excel.name} (처리 오류로 제외됨)\n`;
      }
    }
    
    console.log(`총 첨부파일 수: ${attachments.length}개`);
    console.log(`총 크기: ${Math.round(totalSize/1024/1024*100)/100}MB`);
    
    // 이메일 전송 (안정적인 재시도 로직)
    for (let i = 0; i < RECEIVER_EMAILS.length; i++) {
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`이메일 전송 시작 (시도 ${retryCount + 1}/${maxRetries}): ${RECEIVER_EMAILS[i]}`);
          
          // 전송 전 메모리 정리
          Utilities.sleep(500);
          
          GmailApp.sendEmail(
            RECEIVER_EMAILS[i],
            subject,
            body,
            {
              attachments: attachments,
              name: '기술개발 요청 시스템'
            }
          );
          
          console.log(`이메일 전송 완료: ${RECEIVER_EMAILS[i]}`);
          break; // 성공하면 재시도 중단
          
        } catch (emailError) {
          retryCount++;
          console.error(`이메일 전송 실패 (시도 ${retryCount}/${maxRetries}): ${emailError}`);
          
          if (retryCount >= maxRetries) {
            // 최종 실패 시 로그에 기록
            try {
              const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('로그') || 
                              SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet('로그');
              
              logSheet.appendRow([
                new Date().toLocaleString('ko-KR'),
                '이메일 전송 최종 실패',
                RECEIVER_EMAILS[i],
                emailError.toString(),
                data.requester,
                `첨부파일: ${attachments.length}개`
              ]);
            } catch (logError) {
              console.error('로그 기록 실패:', logError);
            }
          } else {
            // 재시도 전 대기
            Utilities.sleep(2000 * retryCount);
          }
        }
      }
    }
    
    console.log('=== 이메일 전송 프로세스 완료 ===');
    
  } catch (error) {
    console.error('이메일 전송 전체 프로세스 실패:', error);
    
    // 전체 실패 시 로그에 기록
    try {
      const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('로그') || 
                      SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet('로그');
      
      logSheet.appendRow([
        new Date().toLocaleString('ko-KR'),
        '이메일 전송 전체 실패',
        'ALL',
        error.toString(),
        data.requester,
        '시스템 오류'
      ]);
    } catch (logError) {
      console.error('로그 기록 실패:', logError);
    }
  }
}

// ===== 팀룸 웹훅 알림 전송 =====
function sendTeamroomNotification(data) {
  try {
    const message = {
      text: `[동수 기술개발 요청 접수 완료!]\n\n` +
            `[요청자]: ${data.requester}\n` +
            `[개발유형]: ${data.developmentType || '기타'}\n` +
            `[메뉴위치]: ${data.menuLocation}\n` +
            `[요청내용]: ${data.requestContent.substring(0, 100)}${data.requestContent.length > 100 ? '...' : ''}\n\n` +
            `[첨부파일]:\n` +
            `• 사진: ${data.photos ? data.photos.length + '개' : '없음'}\n` +
            `• 엑셀: ${data.excel ? data.excel.name : '없음'}\n\n` +
            `[접수시간]: ${new Date().toLocaleString('ko-KR')}`
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(message)
    };
    
    const response = UrlFetchApp.fetch(TEAMROOM_WEBHOOK_URL, options);
    console.log('팀룸 알림 전송 완료:', response.getContentText());
    
  } catch (error) {
    console.error('팀룸 알림 전송 실패:', error);
    // 웹훅 실패해도 전체 프로세스는 계속 진행
  }
}

// ===== 테스트 함수 (개발용) =====
function testFunction() {
  const testData = {
    requester: '테스트 사용자',
    menuLocation: '관리자 > 사용자관리',
    requestContent: '테스트 요청 내용입니다.',
    timestamp: new Date().toISOString()
  };
  
  console.log('테스트 시작...');
  saveToSheet(testData);
  console.log('테스트 완료');
}

// ===== 배포 설정 =====
/*
1. Google Apps Script에서 새 프로젝트 생성
2. 이 코드를 붙여넣기
3. SPREADSHEET_ID를 실제 Google Sheets ID로 변경
4. Gmail 앱 비밀번호 설정 (중요!)
   - Gmail 설정 > 보안 > 2단계 인증 활성화
   - 앱 비밀번호 생성 (16자리)
   - SENDER_PASSWORD에 앱 비밀번호 입력
5. 배포 > 새 배포
6. 웹 앱으로 설정
7. 액세스 권한: 모든 사용자
8. 배포 후 URL을 HTML 파일의 SCRIPT_URL에 붙여넣기

=== Gmail 앱 비밀번호 설정 방법 ===
1. Gmail 계정으로 로그인
2. Google 계정 설정 (https://myaccount.google.com/)
3. 보안 > 2단계 인증 > 앱 비밀번호
4. "앱 선택" > "기타(맞춤 이름)" > "Google Apps Script" 입력
5. 생성된 16자리 비밀번호를 SENDER_PASSWORD에 입력
6. 기존 비밀번호는 삭제하고 앱 비밀번호만 사용

=== 문제 해결 ===
- 이메일이 전송되지 않으면 Google Apps Script 실행 로그 확인
- 첨부파일이 너무 크면 파일 크기 제한 확인 (25MB)
- 권한 오류 시 Gmail API 권한 확인
*/ 