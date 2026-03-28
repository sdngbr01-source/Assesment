// management-soal.js

// management-soal.js
// Tetap gunakan orderBy seperti biasa
async function loadSoal() {
    const kelas = document.getElementById('filterKelasSoal')?.value;
    const mapel = document.getElementById('filterMapelSoal')?.value;
    const tipe = document.getElementById('filterTipeSoal')?.value;
    const tbody = document.getElementById('soalTableBody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '专栏<td colspan="7" style="text-align: center;">Loading...<专栏/tr>';
    
    try {
        // Cari examId berdasarkan kelas dan mapel
        let examId = null;
        
        if (kelas && mapel) {
            const examSnapshot = await examsRef
                .where('kelas', '==', kelas)
                .where('mataPelajaran', '==', mapel)
                .get();
            
            if (!examSnapshot.empty) {
                examId = examSnapshot.docs[0].id;
            }
        }
        
        if (!examId) {
            tbody.innerHTML = '专栏<td colspan="7" style="text-align: center;">Pilih kelas dan mata pelajaran terlebih dahulu<专栏/tr>';
            return;
        }
        
        // Query soal dengan orderBy (sekarang sudah ada index)
        let query = questionsRef
            .where('examId', '==', examId)
            .orderBy('nomor');
        
        if (tipe && tipe !== '') {
            query = query.where('tipe', '==', tipe);
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '专栏<td colspan="7" style="text-align: center;">Tidak ada data<专栏/tr>';
            return;
        }
        
        tbody.innerHTML = '';
        let no = 1;
        
        snapshot.forEach(doc => {
            const soal = doc.data();
            const row = tbody.insertRow();
            row.insertCell(0).textContent = no++;
            row.insertCell(1).textContent = soal.kelas || '-';
            row.insertCell(2).textContent = soal.mataPelajaran || '-';
            row.insertCell(3).innerHTML = getTipeBadge(soal.tipe);
            
            let soalText = soal.soal || '-';
            if (soalText.length > 50) soalText = soalText.substring(0, 50) + '...';
            row.insertCell(4).innerHTML = `<div style="max-width: 300px; white-space: normal;">${soalText}</div>`;
            
            let gambarHtml = '-';
            if (soal.gambar && soal.gambar !== '') {
                gambarHtml = `<a href="${soal.gambar}" target="_blank" style="color: #007bff;">🔍 Lihat</a>`;
            }
            row.insertCell(5).innerHTML = gambarHtml;
            
            row.insertCell(6).innerHTML = `
                <button class="btn btn-danger btn-small" onclick="deleteSoal('${doc.id}')" style="padding: 4px 8px; font-size: 11px;">🗑 Hapus</button>
            `;
        });
        
    } catch (error) {
        console.error('Error loading soal:', error);
        tbody.innerHTML = `专栏<td colspan="7" style="text-align: center; color: red;">Error: ${error.message}<专栏/tr>`;
    }
}

function getTipeBadge(tipe) {
    if (tipe === 'pg') {
        return '<span style="background: #007bff; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">📝 PG</span>';
    } else if (tipe === 'isian') {
        return '<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">✏️ Isian</span>';
    } else if (tipe === 'uraian') {
        return '<span style="background: #fd7e14; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">📄 Uraian</span>';
    }
    return tipe || '-';
}

// Delete soal
async function deleteSoal(soalId) {
    if (!confirm('Apakah Anda yakin ingin menghapus soal ini?')) {
        return;
    }
    
    try {
        await questionsRef.doc(soalId).delete();
        showToast('Soal berhasil dihapus', 'success');
        loadSoal();
    } catch (error) {
        console.error('Error deleting soal:', error);
        showToast('Gagal menghapus soal', 'error');
    }
}

// Download template soal (diperbarui dengan format yang benar)
function downloadTemplateSoal() {
    // Menggunakan format yang sesuai dengan contoh yang diberikan
    const templateData = [
        {
            'Tipe': 'pg',
            'Soal': 'Sebuah kubus memiliki 6 sisi yang berbentuk ….',
            'Pilihan_A': 'persegi',
            'Pilihan_B': 'persegi panjang',
            'Pilihan_C': 'segitiga',
            'Pilihan_D': 'lingkaran',
            'Kunci': 'A',
            'Gambar': 'https://example.com/gambar.jpg'
        },
        {
            'Tipe': 'pg',
            'Soal': 'Yang termasuk diagonal sisi dari bangun ruang balok di samping adalah ….',
            'Pilihan_A': 'AB, BC, EF, dan GC',
            'Pilihan_B': 'AC, HG, FC, dan FG',
            'Pilihan_C': 'BD, FH, ED, dan EG',
            'Pilihan_D': 'HG, EH, BC, dan AD',
            'Kunci': 'C',
            'Gambar': 'https://drive.google.com/thumbnail?id=1T5drnkBr2ee4LuSDE5bspJGWp1GtpIS8&sz=w1000'
        },
        {
            'Tipe': 'isian',
            'Soal': 'Yang harus dihilangkan agar menjadi bangun balok adalah ….',
            'Pilihan_A': '',
            'Pilihan_B': '',
            'Pilihan_C': '',
            'Pilihan_D': '',
            'Kunci': '1',
            'Gambar': 'https://drive.google.com/thumbnail?id=1eCx9a0RC1PQjYXvcvnFEl-QPLDf_VdY8&sz=w1000'
        },
        {
            'Tipe': 'uraian',
            'Soal': 'Gambarkan masing-masing (2) jaring-jaring kubus dan jaring-jaring balok!',
            'Pilihan_A': '',
            'Pilihan_B': '',
            'Pilihan_C': '',
            'Pilihan_D': '',
            'Kunci': '',
            'Gambar': ''
        }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Atur lebar kolom
    ws['!cols'] = [
        {wch: 10},  // Tipe
        {wch: 60},  // Soal
        {wch: 25},  // Pilihan_A
        {wch: 25},  // Pilihan_B
        {wch: 25},  // Pilihan_C
        {wch: 25},  // Pilihan_D
        {wch: 10},  // Kunci
        {wch: 50}   // Gambar
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Soal');
    XLSX.writeFile(wb, 'template_soal.xlsx');
    
    showToast('Template soal berhasil diunduh', 'success');
}

// Fungsi untuk preview gambar
function previewUploadGambar(url) {
    const previewDiv = document.getElementById('gambarPreview');
    const previewImg = document.getElementById('previewImage');
    
    if (url && url.trim() !== '') {
        // Validasi URL
        if (url.startsWith('http://') || url.startsWith('https://')) {
            previewImg.src = url;
            previewDiv.style.display = 'block';
            
            // Handle error loading gambar
            previewImg.onerror = function() {
                previewImg.src = 'https://via.placeholder.com/200?text=Gambar+Tidak+Dapat+Dimuat';
                showToast('Gambar tidak dapat dimuat. Periksa URL gambar.', 'error');
            };
        } else {
            previewDiv.style.display = 'none';
        }
    } else {
        previewDiv.style.display = 'none';
    }
}

// Handle file upload untuk soal (ditingkatkan)
async function handleSoalUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    const kelas = document.getElementById('uploadKelas')?.value;
    const mapel = document.getElementById('uploadMapel')?.value;
    
    if (!kelas || !mapel) {
        showToast('Pilih kelas dan mata pelajaran terlebih dahulu!', 'error');
        input.value = '';
        return;
    }
    
    // Validasi ekstensi file
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(fileExt)) {
        showToast('Format file harus .xlsx, .xls, atau .csv', 'error');
        input.value = '';
        return;
    }
    
    showToast('Memproses file...', 'info');
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            console.log('Data yang diupload:', jsonData);
            
            // Validasi data
            const validation = validateSoalData(jsonData);
            if (!validation.valid) {
                showToast(validation.message, 'error');
                input.value = '';
                return;
            }
            
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
            const errors = [];
            
            for (const row of jsonData) {
                try {
                    if (!row.Tipe || !row.Soal) {
                        errors.push(`Baris ${nomor}: Tipe atau Soal kosong`);
                        failed++;
                        nomor++;
                        continue;
                    }
                    
                    const tipe = row.Tipe.toLowerCase().trim();
                    if (!['pg', 'isian', 'uraian'].includes(tipe)) {
                        errors.push(`Baris ${nomor}: Tipe "${row.Tipe}" tidak valid (harus pg/isian/uraian)`);
                        failed++;
                        nomor++;
                        continue;
                    }
                    
                    // Validasi khusus untuk PG
                    if (tipe === 'pg') {
                        if (!row.Pilihan_A || !row.Pilihan_B || !row.Pilihan_C || !row.Pilihan_D) {
                            errors.push(`Baris ${nomor}: Pilihan A/B/C/D tidak boleh kosong untuk soal PG`);
                            failed++;
                            nomor++;
                            continue;
                        }
                        
                        const kunci = row.Kunci?.toUpperCase();
                        if (!['A', 'B', 'C', 'D'].includes(kunci)) {
                            errors.push(`Baris ${nomor}: Kunci jawaban harus A, B, C, atau D`);
                            failed++;
                            nomor++;
                            continue;
                        }
                    }
                    
                    // Validasi untuk isian
                    if (tipe === 'isian' && !row.Kunci) {
                        errors.push(`Baris ${nomor}: Kunci jawaban tidak boleh kosong untuk soal isian`);
                        failed++;
                        nomor++;
                        continue;
                    }
                    
                    // Proses URL gambar
                    let gambarUrl = '';
                    if (row.Gambar && row.Gambar.toString().trim()) {
                        gambarUrl = row.Gambar.toString().trim();
                        // Validasi URL
                        if (!gambarUrl.startsWith('http://') && !gambarUrl.startsWith('https://')) {
                            console.warn(`Baris ${nomor}: URL gambar tidak valid:`, gambarUrl);
                            gambarUrl = ''; // Reset jika tidak valid
                        }
                    }
                    
                    const soalData = {
                        examId: examId,
                        kelas: kelas,
                        mataPelajaran: mapel,
                        tipe: tipe,
                        soal: row.Soal.toString().trim(),
                        nomor: nomor++,
                        kunci: tipe === 'pg' ? row.Kunci.toUpperCase() : (row.Kunci || '').toString().trim(),
                        gambar: gambarUrl,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    if (tipe === 'pg') {
                        soalData.pilihan = [
                            row.Pilihan_A.toString().trim(),
                            row.Pilihan_B.toString().trim(),
                            row.Pilihan_C.toString().trim(),
                            row.Pilihan_D.toString().trim()
                        ];
                    }
                    
                    console.log(`Menyimpan soal ${nomor-1} dengan gambar:`, soalData.gambar);
                    
                    await questionsRef.add(soalData);
                    success++;
                    
                } catch (error) {
                    console.error(`Error saving soal baris ${nomor}:`, error);
                    errors.push(`Baris ${nomor}: ${error.message}`);
                    failed++;
                    nomor++;
                }
            }
            
            // Tampilkan hasil upload
            let message = `Upload selesai!\nBerhasil: ${success}\nGagal: ${failed}\nTotal soal: ${nomor-1}`;
            if (errors.length > 0 && errors.length <= 5) {
                message += '\n\nDetail error:\n' + errors.join('\n');
            } else if (errors.length > 5) {
                message += `\n\nDan ${errors.length - 5} error lainnya. Lihat console untuk detail.`;
            }
            
            showToast(`Berhasil upload ${success} soal${failed > 0 ? `, ${failed} gagal` : ''}`, 
                     failed > 0 ? 'error' : 'success');
            alert(message);
            
            closeUploadSoalModal();
            loadSoal();
            
        } catch (error) {
            console.error('Error reading file:', error);
            showToast('Gagal membaca file: ' + error.message, 'error');
        } finally {
            input.value = '';
        }
    };
    
    reader.onerror = function() {
        showToast('Gagal membaca file', 'error');
        input.value = '';
    };
    
    reader.readAsArrayBuffer(file);
}

