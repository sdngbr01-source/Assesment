// koreksi-essay.js
// Manajemen koreksi jawaban essay

// Fungsi escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load siswa untuk filter koreksi
async function loadSiswaForKoreksi() {
    const kelas = document.getElementById('filterKelasKoreksi')?.value;
    const siswaSelect = document.getElementById('filterSiswaKoreksi');
    
    if (!siswaSelect) return;
    
    if (!kelas) {
        siswaSelect.innerHTML = '<option value="">Pilih Kelas Dulu</option>';
        return;
    }
    
    siswaSelect.innerHTML = '<option value="">Loading siswa...</option>';
    
    try {
        const snapshot = await usersRef
            .where('kelas', '==', kelas)
            .where('role', '==', 'siswa')
            .get();
        
        siswaSelect.innerHTML = '<option value="">Pilih Siswa</option>';
        
        if (snapshot.empty) {
            siswaSelect.innerHTML = '<option value="">Tidak ada siswa di kelas ini</option>';
            return;
        }
        
        snapshot.forEach(doc => {
            const siswa = doc.data();
            siswaSelect.innerHTML += `
                <option value="${doc.id}">${escapeHtml(siswa.nama || 'Tanpa Nama')} (${escapeHtml(siswa.nis || '-')})</option>
            `;
        });
        
    } catch (error) {
        console.error('Error loading siswa:', error);
        siswaSelect.innerHTML = '<option value="">Error loading siswa</option>';
    }
}

// Render jawaban essay
function renderJawabanEssay(jawabanUraian, jawabanId) {
    if (!jawabanUraian || Object.keys(jawabanUraian).length === 0) {
        return '<p><em>Tidak ada jawaban essay</em></p>';
    }
    
    let html = '';
    let no = 1;
    
    const sortedEssays = Object.entries(jawabanUraian).sort((a, b) => {
        return (a[1].nomor || 0) - (b[1].nomor || 0);
    });
    
    for (const [questionId, data] of sortedEssays) {
        const jawaban = data.jawaban || '';
        const nilaiMaksimal = data.nilaiMaksimal || 5;
        const soal = data.soal || 'Soal tidak tersedia';
        
        html += `
            <div class="essay-item" style="margin-bottom: 20px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
                <p><strong>Soal Essay ${no++}:</strong></p>
                <p style="margin-left: 15px; color: #333; font-style: italic;">${escapeHtml(soal)}</p>
                <p><strong>Jawaban Siswa:</strong></p>
                <div class="essay-answer" style="margin-left: 15px; padding: 10px; background: white; border-left: 3px solid #007bff; white-space: pre-wrap;">
                    ${escapeHtml(jawaban) || '<em style="color: #999;">Tidak dijawab</em>'}
                </div>
                <p><strong>Nilai Maksimal:</strong> ${nilaiMaksimal}</p>
                <input type="hidden" id="nilaiMaksimal-${jawabanId}-${questionId}" value="${nilaiMaksimal}">
            </div>
        `;
    }
    
    return html;
}

// Render field koreksi
function renderKoreksiFields(jawabanUraian, jawabanId) {
    if (!jawabanUraian || Object.keys(jawabanUraian).length === 0) {
        return '<p>Tidak ada jawaban untuk dikoreksi</p>';
    }
    
    let html = '';
    let no = 1;
    
    const sortedEssays = Object.entries(jawabanUraian).sort((a, b) => {
        return (a[1].nomor || 0) - (b[1].nomor || 0);
    });
    
    for (const [questionId, data] of sortedEssays) {
        const nilaiMaksimal = data.nilaiMaksimal || 5;
        
        html += `
            <div class="koreksi-item" style="margin-bottom: 15px; padding: 10px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <label><strong>Soal Essay ${no++}</strong></label>
                <div style="margin-top: 5px;">
                    <input type="number" 
                           id="nilai-${jawabanId}-${questionId}" 
                           placeholder="Nilai (0-${nilaiMaksimal})"
                           min="0" 
                           max="${nilaiMaksimal}" 
                           step="1"
                           value="0"
                           class="nilai-input"
                           style="width: 150px; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <span style="margin-left: 10px; color: #666;">/ ${nilaiMaksimal}</span>
                </div>
                <textarea id="catatan-${jawabanId}-${questionId}" 
                          placeholder="Catatan koreksi (opsional)"
                          rows="2"
                          style="width: 100%; margin-top: 5px; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
            </div>
        `;
    }
    
    return html;
}

