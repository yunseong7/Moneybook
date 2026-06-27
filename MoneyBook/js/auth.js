import { auth } from "./firebase-config.js";
import { loadTransactions } from "./app.js";

import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const provider = new GoogleAuthProvider();

/* ---------------- 로그인 버튼 ---------------- */
$(document).on("click", "#googleLoginBtn", async function () {
    try {
        await setPersistence(auth, browserSessionPersistence);
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("로그인 실패", error);
    }
});

/* ---------------- 로그아웃 ---------------- */
$(document).on("click", "#logoutBtn", async function () {
    await signOut(auth);
});

/* ---------------- 인증 상태 ---------------- */
onAuthStateChanged(auth, (user) => {
    if (user) {
        $("#overlay").hide();
        $("#loginModal").hide();
        $("#appContent").addClass("is_visible");
        loadTransactions();
    } else {
        $("#overlay").show();
        $("#loginModal").show();
        $("#appContent").removeClass("is_visible");
    }
});
