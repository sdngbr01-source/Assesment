// pdf-setting.js
// Manajemen setting PDF dengan upload gambar lokal

// Key untuk localStorage
const PDF_SETTING_KEY = 'pdf_header_setting';

// Fungsi untuk mendapatkan elemen dengan aman
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element dengan id "${id}" tidak ditemukan`);
    }
    return element;
}

// Kompres gambar sebelum diupload ke Firestore
async function compressImage(file, maxWidth = 200, maxHeight = 200, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    } else {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                const sizeInBytes = Math.round((compressedDataUrl.length * 3) / 4);
                console.log(`Ukuran gambar setelah kompresi: ${(sizeInBytes / 1024).toFixed(2)} KB`);
                
                if (sizeInBytes > 800000) {
                    const moreCompressed = canvas.toDataURL('image/jpeg', 0.5);
                    resolve(moreCompressed);
                } else {
                    resolve(compressedDataUrl);
                }
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

// Handle upload logo dengan kompresi
async function handleLogoUpload(position, input) {
    const file = input.files[0];
    if (!file) return;
    
    if (!file.type.match('image.*')) {
        showToast('Hanya file gambar yang diperbolehkan!', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran file maksimal 5MB!', 'error');
        return;
    }
    
    showToast('📸 Memproses gambar...', 'info');
    
    try {
        const compressedBase64 = await compressImage(file, 150, 150, 0.7);
        const sizeInBytes = Math.round((compressedBase64.length * 3) / 4);
        
        if (sizeInBytes > 900000) {
            showToast('Gambar masih terlalu besar setelah kompresi', 'error');
            return;
        }
        
        if (position === 'kiri') {
            const dataInput = getElement('logoKiriData');
            if (dataInput) dataInput.value = compressedBase64;
            const img = getElement('logoKiriImg');
            if (img) {
                img.src = compressedBase64;
                img.style.display = 'block';
            }
        } else {
            const dataInput = getElement('logoKananData');
            if (dataInput) dataInput.value = compressedBase64;
            const img = getElement('logoKananImg');
            if (img) {
                img.src = compressedBase64;
                img.style.display = 'block';
            }
        }
        
        updatePdfPreview();
        showToast(`Logo ${position === 'kiri' ? 'kiri' : 'kanan'} berhasil diupload`, 'success');
        
    } catch (error) {
        console.error('Error compressing image:', error);
        showToast('Gagal memproses gambar', 'error');
    }
}

// Update preview header
function updatePdfPreview() {
    const previewDiv = getElement('pdfPreview');
    if (!previewDiv) return;
    
    const sekolahNama = getElement('sekolahNama')?.value || 'Nama Sekolah';
    const sekolahAlamat = getElement('sekolahAlamat')?.value || 'Alamat Sekolah';
    const sekolahKota = getElement('sekolahKota')?.value || '';
    const sekolahTelp = getElement('sekolahTelp')?.value || '';
    const sekolahEmail = getElement('sekolahEmail')?.value || '';
    const sekolahMotto = getElement('sekolahMotto')?.value || '';
    const headerWarna = getElement('headerWarna')?.value || '#2c3e50';
    const logoWidth = getElement('logoWidth')?.value || 40;
    const logoHeight = getElement('logoHeight')?.value || 40;
    const logoKiriData = getElement('logoKiriData')?.value || '';
    const logoKananData = getElement('logoKananData')?.value || '';
    
    previewDiv.innerHTML = `
        <div style="background: ${headerWarna}; color: white; padding: 15px; border-radius: 5px; text-align: center;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 15px;">
                ${logoKiriData ? `<img src="${logoKiriData}" style="width: ${logoWidth}px; height: ${logoHeight}px; object-fit: contain;">` : '<div style="width: 40px;"></div>'}
                <div style="flex: 1;">
                    <div style="font-size: 16px; font-weight: bold; white-space: pre-line;">${escapeHtml(sekolahNama)}</div>
                    <div style="font-size: 12px; white-space: pre-line;">${escapeHtml(sekolahAlamat)}</div>
                    ${sekolahKota ? `<div style="font-size: 11px;">${escapeHtml(sekolahKota)}</div>` : ''}
                    <div style="font-size: 10px; margin-top: 5px;">
                        ${sekolahTelp ? `Telp: ${escapeHtml(sekolahTelp)} | ` : ''}
                        ${sekolahEmail ? `Email: ${escapeHtml(sekolahEmail)}` : ''}
                    </div>
                    ${sekolahMotto ? `<div style="font-size: 11px; font-style: italic; margin-top: 5px; white-space: pre-line;">${escapeHtml(sekolahMotto)}</div>` : ''}
                </div>
                ${logoKananData ? `<img src="${logoKananData}" style="width: ${logoWidth}px; height: ${logoHeight}px; object-fit: contain;">` : '<div style="width: 40px;"></div>'}
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Simpan setting PDF
const pdfSettingForm = getElement('pdfSettingForm');
if (pdfSettingForm) {
    pdfSettingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const setting = {
            sekolahNama: getElement('sekolahNama')?.value || '',
            sekolahAlamat: getElement('sekolahAlamat')?.value || '',
            sekolahKota: getElement('sekolahKota')?.value || '',
            sekolahTelp: getElement('sekolahTelp')?.value || '',
            sekolahEmail: getElement('sekolahEmail')?.value || '',
            sekolahMotto: getElement('sekolahMotto')?.value || '',
            headerWarna: getElement('headerWarna')?.value || '#2c3e50',
            logoWidth: getElement('logoWidth')?.value || 40,
            logoHeight: getElement('logoHeight')?.value || 40,
            logoKiriData: getElement('logoKiriData')?.value || '',
            logoKananData: getElement('logoKananData')?.value || '',
            updatedAt: new Date().toISOString()
        };
        
        try {
            localStorage.setItem(PDF_SETTING_KEY, JSON.stringify(setting));
            
            if (typeof db !== 'undefined' && db) {
                const settingWithoutLogo = {
                    sekolahNama: setting.sekolahNama,
                    sekolahAlamat: setting.sekolahAlamat,
                    sekolahKota: setting.sekolahKota,
                    sekolahTelp: setting.sekolahTelp,
                    sekolahEmail: setting.sekolahEmail,
                    sekolahMotto: setting.sekolahMotto,
                    headerWarna: setting.headerWarna,
                    logoWidth: setting.logoWidth,
                    logoHeight: setting.logoHeight,
                    hasLogoKiri: !!setting.logoKiriData,
                    hasLogoKanan: !!setting.logoKananData,
                    updatedAt: setting.updatedAt
                };
                await db.collection('settings').doc('pdfHeader').set(settingWithoutLogo, { merge: true });
            }
            
            showToast('✅ Setting PDF berhasil disimpan!', 'success');
        } catch (error) {
            console.error('Error saving PDF setting:', error);
            showToast('❌ Gagal menyimpan setting PDF', 'error');
        }
    });
}

