// dashboard-siswa.js - SAFE EXAM MODE (Proctoring Ringan)

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

// Konfigurasi Safe Exam
const SAFE_EXAM_CONFIG = {
    maxViolations: 3,           // Maksimal pelanggaran sebelum submit paksa
    checkInterval: 500,         // Interval pengecekan (ms)
    allowedWindowSize: 0.8,     // Minimal ukuran window 80% dari layar
    preventCopyPaste: true,     // Cegah copy-paste
    preventScreenshot: true,    // Cegah screenshot
    preventDevTools: true,      // Cegah DevTools
    requireFullscreen: true,    // Wajib fullscreen
    logViolations: true         // Catat pelanggaran
};

// Inisialisasi Safe Exam
function initSafeExam() {
    examActive = true;
    examStartTime = Date.now();
    violationCount = 0;
    isRestarting = false;
    
    // Tampilkan indikator keamanan
    showSecurityBadge();
    showWatermark();
    
    // Minta fullscreen
    if (SAFE_EXAM_CONFIG.requireFullscreen) {
        requestFullscreen();
    }
    
    // Mulai proctoring
    startProctoring();
    
    // Blokir akses mencurigakan
    enableSecurityBlocks();
    
    // Cegah refresh dengan peringatan
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Cegah tombol back
    history.pushState(null, null, location.href);
    window.addEventListener('popstate', handlePopState);
    
    // Deteksi perubahan visibility (pindah tab/aplikasi)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Deteksi resize (split screen)
    window.addEventListener('resize', handleResize);
    
    // Deteksi fullscreen change
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
}

// Tampilkan badge keamanan
function showSecurityBadge() {
    const existingBadge = document.getElementById('securityBadge');
    if (existingBadge) existingBadge.remove();
    
    const badge = document.createElement('div');
    badge.id = 'securityBadge';
    badge.className = 'security-badge';
    badge.innerHTML = '🔒 SAFE EXAM MODE ACTIVE';
    document.body.appendChild(badge);
}

// Tampilkan watermark
function showWatermark() {
    const existingWatermark = document.getElementById('examWatermark');
    if (existingWatermark) existingWatermark.remove();
    
    const watermark = document.createElement('div');
    watermark.id = 'examWatermark';
    watermark.className = 'exam-watermark';
    watermark.innerHTML = `${currentUser?.nama || 'Siswa'} | ${new Date().toLocaleDateString()}`;
    document.body.appendChild(watermark);
}

// Update badge status
function updateBadgeStatus(isWarning) {
    const badge = document.getElementById('securityBadge');
    if (badge) {
        if (isWarning) {
            badge.classList.add('warning');
            badge.innerHTML = `⚠️ PELANGGARAN ${violationCount}/${SAFE_EXAM_CONFIG.maxViolations} ⚠️`;
        } else {
            badge.classList.remove('warning');
            badge.innerHTML = `🔒 SAFE EXAM MODE | ${violationCount}/${SAFE_EXAM_CONFIG.maxViolations}`;
        }
    }
}

// Mulai proctoring (pengecekan berkala)
function startProctoring() {
    if (proctorInterval) clearInterval(proctorInterval);
    
    proctorInterval = setInterval(() => {
        if (!examActive || isRestarting) return;
        
        const checks = [];
        
        // 1. Cek fullscreen
        if (SAFE_EXAM_CONFIG.requireFullscreen && !isFullscreen()) {
            checks.push('FULLSCREEN_OFF');
        }
        
        // 2. Cek ukuran window (split screen)
        const windowWidth = window.innerWidth;
        const screenWidth = screen.width;
        const ratio = windowWidth / screenWidth;
        if (ratio < SAFE_EXAM_CONFIG.allowedWindowSize) {
            checks.push('SPLIT_SCREEN');
        }
        
        // 3. Cek apakah window terlalu kecil
        if (window.innerWidth < 400 || window.innerHeight < 400) {
            checks.push('WINDOW_TOO_SMALL');
        }
        
        // 4. Cek devtools (jika terbuka)
        if (SAFE_EXAM_CONFIG.preventDevTools && isDevToolsOpen()) {
            checks.push('DEVTOOLS_OPEN');
        }
        
        // Jika ada pelanggaran
        if (checks.length > 0) {
            handleViolation(checks.join(', '));
        }
        
    }, SAFE_EXAM_CONFIG.checkInterval);
}

