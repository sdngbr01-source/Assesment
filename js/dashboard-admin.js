// dashboard-admin.js
// Manajemen dashboard admin

// Ambil data user dari sessionStorage
const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));

// Cek login
if (!currentUser || currentUser.role !== 'admin') {
    window.location.href = 'index.html';
}

// Tampilkan nama user
document.addEventListener('DOMContentLoaded', function() {
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = currentUser.nama;
});

// Fungsi Connection Status
function getConnectionStatus() {
    if (window.firebaseConnection) {
        return window.firebaseConnection.getStatus();
    }
    return { isConnected: false, status: 'unknown' };
}

// Fungsi untuk cek koneksi sebelum load data
async function checkConnectionBeforeLoad() {
    const status = getConnectionStatus();
    if (!status.isConnected) {
        alert('⚠️ Tidak terhubung ke Firebase. Silakan cek koneksi Anda.');
        return false;
    }
    return true;
}

// ==================== FUNGSI LOAD SISWA UNTUK KOREKSI ====================
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
        // Ambil siswa dari collection users
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
                <option value="${doc.id}">${siswa.nama || 'Tanpa Nama'} (${siswa.nis || '-'})</option>
            `;
        });
        
        console.log('✅ Load siswa berhasil:', snapshot.size, 'siswa');
        
    } catch (error) {
        console.error('Error loading siswa:', error);
        siswaSelect.innerHTML = '<option value="">Error loading siswa</option>';
    }
}

async function loadNilai() {
    const kelas = document.getElementById('filterKelasNilai')?.value;
    const mapel = document.getElementById('filterMapelNilai')?.value;
    const search = document.getElementById('searchSiswa')?.value.toLowerCase() || '';
    const tbody = document.getElementById('nilaiTableBody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Loading...</td></tr>';
    
    try {
        let query = answersRef;
        
        if (kelas) query = query.where('kelas', '==', kelas);
        if (mapel) query = query.where('mataPelajaran', '==', mapel);
        
        const snapshot = await query.orderBy('waktu', 'desc').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center">Tidak ada data</td></tr>';
            return;
        }
        
        const nilaiMap = new Map();
        
        snapshot.forEach(doc => {
            const nilai = doc.data();
            const key = nilai.siswaId + '_' + nilai.mataPelajaran;
            
            if (!nilaiMap.has(key) || (nilai.waktu?.toDate?.() > nilaiMap.get(key).waktu?.toDate?.())) {
                nilaiMap.set(key, { id: doc.id, ...nilai });
            }
        });
        
        const filteredData = Array.from(nilaiMap.values()).filter(nilai => {
            if (search) return (nilai.siswaNama || '').toLowerCase().includes(search);
            return true;
        });
        
        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center">Tidak ada data sesuai filter</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        let no = 1;
        
        for (const nilai of filteredData) {
            const nilaiPG = nilai.nilaiPG || 0;
            const nilaiIsian = nilai.nilaiIsian || 0;
            const nilaiUraian = nilai.nilaiUraian || 0;
            const totalPG = nilai.totalPG || 0;
            const totalIsian = nilai.totalIsian || 0;
            const totalUraian = nilai.totalUraian || 0;
            
            const jumlahSoal = (nilai.jumlahSoal?.pg || 0) + (nilai.jumlahSoal?.isian || 0) + (nilai.jumlahSoal?.uraian || 0);
            
            let nilaiAkhir = 0;
            let totalNilai = 0;
            
            // CEK STATUS: Jika masih pending, jangan hitung nilai uraian
            if (nilai.statusKoreksi === 'pending') {
                // Hanya hitung PG + Isian, uraian belum dihitung
                totalNilai = nilaiPG + nilaiIsian;
                if (jumlahSoal > 0) {
                    nilaiAkhir = (totalNilai * 100) / jumlahSoal;
                    nilaiAkhir = Math.round(nilaiAkhir);
                }
            } else {
                // Sudah selesai dikoreksi, hitung semua termasuk uraian
                totalNilai = nilaiPG + nilaiIsian + nilaiUraian;
                if (jumlahSoal > 0) {
                    nilaiAkhir = (totalNilai * 100) / jumlahSoal;
                    nilaiAkhir = Math.round(nilaiAkhir);
                }
            }
            
            let statusText = '';
            let statusClass = '';
            
            if (nilai.statusKoreksi === 'pending') {
                statusText = 'Menunggu Koreksi Essay';
                statusClass = 'status-pending';
            } else {
                statusText = 'Selesai';
                statusClass = 'status-selesai';
            }
            
            const row = tbody.insertRow();
            row.insertCell(0).textContent = no++;
            row.insertCell(1).textContent = nilai.siswaNama || '-';
            row.insertCell(2).textContent = nilai.kelas || '-';
            row.insertCell(3).textContent = nilai.mataPelajaran || '-';
            row.insertCell(4).textContent = totalPG > 0 ? nilaiPG + ' / ' + totalPG : '-';
            row.insertCell(5).textContent = totalIsian > 0 ? nilaiIsian + ' / ' + totalIsian : '-';
            row.insertCell(6).textContent = totalUraian > 0 ? nilaiUraian + ' / ' + totalUraian : '-';
            row.insertCell(7).innerHTML = '<strong>' + nilaiAkhir + '</strong> / 100';
            row.insertCell(8).innerHTML = '<span class="exam-status ' + statusClass + '">' + statusText + '</span>';
        }
        
    } catch (error) {
        console.error('Error loading nilai:', error);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">Error: ' + error.message + '</td></tr>';
    }
}

// ==================== SWITCH TAB ====================
function switchTab(tabName) {
    // Sembunyikan semua tab
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Nonaktifkan semua tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Aktifkan tab yang dipilih
    document.getElementById(`tab-${tabName}`).classList.add('active');
    if (event && event.target) event.target.classList.add('active');
    
    // Load data sesuai tab
    setTimeout(async () => {
        const isConnected = await checkConnectionBeforeLoad();
        if (!isConnected) return;
        
        switch(tabName) {
            case 'user':
                if (typeof loadUsers === 'function') loadUsers();
                break;
            case 'soal':
                if (typeof loadSoal === 'function') loadSoal();
                break;
            case 'kelas': // Tambahkan ini
                if (typeof loadKelas === 'function') loadKelas();
                break;
            case 'nilai':
                loadNilai();
                break;
            case 'koreksi':
                loadSiswaForKoreksi();
                break;
        }
    }, 100);
}

// ==================== LOGOUT ====================
function logout() {
    if (confirm('Apakah Anda yakin ingin logout?')) {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

// ==================== MODAL FUNCTIONS ====================
function showUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) modal.style.display = 'block';
}

function closeUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) modal.style.display = 'none';
}

function showUploadSoalModal() {
    if (typeof loadKelasToUploadDropdown === 'function') {
        loadKelasToUploadDropdown();
    }
    const modal = document.getElementById('uploadSoalModal');
    if (modal) modal.style.display = 'block';
}

function closeUploadSoalModal() {
    const modal = document.getElementById('uploadSoalModal');
    if (modal) modal.style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const uploadModal = document.getElementById('uploadModal');
    const uploadSoalModal = document.getElementById('uploadSoalModal');
    
    if (event.target === uploadModal) uploadModal.style.display = 'none';
    if (event.target === uploadSoalModal) uploadSoalModal.style.display = 'none';
}

// ==================== LOAD DATA AWAL ====================
document.addEventListener('DOMContentLoaded', function() {
    // Load nilai untuk tab yang aktif
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        const onclickAttr = activeTab.getAttribute('onclick');
        if (onclickAttr) {
            const match = onclickAttr.match(/'([^']+)'/);
            if (match && match[1] === 'nilai') {
                setTimeout(loadNilai, 500);
            }
        }
    }
});
// dashboard-admin.js - Tambahkan fungsi showToast global
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        if (type === 'error') alert(message);
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: white;
        padding: 12px 20px;
        border-radius: 8px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        animation: slideIn 0.3s;
        border-left: 4px solid ${type === 'success' ? '#28a745' : '#dc3545'};
    `;
    
    const icon = type === 'success' ? '✅' : '❌';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}