// Load setting PDF
async function loadPdfSetting() {
    try {
        let setting = null;
        const localSetting = localStorage.getItem(PDF_SETTING_KEY);
        if (localSetting) {
            setting = JSON.parse(localSetting);
        }
        
        if (typeof db !== 'undefined' && db) {
            try {
                const doc = await db.collection('settings').doc('pdfHeader').get();
                if (doc.exists) {
                    const firestoreData = doc.data();
                    setting = setting ? { ...setting, ...firestoreData } : firestoreData;
                }
            } catch (err) {
                console.warn('Gagal load dari Firestore:', err);
            }
        }
        
        if (setting) {
            const sekolahNama = getElement('sekolahNama');
            if (sekolahNama) sekolahNama.value = setting.sekolahNama || '';
            
            const sekolahAlamat = getElement('sekolahAlamat');
            if (sekolahAlamat) sekolahAlamat.value = setting.sekolahAlamat || '';
            
            const sekolahKota = getElement('sekolahKota');
            if (sekolahKota) sekolahKota.value = setting.sekolahKota || '';
            
            const sekolahTelp = getElement('sekolahTelp');
            if (sekolahTelp) sekolahTelp.value = setting.sekolahTelp || '';
            
            const sekolahEmail = getElement('sekolahEmail');
            if (sekolahEmail) sekolahEmail.value = setting.sekolahEmail || '';
            
            const sekolahMotto = getElement('sekolahMotto');
            if (sekolahMotto) sekolahMotto.value = setting.sekolahMotto || '';
            
            const headerWarna = getElement('headerWarna');
            if (headerWarna) headerWarna.value = setting.headerWarna || '#2c3e50';
            
            const logoWidth = getElement('logoWidth');
            if (logoWidth) logoWidth.value = setting.logoWidth || 40;
            
            const logoHeight = getElement('logoHeight');
            if (logoHeight) logoHeight.value = setting.logoHeight || 40;
            
            if (setting.logoKiriData) {
                const logoKiriData = getElement('logoKiriData');
                if (logoKiriData) logoKiriData.value = setting.logoKiriData;
                const img = getElement('logoKiriImg');
                if (img) {
                    img.src = setting.logoKiriData;
                    img.style.display = 'block';
                }
            }
            
            if (setting.logoKananData) {
                const logoKananData = getElement('logoKananData');
                if (logoKananData) logoKananData.value = setting.logoKananData;
                const img = getElement('logoKananImg');
                if (img) {
                    img.src = setting.logoKananData;
                    img.style.display = 'block';
                }
            }
            
            updatePdfPreview();
        } else {
            resetPdfSetting();
        }
    } catch (error) {
        console.error('Error loading PDF setting:', error);
        resetPdfSetting();
    }
}

