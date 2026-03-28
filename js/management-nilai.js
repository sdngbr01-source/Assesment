// management-nilai.js - Bagian loadNilai

async function loadNilai() {
    const kelas = document.getElementById('filterKelasNilai')?.value;
    const mapel = document.getElementById('filterMapelNilai')?.value;
    const search = document.getElementById('searchSiswa')?.value.toLowerCase() || '';
    const tbody = document.getElementById('nilaiTableBody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '专栏<td colspan="9" style="text-align: center;">Loading...</td></tr>';
    
    try {
        let query = answersRef;
        
        if (kelas) query = query.where('kelas', '==', kelas);
        if (mapel) query = query.where('mataPelajaran', '==', mapel);
        
        const snapshot = await query.orderBy('waktu', 'desc').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center">Tidak ada data</td></tr>';
            return;
        }
        
        // Group by siswa dan mapel, ambil yang terbaru
        const nilaiMap = new Map();
        
        snapshot.forEach(doc => {
            const nilai = doc.data();
            const key = `${nilai.siswaId}_${nilai.mataPelajaran}`;
            
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
            
            const totalSekarang = nilaiPG + nilaiIsian + nilaiUraian;
            const totalMaksimal = totalPG + totalIsian + totalUraian;
            
            let statusText = '';
            let statusClass = '';
            
            if (nilai.statusKoreksi === 'pending') {
                statusText = '⏳ Menunggu Koreksi Essay';
                statusClass = 'status-pending';
            } else {
                statusText = '✅ Selesai';
                statusClass = 'status-selesai';
            }
            
            const row = tbody.insertRow();
            row.insertCell(0).textContent = no++;
            row.insertCell(1).textContent = nilai.siswaNama || '-';
            row.insertCell(2).textContent = nilai.kelas || '-';
            row.insertCell(3).textContent = nilai.mataPelajaran || '-';
            row.insertCell(4).textContent = totalPG > 0 ? `${nilaiPG} / ${totalPG}` : '-';
            row.insertCell(5).textContent = totalIsian > 0 ? `${nilaiIsian} / ${totalIsian}` : '-';
            row.insertCell(6).textContent = totalUraian > 0 ? `${nilaiUraian} / ${totalUraian}` : '-';
            row.insertCell(7).innerHTML = `<strong>${totalSekarang} / ${totalMaksimal}</strong>`;
            row.insertCell(8).innerHTML = `<span class="exam-status ${statusClass}">${statusText}</span>`;
        }
        
    } catch (error) {
        console.error('Error loading nilai:', error);
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">Error: ${error.message}</td></tr>`;
    }
}