// Deteksi DevTools terbuka
function isDevToolsOpen() {
    // Method 1: Cek lebar vs tinggi
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    
    if (widthDiff > threshold || heightDiff > threshold) {
        return true;
    }
    
    // Method 2: Cek via console (tidak bisa dideteksi langsung, tapi ini fallback)
    try {
        const element = new Image();
        Object.defineProperty(element, 'id', {
            get: function() {
                return true;
            }
        });
        console.log(element);
        return false;
    } catch(e) {
        return true;
    }
}

// Handle visibility change (pindah tab)
function handleVisibilityChange() {
    if (!examActive || isRestarting) return;
    
    if (document.hidden) {
        handleViolation('TAB_SWITCH');
    }
}

// Handle resize (split screen)
let resizeTimeout;
function handleResize() {
    if (!examActive || isRestarting) return;
    
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const ratio = window.innerWidth / screen.width;
        if (ratio < SAFE_EXAM_CONFIG.allowedWindowSize) {
            handleViolation('SPLIT_SCREEN');
        }
    }, 200);
}

// Handle fullscreen change
function handleFullscreenChange() {
    if (!examActive || isRestarting) return;
    
    if (SAFE_EXAM_CONFIG.requireFullscreen && !isFullscreen()) {
        handleViolation('FULLSCREEN_EXIT');
    }
}

// Handle before unload (refresh/tutup)
function handleBeforeUnload(e) {
    if (examActive && !isRestarting) {
        e.preventDefault();
        e.returnValue = '⚠️ PERINGATAN! Anda sedang dalam ujian mode SAFE EXAM.\n\nJika me-refresh atau menutup halaman, ujian akan diulang dari awal.\n\nApakah Anda yakin?';
        return e.returnValue;
    }
}

// Handle pop state (tombol back)
function handlePopState(e) {
    if (examActive && !isRestarting) {
        handleViolation('BACK_BUTTON');
        history.pushState(null, null, location.href);
        e.preventDefault();
        return false;
    }
}

// Handle pelanggaran
async function handleViolation(reason) {
    if (!examActive || isRestarting) return;
    
    violationCount++;
    
    // Update badge
    updateBadgeStatus(true);
    
    // Tampilkan peringatan
    const warningMessage = `⚠️ PELANGGARAN DETEKSI! ⚠️\n\nPelanggaran: ${formatViolationReason(reason)}\n\nPeringatan: ${violationCount}/${SAFE_EXAM_CONFIG.maxViolations}`;
    
    if (violationCount >= SAFE_EXAM_CONFIG.maxViolations) {
        alert(`${warningMessage}\n\n❌ UJIAN DIHENTIKAN! Anda telah melanggar aturan sebanyak ${violationCount} kali.\n\nUjian akan diulang dari awal.`);
        await saveViolationLog(reason, true);
        await restartExamFromBeginning(reason);
    } else {
        alert(`${warningMessage}\n\n⚠️ HATI-HATI! Jika mencapai ${SAFE_EXAM_CONFIG.maxViolations} pelanggaran, ujian akan diulang dari awal!`);
        await saveViolationLog(reason, false);
        
        // Kembalikan ke mode fullscreen jika keluar
        if (SAFE_EXAM_CONFIG.requireFullscreen && !isFullscreen()) {
            setTimeout(() => requestFullscreen(), 1000);
        }
        
        // Update badge kembali ke normal setelah 3 detik
        setTimeout(() => updateBadgeStatus(false), 3000);
    }
}

// Format pesan pelanggaran
function formatViolationReason(reason) {
    const reasons = {
        'FULLSCREEN_OFF': 'Keluar dari mode layar penuh',
        'FULLSCREEN_EXIT': 'Keluar dari layar penuh',
        'SPLIT_SCREEN': 'Mode split screen / resize',
        'WINDOW_TOO_SMALL': 'Window terlalu kecil',
        'TAB_SWITCH': 'Berpindah ke tab lain',
        'DEVTOOLS_OPEN': 'Membuka Developer Tools',
        'BACK_BUTTON': 'Menekan tombol Back',
        'COPY_ATTEMPT': 'Mencoba copy',
        'PASTE_ATTEMPT': 'Mencoba paste',
        'RIGHT_CLICK': 'Klik kanan',
        'LONG_PRESS': 'Tekan lama (long press)',
        'SHORTCUT': 'Shortcut keyboard terlarang'
    };
    return reasons[reason] || reason;
}

