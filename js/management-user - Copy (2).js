// management-user.js

// Load users berdasarkan filter
async function loadUsers() {
    const kelas = document.getElementById('filterKelasUser').value;
    const tbody = document.getElementById('userTableBody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading...</td></tr>';
    
    try {
        let query = usersRef.where('role', '==', 'siswa');
        
        if (kelas) {
            query = query.where('kelas', '==', kelas);
        }
        
        const snapshot = await query.get();
        
        tbody.innerHTML = '';
        let no = 1;
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center">Tidak ada data</td></tr>';
            return;
        }
        
        snapshot.forEach(doc => {
            const user = doc.data();
            tbody.innerHTML += `
                <tr>
                    <td>${no++}</td>
                    <td>${user.nis || '-'}</td>
                    <td>${user.nama || '-'}</td>
                    <td>${user.kelas || '-'}</td>
                    <td>
                        <button class="btn btn-danger btn-small" onclick="deleteUser('${doc.id}')">Hapus</button>
                    </td>
                </tr>
            `;
        });
        
    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error loading data</td></tr>';
    }
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Apakah Anda yakin ingin menghapus user ini?')) {
        return;
    }
    
    try {
        await usersRef.doc(userId).delete();
        alert('User berhasil dihapus');
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Gagal menghapus user');
    }
}

// Handle file upload untuk user
async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            let success = 0;
            let failed = 0;
            
            for (const row of jsonData) {
                try {
                    if (!row.NIS || !row.Nama || !row.Kelas || !row.Password) {
                        failed++;
                        continue;
                    }
                    
                    await usersRef.add({
                        nis: String(row.NIS),
                        nama: row.Nama,
                        kelas: row.Kelas,
                        password: row.Password,
                        role: 'siswa',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    success++;
                } catch (error) {
                    console.error('Error saving user:', error);
                    failed++;
                }
            }
            
            alert(`Upload selesai!\nBerhasil: ${success}\nGagal: ${failed}`);
            closeUploadModal();
            loadUsers();
            
        } catch (error) {
            console.error('Error reading file:', error);
            alert('Gagal membaca file');
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// Download template Excel
function downloadTemplate() {
    const data = [
        ['NIS', 'Nama', 'Kelas', 'Password'],
        ['12345', 'Budi Santoso', '4A', 'budi123'],
        ['12346', 'Siti Aminah', '4A', 'siti123']
    ];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'template_siswa.xlsx');
}

// Event listener untuk filter
document.addEventListener('DOMContentLoaded', function() {
    const filterKelas = document.getElementById('filterKelasUser');
    if (filterKelas) {
        filterKelas.addEventListener('change', loadUsers);
    }
});
async function loadUsers() {
    const kelas = document.getElementById('filterKelasUser')?.value;
    const tbody = document.getElementById('userTableBody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading...</td></tr>';
    
    try {
        let query = usersRef.where('role', '==', 'siswa');
        
        if (kelas) {
            query = query.where('kelas', '==', kelas);
        }
        
        const snapshot = await query.get();
        
        // ... rest of existing code ...
    } catch (error) {
        // ... error handling ...
    }
}