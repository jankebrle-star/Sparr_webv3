// ============================================================
//  SPARR — Unified Firebase Module
//  Importuj z tohoto souboru na každé stránce:
//  import { ... } from './sparr.js'
// ============================================================
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail,
  updatePassword, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc,
  collection, addDoc, getDocs,
  query, where, orderBy, limit,
  updateDoc, arrayUnion, arrayRemove,
  deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ── FIREBASE CONFIG ───────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAhU5DPvVC88jeuQyKrA1jdyRsx3ub8wBY",
  authDomain:        "sparr-ae946.firebaseapp.com",
  projectId:         "sparr-ae946",
  storageBucket:     "sparr-ae946.firebasestorage.app",
  messagingSenderId: "463453691804",
  appId:             "1:463453691804:web:66854c39094693669f7259"
};

// ── EMAILJS CONFIG ────────────────────────────────────────────
export const EJS = {
  publicKey: "HAijP0Nkt2ktswUcA",
  serviceId: "service_ytrykjs",
  templates: {
    welcome:  "Welcome",
    sparring: "Auto-Reply",
    message:  "template_message",
    follow:   "template_follow"
  }
};
export const APP_URL = "https://jankebrle-star.github.io/SPARR_web_v2";

// ── INIT ──────────────────────────────────────────────────────
const app     = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// ── AUTH STATE ────────────────────────────────────────────────
export let currentUser    = null;
export let currentProfile = null;

export function onAuthReady(cb) {
  return onAuthStateChanged(auth, async user => {
    currentUser    = user;
    currentProfile = user ? await getProfile(user.uid) : null;
    cb(user, currentProfile);
  });
}

// ── AUTH ──────────────────────────────────────────────────────
export const sparrLogin = (e, p) => signInWithEmailAndPassword(auth, e, p);

export async function sparrRegister(email, password, data) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: data.name });
  const profile = {
    uid: cred.user.uid, email,
    name: data.name, city: data.city || "",
    sport: data.sport || "Boxing", level: data.level || "Beginner",
    bio: "", weight: "", instagram: "",
    secondary: [], openToSpar: true, teachBeginners: false, photoURL: "",
    points: 0, sessions: 0, wins: 0,
    followers: [], following: [],
    createdAt: Date.now()
  };
  await saveProfile(cred.user.uid, profile);
  await _email(EJS.templates.welcome, { to_name: data.name, to_email: email, app_url: APP_URL });
  return cred.user;
}

export const sparrLogout = async () => {
  await signOut(auth);
  window.location.href = "index.html";
};
export const sparrResetPassword = e => sendPasswordResetEmail(auth, e);
export const sparrChangePassword = (u, p) => updatePassword(u, p);

// ── PROFILE ───────────────────────────────────────────────────
export const saveProfile = (uid, data) =>
  setDoc(doc(db, "fighters", uid), data, { merge: true });

