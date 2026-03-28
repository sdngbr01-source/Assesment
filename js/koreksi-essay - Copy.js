// Load siswa untuk filter koreksi
async function loadSiswaForKoreksi() {
    const kelas = document.getElementById('filterKelasKoreksi').value;
    const selectSiswa = document.getElementById('filterSiswaKoreksi');
    
    if (!kelas) {
        selectSiswa.innerHTML = '<option value="">Pilih Kelas Dulu</option>';
        return;
    }
    
    try {
        const snapshot = await usersRef
            .where('kelas', '==', kelas)
            .where('role', '==', 'siswa')
            .get();
        
        selectSiswa.innerHTML = '<option value="">Pilih Siswa</option>';
        
        snapshot.forEach(doc => {
            const siswa = doc.data();
            selectSiswa.innerHTML += `<option value="${doc.id}">${siswa.nama} (${siswa.nis})</option>`;
        });
        
    } catch (error) {
        console.error('Error loading siswa:', error);
    }
}

// Load jawaban untuk dikoreksi
async function loadJawabanKoreksi() {
    const siswaId = document.getElementById('filterSiswaKoreksi').value;
    const jawabanList = document.getElementById('jawabanList');
    
    if (!siswaId) {
        alert('Pilih siswa terlebih dahulu!');
        return;
    }
    
    try {
        // Ambil jawaban siswa yang belum selesai dikoreksi (uraian)
        const snapshot = await answersRef
            .where('siswaId', '==', siswaId)
            .where('statusKoreksi', '==', 'pending')
            .get();
        
        if (snapshot.empty) {
            jawabanList.innerHTML = '<p>Tidak ada jawaban yang perlu dikoreksi</p>';
            return;
        }
        
        let html = '';
        
        for (const doc of snapshot) {
            const jawaban = doc.data();
            
            // Ambil soal uraian
            const questionsSnapshot = await questionsRef
                .where('examId', '==', jawaban.examId)
                .where('tipe', '==', 'uraian')
                .get();
            
            html += `<h3>${jawaban.mataPelajaran}</h3>`;
            
            questionsSnapshot.forEach(questionDoc => {
                const question = questionDoc.data();
                const jawabanSiswa = jawaban.jawaban[questionDoc.id] || '';
                
                html += `
                    <div class="jawaban-item" data-answer-id="${doc.id}" data-question-id="${questionDoc.id}">
                        <p><strong>Soal:</strong> ${question.soal}</p>
                        <p><strong>Jawaban Siswa:</strong> ${jawabanSiswa}</p>
                        <p><strong>Kunci:</strong> ${question.kunci || '-'}</p>
                        <div class="koreksi-actions">
                            <label>
                                <input type="checkbox" class="jawaban-benar" onchange="toggleJawabanBenar(this, '${doc.id}', '${questionDoc.id}')">
                                Benar
                            </label>
                            <input type="number" class="poin-jawaban" placeholder="Poin" min="0" value="0">
                            <button class="btn btn-primary" onclick="simpanKoreksi('${doc.id}', '${questionDoc.id}')">Simpan</button>
                        </div>
                        <hr>
                    </div>
                `;
            });
        }
        
        jawabanList.innerHTML = html || '<p>Tidak ada jawaban yang perlu dikoreksi</p>';
        
    } catch (error) {
        console.error('Error loading jawaban:', error);
        jawabanList.innerHTML = '<p>Error loading data</p>';
    }
}

// Toggle jawaban benar
function toggleJawabanBenar(checkbox, answerId, questionId) {
    const poinInput = checkbox.closest('.koreksi-actions').querySelector('.poin-jawaban');
    if (checkbox.checked) {
        // Jika dicentang benar, set poin maksimal (bisa diambil dari setting)
        poinInput.value = 3; // Default nilai uraian
        poinInput.disabled = true;
    } else {
        poinInput.value = 0;
        poinInput.disabled = false;
    }
}

// Simpan koreksi
async function simpanKoreksi(answerId, questionId) {
    const jawabanItem = event.target.closest('.jawaban-item');
    const isBenar = jawabanItem.querySelector('.jawaban-benar').checked;
    const poin = parseInt(jawabanItem.querySelector('.poin-jawaban').value) || 0;
    
    try {
        // Ambil data jawaban
        const answerDoc = await answersRef.doc(answerId).get();
        const answerData = answerDoc.data();
        
        // Update nilai uraian
        const currentNilaiUraian = answerData.nilaiUraian || 0;
        const newNilaiUraian = isBenar ? (answerData.totalUraian || 3) : poin;
        
        await answersRef.doc(answerId).update({
            nilaiUraian: newNilaiUraian,
            statusKoreksi: 'selesai',
            koreksi: {
                [questionId]: {
                    benar: isBenar,
                    poin: poin
                }
            }
        });
        
        alert('Koreksi berhasil disimpan');
        loadJawabanKoreksi(); // Reload
        
    } catch (error) {
        console.error('Error saving koreksi:', error);
        alert('Gagal menyimpan koreksi');
    }
}

// Event listeners
document.getElementById('filterKelasKoreksi')?.addEventListener('change', loadSiswaForKoreksi);