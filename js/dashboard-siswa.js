// dashboard-siswa.js - SAFE EXAM MODE (2x Peringatan, Tanpa Long Press)

// Ambil data user dari sessionStorage
const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
let currentExam = null;
let currentQuestions = [];
let currentAnswers = {};
let currentQuestionIndex = 0;
let timerInterval = null;

// ========== SAFE EXAM MODE - PROCTORING SYSTEM ==========
let examActive = false;
let examStartTime = null;
let violationCount = 0;
let isRestarting = false;
let proctorInterval = null;

// Cooldown system
let lastViolationTime = 0;
let violationCooldown = 5000;
let lastViolationReason = '';

// Reset counter setelah periode aman
let lastSuccessfulAction = Date.now();
const VIOLATION_RESET_TIME = 30000;

// Konfigurasi Safe Exam
const SAFE_EXAM_CONFIG = {
    maxViolations: 2,           // 🔥 DIUBAH: 2 kali peringatan saja
    checkInterval: 800,         
    allowedWindowSize: 0.7,     
    preventCopyPaste: true,
    preventDevTools: true,
    requireFullscreen: false,
    logViolations: true
};

// Deteksi pintasan aplikasi (Recent Apps, Home, Overview)
let appSwitchDetected = false;
let lastVisibilityTime = Date.now();

// ========== FITUR BLOKIR SISWA ==========
let isBlocked = false;
let blockReason = '';
let blockExamId = '';

// Cek status blokir siswa untuk suatu ujian
async function checkBlockStatus(examId) {
    try {
        const blockRef = firebase.firestore().collection('student_blocks');
        const blockDoc = await blockRef.doc(`${currentUser.id}_${examId}`).get();
        
        if (blockDoc.exists) {
            const data = blockDoc.data();
            // Jika status blocked dan belum direset
            if (data.status === 'blocked' && !data.reseted) {
                isBlocked = true;
                blockReason = data.reason || 'Terlalu banyak pelanggaran';
                blockExamId = examId;
                return true;
            }
        }
        
        isBlocked = false;
        blockReason = '';
        blockExamId = '';
        return false;
        
    } catch (error) {
        console.error('Error checking block status:', error);
        return false;
    }
}

