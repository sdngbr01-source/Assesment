// management-kelas.js
// Manajemen kelas dinamis untuk SD



// Load daftar kelas untuk semua dropdown
async function loadAllKelasDropdowns() {
    try {
        const snapshot = await kelasRef.where('status', '==', 'aktif').orderBy('tingkatan', 'asc').orderBy('namaKelas', 'asc').get();
        
        const kelasOptions = '<option value="">Pilih Kelas</option>' + 
            snapshot.docs.map(doc => `<option value="${doc.data().namaKelas}">${doc.data().namaKelas}</option>`).join('');
        
        const kelasOptionsAll = '<option value="">Semua Kelas</option>' + 
            snapshot.docs.map(doc => `<option value="${doc.data().namaKelas}">${doc.data().namaKelas}</option>`).join('');
        
        // Update semua dropdown kelas
        const dropdowns = [
            'filterKelasUser', 'filterKelasSoal', 'settingKelas', 
            'filterKelasNilai', 'filterKelasKoreksi', 'laporanKelas', 'generateKelas'
        ];
        
        dropdowns.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (id === 'filterKelasUser' || id === 'filterKelasNilai') {
                    element.innerHTML = kelasOptionsAll;
                } else {
                    element.innerHTML = kelasOptions;
                }
            }
        });
        
        console.log('✅ Dropdown kelas berhasil diupdate');
        
    } catch (error) {
        console.error('Error loading kelas dropdowns:', error);
    }
}

// ============ TAMBAHKAN FUNGSI INI ============
// Load kelas untuk dropdown upload soal
async function loadKelasToUploadDropdown() {
    const uploadKelasSelect = document.getElementById('uploadKelas');
    if (!uploadKelasSelect) return;
    
    try {
        const snapshot = await kelasRef.where('status', '==', 'aktif').orderBy('tingkatan', 'asc').orderBy('namaKelas', 'asc').get();
        
        uploadKelasSelect.innerHTML = '<option value="">Pilih Kelas</option>';
        snapshot.forEach(doc => {
            const kelas = doc.data();
            uploadKelasSelect.innerHTML += `<option value="${kelas.namaKelas}">${kelas.namaKelas}</option>`;
        });
        
        console.log('✅ Dropdown upload kelas berhasil dimuat');
    } catch (error) {
        console.error('Error loading kelas to upload dropdown:', error);
        uploadKelasSelect.innerHTML = '<option value="">Error loading kelas</option>';
    }
}

// Load kelas untuk dropdown di modal upload
async function loadKelasToAllModals() {
    await loadKelasToUploadDropdown();
}

// ============ AKHIR TAMBAHAN ============