// Load jawaban untuk dikoreksi
async function loadJawabanKoreksi() {
    const kelas = document.getElementById('filterKelasKoreksi')?.value;
    const siswaId = document.getElementById('filterSiswaKoreksi')?.value;
    const jawabanList = document.getElementById('jawabanList');
    
    if (!jawabanList) return;
    
    if (!kelas || !siswaId) {
        jawabanList.innerHTML = '<p style="padding: 20px; text-align: center;">Pilih kelas dan siswa terlebih dahulu</p>';
        return;
    }
    
    jawabanList.innerHTML = '<p style="padding: 20px; text-align: center;">Loading jawaban...</p>';
    
    try {
        const snapshot = await answersRef
            .where('siswaId', '==', siswaId)
            .where('statusKoreksi', '==', 'pending')
            .get();
        
        if (snapshot.empty) {
            jawabanList.innerHTML = '<p style="padding: 20px; text-align: center;">Tidak ada jawaban essay yang perlu dikoreksi</p>';
            return;
        }
        
        let html = '';
        let no = 1;
        
        for (const doc of snapshot.docs) {
            const jawaban = doc.data();
            const jawabanUraian = jawaban.jawabanUraian || {};
            
            if (Object.keys(jawabanUraian).length === 0) continue;
            
            html += `
                <div class="jawaban-card" data-jawaban-id="${doc.id}" style="margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; padding: 15px; background: white;">
                    <div class="jawaban-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                        <h3 style="margin: 0;">${no++}. ${escapeHtml(jawaban.mataPelajaran || 'Mata Pelajaran')}</h3>
                        <span class="badge" style="background: #ffc107; color: #000; padding: 5px 10px; border-radius: 20px;">Menunggu Koreksi</span>
                    </div>
                    <div class="jawaban-info" style="margin: 10px 0; color: #666;">
                        <p><strong>Siswa:</strong> ${escapeHtml(jawaban.siswaNama || '-')}</p>
                        <p><strong>NIS:</strong> ${escapeHtml(jawaban.nis || '-')}</p>
                        <p><strong>Kelas:</strong> ${escapeHtml(jawaban.kelas || '-')}</p>
                        <p><strong>Waktu:</strong> ${jawaban.waktu ? new Date(jawaban.waktu.toDate()).toLocaleString() : '-'}</p>
                        <p><strong>Nilai PG:</strong> ${jawaban.nilaiPG || 0} / ${jawaban.totalPG || 0}</p>
                        <p><strong>Nilai Isian:</strong> ${jawaban.nilaiIsian || 0} / ${jawaban.totalIsian || 0}</p>
                    </div>
                    <div class="jawaban-detail">
                        <h4>📝 Jawaban Essay:</h4>
                        <div id="jawabanEssay-${doc.id}">
                            ${renderJawabanEssay(jawabanUraian, doc.id)}
                        </div>
                    </div>
                    <div class="koreksi-form" style="margin-top: 15px;">
                        <h4>✏️ Koreksi:</h4>
                        <div id="koreksiFields-${doc.id}">
                            ${renderKoreksiFields(jawabanUraian, doc.id)}
                        </div>
                        <button class="btn btn-primary" onclick="simpanKoreksi('${doc.id}')" style="margin-top: 10px;">
                            💾 Simpan Koreksi
                        </button>
                    </div>
                </div>
            `;
        }
        
        if (html === '') {
            jawabanList.innerHTML = '<p style="padding: 20px; text-align: center;">Tidak ada jawaban essay yang perlu dikoreksi</p>';
        } else {
            jawabanList.innerHTML = html;
        }
        
    } catch (error) {
        console.error('❌ Error loading jawaban:', error);
        jawabanList.innerHTML = `<p style="padding: 20px; text-align: center; color: red;">Error: ${error.message}</p>`;
    }
}

// Simpan koreksi
async function simpanKoreksi(jawabanId) {
    if (!confirm('Apakah Anda yakin ingin menyimpan koreksi ini?')) {
        return;
    }
    
    try {
        const jawabanDoc = await answersRef.doc(jawabanId).get();
        
        if (!jawabanDoc.exists) {
            alert('Data jawaban tidak ditemukan');
            return;
        }
        
        const jawaban = jawabanDoc.data();
        const jawabanUraian = jawaban.jawabanUraian || {};
        
        let nilaiUraian = 0;
        let totalUraian = jawaban.totalUraian || 0;
        const koreksiDetail = {};
        
        for (const [questionId, data] of Object.entries(jawabanUraian)) {
            const nilaiInput = document.getElementById(`nilai-${jawabanId}-${questionId}`);
            
            if (nilaiInput) {
                let nilai = parseInt(nilaiInput.value) || 0;
                const nilaiMaksimal = data.nilaiMaksimal || 5;
                
                if (nilai > nilaiMaksimal) nilai = nilaiMaksimal;
                if (nilai < 0) nilai = 0;
                
                nilaiUraian += nilai;
                
                koreksiDetail[questionId] = {
                    nilai: nilai,
                    nilaiMaksimal: nilaiMaksimal,
                    catatan: document.getElementById(`catatan-${jawabanId}-${questionId}`)?.value || '',
                    jawaban: data.jawaban,
                    soal: data.soal
                };
            }
        }
        
        const nilaiPG = jawaban.nilaiPG || 0;
        const nilaiIsian = jawaban.nilaiIsian || 0;
        const nilaiTotal = nilaiPG + nilaiIsian + nilaiUraian;
        const totalMaksimal = (jawaban.totalPG || 0) + (jawaban.totalIsian || 0) + totalUraian;
        
        await answersRef.doc(jawabanId).update({
            nilaiUraian: nilaiUraian,
            koreksiDetail: koreksiDetail,
            statusKoreksi: 'selesai',
            dikoreksiOleh: JSON.parse(sessionStorage.getItem('currentUser'))?.nama || 'admin',
            waktuKoreksi: firebase.firestore.FieldValue.serverTimestamp(),
            nilaiTotal: nilaiTotal,
            totalMaksimal: totalMaksimal
        });
        
        alert(`✅ Koreksi berhasil disimpan!\nNilai Essay: ${nilaiUraian} / ${totalUraian}\nTotal Nilai: ${nilaiTotal} / ${totalMaksimal}`);
        
        // Refresh
        loadJawabanKoreksi();
        if (typeof loadNilai === 'function') loadNilai();
        
    } catch (error) {
        console.error('Error saving koreksi:', error);
        alert('❌ Gagal menyimpan koreksi: ' + error.message);
    }
}

// Event listener
document.addEventListener('DOMContentLoaded', function() {
    const filterKelas = document.getElementById('filterKelasKoreksi');
    const filterSiswa = document.getElementById('filterSiswaKoreksi');
    
    if (filterKelas) {
        filterKelas.addEventListener('change', function() {
            loadSiswaForKoreksi();
        });
    }
    
    if (filterSiswa) {
        filterSiswa.addEventListener('change', function() {
            loadJawabanKoreksi();
        });
    }
});