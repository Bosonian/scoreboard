import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBS2YM2vZxblrAsXaRrK2BPa1nQuDsRJWk",
  authDomain: "igfap-452720.firebaseapp.com",
  projectId: "igfap-452720",
  storageBucket: "igfap-452720.firebasestorage.app",
  messagingSenderId: "564499947017",
  appId: "1:564499947017:web:72b277ba26ac5ed092e2d8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
