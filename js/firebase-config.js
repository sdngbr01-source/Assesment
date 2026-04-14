// Konfigurasi Firebase
const firebaseConfig = {
   apiKey: "AIzaSyAAF-5CHAg4QLx3_d-71MgfA3weCsCbiwE",
  authDomain: "asessment-sumatif.firebaseapp.com",
  projectId: "asessment-sumatif",
  storageBucket: "asessment-sumatif.firebasestorage.app",
  messagingSenderId: "432547679185",
  appId: "1:432547679185:web:c976b63120812db12d2ef0"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Collection references
const usersRef = db.collection('users');
const classesRef = db.collection('classes');
const subjectsRef = db.collection('subjects');
const questionsRef = db.collection('questions');
const examsRef = db.collection('exams');
const answersRef = db.collection('answers');
const gradesRef = db.collection('grades');

// Data kelas yang tersedia
const availableClasses = ['4A', '4B', '5A', '5B', '6A', '6B'];

// Data mata pelajaran
const availableSubjects = [
    'Matematika',
    'Bahasa Indonesia',
    'IPA',
    'IPS',
    'PPKn',
    'PJOK',
    'SBdP'
];