// Fungsi validasi data soal
function validateSoalData(data) {
    if (!data || data.length === 0) {
        return { valid: false, message: 'File tidak mengandung data' };
    }
    
    // Cek apakah ada data dengan format yang benar
    const requiredColumns = ['Tipe', 'Soal'];
    const firstRow = data[0];
    
    for (const col of requiredColumns) {
        if (!firstRow.hasOwnProperty(col)) {
            return { 
                valid: false, 
                message: `Kolom "${col}" tidak ditemukan. Pastikan template sesuai format.` 
            };
        }
    }
    
    return { valid: true };
}

// Fungsi untuk menampilkan modal upload soal
function showUploadSoalModal() {
    const modal = document.getElementById('uploadSoalModal');
    if (modal) {
        modal.style.display = 'block';
        // Reset form
        const uploadKelas = document.getElementById('uploadKelas');
        const uploadMapel = document.getElementById('uploadMapel');
        const soalFileInput = document.getElementById('soalFileInput');
        const gambarPreview = document.getElementById('gambarPreview');
        
        if (uploadKelas) uploadKelas.value = '';
        if (uploadMapel) uploadMapel.value = '';
        if (soalFileInput) soalFileInput.value = '';
        if (gambarPreview) gambarPreview.style.display = 'none';
    }
}