// Aktifkan security blocks
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
        
        const blockedKeys = ['F12', 'F5', 'F11', 'PrintScreen', 'Insert', 'Home', 'End'];
        const blockedCombos = [
            { ctrl: true, key: 'r' }, { ctrl: true, key: 'R' },
            { ctrl: true, key: 'u' }, { ctrl: true, key: 'U' },
            { ctrl: true, key: 's' }, { ctrl: true, key: 'S' },
            { ctrl: true, key: 'p' }, { ctrl: true, key: 'P' },
            { ctrl: true, key: 'c' }, { ctrl: true, key: 'C' },
            { ctrl: true, key: 'v' }, { ctrl: true, key: 'V' },
            { ctrl: true, key: 'x' }, { ctrl: true, key: 'X' },
            { ctrl: true, key: 'a' }, { ctrl: true, key: 'A' },
            { ctrl: true, key: 't' }, { ctrl: true, key: 'T' },
            { ctrl: true, key: 'w' }, { ctrl: true, key: 'W' },
            { ctrl: true, key: 'n' }, { ctrl: true, key: 'N' }
        ];
        
        // Cek tombol individual
        if (blockedKeys.includes(e.key)) {
            e.preventDefault();
            handleViolation('SHORTCUT');
            return false;
        }
        
        // Cek kombinasi Ctrl
        for (const combo of blockedCombos) {
            if (e.ctrlKey === combo.ctrl && e.key === combo.key) {
                e.preventDefault();
                handleViolation('SHORTCUT');
                return false;
            }
        }
        
        // Cek Ctrl+Shift+I (DevTools)
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            e.preventDefault();
            handleViolation('DEVTOOLS_OPEN');
            return false;
        }
        
        // Cek F1 (Help)
        if (e.key === 'F1') {
            e.preventDefault();
            return false;
        }
    });
    
    // Blokir long press di mobile
    let touchTimer = null;
    document.addEventListener('touchstart', (e) => {
        if (!examActive || isRestarting) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        touchTimer = setTimeout(() => {
            handleViolation('LONG_PRESS');
            e.preventDefault();
        }, 500);
    });
    
    document.addEventListener('touchend', () => {
        if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
        }
    });
}

// Request fullscreen
function requestFullscreen() {
    const elem = document.documentElement;
    try {
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }
    } catch(e) {
        console.log('Fullscreen not supported');
    }
}

// Cek fullscreen
function isFullscreen() {
    return !!(document.fullscreenElement || 
              document.webkitFullscreenElement || 
              document.msFullscreenElement);
}

// Exit fullscreen
function exitFullscreen() {
    try {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    } catch(e) {}
}

// Simpan log pelanggaran
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
        console.log('Safe exam log saved:', reason);
    } catch (error) {
        console.error('Error saving log:', error);
    }
}

// Restart ujian dari awal
async function restartExamFromBeginning(reason) {
    if (isRestarting) return;
    
    isRestarting = true;
    examActive = false;
    
    // Hentikan proctoring
    if (proctorInterval) clearInterval(proctorInterval);
    
    // Hapus event listeners
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('popstate', handlePopState);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    // Hentikan timer
    if (timerInterval) clearInterval(timerInterval);
    
    // Keluar dari fullscreen
    exitFullscreen();
    
    // Hapus badge dan watermark
    const badge = document.getElementById('securityBadge');
    if (badge) badge.remove();
    const watermark = document.getElementById('examWatermark');
    if (watermark) watermark.remove();
    
    // Reset variabel
    currentAnswers = {};
    currentQuestionIndex = 0;
    
    // Tampilkan pesan
    alert(`🔄 UJIAN DIULANG DARI AWAL!\n\nPelanggaran: ${formatViolationReason(reason)}\n\nSilakan kerjakan ujian dengan tertib.`);
    
    // Reload ulang ujian
    setTimeout(async () => {
        try {
            const subjectName = currentExam?.mataPelajaran || 'Ujian';
            const examId = currentExam?.id;
            
            // Reset state
            isRestarting = false;
            
            // Mulai ulang ujian
            await startExam(examId, subjectName);
        } catch (error) {
            console.error('Error restarting:', error);
            backToMenu();
        }
    }, 1500);
}

