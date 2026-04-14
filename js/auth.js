// Ambil role dari URL
const urlParams = new URLSearchParams(window.location.search);
const role = urlParams.get('role');

// Set judul berdasarkan role
if (role === 'siswa') {
    document.getElementById('role-title').textContent = 'Login Siswa';
    document.getElementById('kelasSelect').style.display = 'block';
} else if (role === 'admin') {
    document.getElementById('role-title').textContent = 'Login Admin';
    document.getElementById('kelasSelect').style.display = 'none';
}

// Handle login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const kelas = document.getElementById('kelas')?.value;
    
    try {
        if (role === 'siswa') {
            // Cari siswa di Firestore
            const siswaQuery = await usersRef
                .where('nis', '==', username)
                .where('kelas', '==', kelas)
                .where('role', '==', 'siswa')
                .get();
            
            if (siswaQuery.empty) {
                alert('NIS atau kelas tidak ditemukan!');
                return;
            }
            
            const siswaData = siswaQuery.docs[0].data();
            
            // Simpan data ke sessionStorage
            sessionStorage.setItem('currentUser', JSON.stringify({
                id: siswaQuery.docs[0].id,
                ...siswaData
            }));
            
            // Redirect ke dashboard siswa
            window.location.href = 'dashboard-siswa.html';
            
        } else if (role === 'admin') {
            // Login admin (bisa menggunakan email/password atau custom)
            // Contoh sederhana: cek username dan password hardcoded
            if (username === 'admin' && password === '20524756') {
                sessionStorage.setItem('currentUser', JSON.stringify({
                    id: 'admin1',
                    nama: 'Administrator',
                    role: 'admin'
                }));
                window.location.href = 'dashboard-admin.html';
            } else {
                alert('Username atau password admin salah!');
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Terjadi kesalahan saat login');
    }
});