export async function getProfile(uid) {
  const snap = await getDoc(doc(db, "fighters", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllFighters(opts = {}) {
  const constraints = [];
  if (opts.sport) constraints.push(where("sport", "==", opts.sport));
  constraints.push(orderBy("points", "desc"));
  if (opts.limit) constraints.push(limit(opts.limit));
  const snap = await getDocs(query(collection(db, "fighters"), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── PHOTO ─────────────────────────────────────────────────────
export async function uploadProfilePhoto(uid, file) {
  const r = ref(storage, `avatars/${uid}`);
  await uploadBytes(r, file);
  const url = await getDownloadURL(r);
  await saveProfile(uid, { photoURL: url });
  return url;
}

// ── FOLLOW ────────────────────────────────────────────────────
export async function toggleFollow(myUid, myName, targetUid, targetEmail, targetName) {
  const myDoc  = doc(db, "fighters", myUid);
  const tgtDoc = doc(db, "fighters", targetUid);
  const snap   = await getDoc(myDoc);
  const already = (snap.data()?.following || []).includes(targetUid);
  if (already) {
    await updateDoc(myDoc,  { following: arrayRemove(targetUid) });
    await updateDoc(tgtDoc, { followers: arrayRemove(myUid) });
    return false;
  }
  await updateDoc(myDoc,  { following: arrayUnion(targetUid) });
  await updateDoc(tgtDoc, { followers: arrayUnion(myUid) });
  await _email(EJS.templates.follow, { to_name: targetName, to_email: targetEmail, from_name: myName, app_url: APP_URL });
  return true;
}

// ── SPARRING ──────────────────────────────────────────────────
export async function sendSparringRequest(fromUid, fromName, toUid, toEmail, toName, message) {
  const msg = message || "Ahoj, rád/a bych si s tebou zasparoval/a!";
  await addDoc(collection(db, "sparringRequests"),
    { fromUid, fromName, toUid, toName, toEmail, message: msg, status: "pending", createdAt: Date.now() });
  await _email(EJS.templates.sparring,
    { to_name: toName, to_email: toEmail, from_name: fromName, message: msg, app_url: APP_URL });
}

export async function getSparringRequests(uid) {
  const snap = await getDocs(query(
    collection(db, "sparringRequests"),
    where("toUid", "==", uid), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export const updateSparringStatus = (id, status) =>
  updateDoc(doc(db, "sparringRequests", id), { status });

// ── CHAT ──────────────────────────────────────────────────────
export const getChatId = (a, b) => [a, b].sort().join("_");

export async function sendMessage(fromUid, fromName, toUid, toName, toEmail, text) {
  const chatId = getChatId(fromUid, toUid);
  await addDoc(collection(db, "chats", chatId, "messages"),
    { fromUid, fromName, text, ts: Date.now() });
  await setDoc(doc(db, "chats", chatId), {
    participants: [fromUid, toUid],
    participantNames: { [fromUid]: fromName, [toUid]: toName },
    lastMessage: text, lastMessageTs: Date.now(),
    [`unread_${toUid}`]: true
  }, { merge: true });
  if (toEmail) {
    await _email(EJS.templates.message,
      { to_name: toName, to_email: toEmail, from_name: fromName, preview: text.slice(0, 100), app_url: APP_URL });
  }
}

export function listenMessages(uid1, uid2, cb) {
  return onSnapshot(
    query(collection(db, "chats", getChatId(uid1, uid2), "messages"), orderBy("ts", "asc")),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function getChats(uid) {
  const snap = await getDocs(query(
    collection(db, "chats"),
    where("participants", "array-contains", uid),
    orderBy("lastMessageTs", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export const markRead = (chatId, uid) =>
  updateDoc(doc(db, "chats", chatId), { [`unread_${uid}`]: false }).catch(() => {});

// ── WALL ──────────────────────────────────────────────────────
export const createPost = (uid, authorName, data) =>
  addDoc(collection(db, "wallPosts"),
    { uid, authorName, ...data, replies: 0, createdAt: Date.now() });

export async function getWallPosts(sport = null) {
  const constraints = [orderBy("createdAt", "desc")];
  if (sport) constraints.unshift(where("sport", "==", sport));
  const snap = await getDocs(query(collection(db, "wallPosts"), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export const deletePost = id => deleteDoc(doc(db, "wallPosts", id));

// ── EMAIL ─────────────────────────────────────────────────────
async function _email(templateId, params) {
  try {
    if (typeof emailjs === "undefined") return;
    await emailjs.send(EJS.serviceId, templateId, params);
  } catch(e) { console.warn("EmailJS:", e?.text || e); }
}

// ── HELPERS ───────────────────────────────────────────────────
export function initials(name = "") {
  return name.trim().split(" ").map(n => n[0] || "").join("").slice(0, 2).toUpperCase() || "?";
}
export function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000)    return "právě teď";
  if (d < 3600000)  return `${Math.floor(d / 60000)}m`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h`;
  return `${Math.floor(d / 86400000)}d`;
}