// Fungsi untuk menutup modal upload soal
function closeUploadSoalModal() {
    const modal = document.getElementById('uploadSoalModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Event listener untuk filter
document.addEventListener('DOMContentLoaded', function() {
    const filterKelas = document.getElementById('filterKelasSoal');
    const filterMapel = document.getElementById('filterMapelSoal');
    
    if (filterKelas) filterKelas.addEventListener('change', loadSoal);
    if (filterMapel) filterMapel.addEventListener('change', loadSoal);
    
    // Event listener untuk preview gambar saat input URL (opsional)
    const gambarInput = document.getElementById('gambarUrlInput');
    if (gambarInput) {
        gambarInput.addEventListener('input', function() {
            previewUploadGambar(this.value);
        });
    }
});
// Tambahkan fungsi untuk memfilter soal berdasarkan kelas
async function loadSoal() {
    const kelas = document.getElementById('filterKelasSoal')?.value;
    const mapel = document.getElementById('filterMapelSoal')?.value;
    const tbody = document.getElementById('soalTableBody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading...</td></tr>';
    
    try {
        let query = soalRef;
        
        if (kelas) {
            query = query.where('kelas', '==', kelas);
        }
        if (mapel) {
            query = query.where('mapel', '==', mapel);
        }
        
        const snapshot = await query.get();
        // ... rest of existing code ...
    } catch (error) {
        // ... error handling ...
    }
}