// Stop safe exam mode
function stopSafeExam() {
    examActive = false;
    if (proctorInterval) clearInterval(proctorInterval);
    
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('popstate', handlePopState);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    
    const badge = document.getElementById('securityBadge');
    if (badge) badge.remove();
    const watermark = document.getElementById('examWatermark');
    if (watermark) watermark.remove();
    
    exitFullscreen();
}

// ========== FUNGSI ASLI (TIDAK DIRUBAH) ==========

// Cek login
if (!currentUser || currentUser.role !== 'siswa') {
    window.location.href = 'index.html';
}

// Tampilkan nama user
document.addEventListener('DOMContentLoaded', function() {
    const userNameEl = document.getElementById('userName');
    const kelasSiswaEl = document.getElementById('kelasSiswa');
    
    if (userNameEl) userNameEl.textContent = currentUser.nama || 'Siswa';
    if (kelasSiswaEl) kelasSiswaEl.textContent = currentUser.kelas || '-';
    
    loadSubjects();
});

// Load mata pelajaran
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
        
        examsSnapshot.forEach(doc => {
            const exam = doc.data();
            const totalSoal = (exam.jumlahSoal?.pg || 0) + (exam.jumlahSoal?.isian || 0) + (exam.jumlahSoal?.uraian || 0);
            subjectList.innerHTML += `
                <div class="card" onclick="startExam('${doc.id}', '${exam.mataPelajaran || 'Ujian'}')">
                    <div class="card-icon">📚</div>
                    <h3>${exam.mataPelajaran || 'Mata Pelajaran'}</h3>
                    <p>${totalSoal} Soal</p>
                    <p>Durasi: ${exam.durasi || 60} menit</p>
                    <p style="color: #28a745; font-size: 12px;">🔒 Safe Exam Mode</p>
                </div>
            `;
        });
        
    } catch (error) {
        console.error('Error loading subjects:', error);
        subjectList.innerHTML = '<p style="color: red;">Error loading data</p>';
    }
}

// Mulai ujian
async function startExam(examId, subjectName) {
    try {
        // Cek apakah sudah pernah mengerjakan
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
        
        // Ambil data ujian
        const examDoc = await examsRef.doc(examId).get();
        if (!examDoc.exists) {
            alert('Ujian tidak ditemukan');
            return;
        }
        
        currentExam = { id: examId, ...examDoc.data() };
        
        // Ambil soal
        const questionsSnapshot = await questionsRef
            .where('kelas', '==', currentExam.kelas)
            .where('mataPelajaran', '==', currentExam.mataPelajaran)
            .get();
        
        currentQuestions = questionsSnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            .sort((a, b) => (a.nomor || 0) - (b.nomor || 0));
        
        if (currentQuestions.length === 0) {
            alert('Tidak ada soal untuk ujian ini. Silakan hubungi guru.');
            return;
        }
        
        // Filter soal
        const examJumlahSoal = currentExam.jumlahSoal || {};
        let filteredQuestions = [];
        
        const pgQuestions = currentQuestions.filter(q => q.tipe === 'pg');
        const isianQuestions = currentQuestions.filter(q => q.tipe === 'isian');
        const uraianQuestions = currentQuestions.filter(q => q.tipe === 'uraian');
        
        const pgCount = examJumlahSoal.pg || pgQuestions.length;
        const isianCount = examJumlahSoal.isian || isianQuestions.length;
        const uraianCount = examJumlahSoal.uraian || uraianQuestions.length;
        
        filteredQuestions = [
            ...pgQuestions.slice(0, pgCount),
            ...isianQuestions.slice(0, isianCount),
            ...uraianQuestions.slice(0, uraianCount)
        ];
        
        if (filteredQuestions.length === 0) {
            alert('Tidak ada soal yang sesuai dengan konfigurasi ujian');
            return;
        }
        
        currentQuestions = filteredQuestions;
        
        // Set nilai per soal
        const nilaiPerSoalSetting = currentExam.nilaiPerSoal || {
            pg: 5,
            isian: 5,
            uraian: 5
        };
        
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
        
        // 🔥 AKTIFKAN SAFE EXAM MODE
        initSafeExam();
        
        // Tambahkan class untuk styling
        document.body.classList.add('exam-mode');
        
    } catch (error) {
        console.error('Error starting exam:', error);
        alert('Gagal memulai ujian: ' + error.message);
    }
}

// Timer
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

