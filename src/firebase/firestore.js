import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  deleteDoc,
  where
} from 'firebase/firestore';
import { db } from './config';

// ============ CLASS & SESSION MANAGEMENT ============

export const createClass = async (classCode, questionBankId, teacherName) => {
  await setDoc(doc(db, 'classes', classCode), {
    code: classCode,
    questionBankId,
    teacherName,
    createdAt: serverTimestamp(),
    active: true
  });
};

export const getClass = async (classCode) => {
  const docSnap = await getDoc(doc(db, 'classes', classCode));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

// ============ PLAYER MANAGEMENT ============

export const joinSession = async (classCode, playerName) => {
  const playerId = `${playerName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
  await setDoc(doc(db, 'sessions', classCode, 'players', playerId), {
    name: playerName,
    score: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    stealsCount: 0,
    pointsStolen: 0,
    pointsLost: 0,
    currentDifficulty: 'EASY',
    questionsCompleted: 0,
    joinedAt: serverTimestamp(),
    lastActivity: serverTimestamp(),
    active: true
  });
  return playerId;
};

export const updatePlayerScore = async (classCode, playerId, scoreDelta, stats = {}) => {
  const playerRef = doc(db, 'sessions', classCode, 'players', playerId);
  const updates = {
    score: increment(scoreDelta),
    lastActivity: serverTimestamp(),
    ...stats
  };
  if (stats.correct) updates.correctAnswers = increment(1);
  if (stats.wrong) updates.wrongAnswers = increment(1);
  if (stats.questionsCompleted) updates.questionsCompleted = increment(1);

  delete updates.correct;
  delete updates.wrong;

  await updateDoc(playerRef, updates);
};

export const stealPoints = async (classCode, robberId, victimId, amount) => {
  const robberRef = doc(db, 'sessions', classCode, 'players', robberId);
  const victimRef = doc(db, 'sessions', classCode, 'players', victimId);

  await updateDoc(robberRef, {
    score: increment(amount),
    stealsCount: increment(1),
    pointsStolen: increment(amount)
  });

  await updateDoc(victimRef, {
    score: increment(-amount),
    pointsLost: increment(amount)
  });

  // Log the steal event
  await addDoc(collection(db, 'sessions', classCode, 'events'), {
    type: 'steal',
    robberId,
    victimId,
    amount,
    timestamp: serverTimestamp()
  });
};

// ============ REAL-TIME LISTENERS ============

export const subscribeToLeaderboard = (classCode, callback) => {
  const q = query(
    collection(db, 'sessions', classCode, 'players'),
    orderBy('score', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const players = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(players);
  });
};

export const subscribeToEvents = (classCode, callback) => {
  const q = query(
    collection(db, 'sessions', classCode, 'events'),
    orderBy('timestamp', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.slice(0, 10).map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(events);
  });
};

// ============ QUESTION BANK MANAGEMENT ============

export const saveQuestionBank = async (bankId, data) => {
  await setDoc(doc(db, 'questionBanks', bankId), {
    ...data,
    createdAt: serverTimestamp()
  });
};

export const getQuestionBank = async (bankId) => {
  const docSnap = await getDoc(doc(db, 'questionBanks', bankId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

export const listQuestionBanks = async () => {
  const snapshot = await getDocs(collection(db, 'questionBanks'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const deleteQuestionBank = async (bankId) => {
  await deleteDoc(doc(db, 'questionBanks', bankId));
};

// ============ SESSION RESET ============

export const resetSession = async (classCode) => {
  const playersSnapshot = await getDocs(
    collection(db, 'sessions', classCode, 'players')
  );

  const deletePromises = playersSnapshot.docs.map(d =>
    deleteDoc(doc(db, 'sessions', classCode, 'players', d.id))
  );
  await Promise.all(deletePromises);

  const eventsSnapshot = await getDocs(
    collection(db, 'sessions', classCode, 'events')
  );
  const deleteEvents = eventsSnapshot.docs.map(d =>
    deleteDoc(doc(db, 'sessions', classCode, 'events', d.id))
  );
  await Promise.all(deleteEvents);
};