function resetPdfSetting() {
    const sekolahNama = getElement('sekolahNama');
    if (sekolahNama) sekolahNama.value = 'SD NEGERI 01 JAKARTA\nTERAKREDITASI A';
    
    const sekolahAlamat = getElement('sekolahAlamat');
    if (sekolahAlamat) sekolahAlamat.value = 'Jl. Pendidikan No. 123\nKel. Menteng, Kec. Menteng';
    
    const sekolahKota = getElement('sekolahKota');
    if (sekolahKota) sekolahKota.value = 'Jakarta Pusat';
    
    const sekolahTelp = getElement('sekolahTelp');
    if (sekolahTelp) sekolahTelp.value = '(021) 12345678';
    
    const sekolahEmail = getElement('sekolahEmail');
    if (sekolahEmail) sekolahEmail.value = 'info@sekolah.sch.id';
    
    const sekolahMotto = getElement('sekolahMotto');
    if (sekolahMotto) sekolahMotto.value = 'Berilmu, Beriman, Berakhlak Mulia\nMembangun Generasi Unggul';
    
    const headerWarna = getElement('headerWarna');
    if (headerWarna) headerWarna.value = '#2c3e50';
    
    const logoWidth = getElement('logoWidth');
    if (logoWidth) logoWidth.value = '40';
    
    const logoHeight = getElement('logoHeight');
    if (logoHeight) logoHeight.value = '40';
    
    const logoKiriData = getElement('logoKiriData');
    if (logoKiriData) logoKiriData.value = '';
    
    const logoKananData = getElement('logoKananData');
    if (logoKananData) logoKananData.value = '';
    
    const logoKiriImg = getElement('logoKiriImg');
    if (logoKiriImg) logoKiriImg.style.display = 'none';
    
    const logoKananImg = getElement('logoKananImg');
    if (logoKananImg) logoKananImg.style.display = 'none';
    
    updatePdfPreview();
    showToast('Setting direset ke default', 'info');
}

