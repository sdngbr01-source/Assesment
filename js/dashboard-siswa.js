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
    
    loadSubjects();
});

// Load mata pelajaran yang tersedia
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
        
        console.log('Data Exam:', {
            mataPelajaran: currentExam.mataPelajaran,
            nilaiPerSoal: currentExam.nilaiPerSoal
        });
        
        // Ambil soal
        const questionsSnapshot = await questionsRef
            .where('examId', '==', examId)
            .get();
        
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
        
        // Set nilai per soal dari exam setting
        const nilaiPerSoalSetting = currentExam.nilaiPerSoal || {
            pg: 5,
            isian: 5,
            uraian: 5
        };
        
        // Update nilai per soal
        currentQuestions = currentQuestions.map(question => {
            if (!question.nilai) {
                if (question.tipe === 'pg') question.nilai = nilaiPerSoalSetting.pg;
                else if (question.tipe === 'isian') question.nilai = nilaiPerSoalSetting.isian;
                else if (question.tipe === 'uraian') question.nilai = nilaiPerSoalSetting.uraian;
            }
            return question;
        });
        
        console.log('Soal dengan nilai:', currentQuestions.map(q => ({tipe: q.tipe, nilai: q.nilai, nomor: q.nomor})));
        
        currentAnswers = {};
        currentQuestionIndex = 0;
        
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('examPage').style.display = 'block';
        document.getElementById('examSubject').textContent = subjectName;
        
        startTimer((currentExam.durasi || 60) * 60);
        showQuestion();
        updateQuestionGrid();
        
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
            <div class="question-image-container" style="margin: 15px 0; text-align: center;">
                <img src="${question.gambar}" 
                     alt="Gambar soal" 
                     style="max-width: 100%; max-height: 200px; border-radius: 8px;">
            </div>
        `;
    }
    
    questionHtml += `<div class="question-text">${question.soal || 'Soal tidak tersedia'}</div>`;
    
    if (question.tipe === 'pg') {
        questionHtml += '<div class="options">';
        const optionLetters = ['A', 'B', 'C', 'D'];
        const pilihan = question.pilihan || [];
        
        pilihan.forEach((pilihanText, index) => {
            if (!pilihanText) return;
            const optionLetter = optionLetters[index];
            const isSelected = currentAnswers[question.id] === optionLetter;
            
            questionHtml += `
                <div class="option ${isSelected ? 'selected' : ''}" 
                     onclick="selectOption('${question.id}', '${optionLetter}')">
                    <div class="option-marker">${optionLetter}</div>
                    <div class="option-text">${optionLetter}. ${pilihanText}</div>
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
            ${currentQuestionIndex > 0 ? '<button class="nav-btn prev" onclick="prevQuestion()">← Sebelumnya</button>' : '<div></div>'}
            ${currentQuestionIndex < currentQuestions.length - 1 ? 
                '<button class="nav-btn next" onclick="nextQuestion()">Selanjutnya →</button>' : 
                '<button class="nav-btn submit" onclick="submitExam()">Selesai</button>'}
        </div>
    `;
    
    container.innerHTML = questionHtml;
}

// dashboard-siswa.js - Fungsi penyimpanan jawaban

function selectOption(questionId, answer) {
    currentAnswers[questionId] = answer;
    showQuestion();
    updateQuestionGrid();
}

function saveShortAnswer(questionId, value) {
    // Pastikan value adalah string
    currentAnswers[questionId] = value || '';
    updateQuestionGrid();
}

function saveEssay(questionId, value) {
    // Pastikan value adalah string
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

// dashboard-siswa.js - SUBMIT EXAM YANG BENAR

async function submitExam() {
    if (!confirm('Apakah Anda yakin ingin mengumpulkan jawaban?')) {
        return;
    }
    
    if (timerInterval) clearInterval(timerInterval);
    
    try {
        // Ambil data ujian
        const examDoc = await examsRef.doc(currentExam.id).get();
        const examData = examDoc.data();
        
        if (!examData) {
            throw new Error('Data ujian tidak ditemukan');
        }
        
        // Ambil nilai per soal dari setting ujian
        const nilaiPGPerSoal = examData.nilaiPerSoal?.pg || 5;
        const nilaiIsianPerSoal = examData.nilaiPerSoal?.isian || 5;
        const nilaiUraianPerSoal = examData.nilaiPerSoal?.uraian || 5;
        
        // STRUKTUR JAWABAN TERPISAH
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
                // Simpan jawaban PG (huruf A/B/C/D)
                jawabanPG[question.id] = {
                    jawaban: jawabanSiswa || '',
                    kunci: kunci || '',
                    nomor: question.nomor,
                    soal: question.soal,
                    pilihan: question.pilihan || []
                };
                
                // Hitung nilai - bandingkan huruf (A, B, C, D)
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
                    nomor: question.nomor
                };
            }
        }
        
        // Hitung total maksimal
        const totalPG = jmlPG * nilaiPGPerSoal;
        const totalIsian = jmlIsian * nilaiIsianPerSoal;
        const totalUraian = jmlUraian * nilaiUraianPerSoal;
        
        console.log('📊 Hasil perhitungan:', {
            jmlPG, jmlIsian, jmlUraian,
            nilaiPG, totalPG,
            nilaiIsian, totalIsian,
            totalUraian
        });
        
        // SIMPAN KE FIRESTORE
        await answersRef.add({
            examId: currentExam.id,
            siswaId: currentUser.id,
            siswaNama: currentUser.nama,
            nis: currentUser.nis || '',
            kelas: currentUser.kelas,
            mataPelajaran: currentExam.mataPelajaran,
            
            // JAWABAN TERPISAH
            jawabanPG: jawabanPG,
            jawabanIsian: jawabanIsian,
            jawabanUraian: jawabanUraian,
            
            // Nilai
            nilaiPG: nilaiPG,
            nilaiIsian: nilaiIsian,
            nilaiUraian: 0,
            totalPG: totalPG,
            totalIsian: totalIsian,
            totalUraian: totalUraian,
            
            // Jumlah soal
            jumlahSoal: {
                pg: jmlPG,
                isian: jmlIsian,
                uraian: jmlUraian
            },
            
            // Status
            statusKoreksi: jmlUraian > 0 ? 'pending' : 'selesai',
            
            // Waktu
            waktu: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('✅ Jawaban berhasil dikumpulkan!');
        showResults(nilaiPG, nilaiIsian, totalPG, totalIsian);
        
    } catch (error) {
        console.error('❌ Error submitting exam:', error);
        alert('❌ Gagal mengumpulkan jawaban: ' + error.message);
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
    
    if (resultPG) resultPG.textContent = `${nilaiPG} / ${totalPG}`;
    if (resultIsian) resultIsian.textContent = `${nilaiIsian} / ${totalIsian}`;
    if (resultUraian) resultUraian.textContent = 'Menunggu koreksi guru';
    if (resultTotal) resultTotal.textContent = `${nilaiPG + nilaiIsian} / ${totalPG + totalIsian}`;
}

function backToMenu() {
    document.getElementById('resultPage').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'block';
    loadSubjects();
}

function logout() {
    if (confirm('Apakah Anda yakin ingin logout?')) {
        if (timerInterval) clearInterval(timerInterval);
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}