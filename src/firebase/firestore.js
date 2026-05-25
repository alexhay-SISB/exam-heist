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
import { BUILT_IN_BANKS, getBuiltInBank, isBuiltInId } from '../data/builtInBanks';

// ============ CLASS & SESSION MANAGEMENT ============

export const createClass = async (classCode, questionBankIds, teacherName, unitFilter = []) => {
  // Accept either a single bank id (legacy) or an array of ids.
  const ids = Array.isArray(questionBankIds) ? questionBankIds : [questionBankIds];
  await setDoc(doc(db, 'classes', classCode), {
    code: classCode,
    questionBankIds: ids,
    questionBankId: ids[0],   // keep legacy field for backward compatibility
    teacherName,
    unitFilter,          // array of syllabus unit numbers (1..6); [] = all units
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
  // Built-in banks are served from the bundled JSON — no network round trip.
  if (isBuiltInId(bankId)) return getBuiltInBank(bankId);

  const docSnap = await getDoc(doc(db, 'questionBanks', bankId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

/**
 * Load several banks and merge their concepts into a single virtual bank.
 * Used when a class is configured to draw from multiple question banks
 * (e.g. "all 3 built-in banks at once").
 */
export const getMergedQuestionBank = async (bankIds) => {
  const ids = Array.isArray(bankIds) ? bankIds : [bankIds];
  const banks = await Promise.all(ids.map(id => getQuestionBank(id)));
  const valid = banks.filter(b => b && Array.isArray(b.concepts));
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];

  return {
    id: ids.join('+'),
    name: valid.map(b => b.name).join(' + '),
    questionCount: valid.reduce((n, b) => n + b.concepts.length, 0),
    concepts: valid.flatMap(b => b.concepts),
    merged: true
  };
};

export const listQuestionBanks = async () => {
  const snapshot = await getDocs(collection(db, 'questionBanks'));
  const firestoreBanks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  // Built-ins always appear first so teachers can find them straight away.
  return [...BUILT_IN_BANKS, ...firestoreBanks];
};

export const deleteQuestionBank = async (bankId) => {
  // Guard: built-in banks live in the source tree and can't be deleted.
  if (isBuiltInId(bankId)) {
    throw new Error('Built-in question banks cannot be deleted.');
  }
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
