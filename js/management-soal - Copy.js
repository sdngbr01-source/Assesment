// management-soal.js

// Load soal berdasarkan filter
async function loadSoal() {
    const kelas = document.getElementById('filterKelasSoal')?.value;
    const mapel = document.getElementById('filterMapelSoal')?.value;
    const tbody = document.getElementById('soalTableBody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading...</td></tr>';
    
    try {
        let query = questionsRef;
        
        if (kelas) {
            query = query.where('kelas', '==', kelas);
        }
        if (mapel) {
            query = query.where('mataPelajaran', '==', mapel);
        }
        
        const snapshot = await query.orderBy('nomor', 'asc').get();
        
        tbody.innerHTML = '';
        let no = 1;
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center">Tidak ada data</td></tr>';
            return;
        }
        
        snapshot.forEach(doc => {
            const soal = doc.data();
            tbody.innerHTML += `
                <tr>
                    <td>${no++}</td>
                    <td>${soal.kelas || '-'}</td>
                    <td>${soal.mataPelajaran || '-'}</td>
                    <td>${soal.tipe || '-'}</td>
                    <td>${(soal.soal || '').substring(0, 50)}${soal.soal && soal.soal.length > 50 ? '...' : ''}</td>
                    <td>
                        <button class="btn btn-danger btn-small" onclick="deleteSoal('${doc.id}')">Hapus</button>
                    </td>
                </tr>
            `;
        });
        
    } catch (error) {
        console.error('Error loading soal:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error loading data</td></tr>';
    }
}

// Delete soal
async function deleteSoal(soalId) {
    if (!confirm('Apakah Anda yakin ingin menghapus soal ini?')) {
        return;
    }
    
    try {
        await questionsRef.doc(soalId).delete();
        alert('Soal berhasil dihapus');
        loadSoal();
    } catch (error) {
        console.error('Error deleting soal:', error);
        alert('Gagal menghapus soal');
    }
}

// Download template soal
function downloadTemplateSoal() {
    const data = [
        ['Tipe', 'Soal', 'Pilihan_A', 'Pilihan_B', 'Pilihan_C', 'Pilihan_D', 'Kunci', 'Gambar'],
        ['pg', 'Contoh soal PG?', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi A', 'https://example.com/gambar.jpg'],
        ['isian', 'Contoh soal isian?', '', '', '', '', 'jawaban benar', ''],
        ['uraian', 'Contoh soal uraian?', '', '', '', '', '', '']
    ];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Template Soal');
    XLSX.writeFile(wb, 'template_soal.xlsx');
}

// Handle file upload untuk soal
// Handle file upload untuk soal dengan gambar
async function handleSoalUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    const kelas = document.getElementById('uploadKelas')?.value;
    const mapel = document.getElementById('uploadMapel')?.value;
    
    if (!kelas || !mapel) {
        alert('Pilih kelas dan mata pelajaran terlebih dahulu!');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            console.log('Data yang diupload:', jsonData); // Untuk debugging
            
            // Cek apakah sudah ada ujian untuk kelas dan mapel ini
            const examQuery = await examsRef
                .where('kelas', '==', kelas)
                .where('mataPelajaran', '==', mapel)
                .where('aktif', '==', true)
                .get();
            
            let examId;
            if (examQuery.empty) {
                const examRef = await examsRef.add({
                    kelas: kelas,
                    mataPelajaran: mapel,
                    aktif: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                examId = examRef.id;
            } else {
                examId = examQuery.docs[0].id;
            }
            
            let success = 0;
            let failed = 0;
            let nomor = 1;
            
            for (const row of jsonData) {
                try {
                    if (!row.Tipe || !row.Soal) {
                        console.warn('Baris tidak lengkap:', row);
                        failed++;
                        continue;
                    }
                    
                    const tipe = row.Tipe.toLowerCase().trim();
                    if (!['pg', 'isian', 'uraian'].includes(tipe)) {
                        console.warn('Tipe tidak valid:', tipe);
                        failed++;
                        continue;
                    }
                    
                    // Proses URL gambar
                    let gambarUrl = '';
                    if (row.Gambar) {
                        gambarUrl = row.Gambar.trim();
                        // Validasi URL sederhana
                        if (!gambarUrl.startsWith('http://') && !gambarUrl.startsWith('https://')) {
                            console.warn('URL gambar tidak valid:', gambarUrl);
                            gambarUrl = ''; // Reset jika tidak valid
                        }
                    }
                    
                    const soalData = {
                        examId: examId,
                        kelas: kelas,
                        mataPelajaran: mapel,
                        tipe: tipe,
                        soal: row.Soal,
                        nomor: nomor++,
                        kunci: row.Kunci || '',
                        gambar: gambarUrl, // Simpan URL gambar
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    if (tipe === 'pg') {
                        soalData.pilihan = [
                            row.Pilihan_A || '',
                            row.Pilihan_B || '',
                            row.Pilihan_C || '',
                            row.Pilihan_D || ''
                        ];
                    }
                    
                    console.log('Menyimpan soal dengan gambar:', soalData.gambar); // Debug
                    
                    await questionsRef.add(soalData);
                    success++;
                    
                } catch (error) {
                    console.error('Error saving soal:', error);
                    failed++;
                }
            }
            
            alert(`Upload selesai!\nBerhasil: ${success}\nGagal: ${failed}\nTotal soal: ${nomor-1}`);
            closeUploadSoalModal();
            loadSoal();
            
        } catch (error) {
            console.error('Error reading file:', error);
            alert('Gagal membaca file: ' + error.message);
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// Event listener untuk filter
document.addEventListener('DOMContentLoaded', function() {
    const filterKelas = document.getElementById('filterKelasSoal');
    const filterMapel = document.getElementById('filterMapelSoal');
    
    if (filterKelas) filterKelas.addEventListener('change', loadSoal);
    if (filterMapel) filterMapel.addEventListener('change', loadSoal);
});