// ============ GENERATE PDF ============
async function generateLembarJawaban() {
    const kelas = getElement('generateKelas')?.value;
    const mapel = getElement('generateMapel')?.value;
    
    if (!kelas || !mapel) {
        showToast('Pilih kelas dan mata pelajaran!', 'error');
        return;
    }
    
    const setting = JSON.parse(localStorage.getItem(PDF_SETTING_KEY) || '{}');
    
    if (typeof usersRef === 'undefined') {
        showToast('Data siswa tidak tersedia', 'error');
        return;
    }
    
    try {
        showToast('📄 Mengambil data siswa...', 'info');
        
        const siswaSnapshot = await usersRef
            .where('kelas', '==', kelas)
            .where('role', '==', 'siswa')
            .get();
        
        if (siswaSnapshot.empty) {
            showToast('Tidak ada siswa di kelas ini', 'error');
            return;
        }
        
        let soalMap = new Map();
        if (typeof soalRef !== 'undefined') {
            const soalSnapshot = await soalRef
                .where('kelas', '==', kelas)
                .where('mataPelajaran', '==', mapel)
                .get();
            
            soalSnapshot.forEach(doc => {
                const soal = doc.data();
                soalMap.set(soal.nomor, soal);
            });
        }
        
        const siswaList = [];
        siswaSnapshot.forEach(doc => {
            siswaList.push({ id: doc.id, ...doc.data() });
        });
        
        showToast(`📄 Membuat ${siswaList.length} lembar jawaban...`, 'info');
        
        for (let i = 0; i < siswaList.length; i++) {
            const siswa = siswaList[i];
            
            let jawabanData = null;
            if (typeof answersRef !== 'undefined') {
                const jawabanSnapshot = await answersRef
                    .where('siswaId', '==', siswa.id)
                    .where('mataPelajaran', '==', mapel)
                    .orderBy('waktu', 'desc')
                    .limit(1)
                    .get();
                
                if (!jawabanSnapshot.empty) {
                    jawabanData = jawabanSnapshot.docs[0].data();
                }
            }
            
            await generateSinglePDF(siswa, kelas, mapel, setting, jawabanData, soalMap);
            
            if ((i + 1) % 5 === 0 || i === siswaList.length - 1) {
                showToast(`Progress: ${i + 1}/${siswaList.length}`, 'info');
            }
        }
        
        showToast(`✅ Berhasil generate ${siswaList.length} lembar jawaban`, 'success');
    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('❌ Gagal generate PDF: ' + error.message, 'error');
    }
}