// Tampilkan modal/pesan blokir
function showBlockedMessage(mataPelajaran) {
    // Hapus modal lama jika ada
    const oldModal = document.getElementById('blockedModal');
    if (oldModal) oldModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'blockedModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; text-align: center; max-width: 90%; margin: 20px; box-shadow: 0 5px 30px rgba(0,0,0,0.3);">
            <div style="font-size: 60px; margin-bottom: 15px;">🔒</div>
            <h2 style="color: #ff4757; margin-bottom: 10px;">AKUN DIBLOKIR</h2>
            <p style="margin-bottom: 15px; color: #333;">Anda tidak dapat mengikuti ujian <strong>${escapeHtml(mataPelajaran)}</strong>.</p>
            <p style="margin-bottom: 15px; padding: 10px; background: #fff3cd; border-radius: 8px; color: #856404;">
                <strong>Alasan:</strong> ${escapeHtml(blockReason)}
            </p>
            <p style="margin-bottom: 20px; color: #666;">Silakan hubungi guru untuk membuka blokir akun Anda.</p>
            <button onclick="closeBlockedModal()" style="padding: 12px 25px; background: #ff4757; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">Tutup</button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Tutup modal blokir
function closeBlockedModal() {
    const modal = document.getElementById('blockedModal');
    if (modal) modal.remove();
}

// Inisialisasi Safe Exam
function initSafeExam() {
    examActive = true;
    examStartTime = Date.now();
    violationCount = 0;
    isRestarting = false;
    lastViolationTime = 0;
    lastSuccessfulAction = Date.now();
    appSwitchDetected = false;
    
    showSecurityBadge();
    showWatermark();
    
    if (SAFE_EXAM_CONFIG.requireFullscreen) {
        requestFullscreen();
    }
    
    startProctoring();
    enableSecurityBlocks();
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    history.pushState(null, null, location.href);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('resize', handleResize);
    
    // 🔥 DETEKSI PINTASAN APLIKASI (Recent Apps, Home)
    window.addEventListener('blur', handleAppSwitch);
    window.addEventListener('pagehide', handleAppSwitch);
    document.addEventListener('pause', handleAppSwitch); // Untuk Android WebView
    
    // Reset counter periodik
    setInterval(() => {
        checkAndResetViolationCounter();
    }, 5000);
}

// 🔥 DETEKSI PINTASAN APLIKASI
function handleAppSwitch() {
    if (!examActive || isRestarting) return;
    
    const now = Date.now();
    // Cek apakah benar-benar pindah aplikasi (bukan sekadar blur biasa)
    if (now - lastVisibilityTime > 100) {
        handleViolation('APP_SWITCH');
    }
    lastVisibilityTime = now;
}

// Reset counter setelah periode aman
function checkAndResetViolationCounter() {
    if (!examActive || isRestarting) return;
    
    const now = Date.now();
    if (now - lastSuccessfulAction >= VIOLATION_RESET_TIME && violationCount > 0) {
        violationCount = 0;
        lastViolationReason = '';
        updateBadgeStatus(false);
        console.log('✅ Violation counter reset');
    }
}

function showSecurityBadge() {
    const existingBadge = document.getElementById('securityBadge');
    if (existingBadge) existingBadge.remove();
    
    const badge = document.createElement('div');
    badge.id = 'securityBadge';
    badge.className = 'security-badge';
    badge.innerHTML = '🔒 SAFE EXAM MODE ACTIVE';
    document.body.appendChild(badge);
}

function showWatermark() {
    const existingWatermark = document.getElementById('examWatermark');
    if (existingWatermark) existingWatermark.remove();
    
    const watermark = document.createElement('div');
    watermark.id = 'examWatermark';
    watermark.className = 'exam-watermark';
    watermark.innerHTML = `${currentUser?.nama || 'Siswa'} | ${new Date().toLocaleDateString()}`;
    document.body.appendChild(watermark);
}

function updateBadgeStatus(isWarning) {
    const badge = document.getElementById('securityBadge');
    if (badge) {
        if (isWarning) {
            badge.classList.add('warning');
            badge.innerHTML = `⚠️ PERINGATAN ${violationCount}/${SAFE_EXAM_CONFIG.maxViolations} ⚠️`;
        } else {
            badge.classList.remove('warning');
            badge.innerHTML = `🔒 SAFE EXAM | ${violationCount}/${SAFE_EXAM_CONFIG.maxViolations}`;
        }
    }
}

// Mulai proctoring
function startProctoring() {
    if (proctorInterval) clearInterval(proctorInterval);
    
    proctorInterval = setInterval(() => {
        if (!examActive || isRestarting) return;
        
        checkAndResetViolationCounter();
        
        const checks = [];
        
        // 🔥 DETEKSI SPLIT SCREEN (lebih akurat)
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const screenWidth = screen.width;
        const screenHeight = screen.height;
        
        // Deteksi split screen horizontal (2 aplikasi berdampingan)
        const widthRatio = windowWidth / screenWidth;
        const isHorizontalSplit = widthRatio < 0.6 && widthRatio > 0.3;
        
        // Deteksi split screen vertikal (2 aplikasi atas-bawah)
        const heightRatio = windowHeight / screenHeight;
        const isVerticalSplit = heightRatio < 0.6 && heightRatio > 0.3;
        
        // Deteksi pop-up view (floating window)
        const isPopupView = (windowWidth < screenWidth * 0.8 && windowHeight < screenHeight * 0.8) ||
                            (Math.abs(windowWidth - screenWidth) > 100 && Math.abs(windowHeight - screenHeight) > 100);
        
        if (isHorizontalSplit || isVerticalSplit || isPopupView) {
            checks.push('SPLIT_SCREEN');
        }
        
        // Cek window terlalu kecil
        if (window.innerWidth < 350 || window.innerHeight < 400) {
            checks.push('WINDOW_TOO_SMALL');
        }
        
        if (checks.length > 0) {
            handleViolation(checks.join(', '));
        } else {
            lastSuccessfulAction = Date.now();
        }
        
    }, SAFE_EXAM_CONFIG.checkInterval);
}

async function handleViolation(reason) {
    if (!examActive || isRestarting) return;
    
    const now = Date.now();
    
    if (now - lastViolationTime < violationCooldown) {
        console.log(`Cooldown aktif: ${reason}`);
        return;
    }
    
    if (lastViolationReason === reason && (now - lastViolationTime) < 10000) {
        console.log(`Pelanggaran berulang diabaikan: ${reason}`);
        return;
    }
    
    lastViolationTime = now;
    lastViolationReason = reason;
    
    violationCount++;
    
    updateBadgeStatus(true);
    
    const warningMessage = `⚠️ PELANGGARAN DETEKSI! ⚠️\n\n${formatViolationReason(reason)}\n\nPERINGATAN: ${violationCount}/${SAFE_EXAM_CONFIG.maxViolations}`;
    
    // 🔥 Jika sudah mencapai maxViolations (2 kali), LANGSUNG BLOKIR
    if (violationCount >= SAFE_EXAM_CONFIG.maxViolations) {
        alert(`${warningMessage}\n\n❌ UJIAN DIHENTIKAN! Anda telah melanggar aturan ${violationCount} kali.\n\nAkun Anda akan diblokir. Hubungi guru untuk membuka blokir.`);
        
        await saveViolationLog(reason, true);
        
        // 🔥 BLOKIR SISWA (simpan ke database)
        await blockStudent(reason);
        
        // Hentikan ujian
        examActive = false;
        isRestarting = true;
        
        if (proctorInterval) clearInterval(proctorInterval);
        if (timerInterval) clearInterval(timerInterval);
        
        // Hapus event listeners
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('popstate', handlePopState);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('blur', handleAppSwitch);
        window.removeEventListener('pagehide', handleAppSwitch);
        document.removeEventListener('pause', handleAppSwitch);
        
        exitFullscreen();
        
        const badge = document.getElementById('securityBadge');
        if (badge) badge.remove();
        const watermark = document.getElementById('examWatermark');
        if (watermark) watermark.remove();
        
        // Tampilkan pesan blokir
        showBlockedMessageAfterViolation(formatViolationReason(reason));
        
        // Kembali ke menu setelah 3 detik
        setTimeout(() => {
            backToMenu();
        }, 3000);
        
    } else {
        alert(`${warningMessage}\n\n⚠️ PERINGATAN! 1 kali lagi maka akun Anda akan DIBLOKIR!`);
        await saveViolationLog(reason, false);
        
        setTimeout(() => {
            if (examActive && !isRestarting) {
                updateBadgeStatus(false);
            }
        }, 3000);
    }
}

// 🔥 FUNGSI BLOKIR SISWA (simpan ke database)
async function blockStudent(reason) {
    if (!currentExam || !currentUser) return;
    
    try {
        const blockRef = firebase.firestore().collection('student_blocks');
        const docId = `${currentUser.id}_${currentExam.id}`;
        
        await blockRef.doc(docId).set({
            siswaId: currentUser.id,
            siswaNama: currentUser.nama || '',
            nis: currentUser.nis || '',
            kelas: currentUser.kelas || '',
            examId: currentExam.id,
            mataPelajaran: currentExam.mataPelajaran || '',
            reason: reason,
            status: 'blocked',
            reseted: false,
            waktu: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('Siswa diblokir:', currentUser.nama, currentExam.mataPelajaran);
        
    } catch (error) {
        console.error('Error blocking student:', error);
    }
}

// Tampilkan pesan blokir setelah pelanggaran
function showBlockedMessageAfterViolation(reason) {
    const oldModal = document.getElementById('blockedModal');
    if (oldModal) oldModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'blockedModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; text-align: center; max-width: 90%; margin: 20px; box-shadow: 0 5px 30px rgba(0,0,0,0.3);">
            <div style="font-size: 60px; margin-bottom: 15px;">🔒</div>
            <h2 style="color: #ff4757; margin-bottom: 10px;">AKUN DIBLOKIR</h2>
            <p style="margin-bottom: 15px; color: #333;">Anda telah melakukan pelanggaran saat ujian <strong>${escapeHtml(currentExam?.mataPelajaran || '')}</strong>.</p>
            <p style="margin-bottom: 15px; padding: 10px; background: #fff3cd; border-radius: 8px; color: #856404;">
                <strong>Pelanggaran:</strong> ${escapeHtml(reason)}
            </p>
            <p style="margin-bottom: 20px; color: #666;">Akun Anda diblokir. Silakan hubungi guru untuk membuka blokir.</p>
            <button onclick="closeBlockedModal()" style="padding: 12px 25px; background: #ff4757; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">Tutup</button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Format pesan pelanggaran
function formatViolationReason(reason) {
    const reasons = {
        'SPLIT_SCREEN': 'Mode split screen / pop-up view',
        'WINDOW_TOO_SMALL': 'Window terlalu kecil',
        'TAB_SWITCH': 'Berpindah ke tab lain',
        'APP_SWITCH': 'Berpindah ke aplikasi lain (Recent Apps/Home)',
        'DEVTOOLS_OPEN': 'Membuka Developer Tools',
        'BACK_BUTTON': 'Menekan tombol Back',
        'COPY_ATTEMPT': 'Mencoba copy',
        'PASTE_ATTEMPT': 'Mencoba paste',
        'RIGHT_CLICK': 'Klik kanan',
        'SHORTCUT': 'Shortcut keyboard terlarang'
    };
    return reasons[reason] || reason;
}

// Handle visibility change (pindah tab)
function handleVisibilityChange() {
    if (!examActive || isRestarting) return;
    
    if (document.hidden) {
        handleViolation('TAB_SWITCH');
    } else {
        lastSuccessfulAction = Date.now();
    }
}

// Handle resize (split screen) dengan throttle
let resizeTimeout;
function handleResize() {
    if (!examActive || isRestarting) return;
    
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const windowWidth = window.innerWidth;
        const screenWidth = screen.width;
        const widthRatio = windowWidth / screenWidth;
        const isSplitScreen = widthRatio < 0.6 && widthRatio > 0.3;
        
        if (isSplitScreen || window.innerWidth < 350) {
            handleViolation('SPLIT_SCREEN');
        } else {
            lastSuccessfulAction = Date.now();
        }
    }, 300);
}

function handleFullscreenChange() {
    if (!examActive || isRestarting) return;
    lastSuccessfulAction = Date.now();
}

function handleBeforeUnload(e) {
    if (examActive && !isRestarting) {
        e.preventDefault();
        e.returnValue = '⚠️ PERINGATAN! Anda sedang dalam ujian. Jika me-refresh, ujian akan diulang dari awal!';
        return e.returnValue;
    }
}

function handlePopState(e) {
    if (examActive && !isRestarting) {
        handleViolation('BACK_BUTTON');
        history.pushState(null, null, location.href);
        e.preventDefault();
        return false;
    }
}

// Aktifkan security blocks (TANPA LONG PRESS)
function enableSecurityBlocks() {
    // Blokir klik kanan
    document.addEventListener('contextmenu', (e) => {
        if (examActive && !isRestarting) {
            e.preventDefault();
            handleViolation('RIGHT_CLICK');
            return false;
        }
    });
    
    // Blokir copy-paste
    if (SAFE_EXAM_CONFIG.preventCopyPaste) {
        document.addEventListener('copy', (e) => {
            if (examActive && !isRestarting) {
                e.preventDefault();
                handleViolation('COPY_ATTEMPT');
                return false;
            }
        });
        
        document.addEventListener('paste', (e) => {
            if (examActive && !isRestarting) {
                e.preventDefault();
                handleViolation('PASTE_ATTEMPT');
                return false;
            }
        });
        
        document.addEventListener('cut', (e) => {
            if (examActive && !isRestarting) {
                e.preventDefault();
                return false;
            }
        });
    }
    
    // Blokir shortcut keyboard
    document.addEventListener('keydown', (e) => {
        if (!examActive || isRestarting) return;
        
        const blockedKeys = ['F12', 'F5', 'PrintScreen', 'Insert', 'Home', 'End'];
        const blockedCombos = [
            { ctrl: true, key: 'r' }, { ctrl: true, key: 'R' },
            { ctrl: true, key: 'u' }, { ctrl: true, key: 'U' },
            { ctrl: true, key: 's' }, { ctrl: true, key: 'S' },
            { ctrl: true, key: 'c' }, { ctrl: true, key: 'C' },
            { ctrl: true, key: 'v' }, { ctrl: true, key: 'V' }
        ];
        
        if (blockedKeys.includes(e.key)) {
            e.preventDefault();
            handleViolation('SHORTCUT');
            return false;
        }
        
        for (const combo of blockedCombos) {
            if (e.ctrlKey === combo.ctrl && e.key === combo.key) {
                e.preventDefault();
                handleViolation('SHORTCUT');
                return false;
            }
        }
        
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            e.preventDefault();
            handleViolation('DEVTOOLS_OPEN');
            return false;
        }
    });
    
    // 🔥 LONG PRESS DIHAPUS - Tidak ada deteksi long press
}

function requestFullscreen() {
    const elem = document.documentElement;
    try {
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
    } catch(e) {}
}

function isFullscreen() {
    return !!(document.fullscreenElement || 
              document.webkitFullscreenElement || 
              document.msFullscreenElement);
}

function exitFullscreen() {
    try {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
    } catch(e) {}
}

async function saveViolationLog(reason, isMaxViolation) {
    if (!currentExam || !currentUser) return;
    
    try {
        const violationLogRef = firebase.firestore().collection('safe_exam_logs');
        await violationLogRef.add({
            examId: currentExam.id,
            siswaId: currentUser.id,
            siswaNama: currentUser.nama || '',
            nis: currentUser.nis || '',
            kelas: currentUser.kelas || '',
            mataPelajaran: currentExam.mataPelajaran || '',
            alasan: reason,
            violationKe: violationCount,
            isMaxViolation: isMaxViolation,
            durasiUjian: Math.floor((Date.now() - examStartTime) / 1000),
            waktu: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent,
            screenSize: `${window.innerWidth}x${window.innerHeight}`,
            fullscreen: isFullscreen()
        });
    } catch (error) {
        console.error('Error saving log:', error);
    }
}

async function restartExamFromBeginning(reason) {
    if (isRestarting) return;
    
    isRestarting = true;
    examActive = false;
    
    if (proctorInterval) clearInterval(proctorInterval);
    if (timerInterval) clearInterval(timerInterval);
    
    // Hapus event listeners
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('popstate', handlePopState);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('blur', handleAppSwitch);
    window.removeEventListener('pagehide', handleAppSwitch);
    document.removeEventListener('pause', handleAppSwitch);
    
    exitFullscreen();
    
    const badge = document.getElementById('securityBadge');
    if (badge) badge.remove();
    const watermark = document.getElementById('examWatermark');
    if (watermark) watermark.remove();
    
    currentAnswers = {};
    currentQuestionIndex = 0;
    violationCount = 0;
    
    alert(`🔄 UJIAN DIULANG DARI AWAL!\n\nPelanggaran: ${formatViolationReason(reason)}\n\nSilakan kerjakan ujian dengan tertib.`);
    
    setTimeout(async () => {
        try {
            const subjectName = currentExam?.mataPelajaran || 'Ujian';
            const examId = currentExam?.id;
            isRestarting = false;
            await startExam(examId, subjectName);
        } catch (error) {
            console.error('Error restarting:', error);
            backToMenu();
        }
    }, 1500);
}

function stopSafeExam() {
    examActive = false;
    if (proctorInterval) clearInterval(proctorInterval);
    
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('popstate', handlePopState);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('blur', handleAppSwitch);
    window.removeEventListener('pagehide', handleAppSwitch);
    document.removeEventListener('pause', handleAppSwitch);
    
    const badge = document.getElementById('securityBadge');
    if (badge) badge.remove();
    const watermark = document.getElementById('examWatermark');
    if (watermark) watermark.remove();
    
    exitFullscreen();
}

// ========== FUNGSI ASLI (TIDAK BERUBAH) ==========

// Cek login
if (!currentUser || currentUser.role !== 'siswa') {
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', function() {
    const userNameEl = document.getElementById('userName');
    const kelasSiswaEl = document.getElementById('kelasSiswa');
    
    if (userNameEl) userNameEl.textContent = currentUser.nama || 'Siswa';
    if (kelasSiswaEl) kelasSiswaEl.textContent = currentUser.kelas || '-';
    
    loadSubjects();
});