// Show question
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
                <img src="${question.gambar}" 
                     alt="Gambar soal" 
                     class="question-image"
                     onclick="showImageModal('${question.gambar}')"
                     onerror="this.style.display='none'">
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
            
            if (gambarUrl) {
                questionHtml += `<img src="${gambarUrl}" onerror="this.style.display='none'">`;
            }
            questionHtml += `<span>${pilihanText}</span>`;
            questionHtml += `</div>`;
            questionHtml += `</div>`;
        }
        
        questionHtml += '</div>';
        
    } else if (question.tipe === 'isian') {
        questionHtml += `
            <div class="short-answer">
                <input type="text" 
                       placeholder="Tulis jawaban Anda" 
                       value="${escapeHtml(currentAnswers[question.id] || '')}"
                       onchange="saveShortAnswer('${question.id}', this.value)">
            </div>
        `;
        
    } else if (question.tipe === 'uraian') {
        questionHtml += `
            <div class="essay-answer">
                <textarea placeholder="Tulis jawaban Anda" rows="5"
                          onchange="saveEssay('${question.id}', this.value)">${escapeHtml(currentAnswers[question.id] || '')}</textarea>
            </div>
        `;
    }
    
    questionHtml += `<div class="navigation-buttons">`;
    if (currentQuestionIndex > 0) {
        questionHtml += `<button class="nav-btn prev" onclick="prevQuestion()">← Sebelumnya</button>`;
    } else {
        questionHtml += `<div></div>`;
    }
    
    if (currentQuestionIndex < currentQuestions.length - 1) {
        questionHtml += `<button class="nav-btn next" onclick="nextQuestion()">Selanjutnya →</button>`;
    } else {
        questionHtml += `<button class="nav-btn submit" onclick="submitExam()">Selesai</button>`;
    }
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
    if (modal) {
        modal.style.display = 'none';
    }
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
        
        gridHtml += `
            <div class="question-grid-item ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''}" 
                 onclick="jumpToQuestion(${index})">
                ${index + 1}
            </div>
        `;
    });
    
    grid.innerHTML = gridHtml;
}