async function generateSinglePDF(siswa, kelas, mapel, setting, jawabanData, soalMap) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // HEADER
    const headerHeight = 45;
    const headerWarna = setting.headerWarna || '#2c3e50';
    
    doc.setFillColor(parseInt(headerWarna.slice(1,3), 16),
                     parseInt(headerWarna.slice(3,5), 16),
                     parseInt(headerWarna.slice(5,7), 16));
    doc.rect(0, 0, 210, headerHeight, 'F');
    
    const logoWidth = (parseInt(setting.logoWidth) || 40) / 1.5;
    const logoHeight = (parseInt(setting.logoHeight) || 40) / 1.5;
    const logoY = (headerHeight - logoHeight) / 2;
    
    if (setting.logoKiriData && setting.logoKiriData.startsWith('data:image')) {
        try {
            doc.addImage(setting.logoKiriData, 'JPEG', 10, logoY, logoWidth, logoHeight);
        } catch (e) {}
    }
    
    if (setting.logoKananData && setting.logoKananData.startsWith('data:image')) {
        try {
            doc.addImage(setting.logoKananData, 'JPEG', 210 - 10 - logoWidth, logoY, logoWidth, logoHeight);
        } catch (e) {}
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    
    const sekolahNama = setting.sekolahNama?.split('\n') || ['SEKOLAH'];
    let textY = 12;
    sekolahNama.forEach(line => {
        doc.text(line, 105, textY, { align: 'center' });
        textY += 6;
    });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const sekolahAlamat = setting.sekolahAlamat?.split('\n') || [];
    sekolahAlamat.forEach(line => {
        doc.text(line, 105, textY, { align: 'center' });
        textY += 5;
    });
    
    if (setting.sekolahKota) doc.text(setting.sekolahKota, 105, textY, { align: 'center' });
    
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(10, headerHeight, 200, headerHeight);
    
    // INFORMASI SISWA
    const infoStartY = headerHeight + 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('LEMBAR JAWABAN', 105, infoStartY, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let currentY = infoStartY + 10;
    doc.text(`Nama: ${siswa.nama || '-'}`, 20, currentY);
    doc.text(`NIS: ${siswa.nis || '-'}`, 20, currentY + 7);
    doc.text(`Kelas: ${kelas}`, 20, currentY + 14);
    doc.text(`Mata Pelajaran: ${mapel}`, 20, currentY + 21);
    doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 20, currentY + 28);
    
    // RINGKASAN NILAI
    if (jawabanData) {
        doc.setFont('helvetica', 'bold');
        doc.text('RINGKASAN NILAI:', 140, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(`PG: ${jawabanData.nilaiPG || 0} / ${jawabanData.totalPG || 0}`, 140, currentY + 7);
        doc.text(`Isian: ${jawabanData.nilaiIsian || 0} / ${jawabanData.totalIsian || 0}`, 140, currentY + 14);
        doc.text(`Uraian: ${jawabanData.nilaiUraian || 0} / ${jawabanData.totalUraian || 0}`, 140, currentY + 21);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total: ${jawabanData.nilaiTotal || 0} / ${jawabanData.totalMaksimal || 0}`, 140, currentY + 28);
        doc.setFont('helvetica', 'normal');
    }
    
    // KUMPULKAN JAWABAN
    let allJawaban = [];
    
    if (jawabanData) {
        const jumlahSoalPG = jawabanData.jumlahSoal?.pg || 0;
        const jumlahSoalIsian = jawabanData.jumlahSoal?.isian || 0;
        const nilaiPerSoalPG = jumlahSoalPG > 0 ? (jawabanData.totalPG || 0) / jumlahSoalPG : 1;
        const nilaiPerSoalIsian = jumlahSoalIsian > 0 ? (jawabanData.totalIsian || 0) / jumlahSoalIsian : 2;
        
        // Jawaban PG
        if (jawabanData.jawabanPG) {
            Object.values(jawabanData.jawabanPG).forEach(item => {
                allJawaban.push({
                    nomor: parseInt(item.nomor),
                    jenis: 'PG',
                    soal: item.soal || '',
                    jawaban: item.jawaban || '-',
                    kunci: item.kunci || '-',
                    benar: item.jawaban === item.kunci,
                    nilai: item.jawaban === item.kunci ? nilaiPerSoalPG : 0
                });
            });
        }
        
        // Jawaban Isian
        if (jawabanData.jawabanIsian) {
            Object.values(jawabanData.jawabanIsian).forEach(item => {
                const isBenar = item.jawaban && item.kunci && 
                                item.jawaban.toString().toLowerCase() === item.kunci.toString().toLowerCase();
                allJawaban.push({
                    nomor: parseInt(item.nomor),
                    jenis: 'Isian',
                    soal: item.soal || '',
                    jawaban: item.jawaban || '-',
                    kunci: item.kunci || '-',
                    benar: isBenar,
                    nilai: isBenar ? nilaiPerSoalIsian : 0
                });
            });
        }
        
        // Jawaban Uraian
        if (jawabanData.koreksiDetail) {
            Object.values(jawabanData.koreksiDetail).forEach(item => {
                let nomor = parseInt(item.nomor);
                if (isNaN(nomor)) nomor = 4;
                
                let kunciJawaban = '-';
                if (soalMap && soalMap.has(nomor)) {
                    kunciJawaban = soalMap.get(nomor).kunci || '-';
                }
                
                allJawaban.push({
                    nomor: nomor,
                    jenis: 'Uraian',
                    soal: item.soal || '',
                    jawaban: item.jawaban || '-',
                    kunci: kunciJawaban,
                    benar: (item.nilai || 0) > 0,
                    nilai: item.nilai || 0,
                    nilaiMaksimal: item.nilaiMaksimal || 5
                });
            });
        }
        
        allJawaban.sort((a, b) => a.nomor - b.nomor);
    }
    
    // TABEL JAWABAN - Dengan lebar yang disesuaikan
    const tableStartY = currentY + 38;
    const tableData = [];
    
    for (const item of allJawaban) {
        // Gunakan teks biasa untuk B/S
        let statusText = '';
        if (item.benar === true) {
            statusText = 'Benar';
        } else if (item.benar === false) {
            statusText = 'Salah';
        } else {
            statusText = '-';
        }
        
        tableData.push([
            item.nomor,
            item.jenis,
            item.soal.length > 40 ? item.soal.substring(0, 37) + '...' : item.soal,
            item.jawaban.length > 20 ? item.jawaban.substring(0, 17) + '...' : item.jawaban,
            item.kunci,
            statusText,
            item.jenis === 'Uraian' ? `${item.nilai}/${item.nilaiMaksimal}` : item.nilai.toString()
        ]);
    }
    
    if (tableData.length === 0) {
        tableData.push(['-', '-', 'Belum ada data jawaban', '-', '-', '-', '-']);
    }
    
    doc.autoTable({
        startY: tableStartY,
        head: [['No', 'Jenis', 'Soal', 'Jawaban', 'Kunci', 'B/S', 'Nilai']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
            fillColor: [52, 73, 94], 
            textColor: [255, 255, 255], 
            fontStyle: 'bold', 
            halign: 'center', 
            fontSize: 7 
        },
        columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 10, halign: 'center' },
            2: { cellWidth: 60, halign: 'left' },
            3: { cellWidth: 30, halign: 'left' },
            4: { cellWidth: 18, halign: 'center' },
            5: { cellWidth: 15, halign: 'center' },
            6: { cellWidth: 12, halign: 'center' }
        },
        styles: { 
            fontSize: 6, 
            cellPadding: 1.5, 
            lineColor: [200, 200, 200], 
            overflow: 'linebreak', 
            valign: 'middle' 
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        didDrawCell: (data) => {
            // Warna untuk kolom B/S (index 5)
            if (data.column.index === 5 && data.cell.raw && data.cell.raw !== '-') {
                const isBenar = data.cell.raw === 'Benar';
                const textColor = isBenar ? [40, 167, 69] : [220, 53, 69];
                
                const cellX = data.cell.x, cellY = data.cell.y;
                const cellWidth = data.cell.width, cellHeight = data.cell.height;
                const bgColor = data.row.index % 2 === 0 ? [255, 255, 255] : [245, 245, 245];
                
                doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
                doc.rect(cellX, cellY, cellWidth, cellHeight, 'F');
                doc.setDrawColor(200, 200, 200);
                doc.rect(cellX, cellY, cellWidth, cellHeight, 'S');
                doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                doc.setFontSize(6);
                doc.text(data.cell.raw, cellX + data.cell.padding('left'), cellY + data.cell.padding('top') + 1.5);
                doc.setTextColor(0, 0, 0);
                return true;
            }
            return false;
        },
        margin: { left: 10, right: 10 }
    });
    
    // KESIMPULAN
    const finalY = doc.lastAutoTable.finalY + 10;
    
    if (jawabanData) {
        const totalNilai = jawabanData.nilaiTotal || 0;
        const totalMaksimal = jawabanData.totalMaksimal || 0;
        const persentase = totalMaksimal > 0 ? Math.round((totalNilai / totalMaksimal) * 100) : 0;
        
        let predikat = '', predikatWarna = '';
        if (persentase >= 90) { predikat = 'A (Sangat Baik)'; predikatWarna = '#28a745'; }
        else if (persentase >= 80) { predikat = 'B (Baik)'; predikatWarna = '#17a2b8'; }
        else if (persentase >= 70) { predikat = 'C (Cukup)'; predikatWarna = '#ffc107'; }
        else if (persentase >= 60) { predikat = 'D (Kurang)'; predikatWarna = '#fd7e14'; }
        else { predikat = 'E (Sangat Kurang)'; predikatWarna = '#dc3545'; }
        
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.3);
        doc.line(15, finalY - 5, 195, finalY - 5);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('KESIMPULAN NILAI:', 15, finalY);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Total Nilai: ${totalNilai} / ${totalMaksimal}`, 15, finalY + 6);
        doc.text(`Persentase: ${persentase}%`, 15, finalY + 12);
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(parseInt(predikatWarna.slice(1,3), 16),
                         parseInt(predikatWarna.slice(3,5), 16),
                         parseInt(predikatWarna.slice(5,7), 16));
        doc.text(`Predikat: ${predikat}`, 15, finalY + 18);
        doc.setTextColor(0, 0, 0);
        
        doc.setFont('helvetica', 'normal');
        doc.text(`Status: ${jawabanData.statusKoreksi === 'selesai' ? 'Sudah Dikoreksi' : 'Menunggu Koreksi'}`, 15, finalY + 24);
        if (jawabanData.statusKoreksi === 'selesai') {
            doc.text(`Dikoreksi oleh: ${jawabanData.dikoreksiOleh || '-'}`, 15, finalY + 30);
        }
        
        doc.setFontSize(8);
        doc.text('Mengetahui,', 140, finalY + 10);
        doc.text('Guru Mata Pelajaran', 140, finalY + 16);
        doc.text('_________________________', 140, finalY + 24);
        doc.text(`(${mapel})`, 140, finalY + 30);
        doc.text('Orang Tua/Wali,', 140, finalY + 40);
        doc.text('_________________________', 140, finalY + 48);
    } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(128, 128, 128);
        doc.text('* Belum ada data nilai untuk ujian ini *', 105, finalY, { align: 'center' });
    }
    
    // FOOTER
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Halaman ${i} dari ${pageCount}`, 105, 287, { align: 'center' });
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(10, 285, 200, 285);
    }
    
    doc.save(`Lembar_Jawaban_${kelas}_${mapel}_${siswa.nama || siswa.nis || 'siswa'}.pdf`);
}
// Download Laporan Excel
async function downloadLaporanKelas() {
    const kelas = getElement('laporanKelas')?.value;
    const mapel = getElement('laporanMapel')?.value;
    
    if (!kelas || !mapel) {
        showToast('Pilih kelas dan mata pelajaran!', 'error');
        return;
    }
    
    try {
        const nilaiSnapshot = await answersRef
            .where('kelas', '==', kelas)
            .where('mataPelajaran', '==', mapel)
            .get();
        
        if (nilaiSnapshot.empty) {
            showToast('Tidak ada data nilai untuk kelas ini', 'error');
            return;
        }
        
        const nilaiMap = new Map();
        nilaiSnapshot.forEach(doc => {
            const nilai = doc.data();
            const key = nilai.siswaId;
            if (!nilaiMap.has(key) || (nilai.waktu?.toDate?.() > nilaiMap.get(key).waktu?.toDate?.())) {
                nilaiMap.set(key, nilai);
            }
        });
        
        const excelData = [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Mata Pelajaran', 'Nilai PG', 'Nilai Isian', 'Nilai Uraian', 'Total Nilai', 'Status']];
        let no = 1;
        
        for (const nilai of nilaiMap.values()) {
            excelData.push([
                no++,
                nilai.nis || '-',
                nilai.siswaNama || '-',
                nilai.kelas || '-',
                nilai.mataPelajaran || '-',
                nilai.nilaiPG || 0,
                nilai.nilaiIsian || 0,
                nilai.nilaiUraian || 0,
                nilai.nilaiTotal || 0,
                nilai.statusKoreksi === 'pending' ? 'Menunggu Koreksi' : 'Selesai'
            ]);
        }
        
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Nilai_${kelas}_${mapel}`);
        XLSX.writeFile(wb, `Laporan_Nilai_${kelas}_${mapel}_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        showToast(`✅ Laporan berhasil diunduh`, 'success');
    } catch (error) {
        console.error('Error downloading laporan:', error);
        showToast('❌ Gagal download laporan', 'error');
    }
}

function showToast(message, type = 'success') {
    const toastContainer = getElement('toastContainer');
    if (!toastContainer) {
        if (type === 'error') alert(message);
        else console.log(message);
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Inisialisasi
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => loadPdfSetting(), 500);
});

// Export
if (typeof window !== 'undefined') {
    window.handleLogoUpload = handleLogoUpload;
    window.loadPdfSetting = loadPdfSetting;
    window.resetPdfSetting = resetPdfSetting;
    window.generateLembarJawaban = generateLembarJawaban;
    window.downloadLaporanKelas = downloadLaporanKelas;
}