async function loadSubjects() {
    const subjectList = document.getElementById('subjectList');
    if (!subjectList) return;
    
    subjectList.innerHTML = '<p>Loading...</p>';
    
    try {
        const examsSnapshot = await examsRef
            .where('kelas', '==', currentUser.kelas)
            .where('aktif', '==', true)
            .get();
        
        subjectList.innerHTML = '';
        
        if (examsSnapshot.empty) {
            subjectList.innerHTML = '<p>Tidak ada ujian tersedia</p>';
            return;
        }
        
        // Loop untuk setiap ujian dan cek status blokir
        for (const doc of examsSnapshot.docs) {
            const exam = doc.data();
            const totalSoal = (exam.jumlahSoal?.pg || 0) + (exam.jumlahSoal?.isian || 0) + (exam.jumlahSoal?.uraian || 0);
            
            // 🔥 CEK STATUS BLOKIR UNTUK UJIAN INI
            const isBlockedForThisExam = await checkBlockStatus(doc.id);
            
            let cardStyle = '';
            let onclickAttr = `onclick="startExam('${doc.id}', '${exam.mataPelajaran || 'Ujian'}')"`;
            let badgeHtml = '<p style="color: #28a745; font-size: 12px;">🔒 Safe Exam Mode</p>';
            
            if (isBlockedForThisExam) {
                cardStyle = 'style="opacity: 0.6; background: #f8f9fa; cursor: not-allowed;"';
                onclickAttr = `onclick="showBlockedMessage('${exam.mataPelajaran || 'Ujian'}')"`;
                badgeHtml = '<p style="color: #dc3545; font-size: 12px;">🔒 DIBLOKIR - Hubungi Guru</p>';
            }
            
            subjectList.innerHTML += `
                <div class="card" ${cardStyle} ${onclickAttr}>
                    <div class="card-icon">📚</div>
                    <h3>${exam.mataPelajaran || 'Mata Pelajaran'}</h3>
                    <p>${totalSoal} Soal</p>
                    <p>Durasi: ${exam.durasi || 60} menit</p>
                    ${badgeHtml}
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading subjects:', error);
        subjectList.innerHTML = '<p style="color: red;">Error loading data</p>';
    }
}

async function startExam(examId, subjectName) {
    try {
	const isBlockedForThisExam = await checkBlockStatus(examId);
        if (isBlockedForThisExam) {
            showBlockedMessage(subjectName);
            return;
        }
        const existingAnswer = await answersRef
            .where('examId', '==', examId)
            .where('siswaId', '==', currentUser.id)
            .get();
        
        const hasCompleted = existingAnswer.docs.some(doc => {
            const data = doc.data();
            return data.statusSubmit === 'normal' || (data.statusKoreksi === 'selesai' && data.nilaiSementara > 0);
        });
        
        if (hasCompleted) {
            alert('Anda sudah menyelesaikan ujian ini! Tidak bisa mengulang.');
            return;
        }
        
        const examDoc = await examsRef.doc(examId).get();
        if (!examDoc.exists) {
            alert('Ujian tidak ditemukan');
            return;
        }
        
        currentExam = { id: examId, ...examDoc.data() };
        
        const questionsSnapshot = await questionsRef
            .where('kelas', '==', currentExam.kelas)
            .where('mataPelajaran', '==', currentExam.mataPelajaran)
            .get();
        
        currentQuestions = questionsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (a.nomor || 0) - (b.nomor || 0));
        
        if (currentQuestions.length === 0) {
            alert('Tidak ada soal untuk ujian ini.');
            return;
        }
        
        const examJumlahSoal = currentExam.jumlahSoal || {};
        const pgQuestions = currentQuestions.filter(q => q.tipe === 'pg');
        const isianQuestions = currentQuestions.filter(q => q.tipe === 'isian');
        const uraianQuestions = currentQuestions.filter(q => q.tipe === 'uraian');
        
        const pgCount = examJumlahSoal.pg || pgQuestions.length;
        const isianCount = examJumlahSoal.isian || isianQuestions.length;
        const uraianCount = examJumlahSoal.uraian || uraianQuestions.length;
        
        currentQuestions = [
            ...pgQuestions.slice(0, pgCount),
            ...isianQuestions.slice(0, isianCount),
            ...uraianQuestions.slice(0, uraianCount)
        ];
        
        const nilaiPerSoalSetting = currentExam.nilaiPerSoal || { pg: 5, isian: 5, uraian: 5 };
        currentQuestions = currentQuestions.map(question => {
            if (!question.nilai) {
                if (question.tipe === 'pg') question.nilai = nilaiPerSoalSetting.pg;
                else if (question.tipe === 'isian') question.nilai = nilaiPerSoalSetting.isian;
                else if (question.tipe === 'uraian') question.nilai = nilaiPerSoalSetting.uraian;
            }
            return question;
        });
        
        currentAnswers = {};
        currentQuestionIndex = 0;
        
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('examPage').style.display = 'block';
        document.getElementById('examSubject').textContent = subjectName;
        
        startTimer((currentExam.durasi || 60) * 60);
        showQuestion();
        updateQuestionGrid();
        
        initSafeExam();
        document.body.classList.add('exam-mode');
        
    } catch (error) {
        console.error('Error starting exam:', error);
        alert('Gagal memulai ujian: ' + error.message);
    }
}

function startTimer(duration) {
    const timerDisplay = document.getElementById('timer');
    if (!timerDisplay) return;
    
    let timeLeft = duration;
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            alert('Waktu habis!');
            submitExam();
        }
        timeLeft--;
    }, 1000);
}

function showQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    const container = document.getElementById('questionContainer');
    if (!question || !container) return;
    
    let questionHtml = `
        <div class="question-number">Soal ${currentQuestionIndex + 1} dari ${currentQuestions.length}</div>
        <div class="question-point">Nilai: ${question.nilai || 0} poin</div>
    `;
    
    if (question.gambar && question.gambar.trim() !== '') {
        questionHtml += `
            <div class="question-image-container">
                <img src="${question.gambar}" alt="Gambar soal" class="question-image" onclick="showImageModal('${question.gambar}')" onerror="this.style.display='none'">
                <p style="font-size: 12px; color: #666; margin-top: 5px;">Klik gambar untuk memperbesar</p>
            </div>
        `;
    }
    
    questionHtml += `<div class="question-text">${question.soal || 'Soal tidak tersedia'}</div>`;
    
    if (question.tipe === 'pg') {
        questionHtml += '<div class="options">';
        const optionLetters = ['A', 'B', 'C', 'D'];
        const pilihan = question.pilihan || [];
        const gambarPilihan = question.gambarPilihan || {};
        
        for (let i = 0; i < pilihan.length; i++) {
            const pilihanText = pilihan[i];
            if (!pilihanText) continue;
            
            const optionLetter = optionLetters[i];
            const isSelected = currentAnswers[question.id] === optionLetter;
            const gambarUrl = (gambarPilihan && gambarPilihan[optionLetter]) ? gambarPilihan[optionLetter] : '';
            
            questionHtml += `<div class="option ${isSelected ? 'selected' : ''}" onclick="selectOption('${question.id}', '${optionLetter}')">`;
            questionHtml += `<div class="option-marker">${optionLetter}</div>`;
            questionHtml += `<div class="option-text">`;
            if (gambarUrl) questionHtml += `<img src="${gambarUrl}" onerror="this.style.display='none'">`;
            questionHtml += `<span>${pilihanText}</span>`;
            questionHtml += `</div></div>`;
        }
        questionHtml += '</div>';
    } else if (question.tipe === 'isian') {
        questionHtml += `<div class="short-answer"><input type="text" placeholder="Tulis jawaban Anda" value="${escapeHtml(currentAnswers[question.id] || '')}" onchange="saveShortAnswer('${question.id}', this.value)"></div>`;
    } else if (question.tipe === 'uraian') {
        questionHtml += `<div class="essay-answer"><textarea placeholder="Tulis jawaban Anda" rows="5" onchange="saveEssay('${question.id}', this.value)">${escapeHtml(currentAnswers[question.id] || '')}</textarea></div>`;
    }
    
    questionHtml += `<div class="navigation-buttons">`;
    if (currentQuestionIndex > 0) questionHtml += `<button class="nav-btn prev" onclick="prevQuestion()">← Sebelumnya</button>`;
    else questionHtml += `<div></div>`;
    
    if (currentQuestionIndex < currentQuestions.length - 1) questionHtml += `<button class="nav-btn next" onclick="nextQuestion()">Selanjutnya →</button>`;
    else questionHtml += `<button class="nav-btn submit" onclick="submitExam()">Selesai</button>`;
    questionHtml += `</div>`;
    
    container.innerHTML = questionHtml;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showImageModal(imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    if (modal && modalImg) {
        modal.style.display = 'flex';
        modalImg.src = imageUrl;
    }
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) modal.style.display = 'none';
}

function selectOption(questionId, answer) {
    currentAnswers[questionId] = answer;
    showQuestion();
    updateQuestionGrid();
}

function saveShortAnswer(questionId, value) {
    currentAnswers[questionId] = value || '';
    updateQuestionGrid();
}

function saveEssay(questionId, value) {
    currentAnswers[questionId] = value || '';
    updateQuestionGrid();
}

function nextQuestion() {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showQuestion();
    }
}

function jumpToQuestion(index) {
    if (index >= 0 && index < currentQuestions.length) {
        currentQuestionIndex = index;
        showQuestion();
    }
}

function updateQuestionGrid() {
    const grid = document.getElementById('questionGrid');
    if (!grid) return;
    
    let gridHtml = '';
    currentQuestions.forEach((question, index) => {
        const isAnswered = currentAnswers[question.id] !== undefined && currentAnswers[question.id] !== '';
        const isCurrent = index === currentQuestionIndex;
        gridHtml += `<div class="question-grid-item ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''}" onclick="jumpToQuestion(${index})">${index + 1}</div>`;
    });
    grid.innerHTML = gridHtml;
}

async function submitExam() {
    if (!confirm('Apakah Anda yakin ingin mengumpulkan jawaban?')) return;
    
    stopSafeExam();
    if (timerInterval) clearInterval(timerInterval);
    
    try {
        const examDoc = await examsRef.doc(currentExam.id).get();
        const examData = examDoc.data();
        if (!examData) throw new Error('Data ujian tidak ditemukan');
        
        const nilaiPGPerSoal = examData.nilaiPerSoal?.pg || 5;
        const nilaiIsianPerSoal = examData.nilaiPerSoal?.isian || 5;
        const nilaiUraianPerSoal = examData.nilaiPerSoal?.uraian || 5;
        
        const jawabanPG = {};
        const jawabanIsian = {};
        const jawabanUraian = {};
        let nilaiPG = 0, nilaiIsian = 0, jmlPG = 0, jmlIsian = 0, jmlUraian = 0;
        
        for (const question of currentQuestions) {
            const jawabanSiswa = currentAnswers[question.id];
            const kunci = question.kunci;
            const tipe = question.tipe;
            
            if (tipe === 'pg') {
                jmlPG++;
                jawabanPG[question.id] = { jawaban: jawabanSiswa || '', kunci: kunci || '', nomor: question.nomor, soal: question.soal, pilihan: question.pilihan || [] };
                if (jawabanSiswa && kunci && String(jawabanSiswa).trim().toUpperCase() === String(kunci).trim().toUpperCase()) nilaiPG += nilaiPGPerSoal;
            } else if (tipe === 'isian') {
                jmlIsian++;
                jawabanIsian[question.id] = { jawaban: jawabanSiswa || '', kunci: kunci || '', nomor: question.nomor, soal: question.soal };
                if (jawabanSiswa && kunci && String(jawabanSiswa).toLowerCase().trim() === String(kunci).toLowerCase().trim()) nilaiIsian += nilaiIsianPerSoal;
            } else if (tipe === 'uraian') {
                jmlUraian++;
                jawabanUraian[question.id] = { jawaban: jawabanSiswa || '', soal: question.soal, nilaiMaksimal: nilaiUraianPerSoal, nilaiDiperoleh: 0, nomor: question.nomor };
            }
        }
        
        const totalPG = jmlPG * nilaiPGPerSoal;
        const totalIsian = jmlIsian * nilaiIsianPerSoal;
        const totalUraian = jmlUraian * nilaiUraianPerSoal;
        const jumlahNilaiDiperoleh = nilaiPG + nilaiIsian;
        const jumlahNilaiMaksimal = totalPG + totalIsian + totalUraian;
        let nilaiSementara = jumlahNilaiMaksimal > 0 ? Math.round((jumlahNilaiDiperoleh / jumlahNilaiMaksimal) * 100) : 0;
        
        await answersRef.add({
            examId: currentExam.id, siswaId: currentUser.id, siswaNama: currentUser.nama, nis: currentUser.nis || '',
            kelas: currentUser.kelas, mataPelajaran: currentExam.mataPelajaran,
            jawabanPG, jawabanIsian, jawabanUraian,
            nilaiPG, nilaiIsian, nilaiUraian: 0, totalPG, totalIsian, totalUraian,
            jumlahSoal: { pg: jmlPG, isian: jmlIsian, uraian: jmlUraian },
            nilaiSementara, statusKoreksi: jmlUraian > 0 ? 'pending' : 'selesai',
            statusSubmit: 'normal', safeExamActive: true,
            waktu: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert(jmlUraian > 0 ? `Jawaban berhasil dikumpulkan!\nNilai Sementara: ${nilaiSementara}\n(Soal uraian menunggu koreksi)` : `Jawaban berhasil dikumpulkan!\nNilai Akhir: ${nilaiSementara}`);
        showResults(nilaiPG, nilaiIsian, totalPG, totalIsian);
        document.body.classList.remove('exam-mode');
    } catch (error) {
        console.error('Error submitting exam:', error);
        alert('Gagal mengumpulkan jawaban: ' + error.message);
    }
}

function showResults(nilaiPG, nilaiIsian, totalPG, totalIsian) {
    document.getElementById('examPage').style.display = 'none';
    document.getElementById('resultPage').style.display = 'block';
    document.getElementById('resultPG').textContent = nilaiPG + ' / ' + totalPG;
    document.getElementById('resultIsian').textContent = nilaiIsian + ' / ' + totalIsian;
    document.getElementById('resultUraian').textContent = 'Menunggu koreksi guru';
    document.getElementById('resultTotal').textContent = (nilaiPG + nilaiIsian) + ' / ' + (totalPG + totalIsian);
}

function backToMenu() {
    stopSafeExam();
    document.getElementById('resultPage').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'block';
    currentExam = null;
    currentQuestions = [];
    currentAnswers = {};
    currentQuestionIndex = 0;
    if (timerInterval) clearInterval(timerInterval);
    document.body.classList.remove('exam-mode');
}

function logout() {
    if (confirm('Apakah Anda yakin ingin logout?')) {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

function getGambarUrl(gambarPilihan, optionLetter, gambarSoal) {
    let url = gambarPilihan?.[optionLetter] || '';
    if (!url && gambarSoal) url = gambarSoal;
    if (url && url.includes('drive.google.com')) {
        let id = null;
        let match = url.match(/id=([^&]+)/);
        if (match) id = match[1];
        if (!id) { match = url.match(/\/d\/([^\/]+)/); if (match) id = match[1]; }
        if (id) url = `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
    }
    return url;
}
