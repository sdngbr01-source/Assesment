// laporan-nilai.js
// Download laporan per kelas (Excel) - TETAP menggunakan orderBy

async function downloadLaporanKelas() {
    const kelas = document.getElementById('laporanKelas').value;
    const mapel = document.getElementById('laporanMapel').value;
    
    if (!kelas || !mapel) {
        alert('Pilih kelas dan mata pelajaran!');
        return;
    }
    
    try {
        // TETAP gunakan orderBy, index akan menangani
        const snapshot = await answersRef
            .where('kelas', '==', kelas)
            .where('mataPelajaran', '==', mapel)
            .orderBy('siswaNama')
            .get();
        
        if (snapshot.empty) {
            alert('Tidak ada data untuk kelas dan mapel ini');
            return;
        }
        
        // Siapkan data untuk Excel
        const data = [['No', 'Nama', 'Mata Pelajaran', 'Pilihan Ganda', 'Isian', 'Uraian', 'Total Nilai']];
        let no = 1;
        
        snapshot.forEach(doc => {
            const nilai = doc.data();
            const totalPG = nilai.nilaiPG || 0;
            const totalIsian = nilai.nilaiIsian || 0;
            const totalUraian = nilai.nilaiUraian || 0;
            const total = totalPG + totalIsian + totalUraian;
            const totalMaks = (nilai.totalPG || 0) + (nilai.totalIsian || 0) + (nilai.totalUraian || 0);
            
            data.push([
                no++,
                nilai.siswaNama || '-',
                nilai.mataPelajaran || '-',
                `${totalPG} / ${nilai.totalPG || 0}`,
                `${totalIsian} / ${nilai.totalIsian || 0}`,
                `${totalUraian} / ${nilai.totalUraian || 0}`,
                `${total} / ${totalMaks}`
            ]);
        });
        
        // Buat Excel file
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Atur lebar kolom
        ws['!cols'] = [
            { wch: 5 },   // No
            { wch: 25 },  // Nama
            { wch: 20 },  // Mata Pelajaran
            { wch: 18 },  // Pilihan Ganda
            { wch: 18 },  // Isian
            { wch: 18 },  // Uraian
            { wch: 18 }   // Total Nilai
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Laporan Nilai');
        XLSX.writeFile(wb, `Laporan_Nilai_${kelas}_${mapel}_${new Date().toISOString().slice(0,10)}.xlsx`);
        
        alert(`✅ Laporan berhasil didownload!\nTotal data: ${snapshot.size} siswa`);
        
    } catch (error) {
        console.error('Error downloading laporan:', error);
        
        if (error.code === 'failed-precondition' && error.message.includes('index')) {
            const linkMatch = error.message.match(/https:\/\/[^\s]+/);
            const link = linkMatch ? linkMatch[0] : '#';
            alert(`⚠️ Database perlu diindex.\n\nKlik OK untuk membuka halaman pembuatan index.\nSetelah index dibuat (5-10 menit), refresh dan coba lagi.`);
            if (link !== '#') window.open(link, '_blank');
        } else {
            alert('Gagal mendownload laporan: ' + error.message);
        }
    }
}

// ==================== GENERATE LEMBAR JAWABAN PDF ====================

async function generateLembarJawaban() {
    const kelas = document.getElementById('generateKelas').value;
    const mapel = document.getElementById('generateMapel').value;
    
    if (!kelas || !mapel) {
        alert('Pilih kelas dan mata pelajaran!');
        return;
    }
    
    // Cek jsPDF tersedia
    const JsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!JsPDF) {
        alert('⚠️ Library PDF tidak ditemukan. Pastikan koneksi internet dan refresh halaman.');
        return;
    }
    
    try {
        // Ambil data siswa
        const siswaSnapshot = await usersRef
            .where('kelas', '==', kelas)
            .where('role', '==', 'siswa')
            .orderBy('nama')
            .get();
        
        if (siswaSnapshot.empty) {
            alert('Tidak ada siswa di kelas ini');
            return;
        }
        
        // Ambil data jawaban untuk mapel ini
        const jawabanSnapshot = await answersRef
            .where('kelas', '==', kelas)
            .where('mataPelajaran', '==', mapel)
            .get();
        
        // Buat map jawaban per siswa
        const jawabanMap = {};
        jawabanSnapshot.forEach(doc => {
            const jawaban = doc.data();
            jawabanMap[jawaban.siswaId] = jawaban;
        });
        
        let successCount = 0;
        let noAnswerCount = 0;
        
        // Generate PDF untuk setiap siswa
        for (const siswaDoc of siswaSnapshot.docs) {
            const siswa = siswaDoc.data();
            const jawaban = jawabanMap[siswaDoc.id];
            
            if (jawaban) {
                try {
                    await generatePDFSiswa(siswa, jawaban, mapel);
                    successCount++;
                    // Beri jeda kecil agar tidak overload
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error(`Error generate PDF untuk ${siswa.nama}:`, error);
                }
            } else {
                noAnswerCount++;
            }
        }
        
        alert(`✅ Generate PDF selesai!\nBerhasil: ${successCount}\nBelum mengerjakan: ${noAnswerCount}`);
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        
        if (error.code === 'failed-precondition' && error.message.includes('index')) {
            const linkMatch = error.message.match(/https:\/\/[^\s]+/);
            const link = linkMatch ? linkMatch[0] : '#';
            alert(`⚠️ Database perlu diindex.\n\nKlik OK untuk membuka halaman pembuatan index.\nSetelah index dibuat (5-10 menit), refresh dan coba lagi.`);
            if (link !== '#') window.open(link, '_blank');
        } else {
            alert('Gagal generate PDF: ' + error.message);
        }
    }
}

