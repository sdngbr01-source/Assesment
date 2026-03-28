// dashboard-siswa.js

// Ambil data user dari sessionStorage
const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
let currentExam = null;
let currentQuestions = [];
let currentAnswers = {};
let currentQuestionIndex = 0;
let timerInterval = null;

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
    
    // Load mata pelajaran
    loadSubjects();
});

// Load mata pelajaran yang tersedia
async function loadSubjects() {
    const subjectList = document.getElementById('subjectList');
    if (!subjectList) return;
    
    subjectList.innerHTML = '<p>Loading...</p>';
    
    try {
        // Query sederhana tanpa orderBy dulu
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
            subjectList.innerHTML += `
                <div class="card" onclick="startExam('${doc.id}', '${exam.mataPelajaran || 'Ujian'}')">
                    <div class="card-icon">📚</div>
                    <h3>${exam.mataPelajaran || 'Mata Pelajaran'}</h3>
                    <p>${exam.jumlahSoal ? exam.jumlahSoal.pg + exam.jumlahSoal.isian + exam.jumlahSoal.uraian : '0'} Soal</p>
                    <p>Durasi: ${exam.durasi || 60} menit</p>
                </div>
            `;
        });
        
    } catch (error) {
        console.error('Error loading subjects:', error);
        subjectList.innerHTML = '<p style="color: red;">Error loading data. Cek koneksi dan index Firestore.</p>';
    }
}