// Submit exam
async function submitExam() {
    if (!confirm('Apakah Anda yakin ingin mengumpulkan jawaban?')) {
        return;
    }
    
    // Hentikan safe exam mode
    stopSafeExam();
    
    if (timerInterval) clearInterval(timerInterval);
    
    try {
        const examDoc = await examsRef.doc(currentExam.id).get();
        const examData = examDoc.data();
        
        if (!examData) {
            throw new Error('Data ujian tidak ditemukan');
        }
        
        const nilaiPGPerSoal = examData.nilaiPerSoal?.pg || 5;
        const nilaiIsianPerSoal = examData.nilaiPerSoal?.isian || 5;
        const nilaiUraianPerSoal = examData.nilaiPerSoal?.uraian || 5;
        
        const jawabanPG = {};
        const jawabanIsian = {};
        const jawabanUraian = {};
        
        let nilaiPG = 0;
        let nilaiIsian = 0;
        let jmlPG = 0;
        let jmlIsian = 0;
        let jmlUraian = 0;
        
        for (const question of currentQuestions) {
            const jawabanSiswa = currentAnswers[question.id];
            const kunci = question.kunci;
            const tipe = question.tipe;
            
            if (tipe === 'pg') {
                jmlPG++;
                jawabanPG[question.id] = {
                    jawaban: jawabanSiswa || '',
                    kunci: kunci || '',
                    nomor: question.nomor,
                    soal: question.soal,
                    pilihan: question.pilihan || []
                };
                
                if (jawabanSiswa && kunci) {
                    const jawabanHuruf = String(jawabanSiswa).trim().toUpperCase();
                    const kunciHuruf = String(kunci).trim().toUpperCase();
                    if (jawabanHuruf === kunciHuruf) {
                        nilaiPG += nilaiPGPerSoal;
                    }
                }
            } 
            else if (tipe === 'isian') {
                jmlIsian++;
                jawabanIsian[question.id] = {
                    jawaban: jawabanSiswa || '',
                    kunci: kunci || '',
                    nomor: question.nomor,
                    soal: question.soal
                };
                
                if (jawabanSiswa && kunci) {
                    const jawabanStr = String(jawabanSiswa).toLowerCase().trim();
                    const kunciStr = String(kunci).toLowerCase().trim();
                    if (jawabanStr === kunciStr) {
                        nilaiIsian += nilaiIsianPerSoal;
                    }
                }
            }
            else if (tipe === 'uraian') {
                jmlUraian++;
                jawabanUraian[question.id] = {
                    jawaban: jawabanSiswa || '',
                    soal: question.soal,
                    nilaiMaksimal: nilaiUraianPerSoal,
                    nilaiDiperoleh: 0,
                    nomor: question.nomor
                };
            }
        }
        
        const totalPG = jmlPG * nilaiPGPerSoal;
        const totalIsian = jmlIsian * nilaiIsianPerSoal;
        const totalUraian = jmlUraian * nilaiUraianPerSoal;
        
        const jumlahNilaiDiperoleh = nilaiPG + nilaiIsian;
        const jumlahNilaiMaksimal = totalPG + totalIsian + totalUraian;
        
        let nilaiSementara = 0;
        if (jumlahNilaiMaksimal > 0) {
            nilaiSementara = (jumlahNilaiDiperoleh / jumlahNilaiMaksimal) * 100;
            nilaiSementara = Math.round(nilaiSementara);
        }
        
        await answersRef.add({
            examId: currentExam.id,
            siswaId: currentUser.id,
            siswaNama: currentUser.nama,
            nis: currentUser.nis || '',
            kelas: currentUser.kelas,
            mataPelajaran: currentExam.mataPelajaran,
            
            jawabanPG: jawabanPG,
            jawabanIsian: jawabanIsian,
            jawabanUraian: jawabanUraian,
            
            nilaiPG: nilaiPG,
            nilaiIsian: nilaiIsian,
            nilaiUraian: 0,
            totalPG: totalPG,
            totalIsian: totalIsian,
            totalUraian: totalUraian,
            
            jumlahSoal: {
                pg: jmlPG,
                isian: jmlIsian,
                uraian: jmlUraian
            },
            
            nilaiSementara: nilaiSementara,
            statusKoreksi: jmlUraian > 0 ? 'pending' : 'selesai',
            statusSubmit: 'normal',
            safeExamActive: true,
            waktu: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        if (jmlUraian > 0) {
            alert('Jawaban berhasil dikumpulkan!\nNilai Sementara: ' + nilaiSementara + '\n(Soal uraian menunggu koreksi)');
        } else {
            alert('Jawaban berhasil dikumpulkan!\nNilai Akhir: ' + nilaiSementara);
        }
        showResults(nilaiPG, nilaiIsian, totalPG, totalIsian);
        
        // Hapus class exam mode
        document.body.classList.remove('exam-mode');
        
    } catch (error) {
        console.error('Error submitting exam:', error);
        alert('Gagal mengumpulkan jawaban: ' + error.message);
    }
}

function showResults(nilaiPG, nilaiIsian, totalPG, totalIsian) {
    const examPage = document.getElementById('examPage');
    const resultPage = document.getElementById('resultPage');
    
    if (examPage) examPage.style.display = 'none';
    if (resultPage) resultPage.style.display = 'block';
    
    const resultPG = document.getElementById('resultPG');
    const resultIsian = document.getElementById('resultIsian');
    const resultUraian = document.getElementById('resultUraian');
    const resultTotal = document.getElementById('resultTotal');
    
    if (resultPG) resultPG.textContent = nilaiPG + ' / ' + totalPG;
    if (resultIsian) resultIsian.textContent = nilaiIsian + ' / ' + totalIsian;
    if (resultUraian) resultUraian.textContent = 'Menunggu koreksi guru';
    if (resultTotal) resultTotal.textContent = (nilaiPG + nilaiIsian) + ' / ' + (totalPG + totalIsian);
}

// backToMenu
function backToMenu() {
    stopSafeExam();
    
    const resultPage = document.getElementById('resultPage');
    const mainMenu = document.getElementById('mainMenu');
    
    if (resultPage) resultPage.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'block';
    
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
    
    if (!url && gambarSoal) {
        url = gambarSoal;
    }
    
    if (url && url.includes('drive.google.com')) {
        let id = null;
        let match = url.match(/id=([^&]+)/);
        if (match) id = match[1];
        
        if (!id) {
            match = url.match(/\/d\/([^\/]+)/);
            if (match) id = match[1];
        }
        
        if (id) {
            url = `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
        }
    }
    
    return url;
}