// Load dan tampilkan daftar kelas di tabel
async function loadKelas() {
    const tbody = document.getElementById('kelasTableBody');
    const filterStatus = document.getElementById('filterStatusKelas')?.value || '';
    
    if (!tbody) return;
    
    tbody.innerHTML = '发展<td colspan="7" style="text-align: center;">Loading...发展</td></tr>';
    
    try {
        let query = kelasRef;
        
        if (filterStatus) {
            query = query.where('status', '==', filterStatus);
        }
        
        const snapshot = await query.orderBy('tingkatan', 'asc').orderBy('namaKelas', 'asc').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Belum ada kelas. Silakan tambah kelas baru.</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        let no = 1;
        
        for (const doc of snapshot.docs) {
            const kelas = doc.data();
            
            // Hitung jumlah siswa di kelas ini
            let jumlahSiswa = 0;
            try {
                const siswaSnapshot = await usersRef
                    .where('kelas', '==', kelas.namaKelas)
                    .where('role', '==', 'siswa')
                    .get();
                jumlahSiswa = siswaSnapshot.size;
            } catch (error) {
                console.error('Error counting siswa:', error);
            }
            
            const row = tbody.insertRow();
            row.insertCell(0).textContent = no++;
            row.insertCell(1).innerHTML = `<strong>${kelas.namaKelas}</strong>`;
            row.insertCell(2).textContent = `Kelas ${kelas.tingkatan} SD`;
            row.insertCell(3).textContent = kelas.waliKelas || '-';
            row.insertCell(4).textContent = jumlahSiswa;
            row.insertCell(5).innerHTML = kelas.status === 'aktif' 
                ? '<span class="status-active">✅ Aktif</span>' 
                : '<span class="status-inactive">⭕ Nonaktif</span>';
            
            const actions = row.insertCell(6);
            actions.innerHTML = `
                <button class="btn-edit" onclick="editKelas('${doc.id}', '${kelas.namaKelas}', '${kelas.tingkatan}', '${kelas.waliKelas || ''}', '${kelas.status}')">✏️ Edit</button>
                <button class="btn-delete" onclick="deleteKelas('${doc.id}', '${kelas.namaKelas}')">🗑️ Hapus</button>
            `;
        }
        
    } catch (error) {
        console.error('Error loading kelas:', error);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error: ${error.message}</td></tr>`;
    }
}

// Tambah kelas baru
async function tambahKelas(event) {
    event.preventDefault();
    
    const namaKelas = document.getElementById('namaKelas').value.trim();
    const tingkatan = document.getElementById('tingkatanKelas').value;
    const waliKelas = document.getElementById('waliKelas').value.trim();
    const status = document.getElementById('statusKelas').value;
    
    if (!namaKelas || !tingkatan) {
        showToast('Mohon lengkapi data kelas', 'error');
        return;
    }
    
    // Validasi format nama kelas untuk SD (1A, 1B, 2A, dst)
    const kelasRegex = /^[1-6][A-Z]$/;
    if (!kelasRegex.test(namaKelas)) {
        showToast('Format nama kelas salah. Contoh untuk SD: 1A, 2B, 3C, 4A, 5B, 6C', 'error');
        return;
    }
    
    try {
        // Cek apakah kelas sudah ada
        const existing = await kelasRef.where('namaKelas', '==', namaKelas).get();
        if (!existing.empty) {
            showToast(`Kelas ${namaKelas} sudah terdaftar!`, 'error');
            return;
        }
        
        await kelasRef.add({
            namaKelas: namaKelas,
            tingkatan: parseInt(tingkatan),
            waliKelas: waliKelas || null,
            status: status,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast(`✅ Kelas ${namaKelas} berhasil ditambahkan`, 'success');
        
        // Reset form
        document.getElementById('tambahKelasForm').reset();
        
        // Reload data
        await loadKelas();
        await loadAllKelasDropdowns();
        await loadKelasToAllModals(); // Tambahkan ini
        
        // Reload data di tab lain
        if (typeof loadUsers === 'function') loadUsers();
        if (typeof loadSoal === 'function') loadSoal();
        if (typeof loadNilai === 'function') loadNilai();
        
    } catch (error) {
        console.error('Error adding kelas:', error);
        showToast('Gagal menambahkan kelas: ' + error.message, 'error');
    }
}

// Edit kelas
function editKelas(id, namaKelas, tingkatan, waliKelas, status) {
    const newNama = prompt('Edit nama kelas (contoh: 1A, 2B, 3C):', namaKelas);
    if (!newNama) return;
    
    const newWaliKelas = prompt('Edit wali kelas:', waliKelas || '');
    const newStatus = confirm('Ubah status menjadi nonaktif?') ? 'nonaktif' : 'aktif';
    
    updateKelas(id, newNama, tingkatan, newWaliKelas, newStatus);
}

// Update kelas
async function updateKelas(id, namaKelas, tingkatan, waliKelas, status) {
    try {
        // Validasi format untuk SD
        const kelasRegex = /^[1-6][A-Z]$/;
        if (!kelasRegex.test(namaKelas)) {
            showToast('Format nama kelas salah. Contoh untuk SD: 1A, 2B, 3C, 4A, 5B, 6C', 'error');
            return;
        }
        
        // Cek duplikasi nama
        const existing = await kelasRef.where('namaKelas', '==', namaKelas).get();
        if (!existing.empty && existing.docs[0].id !== id) {
            showToast(`Kelas ${namaKelas} sudah ada!`, 'error');
            return;
        }
        
        await kelasRef.doc(id).update({
            namaKelas: namaKelas,
            waliKelas: waliKelas || null,
            status: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast(`✅ Kelas berhasil diupdate`, 'success');
        
        await loadKelas();
        await loadAllKelasDropdowns();
        await loadKelasToAllModals(); // Tambahkan ini
        
        if (typeof loadUsers === 'function') loadUsers();
        if (typeof loadSoal === 'function') loadSoal();
        if (typeof loadNilai === 'function') loadNilai();
        
    } catch (error) {
        console.error('Error updating kelas:', error);
        showToast('Gagal update kelas: ' + error.message, 'error');
    }
}

// Hapus kelas
async function deleteKelas(id, namaKelas) {
    if (!confirm(`⚠️ Hapus kelas ${namaKelas}?\n\nSemua data yang terkait dengan kelas ini (siswa, soal, nilai) akan terpengaruh.\n\nApakah Anda yakin?`)) {
        return;
    }
    
    try {
        // Cek apakah ada siswa di kelas ini
        const siswaSnapshot = await usersRef
            .where('kelas', '==', namaKelas)
            .where('role', '==', 'siswa')
            .get();
        
        if (!siswaSnapshot.empty) {
            if (!confirm(`Kelas ${namaKelas} memiliki ${siswaSnapshot.size} siswa. Data siswa akan tetap ada tapi kelasnya akan kosong. Lanjutkan?`)) {
                return;
            }
            
            // Update siswa menjadi tanpa kelas
            const batch = db.batch();
            siswaSnapshot.forEach(doc => {
                batch.update(doc.ref, { kelas: null });
            });
            await batch.commit();
        }
        
        // Hapus kelas
        await kelasRef.doc(id).delete();
        
        showToast(`✅ Kelas ${namaKelas} berhasil dihapus`, 'success');
        
        await loadKelas();
        await loadAllKelasDropdowns();
        await loadKelasToAllModals(); // Tambahkan ini
        
        if (typeof loadUsers === 'function') loadUsers();
        if (typeof loadSoal === 'function') loadSoal();
        if (typeof loadNilai === 'function') loadNilai();
        
    } catch (error) {
        console.error('Error deleting kelas:', error);
        showToast('Gagal menghapus kelas: ' + error.message, 'error');
    }
}

// Export kelas ke Excel
function exportKelasToExcel() {
    const table = document.getElementById('kelasTable');
    const rows = table.querySelectorAll('tr');
    
    const data = [];
    rows.forEach(row => {
        const rowData = [];
        row.querySelectorAll('th, td').forEach(cell => {
            // Skip kolom aksi
            if (cell.cellIndex !== 6 || row.rowIndex === 0) {
                rowData.push(cell.innerText);
            }
        });
        if (rowData.length > 0) data.push(rowData);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daftar Kelas');
    XLSX.writeFile(wb, `daftar_kelas_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    showToast('📊 Export Excel berhasil', 'success');
}

// Load data kelas untuk dropdown di halaman lain
async function loadKelasForDropdowns() {
    await loadAllKelasDropdowns();
    await loadKelasToAllModals(); // Tambahkan ini
}

// Fungsi showToast jika belum ada
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        if (type === 'error') {
            alert(message);
        }
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Load data saat DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // Load kelas dropdowns untuk semua filter
    setTimeout(() => {
        loadKelasForDropdowns();
    }, 1000);
});

// Export fungsi untuk digunakan di file lain
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadAllKelasDropdowns,
        loadKelas,
        loadKelasToUploadDropdown,
        loadKelasToAllModals,
        tambahKelas,
        updateKelas,
        deleteKelas,
        exportKelasToExcel
    };
}