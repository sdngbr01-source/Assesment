// Konfigurasi Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDLrBJycmHrxy1Gow27cSIQh7PeuudtmnU",
  authDomain: "asessment-2-5c5d5.firebaseapp.com",
  projectId: "asessment-2-5c5d5",
  storageBucket: "asessment-2-5c5d5.firebasestorage.app",
  messagingSenderId: "1048522029291",
  appId: "1:1048522029291:web:3215f7906b74ad229d66ae"
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