// laporan-nilai.js - Fungsi generatePDFSiswa dengan header custom

// laporan-nilai.js - Fungsi generatePDFSiswa yang diperbaiki

async function generatePDFSiswa(siswa, jawaban, mapel) {
    return new Promise(async (resolve, reject) => {
        try {
            const JsPDF = window.jspdf?.jsPDF || window.jsPDF;
            if (!JsPDF) {
                reject(new Error('jsPDF library not loaded'));
                return;
            }
            
            // Ambil setting header
            const headerSetting = getPdfSetting();
            
            const doc = new JsPDF();
            let yPos = 15;
            
            // ========== HEADER DENGAN LOGO DAN IDENTITAS SEKOLAH ==========
            
            // Logo Kiri (jika ada)
            if (headerSetting.logoKiriUrl) {
                try {
                    doc.addImage(headerSetting.logoKiriUrl, 'JPEG', 15, yPos, 25, 25);
                } catch (e) {
                    console.warn('Gagal memuat logo kiri:', e);
                }
            }
            
            // Logo Kanan (jika ada)
            if (headerSetting.logoKananUrl) {
                try {
                    doc.addImage(headerSetting.logoKananUrl, 'JPEG', 170, yPos, 25, 25);
                } catch (e) {
                    console.warn('Gagal memuat logo kanan:', e);
                }
            }
            
            // Identitas Sekolah (Tengah) - Multi baris
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(headerSetting.headerWarna || '#2c3e50');
            
            // Split nama sekolah menjadi beberapa baris
            const namaSekolahLines = (headerSetting.sekolahNama || '').split('\n');
            let currentY = yPos + 8;
            for (const line of namaSekolahLines) {
                if (line.trim()) {
                    doc.text(line.trim(), 105, currentY, { align: 'center' });
                    currentY += 5;
                }
            }
            
            // Alamat sekolah (multi baris)
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            const alamatLines = (headerSetting.sekolahAlamat || '').split('\n');
            for (const line of alamatLines) {
                if (line.trim()) {
                    doc.text(line.trim(), 105, currentY, { align: 'center' });
                    currentY += 4;
                }
            }
            
            // Kontak
            doc.text(`Telp: ${headerSetting.sekolahTelp || '-'} | Email: ${headerSetting.sekolahEmail || '-'}`, 105, currentY, { align: 'center' });
            currentY += 4;
            doc.text(headerSetting.sekolahKota || '', 105, currentY, { align: 'center' });
            currentY += 5;
            
            // Motto (multi baris)
            doc.setFontSize(7);
            doc.setFont(undefined, 'italic');
            const mottoLines = (headerSetting.sekolahMotto || '').split('\n');
            for (const line of mottoLines) {
                if (line.trim()) {
                    doc.text(line.trim(), 105, currentY, { align: 'center' });
                    currentY += 4;
                }
            }
            
            // Garis pemisah
            doc.setDrawColor(200, 200, 200);
            doc.line(15, currentY + 3, 195, currentY + 3);
            
            yPos = currentY + 12;
            
            // Judul Lembar Jawaban
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 0, 0); // Kembalikan ke hitam
            doc.text('LEMBAR JAWABAN SISWA', 105, yPos, { align: 'center' });
            yPos += 12;
            
            // ========== INFO SISWA ==========
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0, 0, 0); // Pastikan hitam
            doc.text(`Nama          : ${siswa.nama || '-'}`, 20, yPos);
            yPos += 6;
            doc.text(`Kelas         : ${siswa.kelas || '-'}`, 20, yPos);
            yPos += 6;
            doc.text(`NIS           : ${siswa.nis || '-'}`, 20, yPos);
            yPos += 6;
            doc.text(`Mata Pelajaran: ${mapel}`, 20, yPos);
            yPos += 6;
            doc.text(`Tanggal       : ${new Date().toLocaleDateString('id-ID')}`, 20, yPos);
            yPos += 15;
            
            // ========== RINGKASAN NILAI ==========
            const nilaiPG = jawaban.nilaiPG || 0;
            const nilaiIsian = jawaban.nilaiIsian || 0;
            const nilaiUraian = jawaban.nilaiUraian || 0;
            const totalPG = jawaban.totalPG || 0;
            const totalIsian = jawaban.totalIsian || 0;
            const totalUraian = jawaban.totalUraian || 0;
            const total = nilaiPG + nilaiIsian + nilaiUraian;
            const totalMaks = totalPG + totalIsian + totalUraian;
            
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('RINGKASAN NILAI:', 20, yPos);
            yPos += 8;
            
            doc.setFont(undefined, 'normal');
            doc.text(`   Pilihan Ganda : ${nilaiPG} / ${totalPG}`, 20, yPos);
            yPos += 6;
            doc.text(`   Isian         : ${nilaiIsian} / ${totalIsian}`, 20, yPos);
            yPos += 6;
            doc.text(`   Uraian        : ${nilaiUraian} / ${totalUraian}`, 20, yPos);
            yPos += 8;
            
            doc.setFont(undefined, 'bold');
            doc.text(`   TOTAL NILAI   : ${total} / ${totalMaks}`, 20, yPos);
            yPos += 20;
            
            // ========== DETAIL JAWABAN ==========
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('DETAIL JAWABAN:', 20, yPos);
            yPos += 10;
            
            // Ambil soal
            const questionsSnapshot = await firebase.firestore()
                .collection('questions')
                .where('examId', '==', jawaban.examId)
                .get();
            
            const questions = [];
            questionsSnapshot.forEach(doc => {
                questions.push({ id: doc.id, ...doc.data() });
            });
            questions.sort((a, b) => (a.nomor || 0) - (b.nomor || 0));
            
            const jawabanPG = jawaban.jawabanPG || {};
            const jawabanIsian = jawaban.jawabanIsian || {};
            const jawabanUraian = jawaban.jawabanUraian || {};
            
            let noSoal = 1;
            for (const question of questions) {
                if (yPos > 260) {
                    doc.addPage();
                    yPos = 20;
                }
                
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(0, 0, 0); // Hitam untuk judul soal
                let jenisSoal = '';
                if (question.tipe === 'pg') jenisSoal = 'PILIHAN GANDA';
                else if (question.tipe === 'isian') jenisSoal = 'ISIAN SINGKAT';
                else if (question.tipe === 'uraian') jenisSoal = 'URAIAN';
                
                doc.text(`${noSoal++}. [${jenisSoal}]`, 20, yPos);
                yPos += 6;
                
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(0, 0, 0); // Hitam untuk soal
                const soalSplit = doc.splitTextToSize(question.soal || '', 170);
                doc.text(soalSplit, 25, yPos);
                yPos += soalSplit.length * 5 + 3;
                
                if (question.tipe === 'pg') {
                    const options = ['A', 'B', 'C', 'D'];
                    const jawabanBenar = question.kunci;
                    const jawabanData = jawabanPG[question.id];
                    const jawabanSiswa = jawabanData?.jawaban || '';
                    const isCorrect = jawabanSiswa && jawabanSiswa.toUpperCase() === String(jawabanBenar).toUpperCase();
                    
                    // Jawaban siswa - warna hitam
                    doc.setTextColor(0, 0, 0);
                    doc.text(`   Jawaban : ${jawabanSiswa || '(tidak dijawab)'}`, 25, yPos);
                    yPos += 5;
                    
                    // Status - hanya baris ini yang berwarna
                    if (isCorrect) {
                        doc.setTextColor(0, 128, 0); // Hijau untuk BENAR
                        doc.text(`   Status  : BENAR ✓`, 25, yPos);
                    } else {
                        doc.setTextColor(255, 0, 0); // Merah untuk SALAH
                        doc.text(`   Status  : SALAH ✗`, 25, yPos);
                        yPos += 5;
                        doc.setTextColor(0, 128, 0); // Hijau untuk kunci jawaban
                        doc.text(`   Seharusnya : ${jawabanBenar}`, 25, yPos);
                    }
                    // Kembalikan ke hitam setelah selesai
                    doc.setTextColor(0, 0, 0);
                    yPos += 8;
                    
                } else if (question.tipe === 'isian') {
                    const jawabanBenar = question.kunci;
                    const jawabanData = jawabanIsian[question.id];
                    const jawabanSiswa = jawabanData?.jawaban || '';
                    const isCorrect = jawabanSiswa && jawabanSiswa.toLowerCase().trim() === String(jawabanBenar).toLowerCase().trim();
                    
                    // Jawaban siswa - warna hitam
                    doc.setTextColor(0, 0, 0);
                    doc.text(`   Jawaban : ${jawabanSiswa || '(tidak dijawab)'}`, 25, yPos);
                    yPos += 5;
                    
                    // Status - hanya baris ini yang berwarna
                    if (isCorrect) {
                        doc.setTextColor(0, 128, 0); // Hijau untuk BENAR
                        doc.text(`   Status  : BENAR ✓`, 25, yPos);
                    } else {
                        doc.setTextColor(255, 0, 0); // Merah untuk SALAH
                        doc.text(`   Status  : SALAH ✗`, 25, yPos);
                        yPos += 5;
                        doc.setTextColor(0, 128, 0); // Hijau untuk kunci jawaban
                        doc.text(`   Seharusnya : ${jawabanBenar}`, 25, yPos);
                    }
                    // Kembalikan ke hitam
                    doc.setTextColor(0, 0, 0);
                    yPos += 8;
                    
                } else if (question.tipe === 'uraian') {
                    const jawabanData = jawabanUraian[question.id];
                    const jawabanSiswa = jawabanData?.jawaban || '';
                    const nilaiMaksimal = jawabanData?.nilaiMaksimal || 0;
                    
                    let nilai = 0;
                    if (jawaban.koreksiDetail && jawaban.koreksiDetail[question.id]) {
                        nilai = jawaban.koreksiDetail[question.id].nilai || 0;
                    }
                    
                    doc.setTextColor(0, 0, 0);
                    doc.text(`   Jawaban :`, 25, yPos);
                    yPos += 5;
                    
                    const jawabanSplit = doc.splitTextToSize(jawabanSiswa || '(tidak dijawab)', 165);
                    doc.text(jawabanSplit, 30, yPos);
                    yPos += jawabanSplit.length * 5 + 3;
                    
                    // Nilai - warna berdasarkan nilai
                    if (nilai === nilaiMaksimal) {
                        doc.setTextColor(0, 128, 0); // Hijau jika nilai maksimal
                    } else if (nilai > 0) {
                        doc.setTextColor(255, 165, 0); // Oranye jika sebagian
                    } else {
                        doc.setTextColor(255, 0, 0); // Merah jika 0
                    }
                    doc.text(`   Nilai : ${nilai} / ${nilaiMaksimal}`, 25, yPos);
                    doc.setTextColor(0, 0, 0); // Kembalikan ke hitam
                    yPos += 8;
                    
                    if (nilai < nilaiMaksimal && jawaban.koreksiDetail && jawaban.koreksiDetail[question.id]?.catatan) {
                        doc.setTextColor(100, 100, 100);
                        doc.text(`   Catatan : ${jawaban.koreksiDetail[question.id].catatan}`, 25, yPos);
                        doc.setTextColor(0, 0, 0);
                        yPos += 6;
                    }
                    
                    if (question.kunci && question.kunci.trim() !== '') {
                        doc.setTextColor(0, 128, 0);
                        doc.text(`   Kunci Jawaban : ${question.kunci}`, 25, yPos);
                        doc.setTextColor(0, 0, 0);
                        yPos += 6;
                    }
                    yPos += 5;
                }
                
                yPos += 5;
            }
            
            // Footer
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.setFont(undefined, 'italic');
            doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 105, 285, { align: 'center' });
            
            const fileName = `Lembar_Jawaban_${siswa.nama || 'siswa'}_${mapel}.pdf`;
            doc.save(fileName);
            
            resolve();
            
        } catch (error) {
            console.error('Error in generatePDFSiswa:', error);
            reject(error);
        }
    });
}