// Mulai ujian
async function startExam(examId, subjectName) {
    try {
        // Cek apakah sudah pernah mengerjakan - QUERY SEDERHANA
        const existingAnswer = await answersRef
            .where('examId', '==', examId)
            .where('siswaId', '==', currentUser.id)
            .limit(1)
            .get();
        
        if (!existingAnswer.empty) {
            alert('Anda sudah mengerjakan ujian ini!');
            return;
        }
        
        // Ambil data ujian
        const examDoc = await examsRef.doc(examId).get();
        if (!examDoc.exists) {
            alert('Ujian tidak ditemukan');
            return;
        }
        
        currentExam = { id: examId, ...examDoc.data() };
        
        // Ambil soal - TANPA ORDERBY dulu untuk menghindari index
        const questionsSnapshot = await questionsRef
            .where('examId', '==', examId)
            .get();
        
        // Urutkan manual di client
        currentQuestions = questionsSnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            .sort((a, b) => (a.nomor || 0) - (b.nomor || 0));
        
        if (currentQuestions.length === 0) {
            alert('Tidak ada soal untuk ujian ini');
            return;
        }
        
        // Inisialisasi jawaban
        currentAnswers = {};
        currentQuestionIndex = 0;
        
        // Tampilkan halaman ujian
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('examPage').style.display = 'block';
        document.getElementById('examSubject').textContent = subjectName;
        
        // Mulai timer
        startTimer((currentExam.durasi || 60) * 60);
        
        // Tampilkan soal pertama
        showQuestion();
        updateQuestionGrid();
        
    } catch (error) {
        console.error('Error starting exam:', error);
        
        // Deteksi error index
        if (error.code === 'failed-precondition' && error.message.includes('index')) {
            alert('Database perlu diindex. Silakan hubungi admin.');
            console.log('Buat index di:', error.message.match(/https:\/\/[^\s]+/));
        } else {
            alert('Gagal memulai ujian: ' + error.message);
        }
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

// Tampilkan soal
// Fungsi showQuestion yang diperbaiki
function showQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    const container = document.getElementById('questionContainer');
    
    if (!question || !container) return;
    
    let questionHtml = `
        <div class="question-number">Soal ${currentQuestionIndex + 1} dari ${currentQuestions.length}</div>
    `;
    
    // Tampilkan gambar jika ada - DIPERBAIKI
    if (question.gambar && question.gambar.trim() !== '') {
        const gambarUrl = question.gambar.trim();
        console.log('Menampilkan gambar:', gambarUrl); // Untuk debugging
        
        questionHtml += `
            <div class="question-image-container" style="margin: 15px 0; text-align: center;">
                <img src="${gambarUrl}" 
                     alt="Gambar soal" 
                     class="question-image"
                     style="max-width: 100%; max-height: 300px; border: 1px solid #ddd; border-radius: 8px; padding: 5px;"
                     onload="this.style.display='block'"
                     onerror="this.onerror=null; this.src=''; this.parentElement.innerHTML='<div style=\'color: red; padding: 10px; border: 1px dashed red;\'>❌ Gambar tidak dapat dimuat</div>';">
                <p style="font-size: 12px; color: #666; margin-top: 5px;">Klik gambar untuk memperbesar</p>
            </div>
        `;
    }
    
    questionHtml += `<div class="question-text">${question.soal || 'Soal tidak tersedia'}</div>`;
    
    // Sisanya tetap sama...
    if (question.tipe === 'pg') {
        questionHtml += '<div class="options">';
        const optionLetters = ['A', 'B', 'C', 'D'];
        const pilihan = question.pilihan || [];
        
        pilihan.forEach((pilihanText, index) => {
            if (!pilihanText) return;
            
            const isSelected = currentAnswers[question.id] === pilihanText;
            const optionLetter = optionLetters[index];
            
            questionHtml += `
                <div class="option ${isSelected ? 'selected' : ''}" 
                     onclick="selectOption('${question.id}', '${pilihanText.replace(/'/g, "\\'")}')">
                    <div class="option-marker">${optionLetter}</div>
                    <div class="option-text">${pilihanText}</div>
                </div>
            `;
        });
        questionHtml += '</div>';
        
    } else if (question.tipe === 'isian') {
        questionHtml += `
            <div class="short-answer">
                <input type="text" 
                       placeholder="Tulis jawaban Anda" 
                       value="${currentAnswers[question.id] || ''}"
                       onchange="saveShortAnswer('${question.id}', this.value)">
            </div>
        `;
        
    } else if (question.tipe === 'uraian') {
        questionHtml += `
            <div class="essay-answer">
                <textarea placeholder="Tulis jawaban Anda" rows="5"
                          onchange="saveEssay('${question.id}', this.value)">${currentAnswers[question.id] || ''}</textarea>
            </div>
        `;
    }
    
    questionHtml += `
        <div class="navigation-buttons">
            ${currentQuestionIndex > 0 ? 
                '<button class="nav-btn prev" onclick="prevQuestion()">← Sebelumnya</button>' : 
                '<div></div>'}
            ${currentQuestionIndex < currentQuestions.length - 1 ? 
                '<button class="nav-btn next" onclick="nextQuestion()">Selanjutnya →</button>' : 
                '<button class="nav-btn submit" onclick="submitExam()">Selesai</button>'}
        </div>
    `;
    
    container.innerHTML = questionHtml;
    
    // Tambahkan event listener untuk memperbesar gambar
    const img = container.querySelector('.question-image');
    if (img) {
        img.addEventListener('click', function() {
            showImageModal(this.src);
        });
    }
}

// Fungsi untuk menampilkan modal gambar
function showImageModal(imageUrl) {
    // Hapus modal lama jika ada
    const oldModal = document.getElementById('imageModal');
    if (oldModal) oldModal.remove();
    
    // Buat modal baru
    const modal = document.createElement('div');
    modal.id = 'imageModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        cursor: pointer;
    `;
    
    modal.innerHTML = `
        <img src="${imageUrl}" style="max-width: 90%; max-height: 90%; object-fit: contain;">
        <span style="position: absolute; top: 20px; right: 30px; color: white; font-size: 30px; cursor: pointer;">&times;</span>
    `;
    
    modal.onclick = function() {
        this.remove();
    };
    
    document.body.appendChild(modal);
}

// Fungsi-fungsi navigasi
function selectOption(questionId, answer) {
    currentAnswers[questionId] = answer;
    showQuestion();
    updateQuestionGrid();
}

function saveShortAnswer(questionId, value) {
    currentAnswers[questionId] = value;
    updateQuestionGrid();
}

function saveEssay(questionId, value) {
    currentAnswers[questionId] = value;
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

// Submit ujian
async function submitExam() {
    if (!confirm('Apakah Anda yakin ingin mengumpulkan jawaban?')) {
        return;
    }
    
    if (timerInterval) clearInterval(timerInterval);
    
    try {
        // Hitung nilai otomatis untuk PG dan Isian
        let nilaiPG = 0;
        let nilaiIsian = 0;
        let totalPG = 0;
        let totalIsian = 0;
        
        currentQuestions.forEach(question => {
            const jawabanSiswa = currentAnswers[question.id];
            
            if (question.tipe === 'pg') {
                totalPG += question.nilai || 1;
                if (jawabanSiswa === question.kunci) {
                    nilaiPG += question.nilai || 1;
                }
            } else if (question.tipe === 'isian') {
                totalIsian += question.nilai || 2;
                if (jawabanSiswa && jawabanSiswa.toLowerCase().trim() === (question.kunci || '').toLowerCase().trim()) {
                    nilaiIsian += question.nilai || 2;
                }
            }
        });
        
        // Simpan jawaban
        await answersRef.add({
            examId: currentExam.id,
            siswaId: currentUser.id,
            siswaNama: currentUser.nama,
            kelas: currentUser.kelas,
            mataPelajaran: currentExam.mataPelajaran,
            jawaban: currentAnswers,
            nilaiPG: nilaiPG,
            nilaiIsian: nilaiIsian,
            totalPG: totalPG,
            totalIsian: totalIsian,
            statusKoreksi: 'pending',
            waktu: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Tampilkan hasil
        showResults(nilaiPG, nilaiIsian, totalPG, totalIsian);
        
    } catch (error) {
        console.error('Error submitting exam:', error);
        alert('Gagal mengumpulkan jawaban: ' + error.message);
    }
}

// Tampilkan hasil
function showResults(nilaiPG, nilaiIsian, totalPG, totalIsian) {
    document.getElementById('examPage').style.display = 'none';
    document.getElementById('resultPage').style.display = 'block';
    
    document.getElementById('resultPG').textContent = `${nilaiPG} / ${totalPG}`;
    document.getElementById('resultIsian').textContent = `${nilaiIsian} / ${totalIsian}`;
    document.getElementById('resultUraian').textContent = 'Menunggu koreksi';
    document.getElementById('resultTotal').textContent = `${nilaiPG + nilaiIsian} / ${totalPG + totalIsian}`;
}

// Kembali ke menu
function backToMenu() {
    document.getElementById('resultPage').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'block';
    loadSubjects();
}

// Logout
function logout() {
    if (confirm('Apakah Anda yakin ingin logout?')) {
        if (timerInterval) clearInterval(timerInterval);
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}