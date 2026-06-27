import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCRgEhw6IU6WtFvnV2MxMY3dEvuKDsYCNc",
  authDomain: "moneybook-731a2.firebaseapp.com",
  projectId: "moneybook-731a2",
  storageBucket: "moneybook-731a2.firebasestorage.app",
  messagingSenderId: "721613434789",
  appId: "1:721613434789:web:5329006e76249f075a024c"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);