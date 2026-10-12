import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { storage, uploadImageDataUrl, deleteImage } from './storage.js';
import { getSession, signIn, signOut, onAuthChange } from './auth.js';
import {
  Search, Plus, X, Pencil, Trash2, Lock, Unlock, ChevronDown, ChevronUp,
  Download, Upload, BookOpen, Filter, Save, Menu, Check, Tag as TagIcon,
  Eye, EyeOff, GraduationCap, Image as ImageIcon, Play, Shuffle, RotateCcw, Sparkles,
  Database, ArrowUp, ArrowDown, ExternalLink, CalendarClock
} from 'lucide-react';

/* ---------- storage keys ---------- */
const K_QUESTIONS = 'qbank:questions';
const K_TOPICS = 'qbank:topics';
const K_PRESENTATIONS = 'qbank:presentations';
const K_PRES_TOPICS = 'qbank:pres_topics';
const IMG_PREFIX = 'qbank:img:';

/* in-memory cache so we don't re-fetch the same pasted image twice in a session */
const imageDataCache = new Map();

/* compress a pasted/dropped image file down to a reasonable size before storing it */
function fileToCompressedDataUrl(file, maxWidth = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image decode failed'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);

/* ---------- palette (card-catalog / archive theme) ---------- */
const PALETTE = ['#A63D40', '#2F5233', '#8A6A2F', '#3E5C76', '#6B4C6E', '#8C5B3E'];

const paletteFor = (index) => PALETTE[index % PALETTE.length];

/* ---------- difficulty levels (fixed scale, not user-editable) ---------- */
const DIFFICULTIES = [
  { id: 'basic',        label: 'בסיסי',   level: 1, color: '#5B8C5A' },
  { id: 'medium',       label: 'בינוני',  level: 2, color: '#8A6A2F' },
  { id: 'required',     label: 'נדרש',    level: 3, color: '#A63D40' },
  { id: 'challenging',  label: 'מאתגר',   level: 4, color: '#3E5C76' },
];
const BAGRUT_COLOR = '#5C4B8A';
const difficultyById = (id) => DIFFICULTIES.find(d => d.id === id) || null;

/* ---------- seed content ---------- */
const seedTopics = () => ([
  { id: uid(), name: 'רקורסיה', color: PALETTE[0] },
  { id: uid(), name: 'רשימה מקושרת', color: PALETTE[1] },
  { id: uid(), name: 'מערכים', color: PALETTE[2] },
  { id: uid(), name: 'מיון וחיפוש', color: PALETTE[3] },
  { id: uid(), name: 'עצים', color: PALETTE[4] },
  { id: uid(), name: 'מחסניות ותורים', color: PALETTE[5] },
]);

const buildSeedQuestions = (topics) => {
  const byName = (n) => topics.find(t => t.name === n)?.id;
  return [
    {
      id: uid(),
      title: 'היפוך רשימה מקושרת ברקורסיה',
      body: 'כתבו פונקציה רקורסיבית reverseList המקבלת מצביע לראש רשימה מקושרת חד-כיוונית (Singly Linked List), והופכת את סדר החוליות בה. הפונקציה תחזיר מצביע לראש הרשימה ההפוכה. אין להשתמש בלולאה, ואין להקצות חוליות חדשות — יש לשנות את מצביעי ה-next הקיימים בלבד.',
      code:
`typedef struct Node {
    int data;
    struct Node* next;
} Node;

Node* reverseList(Node* head) {
    if (head == NULL || head->next == NULL) {
        return head;
    }
    Node* newHead = reverseList(head->next);
    head->next->next = head;
    head->next = NULL;
    return newHead;
}`,
      codeLang: 'C',
      answer:
'הרעיון: נרד רקורסיבית עד לחוליה האחרונה — היא תהפוך לראש החדש. בכל חזרה מהרקורסיה, החוליה הנוכחית "מצמידה" את עצמה אחרי החוליה הבאה (head->next->next = head), ומנתקת את הקישור הישן קדימה (head->next = NULL). מקרה הבסיס: רשימה ריקה או חוליה בודדת — מוחזרת כפי שהיא. סיבוכיות זמן O(n), סיבוכיות מקום O(n) עקב מחסנית הרקורסיה.',
      images: [],
      tags: [byName('רקורסיה'), byName('רשימה מקושרת')].filter(Boolean),
      difficulty: 'required',
      hidden: false,
      isBagrut: true,
      createdAt: Date.now(),
    },
    {
      id: uid(),
      title: 'סכום איברים במערך ברקורסיה',
      body: 'כתבו פונקציה רקורסיבית sumArray(arr, n) המחזירה את סכום n האיברים הראשונים במערך שלמים arr.',
      code:
`int sumArray(int arr[], int n) {
    if (n <= 0) {
        return 0;
    }
    return arr[n - 1] + sumArray(arr, n - 1);
}`,
      codeLang: 'C',
      answer: 'מקרה בסיס: n=0 מחזיר 0. אחרת מחזירים את האיבר האחרון בטווח ועוד קריאה רקורסיבית על שאר המערך (n-1 איברים). עומק הרקורסיה הוא O(n).',
      images: [],
      tags: [byName('רקורסיה'), byName('מערכים')].filter(Boolean),
      difficulty: 'basic',
      hidden: false,
      isBagrut: false,
      createdAt: Date.now() - 1000,
    },
    {
      id: uid(),
      title: 'בדיקת רשימה מקושרת מעגלית (מחזור)',
      body: 'כתבו פונקציה hasCycle(head) הבודקת אם רשימה מקושרת חד-כיוונית מכילה מעגל, וזאת בזמן O(n) ובמקום קבוע O(1) בלבד — ללא שימוש במבנה נתונים עזר.',
      code:
`int hasCycle(Node* head) {
    Node* slow = head;
    Node* fast = head;
    while (fast != NULL && fast->next != NULL) {
        slow = slow->next;
        fast = fast->next->next;
        if (slow == fast) return 1;
    }
    return 0;
}`,
      codeLang: 'C',
      answer: 'זהו אלגוריתם "הצב והארנב" (Floyd Cycle Detection): שני מצביעים נעים בקצב שונה. אם יש מעגל, המהיר יתפוס את האיטי בתוך המעגל. סיבוכיות זמן O(n), סיבוכיות מקום O(1).',
      images: [],
      tags: [byName('רשימה מקושרת')].filter(Boolean),
      difficulty: 'challenging',
      hidden: true,
      isBagrut: false,
      createdAt: Date.now() - 2000,
    },
  ];
};

/* ---------- presentation link -> embeddable URL ---------- */
function toEmbedInfo(rawUrl) {
  if (!rawUrl) return { embedUrl: null, kind: 'none' };
  let m = rawUrl.match(/docs\.google\.com\/presentation\/d\/(e\/[a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+)/);
  if (m) return { embedUrl: `https://docs.google.com/presentation/d/${m[1]}/embed?start=false&loop=false&delayms=3000`, kind: 'slides' };
  m = rawUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return { embedUrl: `https://drive.google.com/file/d/${m[1]}/preview`, kind: 'drive' };
  m = rawUrl.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (m) return { embedUrl: `https://drive.google.com/file/d/${m[1]}/preview`, kind: 'drive' };
  m = rawUrl.match(/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return { embedUrl: `https://drive.google.com/embeddedfolderview?id=${m[1]}#list`, kind: 'folder' };
  m = rawUrl.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return { embedUrl: `https://docs.google.com/document/d/${m[1]}/preview`, kind: 'doc' };
  if (/\.pdf(\?.*)?$/i.test(rawUrl)) return { embedUrl: rawUrl, kind: 'pdf' };
  return { embedUrl: null, kind: 'external' };
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const seedPresTopics = () => ([
  { id: uid(), name: 'סטטיסטיקה', color: PALETTE[0] },
  { id: uid(), name: 'Python / Pandas', color: PALETTE[1] },
  { id: uid(), name: 'ויזואליזציה', color: PALETTE[3] },
]);

const buildSeedPresentations = (presTopics) => {
  const byName = (n) => presTopics.find(t => t.name === n)?.id;
  return [
    {
      id: uid(),
      title: 'שיעור 1 — מבוא למדעי הנתונים',
      description: 'סקירה כללית של התחום, כלים עיקריים, ומה נלמד השנה.',
      sourceUrl: '',
      resources: [],
      tags: [byName('Python / Pandas')].filter(Boolean),
      releaseDate: null,
      hidden: false,
      createdAt: Date.now() - 2000,
    },
    {
      id: uid(),
      title: 'שיעור 2 — סטטיסטיקה תיאורית',
      description: 'ממוצע, חציון, סטיית תקן, והצגת נתונים בצורה תמציתית.',
      sourceUrl: '',
      resources: [{ id: uid(), label: 'דף תרגול', url: '' }],
      tags: [byName('סטטיסטיקה')].filter(Boolean),
      releaseDate: null,
      hidden: false,
      createdAt: Date.now() - 1000,
    },
  ];
};

/* ---------- small helpers ---------- */
const cls = (...xs) => xs.filter(Boolean).join(' ');

function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = 'info') => {
    setToast({ message, type, key: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, show];
}

function LevelMeter({ id, size = 'md' }) {
  const d = difficultyById(id);
  if (!d) return null;
  const maxLevel = DIFFICULTIES.length;
  return (
    <span className={cls('qb-level', size === 'sm' && 'qb-level-sm')} title={d.label} style={{ '--level-color': d.color }}>
      <span className="qb-level-bars">
        {Array.from({ length: maxLevel }, (_, i) => i + 1).map(i => (
          <span key={i} className={cls('qb-level-bar', i <= d.level && 'qb-level-bar-filled')} style={{ height: 4 + i * 2 }} />
        ))}
      </span>
      <span className="qb-level-label">{d.label}</span>
    </span>
  );
}

function LazyImage({ src, alt, style, onError }) {
  const isRef = typeof src === 'string' && src.startsWith('storage:');
  const [resolved, setResolved] = useState(() => (isRef ? imageDataCache.get(src) || null : src));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isRef || resolved) return;
    let cancelled = false;
    const key = src.slice('storage:'.length);
    (async () => {
      try {
        const r = await storage.get(key);
        if (r && !cancelled) {
          imageDataCache.set(src, r.value);
          setResolved(r.value);
        } else if (!cancelled) {
          setFailed(true);
        }
      } catch (e) {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [src, isRef, resolved]);

  if (isRef && !resolved && !failed) {
    return <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-dark)', color: 'var(--ink-soft)', fontSize: 11 }}>טוען…</div>;
  }
  if (failed) {
    return <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-dark)', color: 'var(--stamp)', fontSize: 11 }}>שגיאה בטעינת תמונה</div>;
  }
  return <img src={resolved} alt={alt || ''} style={style} onError={onError} />;
}

/* ==================================================================== */

export default function QuestionBankApp() {
  const [view, setView] = useState('questions'); // 'questions' | 'presentations'
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [topics, setTopics] = useState([]);
  const [presentations, setPresentations] = useState([]);
  const [presTopics, setPresTopics] = useState([]);
  const [toast, showToast] = useToast();

  const [search, setSearch] = useState('');
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState([]);
  const [bagrutOnly, setBagrutOnly] = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState('all'); // 'all' | 'visible' | 'hidden' (admin only)
  const [matchMode, setMatchMode] = useState('all'); // 'all' | 'any'
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [activeId, setActiveId] = useState(null);
  const [showAnswerFor, setShowAnswerFor] = useState({});

  const [editMode, setEditMode] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null); // object or null
  const [managingTopics, setManagingTopics] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [importText, setImportText] = useState('');

  const [practiceOpen, setPracticeOpen] = useState(false);
  const [practiceConfig, setPracticeConfig] = useState({ topics: [], difficulties: [], bagrutOnly: false, count: 'all', shuffle: true });
  const [practiceSession, setPracticeSession] = useState(null); // { queue: [ids], index: 0, done: false }
  const [practiceShowAnswer, setPracticeShowAnswer] = useState(false);

  const [activePresId, setActivePresId] = useState(null);
  const [editingPresentation, setEditingPresentation] = useState(null);
  const [managingPresTopics, setManagingPresTopics] = useState(false);
  const [selectedPresTopics, setSelectedPresTopics] = useState([]);

  /* -------- load -------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let qData = null, tData = null, pData = null, ptData = null;
      try {
        const r = await storage.get(K_QUESTIONS);
        qData = r ? JSON.parse(r.value) : null;
      } catch (e) { qData = null; }
      try {
        const r = await storage.get(K_TOPICS);
        tData = r ? JSON.parse(r.value) : null;
      } catch (e) { tData = null; }
      try {
        const r = await storage.get(K_PRESENTATIONS);
        pData = r ? JSON.parse(r.value) : null;
      } catch (e) { pData = null; }
      try {
        const r = await storage.get(K_PRES_TOPICS);
        ptData = r ? JSON.parse(r.value) : null;
      } catch (e) { ptData = null; }

      if (cancelled) return;

      if (!qData || !tData || tData.length === 0) {
        const st = seedTopics();
        const sq = buildSeedQuestions(st);
        setTopics(tData && tData.length ? tData : st);
        setQuestions(qData && qData.length ? qData : sq);
        try {
          if (!tData || tData.length === 0) await storage.set(K_TOPICS, JSON.stringify(st));
          if (!qData || qData.length === 0) await storage.set(K_QUESTIONS, JSON.stringify(sq));
        } catch (e) { /* ignore seed-write failure */ }
      } else {
        setTopics(tData);
        setQuestions(qData);
      }

      if (!pData || !ptData || ptData.length === 0) {
        const spt = seedPresTopics();
        const sp = buildSeedPresentations(spt);
        setPresTopics(ptData && ptData.length ? ptData : spt);
        setPresentations(pData && pData.length ? pData : sp);
        try {
          if (!ptData || ptData.length === 0) await storage.set(K_PRES_TOPICS, JSON.stringify(spt));
          if (!pData || pData.length === 0) await storage.set(K_PRESENTATIONS, JSON.stringify(sp));
        } catch (e) { /* ignore seed-write failure */ }
      } else {
        setPresTopics(ptData);
        setPresentations(pData);
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  /* -------- persistence helpers -------- */
  const persistQuestions = useCallback(async (next) => {
    setQuestions(next);
    try {
      const r = await storage.set(K_QUESTIONS, JSON.stringify(next));
      if (!r) showToast('שמירת השאלות נכשלה', 'error');
    } catch (e) { showToast('שגיאה בשמירת השאלות', 'error'); }
  }, [showToast]);

  const persistTopics = useCallback(async (next) => {
    setTopics(next);
    try {
      const r = await storage.set(K_TOPICS, JSON.stringify(next));
      if (!r) showToast('שמירת הנושאים נכשלה', 'error');
    } catch (e) { showToast('שגיאה בשמירת הנושאים', 'error'); }
  }, [showToast]);

  const [confirmState, setConfirmState] = useState(null); // { message, resolve }
  const askConfirm = useCallback((message) => new Promise(resolve => setConfirmState({ message, resolve })), []);
  const resolveConfirm = (result) => { confirmState && confirmState.resolve(result); setConfirmState(null); };

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [loginBusy, setLoginBusy] = useState(false);

  /* -------- admin gate (real Supabase Auth session) -------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getSession();
      if (!cancelled) setEditMode(!!session);
    })();
    const unsubscribe = onAuthChange((session) => setEditMode(!!session));
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  const toggleEditMode = useCallback(async () => {
    if (editMode) {
      await signOut();
      setEditMode(false);
      setVisibilityFilter('all');
      return;
    }
    setLoginError(null);
    setLoginEmail('');
    setLoginPassword('');
    setLoginOpen(true);
  }, [editMode]);

  const submitLogin = async () => {
    setLoginBusy(true);
    setLoginError(null);
    try {
      await signIn(loginEmail.trim(), loginPassword);
      setLoginOpen(false);
      showToast('מצב עריכה פעיל', 'success');
    } catch (e) {
      setLoginError('אימייל או סיסמה שגויים.');
    } finally {
      setLoginBusy(false);
    }
  };


  /* -------- topic filter -------- */
  const toggleTopicFilter = (id) => {
    setSelectedTopics(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleDifficultyFilter = (id) => {
    setSelectedDifficulties(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filteredQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter(item => {
      if (!editMode && item.hidden) return false;
      if (editMode && visibilityFilter === 'visible' && item.hidden) return false;
      if (editMode && visibilityFilter === 'hidden' && !item.hidden) return false;
      if (bagrutOnly && !item.isBagrut) return false;
      if (selectedTopics.length > 0) {
        const tags = item.tags || [];
        const ok = matchMode === 'all'
          ? selectedTopics.every(t => tags.includes(t))
          : selectedTopics.some(t => tags.includes(t));
        if (!ok) return false;
      }
      if (selectedDifficulties.length > 0 && !selectedDifficulties.includes(item.difficulty)) return false;
      if (!q) return true;
      const hay = [
        item.title, item.body, item.code, item.answer,
        ...(item.tags || []).map(tid => topics.find(t => t.id === tid)?.name || '')
      ].join(' ').toLowerCase();
      return hay.includes(q);
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [questions, search, selectedTopics, selectedDifficulties, bagrutOnly, matchMode, topics, editMode, visibilityFilter]);

  /* -------- CRUD: questions -------- */
  const openNewQuestion = () => setEditingQuestion({
    id: uid(), title: '', body: '', code: '', codeLang: '', answer: '', images: [], tags: [], difficulty: 'basic', hidden: false, isBagrut: false, isNew: true
  });
  const openEditQuestion = (q) => setEditingQuestion({ ...q, images: [...(q.images || [])], tags: [...(q.tags || [])] });

  const saveQuestion = async (draft) => {
    if (!draft.title.trim()) { showToast('חובה להזין כותרת לשאלה', 'error'); return; }
    const { isNew, ...clean } = draft;
    const exists = questions.some(q => q.id === clean.id);
    let next;
    if (exists) {
      next = questions.map(q => q.id === clean.id ? { ...clean } : q);
    } else {
      next = [{ ...clean, createdAt: Date.now() }, ...questions];
    }
    await persistQuestions(next);
    setEditingQuestion(null);
    showToast('השאלה נשמרה', 'success');
  };

  const deleteQuestion = async (id) => {
    const ok = await askConfirm('למחוק את השאלה? הפעולה אינה הפיכה.');
    if (!ok) return;
    const target = questions.find(q => q.id === id);
    if (target) {
      for (const src of target.images || []) {
        if (typeof src === 'string' && src.startsWith('storage:')) {
          try { await storage.delete(src.slice('storage:'.length)); } catch (e) { /* best effort */ }
          imageDataCache.delete(src);
        }
      }
    }
    await persistQuestions(questions.filter(q => q.id !== id));
    if (activeId === id) setActiveId(null);
    showToast('השאלה נמחקה', 'success');
  };

  /* -------- CRUD: topics -------- */
  const addTopic = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (topics.some(t => t.name === trimmed)) return topics.find(t => t.name === trimmed).id;
    const t = { id: uid(), name: trimmed, color: paletteFor(topics.length) };
    await persistTopics([...topics, t]);
    return t.id;
  };
  const renameTopic = async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await persistTopics(topics.map(t => t.id === id ? { ...t, name: trimmed } : t));
  };
  const deleteTopic = async (id) => {
    const ok = await askConfirm('למחוק את הנושא? התיוג יוסר מכל השאלות המשויכות.');
    if (!ok) return;
    await persistTopics(topics.filter(t => t.id !== id));
    await persistQuestions(questions.map(q => ({ ...q, tags: (q.tags || []).filter(tid => tid !== id) })));
    setSelectedTopics(prev => prev.filter(x => x !== id));
  };

  /* -------- presentations -------- */
  const persistPresentations = useCallback(async (next) => {
    setPresentations(next);
    try {
      const r = await storage.set(K_PRESENTATIONS, JSON.stringify(next));
      if (!r) showToast('שמירת המצגות נכשלה', 'error');
    } catch (e) { showToast('שגיאה בשמירת המצגות', 'error'); }
  }, [showToast]);

  const persistPresTopics = useCallback(async (next) => {
    setPresTopics(next);
    try {
      const r = await storage.set(K_PRES_TOPICS, JSON.stringify(next));
      if (!r) showToast('שמירת הנושאים נכשלה', 'error');
    } catch (e) { showToast('שגיאה בשמירת הנושאים', 'error'); }
  }, [showToast]);

  const addPresTopic = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (presTopics.some(t => t.name === trimmed)) return presTopics.find(t => t.name === trimmed).id;
    const t = { id: uid(), name: trimmed, color: paletteFor(presTopics.length) };
    await persistPresTopics([...presTopics, t]);
    return t.id;
  };
  const renamePresTopic = async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await persistPresTopics(presTopics.map(t => t.id === id ? { ...t, name: trimmed } : t));
  };
  const deletePresTopic = async (id) => {
    const ok = await askConfirm('למחוק את הנושא? התיוג יוסר מכל המצגות המשויכות.');
    if (!ok) return;
    await persistPresTopics(presTopics.filter(t => t.id !== id));
    await persistPresentations(presentations.map(p => ({ ...p, tags: (p.tags || []).filter(tid => tid !== id) })));
    setSelectedPresTopics(prev => prev.filter(x => x !== id));
  };

  const openNewPresentation = () => setEditingPresentation({
    id: uid(), title: '', description: '', sourceUrl: '', resources: [], tags: [], releaseDate: '', hidden: false, isNew: true
  });
  const openEditPresentation = (p) => setEditingPresentation({ ...p, tags: [...(p.tags || [])], resources: [...(p.resources || [])], releaseDate: p.releaseDate || '' });

  const savePresentation = async (draft) => {
    if (!draft.title.trim()) { showToast('חובה להזין כותרת למצגת', 'error'); return; }
    const { isNew, ...clean } = draft;
    clean.releaseDate = clean.releaseDate || null;
    const exists = presentations.some(p => p.id === clean.id);
    let next;
    if (exists) {
      next = presentations.map(p => p.id === clean.id ? { ...clean } : p);
    } else {
      next = [...presentations, { ...clean, createdAt: Date.now() }];
    }
    await persistPresentations(next);
    setEditingPresentation(null);
    showToast('המצגה נשמרה', 'success');
  };

  const deletePresentation = async (id) => {
    const ok = await askConfirm('למחוק את המצגה? הפעולה אינה הפיכה.');
    if (!ok) return;
    await persistPresentations(presentations.filter(p => p.id !== id));
    if (activePresId === id) setActivePresId(null);
    showToast('המצגה נמחקה', 'success');
  };

  const movePresentation = async (id, dir) => {
    const idx = presentations.findIndex(p => p.id === id);
    if (idx === -1) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= presentations.length) return;
    const next = [...presentations];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    await persistPresentations(next);
  };

  const isPresLocked = (p) => !!(p.releaseDate && p.releaseDate > todayStr());

  /* -------- backup -------- */
  const exportJson = () => JSON.stringify({ questions, topics, presentations, presTopics }, null, 2);
  const importJson = async () => {
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed.questions) || !Array.isArray(parsed.topics)) throw new Error('bad shape');
      const ok = await askConfirm('הפעולה תחליף את כל הנתונים הקיימים באתר בנתונים המיובאים. להמשיך?');
      if (!ok) return;
      await persistTopics(parsed.topics);
      await persistQuestions(parsed.questions);
      if (Array.isArray(parsed.presentations)) await persistPresentations(parsed.presentations);
      if (Array.isArray(parsed.presTopics)) await persistPresTopics(parsed.presTopics);
      showToast('הייבוא הצליח', 'success');
      setImportText('');
      setBackupOpen(false);
    } catch (e) {
      showToast('קובץ ה-JSON אינו תקין', 'error');
    }
  };

  const topicById = (id) => topics.find(t => t.id === id);
  const activeQuestion = questions.find(q => q.id === activeId) || null;
  const visibleTotal = editMode ? questions.length : questions.filter(q => !q.hidden).length;

  /* -------- practice mode -------- */
  const shuffleArr = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const practicePool = useMemo(() => {
    return questions.filter(item => {
      if (item.hidden) return false; // practice mode never surfaces exam-only questions
      if (practiceConfig.bagrutOnly && !item.isBagrut) return false;
      if (practiceConfig.topics.length > 0 && !practiceConfig.topics.some(t => (item.tags || []).includes(t))) return false;
      if (practiceConfig.difficulties.length > 0 && !practiceConfig.difficulties.includes(item.difficulty)) return false;
      return true;
    });
  }, [questions, practiceConfig]);

  const startPractice = () => {
    if (practicePool.length === 0) {
      showToast('אין שאלות מתאימות לתרגול לפי הסינון שנבחר', 'error');
      return;
    }
    let ids = practicePool.map(q => q.id);
    if (practiceConfig.shuffle) ids = shuffleArr(ids);
    if (practiceConfig.count !== 'all') {
      const n = Math.max(1, Math.min(Number(practiceConfig.count) || ids.length, ids.length));
      ids = ids.slice(0, n);
    }
    setPracticeSession({ queue: ids, index: 0, done: false });
    setPracticeShowAnswer(false);
    setPracticeOpen(false);
  };

  const practiceNext = () => {
    setPracticeSession(s => {
      if (!s) return s;
      if (s.index >= s.queue.length - 1) return { ...s, done: true };
      return { ...s, index: s.index + 1 };
    });
    setPracticeShowAnswer(false);
  };
  const practicePrev = () => {
    setPracticeSession(s => (s ? { ...s, index: Math.max(0, s.index - 1) } : s));
    setPracticeShowAnswer(false);
  };
  const practiceRestart = () => {
    setPracticeSession(s => (s ? { ...s, index: 0, done: false, queue: practiceConfig.shuffle ? shuffleArr(s.queue) : s.queue } : s));
    setPracticeShowAnswer(false);
  };
  const exitPractice = () => { setPracticeSession(null); setPracticeShowAnswer(false); };

  /* ==================================================================== */

  return (
    <div dir="rtl" lang="he" style={styles.appRoot}>
      <style>{CSS}</style>

      {loading ? (
        <div style={styles.loadingScreen}>
          <div className="qb-punch qb-punch-lg" />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)' }}>טוען את המאגר…</div>
        </div>
      ) : (
        <>
          {/* ---------- header ---------- */}
          <header style={styles.header}>
            <div style={styles.headerTop}>
              <button className="qb-icon-btn qb-only-mobile" onClick={() => setSidebarOpen(s => !s)} aria-label="תפריט נושאים">
                <Menu size={20} />
              </button>
              <div style={styles.brand}>
                {view === 'questions' ? <BookOpen size={26} color="var(--stamp)" style={{ flexShrink: 0 }} /> : <Database size={26} color="var(--stamp)" style={{ flexShrink: 0 }} />}
                <div>
                  <h1 style={styles.title}>{view === 'questions' ? 'מאגר שאלות במדעי המחשב' : 'מדעי הנתונים'}</h1>
                  <div style={styles.subtitle}>
                    {view === 'questions'
                      ? 'אוסף שאלות ותרגילים שנאספו לאורך שנות ההוראה, מתויגים לפי נושא'
                      : 'מצגות השיעורים, לפי סדר הלמידה'}
                  </div>
                </div>
              </div>
              <div style={styles.headerActions}>
                {view === 'questions' && (
                  <button className="qb-btn qb-btn-accent" onClick={() => setPracticeOpen(true)}>
                    <Play size={16} /> <span>מצב תרגול</span>
                  </button>
                )}
                <button className={cls('qb-btn', editMode && 'qb-btn-active')} onClick={toggleEditMode}>
                  {editMode ? <Unlock size={16} /> : <Lock size={16} />}
                  <span>{editMode ? 'מצב עריכה פעיל' : 'כניסת מנהל'}</span>
                </button>
              </div>
            </div>

            <div className="qb-nav-tabs">
              <button className={cls('qb-nav-tab', view === 'questions' && 'qb-nav-tab-active')} onClick={() => setView('questions')}>
                <BookOpen size={15} /> מאגר שאלות
              </button>
              <button className={cls('qb-nav-tab', view === 'presentations' && 'qb-nav-tab-active')} onClick={() => setView('presentations')}>
                <Database size={15} /> מדעי הנתונים
              </button>
            </div>

            {view === 'questions' && (
            <div style={styles.searchRow}>
              <div style={styles.searchBox}>
                <Search size={17} color="var(--ink-soft)" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="חיפוש בשאלות, בקוד או בתגיות…"
                  style={styles.searchInput}
                />
                {search && (
                  <button className="qb-icon-btn" onClick={() => setSearch('')} aria-label="נקה חיפוש">
                    <X size={15} />
                  </button>
                )}
              </div>
              <div style={styles.countBadge}>{filteredQuestions.length} / {visibleTotal} שאלות</div>
              {editMode && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="qb-btn qb-btn-primary" onClick={openNewQuestion}>
                    <Plus size={16} /> <span>שאלה חדשה</span>
                  </button>
                  <button className="qb-btn" onClick={() => setManagingTopics(true)}>
                    <TagIcon size={16} /> <span className="qb-only-desktop">ניהול נושאים</span>
                  </button>
                  <button className="qb-btn" onClick={() => setBackupOpen(true)}>
                    <Download size={16} /> <span className="qb-only-desktop">גיבוי</span>
                  </button>
                </div>
              )}
            </div>
            )}

            {view === 'presentations' && (
            <div style={styles.searchRow}>
              <div style={styles.countBadge}>
                {presentations.filter(p => editMode || (!p.hidden)).length} מצגות
              </div>
              {editMode && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="qb-btn qb-btn-primary" onClick={openNewPresentation}>
                    <Plus size={16} /> <span>מצגת חדשה</span>
                  </button>
                  <button className="qb-btn" onClick={() => setManagingPresTopics(true)}>
                    <TagIcon size={16} /> <span className="qb-only-desktop">ניהול נושאים</span>
                  </button>
                </div>
              )}
            </div>
            )}
          </header>

          <div style={styles.body}>
            {view === 'presentations' ? (
              <PresentationsView
                presentations={presentations}
                presTopics={presTopics}
                editMode={editMode}
                selectedPresTopics={selectedPresTopics}
                onToggleTopic={(id) => setSelectedPresTopics(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                onClearTopics={() => setSelectedPresTopics([])}
                onOpen={(id) => setActivePresId(id)}
                onEdit={openEditPresentation}
                onDelete={deletePresentation}
                onMove={movePresentation}
                isLocked={isPresLocked}
              />
            ) : practiceSession ? (
              <PracticeView
                session={practiceSession}
                questions={questions}
                topics={topics}
                showAnswer={practiceShowAnswer}
                onToggleAnswer={() => setPracticeShowAnswer(v => !v)}
                onNext={practiceNext}
                onPrev={practicePrev}
                onRestart={practiceRestart}
                onExit={exitPractice}
              />
            ) : (
              <>
            {/* ---------- sidebar (drawer) ---------- */}
            <aside className={cls('qb-sidebar', sidebarOpen && 'qb-sidebar-open')} style={styles.sidebar}>
              {editMode && (
                <>
                  <div style={styles.sidebarHead}>
                    {visibilityFilter === 'hidden' ? <EyeOff size={15} /> : <Eye size={15} />}
                    <span>מצב חשיפה</span>
                  </div>
                  <div style={styles.matchToggle}>
                    <button className={cls('qb-chip-toggle', visibilityFilter === 'all' && 'qb-chip-toggle-active')} onClick={() => setVisibilityFilter('all')}>הכל</button>
                    <button className={cls('qb-chip-toggle', visibilityFilter === 'visible' && 'qb-chip-toggle-active')} onClick={() => setVisibilityFilter('visible')}>גלויות</button>
                    <button className={cls('qb-chip-toggle', visibilityFilter === 'hidden' && 'qb-chip-toggle-active')} onClick={() => setVisibilityFilter('hidden')}>מבחנים</button>
                  </div>
                </>
              )}

              <div style={{ ...styles.sidebarHead, marginTop: editMode ? 20 : 0 }}>
                <GraduationCap size={15} />
                <span>מקור</span>
              </div>
              <button
                onClick={() => setBagrutOnly(v => !v)}
                className={cls('qb-drawer-tab', bagrutOnly && 'qb-drawer-tab-active')}
                style={{ marginBottom: 16 }}
              >
                <span style={{ flex: 1, textAlign: 'right' }}>רק שאלות בגרות</span>
                {bagrutOnly && <Check size={14} color="#5C4B8A" />}
              </button>

              <div style={styles.sidebarHead}>
                <Filter size={15} />
                <span>רמת קושי</span>
                {selectedDifficulties.length > 0 && (
                  <button className="qb-link" onClick={() => setSelectedDifficulties([])}>נקה</button>
                )}
              </div>
              <div style={styles.difficultyFilterList}>
                {DIFFICULTIES.map(d => {
                  const active = selectedDifficulties.includes(d.id);
                  const count = (editMode ? questions : questions.filter(x => !x.hidden)).filter(q => q.difficulty === d.id).length;
                  return (
                    <button
                      key={d.id}
                      onClick={() => toggleDifficultyFilter(d.id)}
                      className={cls('qb-drawer-tab', active && 'qb-drawer-tab-active')}
                    >
                      <LevelMeter id={d.id} size="sm" />
                      <span style={{ flex: 1 }} />
                      <span style={styles.drawerCount}>{count}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ ...styles.sidebarHead, marginTop: 20 }}>
                <TagIcon size={15} />
                <span>נושאים</span>
                {selectedTopics.length > 0 && (
                  <button className="qb-link" onClick={() => setSelectedTopics([])}>נקה סינון</button>
                )}
              </div>

              {topics.length > 1 && (
                <div style={styles.matchToggle}>
                  <button
                    className={cls('qb-chip-toggle', matchMode === 'all' && 'qb-chip-toggle-active')}
                    onClick={() => setMatchMode('all')}
                  >כל התגיות שנבחרו</button>
                  <button
                    className={cls('qb-chip-toggle', matchMode === 'any' && 'qb-chip-toggle-active')}
                    onClick={() => setMatchMode('any')}
                  >לפחות תגית אחת</button>
                </div>
              )}

              <div style={styles.topicList}>
                {topics.map(t => {
                  const count = (editMode ? questions : questions.filter(x => !x.hidden)).filter(q => (q.tags || []).includes(t.id)).length;
                  const active = selectedTopics.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTopicFilter(t.id)}
                      className={cls('qb-drawer-tab', active && 'qb-drawer-tab-active')}
                      style={{ '--tag-color': t.color }}
                    >
                      <span style={styles.drawerDot} />
                      <span style={{ flex: 1, textAlign: 'right' }}>{t.name}</span>
                      <span style={styles.drawerCount}>{count}</span>
                    </button>
                  );
                })}
                {topics.length === 0 && <div style={styles.emptyHint}>אין עדיין נושאים.</div>}
              </div>
            </aside>

            {sidebarOpen && <div style={styles.overlay} onClick={() => setSidebarOpen(false)} />}

            {/* ---------- main grid ---------- */}
            <main style={styles.main}>
              {filteredQuestions.length === 0 ? (
                <div style={styles.emptyState}>
                  <div className="qb-punch qb-punch-lg" style={{ marginBottom: 14 }} />
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, marginBottom: 6 }}>לא נמצאו שאלות</div>
                  <div style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
                    {questions.length === 0
                      ? (editMode ? 'לחצו על "שאלה חדשה" כדי להתחיל למלא את המאגר.' : 'המאגר עדיין ריק.')
                      : 'נסו לשנות את מילות החיפוש או את הסינון לפי נושא.'}
                  </div>
                </div>
              ) : (
                <div style={styles.grid}>
                  {filteredQuestions.map((q, i) => (
                    <button key={q.id} className="qb-card" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }} onClick={() => setActiveId(q.id)}>
                      <div style={styles.cardTopRow}>
                        <div className="qb-punch" />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {editMode && q.hidden && <span className="qb-exam-badge"><EyeOff size={11} /> מבחנים בלבד</span>}
                          {q.isBagrut && <span className="qb-bagrut-badge"><GraduationCap size={11} /> בגרות</span>}
                          {(q.images || []).length > 0 && <span className="qb-image-badge"><ImageIcon size={11} /> {q.images.length}</span>}
                          {q.difficulty && <LevelMeter id={q.difficulty} size="sm" />}
                        </div>
                      </div>
                      <div style={styles.cardTitle}>{q.title}</div>
                      <div style={styles.cardBody}>
                        {q.body && q.body.trim()
                          ? `${q.body.slice(0, 120)}${q.body.length > 120 ? '…' : ''}`
                          : ((q.images || []).length > 0
                            ? <span style={{ fontStyle: 'italic' }}>השאלה מוצגת כתמונה — לחצו לצפייה</span>
                            : '')}
                      </div>
                      <div style={styles.cardTags}>
                        {(q.tags || []).slice(0, 4).map(tid => {
                          const t = topicById(tid);
                          if (!t) return null;
                          return <span key={tid} className="qb-stamp" style={{ '--tag-color': t.color }}>{t.name}</span>;
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </main>
              </>
            )}
          </div>

          <footer style={styles.footer}>
            הנתונים באתר משותפים לכל מי שנכנס לקישור הזה — כל השאלות, הנושאים והעריכות גלויים לכל מבקר.
          </footer>

          {/* ---------- question detail modal ---------- */}
          {activeQuestion && (
            <div style={styles.modalOverlay} onClick={() => setActiveId(null)}>
              <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
                <div style={styles.modalHeadRow}>
                  <h2 style={styles.modalTitle}>{activeQuestion.title}</h2>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {editMode && (
                      <>
                        <button className="qb-icon-btn" onClick={() => openEditQuestion(activeQuestion)} aria-label="עריכה"><Pencil size={17} /></button>
                        <button className="qb-icon-btn" onClick={() => deleteQuestion(activeQuestion.id)} aria-label="מחיקה"><Trash2 size={17} /></button>
                      </>
                    )}
                    <button className="qb-icon-btn" onClick={() => setActiveId(null)} aria-label="סגירה"><X size={19} /></button>
                  </div>
                </div>

                <div style={{ ...styles.cardTags, alignItems: 'center' }}>
                  {editMode && activeQuestion.hidden && <span className="qb-exam-badge"><EyeOff size={11} /> מבחנים בלבד</span>}
                  {activeQuestion.isBagrut && <span className="qb-bagrut-badge"><GraduationCap size={11} /> בגרות</span>}
                  {activeQuestion.difficulty && <LevelMeter id={activeQuestion.difficulty} />}
                  {(activeQuestion.tags || []).map(tid => {
                    const t = topicById(tid);
                    if (!t) return null;
                    return <span key={tid} className="qb-stamp" style={{ '--tag-color': t.color }}>{t.name}</span>;
                  })}
                </div>

                {activeQuestion.body && activeQuestion.body.trim() && (
                  <p style={styles.modalBody}>{activeQuestion.body}</p>
                )}

                {activeQuestion.code && (
                  <div style={styles.codeBlockWrap}>
                    {activeQuestion.codeLang && <div style={styles.codeLangLabel}>{activeQuestion.codeLang}</div>}
                    <pre dir="ltr" style={styles.codeBlock}><code>{activeQuestion.code}</code></pre>
                  </div>
                )}

                {(activeQuestion.images || []).length > 0 && (
                  <div style={styles.imageGrid}>
                    {activeQuestion.images.map((src, idx) => (
                      <LazyImage key={idx} src={src} alt={`תרשים ${idx + 1}`} style={styles.image} />
                    ))}
                  </div>
                )}

                {activeQuestion.answer && (
                  <div style={styles.answerBox}>
                    <button
                      className="qb-btn"
                      onClick={() => setShowAnswerFor(s => ({ ...s, [activeQuestion.id]: !s[activeQuestion.id] }))}
                    >
                      {showAnswerFor[activeQuestion.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      <span>{showAnswerFor[activeQuestion.id] ? 'הסתר פתרון' : 'הצג פתרון'}</span>
                    </button>
                    {showAnswerFor[activeQuestion.id] && (
                      <div style={styles.answerText}>{activeQuestion.answer}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---------- edit/create question modal ---------- */}
          {editingQuestion && (
            <EditQuestionForm
              draft={editingQuestion}
              topics={topics}
              onCancel={() => setEditingQuestion(null)}
              onSave={saveQuestion}
              onAddTopic={addTopic}
              showToast={showToast}
            />
          )}

          {/* ---------- topic manager modal ---------- */}
          {managingTopics && (
            <TopicManager
              topics={topics}
              questions={questions}
              onClose={() => setManagingTopics(false)}
              onAdd={addTopic}
              onRename={renameTopic}
              onDelete={deleteTopic}
            />
          )}

          {/* ---------- presentation detail modal ---------- */}
          {activePresId && (() => {
            const p = presentations.find(x => x.id === activePresId);
            if (!p) return null;
            const { embedUrl, kind } = toEmbedInfo(p.sourceUrl);
            return (
              <div style={styles.modalOverlay} onClick={() => setActivePresId(null)}>
                <div style={{ ...styles.modalCard, maxWidth: 860 }} onClick={e => e.stopPropagation()}>
                  <div style={styles.modalHeadRow}>
                    <h2 style={styles.modalTitle}>{p.title}</h2>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {editMode && (
                        <>
                          <button className="qb-icon-btn" onClick={() => { setActivePresId(null); openEditPresentation(p); }}><Pencil size={17} /></button>
                          <button className="qb-icon-btn" onClick={() => deletePresentation(p.id)}><Trash2 size={17} /></button>
                        </>
                      )}
                      <button className="qb-icon-btn" onClick={() => setActivePresId(null)}><X size={19} /></button>
                    </div>
                  </div>
                  {p.description && <p style={styles.modalBody}>{p.description}</p>}
                  <div style={styles.formLabel}>מצגת</div>
                  {embedUrl ? (
                    <div style={styles.presEmbedWrap}>
                      <iframe src={embedUrl} style={styles.presEmbedFrame} allowFullScreen title={p.title} />
                    </div>
                  ) : p.sourceUrl ? (
                    <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="qb-btn qb-btn-primary" style={{ display: 'inline-flex', marginTop: 6 }}>
                      <ExternalLink size={16} /> פתיחת המצגה בכרטיסייה חדשה
                    </a>
                  ) : (
                    <div style={{ color: 'var(--ink-soft)', fontSize: 13, marginTop: 6 }}>לא הוגדר קישור למצגה זו עדיין.</div>
                  )}

                  {(p.resources || []).map(res => {
                    const { embedUrl: resEmbed } = toEmbedInfo(res.url);
                    return (
                      <div key={res.id} style={{ marginTop: 20 }}>
                        <div style={styles.formLabel}>{res.label || 'קובץ נוסף'}</div>
                        {resEmbed ? (
                          <div style={styles.presEmbedWrap}>
                            <iframe src={resEmbed} style={styles.presEmbedFrame} allowFullScreen title={res.label} />
                          </div>
                        ) : res.url ? (
                          <a href={res.url} target="_blank" rel="noopener noreferrer" className="qb-btn" style={{ display: 'inline-flex', marginTop: 6 }}>
                            <ExternalLink size={16} /> פתיחת {res.label || 'הקובץ'} בכרטיסייה חדשה
                          </a>
                        ) : (
                          <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>לא הוגדר קישור.</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ---------- presentation edit modal ---------- */}
          {editingPresentation && (
            <EditPresentationForm
              draft={editingPresentation}
              presTopics={presTopics}
              onCancel={() => setEditingPresentation(null)}
              onSave={savePresentation}
              onAddTopic={addPresTopic}
            />
          )}

          {/* ---------- presentation topic manager modal ---------- */}
          {managingPresTopics && (
            <TopicManager
              topics={presTopics}
              questions={presentations}
              onClose={() => setManagingPresTopics(false)}
              onAdd={addPresTopic}
              onRename={renamePresTopic}
              onDelete={deletePresTopic}
            />
          )}

          {/* ---------- backup modal ---------- */}
          {backupOpen && (
            <div style={styles.modalOverlay} onClick={() => setBackupOpen(false)}>
              <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
                <div style={styles.modalHeadRow}>
                  <h2 style={styles.modalTitle}>גיבוי וייבוא נתונים</h2>
                  <button className="qb-icon-btn" onClick={() => setBackupOpen(false)}><X size={19} /></button>
                </div>
                <div style={styles.formLabel}>ייצוא — העתיקו ושמרו את הטקסט הבא כגיבוי:</div>
                <textarea readOnly value={exportJson()} style={{ ...styles.textarea, height: 160, fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'left' }} onClick={e => e.target.select()} />
                <div style={{ ...styles.formLabel, marginTop: 16 }}>ייבוא — הדביקו JSON שיוצא בעבר (הפעולה תחליף את כל הנתונים הנוכחיים):</div>
                <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="הדביקו כאן JSON…" style={{ ...styles.textarea, height: 120, fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'left' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 12 }}>
                  <button className="qb-btn qb-btn-primary" onClick={importJson} disabled={!importText.trim()}>
                    <Upload size={16} /> <span>ייבוא</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---------- practice setup modal ---------- */}
          {practiceOpen && (
            <div style={styles.modalOverlay} onClick={() => setPracticeOpen(false)}>
              <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
                <div style={styles.modalHeadRow}>
                  <h2 style={styles.modalTitle}>הגדרת תרגול</h2>
                  <button className="qb-icon-btn" onClick={() => setPracticeOpen(false)}><X size={19} /></button>
                </div>

                <label style={styles.formLabel}>נושאים (ריק = כל הנושאים)</label>
                <div style={styles.tagChooser}>
                  {topics.map(t => {
                    const active = practiceConfig.topics.includes(t.id);
                    return (
                      <button
                        key={t.id} type="button"
                        onClick={() => setPracticeConfig(c => ({ ...c, topics: active ? c.topics.filter(x => x !== t.id) : [...c.topics, t.id] }))}
                        className={cls('qb-stamp', 'qb-stamp-btn', active && 'qb-stamp-active')}
                        style={{ '--tag-color': t.color }}
                      >
                        {active && <Check size={12} style={{ marginLeft: 4 }} />}{t.name}
                      </button>
                    );
                  })}
                </div>

                <label style={styles.formLabel}>רמת קושי (ריק = הכל)</label>
                <div style={styles.difficultyChooser}>
                  {DIFFICULTIES.map(d => {
                    const active = practiceConfig.difficulties.includes(d.id);
                    return (
                      <button
                        key={d.id} type="button"
                        onClick={() => setPracticeConfig(c => ({ ...c, difficulties: active ? c.difficulties.filter(x => x !== d.id) : [...c.difficulties, d.id] }))}
                        className={cls('qb-diff-btn', active && 'qb-diff-btn-active')}
                        style={{ '--level-color': d.color }}
                      >
                        <LevelMeter id={d.id} size="sm" />
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setPracticeConfig(c => ({ ...c, bagrutOnly: !c.bagrutOnly }))}
                  className={cls('qb-vis-btn', 'qb-vis-btn-bagrut', practiceConfig.bagrutOnly && 'qb-vis-btn-active')}
                  style={{ marginTop: 14 }}
                ><GraduationCap size={15} /> רק שאלות בגרות</button>

                <label style={styles.formLabel}>כמות שאלות</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className={cls('qb-chip-toggle', practiceConfig.count === 'all' && 'qb-chip-toggle-active')}
                    style={{ flex: 'none', padding: '8px 14px' }}
                    onClick={() => setPracticeConfig(c => ({ ...c, count: 'all' }))}
                  >כל השאלות המתאימות ({practicePool.length})</button>
                  <input
                    type="number" min={1} max={Math.max(1, practicePool.length)}
                    value={practiceConfig.count === 'all' ? '' : practiceConfig.count}
                    onChange={e => setPracticeConfig(c => ({ ...c, count: e.target.value ? Number(e.target.value) : 'all' }))}
                    placeholder="מספר מותאם אישית"
                    style={{ ...styles.input, width: 130 }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setPracticeConfig(c => ({ ...c, shuffle: !c.shuffle }))}
                  className={cls('qb-vis-btn', practiceConfig.shuffle && 'qb-vis-btn-active')}
                  style={{ marginTop: 14 }}
                ><Shuffle size={15} /> ערבוב סדר השאלות</button>

                <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                  <button className="qb-btn qb-btn-primary" onClick={startPractice}><Play size={16} /><span>התחלת תרגול</span></button>
                  <button className="qb-btn" onClick={() => setPracticeOpen(false)}>ביטול</button>
                </div>
              </div>
            </div>
          )}

          {/* ---------- confirm dialog ---------- */}
          {confirmState && (
            <div style={styles.modalOverlay} onClick={() => resolveConfirm(false)}>
              <div style={{ ...styles.modalCard, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
                <p style={{ ...styles.modalBody, margin: '4px 0 20px' }}>{confirmState.message}</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="qb-btn qb-btn-primary" onClick={() => resolveConfirm(true)}>אישור</button>
                  <button className="qb-btn" onClick={() => resolveConfirm(false)}>ביטול</button>
                </div>
              </div>
            </div>
          )}

          {/* ---------- admin login dialog (Supabase Auth) ---------- */}
          {loginOpen && (
            <div style={styles.modalOverlay} onClick={() => setLoginOpen(false)}>
              <div style={{ ...styles.modalCard, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
                <div style={styles.modalHeadRow}>
                  <h2 style={styles.modalTitle}>כניסת מנהל</h2>
                  <button className="qb-icon-btn" onClick={() => setLoginOpen(false)}><X size={19} /></button>
                </div>
                <label style={styles.formLabel}>אימייל</label>
                <input
                  type="email"
                  autoFocus
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  style={{ ...styles.input, direction: 'ltr', textAlign: 'left' }}
                  placeholder="you@example.com"
                />
                <label style={styles.formLabel}>סיסמה</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitLogin(); }}
                  style={styles.input}
                  placeholder="סיסמה…"
                />
                {loginError && <div style={{ color: 'var(--stamp)', fontSize: 13, marginTop: 8 }}>{loginError}</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="qb-btn qb-btn-primary" onClick={submitLogin} disabled={!loginEmail || !loginPassword || loginBusy}>
                    {loginBusy ? 'מתחברת…' : 'כניסה'}
                  </button>
                  <button className="qb-btn" onClick={() => setLoginOpen(false)}>ביטול</button>
                </div>
              </div>
            </div>
          )}

          {/* ---------- toast ---------- */}
          {toast && (
            <div key={toast.key} className={cls('qb-toast', `qb-toast-${toast.type}`)}>{toast.message}</div>
          )}
        </>
      )}
    </div>
  );
}

/* ==================================================================== */
/* edit / create question form                                          */
/* ==================================================================== */
function EditQuestionForm({ draft, topics, onCancel, onSave, onAddTopic, showToast }) {
  const [form, setForm] = useState(draft);
  const [newTopicName, setNewTopicName] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleTag = (id) => {
    setForm(f => ({
      ...f,
      tags: (f.tags || []).includes(id) ? f.tags.filter(t => t !== id) : [...(f.tags || []), id]
    }));
  };

  const addNewTopic = async () => {
    const name = newTopicName.trim();
    if (!name) return;
    const id = await onAddTopic(name);
    if (id) setForm(f => ({ ...f, tags: [...(f.tags || []), id] }));
    setNewTopicName('');
  };

  const addImageUrl = () => {
    const url = newImageUrl.trim();
    if (!url) return;
    setForm(f => ({ ...f, images: [...(f.images || []), url] }));
    setNewImageUrl('');
  };

  const addImageFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f.type && f.type.startsWith('image/'));
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      try {
        const dataUrl = await fileToCompressedDataUrl(file);
        const path = `${form.id}/${uid()}.jpg`;
        const publicUrl = await uploadImageDataUrl(dataUrl, path);
        setForm(f => ({ ...f, images: [...(f.images || []), publicUrl] }));
      } catch (e) {
        showToast && showToast('שגיאה בהעלאת התמונה', 'error');
      }
    }
    setUploading(false);
  };

  const handlePasteImage = (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    const imageFiles = [];
    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) imageFiles.push(f);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      addImageFiles(imageFiles);
    }
  };

  const handleDropImage = (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addImageFiles(e.dataTransfer.files);
    }
  };

  const removeImage = async (idx) => {
    // Note: this removes the reference from the question. It does not delete
    // the underlying file from Supabase Storage (kept simple deliberately —
    // an orphaned file is harmless; see README for how to clean these up
    // periodically if storage usage becomes a concern).
    setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeadRow}>
          <h2 style={styles.modalTitle}>{form.isNew ? 'שאלה חדשה' : 'עריכת שאלה'}</h2>
          <button className="qb-icon-btn" onClick={onCancel}><X size={19} /></button>
        </div>

        <label style={styles.formLabel}>כותרת</label>
        <input value={form.title} onChange={e => set('title', e.target.value)} style={styles.input} placeholder="למשל: היפוך רשימה מקושרת ברקורסיה" />

        <label style={styles.formLabel}>רמת קושי</label>
        <div style={styles.difficultyChooser}>
          {DIFFICULTIES.map(d => {
            const active = form.difficulty === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => set('difficulty', d.id)}
                className={cls('qb-diff-btn', active && 'qb-diff-btn-active')}
                style={{ '--level-color': d.color }}
              >
                <LevelMeter id={d.id} size="sm" />
              </button>
            );
          })}
        </div>

        <label style={styles.formLabel}>חשיפה</label>
        <div style={styles.visibilityChooser}>
          <button
            type="button"
            onClick={() => set('hidden', false)}
            className={cls('qb-vis-btn', !form.hidden && 'qb-vis-btn-active')}
          ><Eye size={15} /> גלויה לתלמידים</button>
          <button
            type="button"
            onClick={() => set('hidden', true)}
            className={cls('qb-vis-btn', 'qb-vis-btn-exam', form.hidden && 'qb-vis-btn-active')}
          ><EyeOff size={15} /> מוסתרת — למבחנים בלבד</button>
        </div>

        <label style={styles.formLabel}>מקור</label>
        <button
          type="button"
          onClick={() => set('isBagrut', !form.isBagrut)}
          className={cls('qb-vis-btn', 'qb-vis-btn-bagrut', form.isBagrut && 'qb-vis-btn-active')}
        ><GraduationCap size={15} /> זו הייתה שאלת בגרות בפועל</button>

        <label style={styles.formLabel}>גוף השאלה (לא חובה אם השאלה תודבק כתמונה למטה)</label>
        <textarea value={form.body} onChange={e => set('body', e.target.value)} style={{ ...styles.textarea, height: 110 }} placeholder="נוסח השאלה, אם רוצים אותו כטקסט חופשי לחיפוש…" />

        <div style={styles.formRow2}>
          <div style={{ flex: 1 }}>
            <label style={styles.formLabel}>שפת קוד (תווית בלבד)</label>
            <input value={form.codeLang} onChange={e => set('codeLang', e.target.value)} style={styles.input} placeholder="C / Python / Java…" />
          </div>
        </div>
        <label style={styles.formLabel}>קטע קוד (אופציונלי)</label>
        <textarea value={form.code} onChange={e => set('code', e.target.value)} style={{ ...styles.textarea, height: 130, fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'left' }} placeholder="הדביקו כאן קוד…" />

        <label style={styles.formLabel}>פתרון / תשובה (אופציונלי, יוצג מוסתר לתלמידים)</label>
        <textarea value={form.answer} onChange={e => set('answer', e.target.value)} style={{ ...styles.textarea, height: 110 }} placeholder="הסבר הפתרון…" />

        <label style={styles.formLabel}>תמונות / תרשימים</label>
        <div
          className="qb-dropzone"
          tabIndex={0}
          onPaste={handlePasteImage}
          onDrop={handleDropImage}
          onDragOver={e => e.preventDefault()}
        >
          {uploading ? 'מעלה תמונה…' : 'לחצו כאן ואז הדביקו תמונה (Ctrl+V), או גררו קובץ תמונה לכאן'}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 8 }}>
          <input value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} style={{ ...styles.input, flex: 1 }} placeholder="או הדביקו קישור URL לתמונה…" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addImageUrl())} />
          <button className="qb-btn" onClick={addImageUrl}><Plus size={15} /></button>
        </div>
        {(form.images || []).length > 0 && (
          <div style={styles.imageGrid}>
            {form.images.map((src, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                <LazyImage src={src} alt="" style={styles.image} />
                <button className="qb-icon-btn" style={styles.imageRemoveBtn} onClick={() => removeImage(idx)}><X size={13} /></button>
              </div>
            ))}
          </div>
        )}

        <label style={styles.formLabel}>תגיות נושא</label>
        <div style={styles.tagChooser}>
          {topics.map(t => {
            const active = (form.tags || []).includes(t.id);
            return (
              <button key={t.id} type="button" onClick={() => toggleTag(t.id)} className={cls('qb-stamp', 'qb-stamp-btn', active && 'qb-stamp-active')} style={{ '--tag-color': t.color }}>
                {active && <Check size={12} style={{ marginLeft: 4 }} />}{t.name}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={newTopicName} onChange={e => setNewTopicName(e.target.value)} style={{ ...styles.input, flex: 1 }} placeholder="נושא חדש…" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNewTopic())} />
          <button className="qb-btn" onClick={addNewTopic}><Plus size={15} /><span>נושא</span></button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="qb-btn qb-btn-primary" onClick={() => onSave(form)}><Save size={16} /><span>שמירה</span></button>
          <button className="qb-btn" onClick={onCancel}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* ==================================================================== */
/* topic manager                                                        */
/* ==================================================================== */
function TopicManager({ topics, questions, onClose, onAdd, onRename, onDelete }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeadRow}>
          <h2 style={styles.modalTitle}>ניהול נושאים</h2>
          <button className="qb-icon-btn" onClick={onClose}><X size={19} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} style={{ ...styles.input, flex: 1 }} placeholder="שם נושא חדש…" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(newName); setNewName(''); } }} />
          <button className="qb-btn qb-btn-primary" onClick={() => { onAdd(newName); setNewName(''); }}><Plus size={15} /><span>הוספה</span></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {topics.map(t => {
            const count = questions.filter(q => (q.tags || []).includes(t.id)).length;
            return (
              <div key={t.id} style={styles.topicManagerRow}>
                <span className="qb-stamp" style={{ '--tag-color': t.color }}>{t.name}</span>
                {editingId === t.id ? (
                  <>
                    <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...styles.input, flex: 1, padding: '6px 10px' }} />
                    <button className="qb-icon-btn" onClick={() => { onRename(t.id, editName); setEditingId(null); }}><Save size={15} /></button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, color: 'var(--ink-soft)', fontSize: 13 }}>{count} שאלות</span>
                    <button className="qb-icon-btn" onClick={() => { setEditingId(t.id); setEditName(t.name); }}><Pencil size={14} /></button>
                    <button className="qb-icon-btn" onClick={() => onDelete(t.id)}><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            );
          })}
          {topics.length === 0 && <div style={styles.emptyHint}>אין עדיין נושאים — הוסיפו את הראשון למעלה.</div>}
        </div>
      </div>
    </div>
  );
}

/* ==================================================================== */
/* practice mode session view                                           */
/* ==================================================================== */
function PracticeView({ session, questions, topics, showAnswer, onToggleAnswer, onNext, onPrev, onRestart, onExit }) {
  const topicById = (id) => topics.find(t => t.id === id);
  const currentId = session.queue[session.index];
  const q = questions.find(x => x.id === currentId);
  const isLast = session.index >= session.queue.length - 1;

  const [studentAnswer, setStudentAnswer] = useState('');
  const [aiFeedback, setAiFeedback] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    setStudentAnswer('');
    setAiFeedback(null);
    setAiLoading(false);
    setAiError(null);
  }, [currentId]);

  const requestFeedback = async () => {
    if (!studentAnswer.trim() || !q.answer) return;
    setAiLoading(true);
    setAiError(null);
    setAiFeedback(null);
    try {
      // NOTE: This calls api.anthropic.com directly from the browser, which
      // only worked inside the Claude-artifact sandbox (it had a built-in
      // proxy handling auth for you). It will NOT work as-is once deployed —
      // browsers block this call (no API key, and Anthropic's API does not
      // accept direct cross-origin browser requests). To make this feature
      // work again post-deployment, you'd need a small backend endpoint
      // (e.g. a Supabase Edge Function) that holds your real Anthropic API
      // key server-side and forwards the request. Left in place, disabled by
      // the graceful error handling below, until you're ready to build that.
      const prompt = `אתה עוזר הוראה במדעי המחשב, נותן משוב לתלמיד/ה על תשובה לשאלת תרגול.
שאלה: ${q.title}
${q.body || ''}
${q.code ? 'קוד נלווה לשאלה:\n' + q.code : ''}
פתרון לדוגמה (מיועד למורה, אל תצטט אותו במלואו לתלמיד): ${q.answer}
תשובת התלמיד/ה: ${studentAnswer}

תן משוב קצר ובונה בעברית (2-4 משפטים): ציין מה נכון בתשובה, ומה חסר או שגוי. אם התשובה שגויה לגמרי או ריקה מתוכן, כוון את התלמיד/ה לכיוון הנכון מבלי לחשוף את הפתרון המלא במילים זהות לפתרון לדוגמה. היה מעודד, ממוקד וקצר.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await response.json();
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      if (!text) throw new Error('empty response');
      setAiFeedback(text);
    } catch (e) {
      setAiError('לא הצלחנו לקבל משוב כרגע. נסו שוב בעוד רגע.');
    } finally {
      setAiLoading(false);
    }
  };

  if (session.done) {
    return (
      <div style={styles.practiceWrap}>
        <div style={styles.practiceDoneCard}>
          <div className="qb-punch qb-punch-lg" style={{ marginBottom: 14 }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8 }}>כל הכבוד! סיימת את התרגול</div>
          <div style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 20 }}>{session.queue.length} שאלות תורגלו</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="qb-btn qb-btn-primary" onClick={onRestart}><RotateCcw size={16} /><span>לתרגל שוב</span></button>
            <button className="qb-btn" onClick={onExit}>יציאה מהתרגול</button>
          </div>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div style={styles.practiceWrap}>
        <div style={styles.practiceDoneCard}>
          <div style={{ marginBottom: 16 }}>השאלה לא נמצאה (יתכן שנמחקה).</div>
          <button className="qb-btn" onClick={onExit}>יציאה מהתרגול</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.practiceWrap}>
      <div style={styles.practiceTopBar}>
        <button className="qb-btn" onClick={onExit}><X size={15} /> יציאה מהתרגול</button>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>שאלה {session.index + 1} מתוך {session.queue.length}</div>
      </div>
      <div style={styles.practiceProgressTrack}>
        <div style={{ ...styles.practiceProgressFill, width: `${((session.index + 1) / session.queue.length) * 100}%` }} />
      </div>

      <div style={styles.practiceCard}>
        <div style={{ ...styles.cardTags, alignItems: 'center', marginBottom: 10 }}>
          {q.isBagrut && <span className="qb-bagrut-badge"><GraduationCap size={11} /> בגרות</span>}
          {q.difficulty && <LevelMeter id={q.difficulty} />}
          {(q.tags || []).map(tid => {
            const t = topicById(tid);
            if (!t) return null;
            return <span key={tid} className="qb-stamp" style={{ '--tag-color': t.color }}>{t.name}</span>;
          })}
        </div>

        <h2 style={styles.modalTitle}>{q.title}</h2>

        {q.body && q.body.trim() && <p style={styles.modalBody}>{q.body}</p>}

        {q.code && (
          <div style={styles.codeBlockWrap}>
            {q.codeLang && <div style={styles.codeLangLabel}>{q.codeLang}</div>}
            <pre dir="ltr" style={styles.codeBlock}><code>{q.code}</code></pre>
          </div>
        )}

        {(q.images || []).length > 0 && (
          <div style={styles.imageGrid}>
            {q.images.map((src, idx) => (
              <LazyImage key={idx} src={src} alt={`תרשים ${idx + 1}`} style={styles.image} />
            ))}
          </div>
        )}

        {q.answer && (
          <div style={styles.aiFeedbackSection}>
            <label style={styles.formLabel}>התשובה שלך</label>
            <textarea
              value={studentAnswer}
              onChange={e => setStudentAnswer(e.target.value)}
              style={{ ...styles.textarea, height: 100 }}
              placeholder="כתבו כאן את התשובה או הפתרון שלכם…"
            />
            <button
              className="qb-btn qb-btn-primary"
              onClick={requestFeedback}
              disabled={!studentAnswer.trim() || aiLoading}
              style={{ marginTop: 8 }}
            >
              <Sparkles size={16} />
              <span>{aiLoading ? 'מקבל משוב…' : 'קבלת משוב מבינה מלאכותית'}</span>
            </button>

            {aiError && <div style={{ color: 'var(--stamp)', fontSize: 13, marginTop: 8 }}>{aiError}</div>}

            {aiFeedback && (
              <div style={styles.aiFeedbackBox}>
                <div style={styles.aiFeedbackLabel}><Sparkles size={13} /> משוב</div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>{aiFeedback}</div>
              </div>
            )}
          </div>
        )}

        {q.answer && (
          <div style={styles.answerBox}>
            <button className="qb-btn" onClick={onToggleAnswer}>
              {showAnswer ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span>{showAnswer ? 'הסתר פתרון' : 'הצג פתרון'}</span>
            </button>
            {showAnswer && <div style={styles.answerText}>{q.answer}</div>}
          </div>
        )}
      </div>

      <div style={styles.practiceNavRow}>
        <button className="qb-btn" onClick={onPrev} disabled={session.index === 0}>השאלה הקודמת</button>
        <button className="qb-btn qb-btn-primary" onClick={onNext}>{isLast ? 'סיום התרגול' : 'השאלה הבאה'}</button>
      </div>
    </div>
  );
}

/* ==================================================================== */
/* presentations: browse view                                           */
/* ==================================================================== */
function PresentationsView({ presentations, presTopics, editMode, selectedPresTopics, onToggleTopic, onClearTopics, onOpen, onEdit, onDelete, onMove, isLocked }) {
  const topicById = (id) => presTopics.find(t => t.id === id);

  const visible = presentations.filter(p => {
    if (!editMode && p.hidden) return false;
    if (selectedPresTopics.length > 0 && !selectedPresTopics.some(t => (p.tags || []).includes(t))) return false;
    return true;
  });

  return (
    <>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHead}>
          <Filter size={15} />
          <span>נושאים</span>
          {selectedPresTopics.length > 0 && <button className="qb-link" onClick={onClearTopics}>נקה סינון</button>}
        </div>
        <div style={styles.topicList}>
          {presTopics.map(t => {
            const active = selectedPresTopics.includes(t.id);
            const count = presentations.filter(p => (editMode || !p.hidden) && (p.tags || []).includes(t.id)).length;
            return (
              <button key={t.id} onClick={() => onToggleTopic(t.id)} className={cls('qb-drawer-tab', active && 'qb-drawer-tab-active')} style={{ '--tag-color': t.color }}>
                <span style={styles.drawerDot} />
                <span style={{ flex: 1, textAlign: 'right' }}>{t.name}</span>
                <span style={styles.drawerCount}>{count}</span>
              </button>
            );
          })}
          {presTopics.length === 0 && <div style={styles.emptyHint}>אין עדיין נושאים.</div>}
        </div>
      </aside>

      <main style={styles.main}>
        {visible.length === 0 ? (
          <div style={styles.emptyState}>
            <div className="qb-punch qb-punch-lg" style={{ marginBottom: 14 }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, marginBottom: 6 }}>אין עדיין מצגות</div>
            <div style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
              {editMode ? 'לחצו על "מצגת חדשה" כדי להתחיל לבנות את סדר הלמידה.' : 'המצגות עדיין לא פורסמו.'}
            </div>
          </div>
        ) : (
          <div style={styles.presList}>
            {visible.map((p, idx) => {
              const locked = isLocked(p);
              return (
                <div key={p.id} style={{ ...styles.presRow, opacity: locked && !editMode ? 0.6 : 1 }}>
                  <button
                    className="qb-pres-card"
                    onClick={() => { if (!locked) onOpen(p.id); }}
                    disabled={locked}
                  >
                    <div style={styles.presNumber}>{idx + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.cardTopRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {editMode && p.hidden && <span className="qb-exam-badge"><EyeOff size={11} /> מוסתרת</span>}
                          {locked && <span className="qb-lock-badge"><CalendarClock size={11} /> נפתח ב-{p.releaseDate}</span>}
                        </div>
                      </div>
                      <div style={styles.cardTitle}>{p.title}</div>
                      {p.description && <div style={styles.cardBody}>{p.description}</div>}
                      <div style={styles.cardTags}>
                        {(p.tags || []).map(tid => {
                          const t = topicById(tid);
                          if (!t) return null;
                          return <span key={tid} className="qb-stamp" style={{ '--tag-color': t.color }}>{t.name}</span>;
                        })}
                        {(p.resources || []).map(r => (
                          <span key={r.id} className="qb-image-badge">{r.label}</span>
                        ))}
                      </div>
                    </div>
                    {locked && !editMode && <Lock size={18} color="var(--ink-soft)" />}
                  </button>
                  {editMode && (
                    <div style={styles.presAdminCol}>
                      <button className="qb-icon-btn" onClick={() => onMove(p.id, -1)} disabled={idx === 0}><ArrowUp size={14} /></button>
                      <button className="qb-icon-btn" onClick={() => onMove(p.id, 1)} disabled={idx === visible.length - 1}><ArrowDown size={14} /></button>
                      <button className="qb-icon-btn" onClick={() => onEdit(p)}><Pencil size={14} /></button>
                      <button className="qb-icon-btn" onClick={() => onDelete(p.id)}><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

/* ==================================================================== */
/* presentations: edit / create form                                    */
/* ==================================================================== */
function EditPresentationForm({ draft, presTopics, onCancel, onSave, onAddTopic }) {
  const [form, setForm] = useState(draft);
  const [newTopicName, setNewTopicName] = useState('');
  const [newResLabel, setNewResLabel] = useState('דף תרגול');
  const [newResUrl, setNewResUrl] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleTag = (id) => {
    setForm(f => ({ ...f, tags: (f.tags || []).includes(id) ? f.tags.filter(t => t !== id) : [...(f.tags || []), id] }));
  };
  const addNewTopic = async () => {
    const name = newTopicName.trim();
    if (!name) return;
    const id = await onAddTopic(name);
    if (id) setForm(f => ({ ...f, tags: [...(f.tags || []), id] }));
    setNewTopicName('');
  };

  const addResource = () => {
    const url = newResUrl.trim();
    const label = newResLabel.trim() || 'קובץ נוסף';
    if (!url) return;
    setForm(f => ({ ...f, resources: [...(f.resources || []), { id: uid(), label, url }] }));
    setNewResUrl('');
  };
  const removeResource = (id) => setForm(f => ({ ...f, resources: (f.resources || []).filter(r => r.id !== id) }));

  const { embedUrl, kind } = toEmbedInfo(form.sourceUrl);

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeadRow}>
          <h2 style={styles.modalTitle}>{form.isNew ? 'מצגה חדשה' : 'עריכת מצגה'}</h2>
          <button className="qb-icon-btn" onClick={onCancel}><X size={19} /></button>
        </div>

        <label style={styles.formLabel}>כותרת</label>
        <input value={form.title} onChange={e => set('title', e.target.value)} style={styles.input} placeholder="למשל: שיעור 3 — רגרסיה לינארית" />

        <label style={styles.formLabel}>תיאור קצר (רשות)</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} style={{ ...styles.textarea, height: 70 }} placeholder="מה נלמד בשיעור הזה…" />

        <label style={styles.formLabel}>קישור למצגה (Google Slides / Google Drive)</label>
        <input value={form.sourceUrl} onChange={e => set('sourceUrl', e.target.value)} style={{ ...styles.input, direction: 'ltr', textAlign: 'left' }} placeholder="https://docs.google.com/presentation/d/…" />
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
          {embedUrl ? '✓ הקישור זוהה ויוטמע אוטומטית בעמוד.' : form.sourceUrl ? 'הקישור לא זוהה כ-Google Slides/Drive/PDF — יוצג ככפתור פתיחה בכרטיסייה חדשה בלבד.' : 'קובץ שמור רק אצלך במחשב? העלו אותו תחילה ל-Google Drive או Slides והדביקו כאן את הקישור.'}
        </div>
        {embedUrl && (
          <div style={styles.presEmbedWrap}>
            <iframe src={embedUrl} style={styles.presEmbedFrame} title="תצוגה מקדימה" />
          </div>
        )}

        <label style={styles.formLabel}>קבצים נוספים לשיעור (דף תרגול, מטלה וכו')</label>
        {(form.resources || []).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {form.resources.map(r => (
              <div key={r.id} style={styles.topicManagerRow}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{r.label}</span>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-soft)', direction: 'ltr', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.url}</span>
                <button className="qb-icon-btn" onClick={() => removeResource(r.id)}><X size={13} /></button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newResLabel} onChange={e => setNewResLabel(e.target.value)} style={{ ...styles.input, width: 120 }} placeholder="תווית (דף תרגול…)" />
          <input value={newResUrl} onChange={e => setNewResUrl(e.target.value)} style={{ ...styles.input, flex: 1, direction: 'ltr', textAlign: 'left' }} placeholder="קישור…" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addResource())} />
          <button className="qb-btn" onClick={addResource}><Plus size={15} /></button>
        </div>

        <label style={styles.formLabel}>תאריך חשיפה (רשות — ריק = גלוי מיד)</label>
        <input type="date" value={form.releaseDate || ''} onChange={e => set('releaseDate', e.target.value)} style={styles.input} />

        <button
          type="button"
          onClick={() => set('hidden', !form.hidden)}
          className={cls('qb-vis-btn', 'qb-vis-btn-exam', form.hidden && 'qb-vis-btn-active')}
          style={{ marginTop: 14 }}
        ><EyeOff size={15} /> מוסתרת לגמרי (טיוטה, לא מוכנה)</button>

        <label style={styles.formLabel}>תגיות נושא</label>
        <div style={styles.tagChooser}>
          {presTopics.map(t => {
            const active = (form.tags || []).includes(t.id);
            return (
              <button key={t.id} type="button" onClick={() => toggleTag(t.id)} className={cls('qb-stamp', 'qb-stamp-btn', active && 'qb-stamp-active')} style={{ '--tag-color': t.color }}>
                {active && <Check size={12} style={{ marginLeft: 4 }} />}{t.name}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={newTopicName} onChange={e => setNewTopicName(e.target.value)} style={{ ...styles.input, flex: 1 }} placeholder="נושא חדש…" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNewTopic())} />
          <button className="qb-btn" onClick={addNewTopic}><Plus size={15} /><span>נושא</span></button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="qb-btn qb-btn-primary" onClick={() => onSave(form)}><Save size={16} /><span>שמירה</span></button>
          <button className="qb-btn" onClick={onCancel}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* ==================================================================== */
/* styles                                                                */
/* ==================================================================== */
const styles = {
  appRoot: {
    fontFamily: 'var(--font-body)',
    background: 'var(--paper)',
    color: 'var(--ink)',
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  loadingScreen: {
    minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 16,
  },
  header: {
    borderBottom: '2px solid var(--ink)', background: 'var(--paper-dark)', padding: '16px 20px',
    position: 'sticky', top: 0, zIndex: 20,
  },
  headerTop: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  brand: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, margin: 0, lineHeight: 1.2 },
  subtitle: { fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 },
  headerActions: { display: 'flex', gap: 8, flexShrink: 0 },
  searchRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: 8, background: 'var(--paper)',
    border: '1px solid var(--ink)', borderRadius: 8, padding: '8px 12px', flex: '1 1 260px', minWidth: 200,
  },
  searchInput: { border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 14, color: 'var(--ink)', fontFamily: 'var(--font-body)' },
  countBadge: { fontSize: 12.5, color: 'var(--ink-soft)', whiteSpace: 'nowrap' },
  body: { display: 'flex', flex: 1, position: 'relative' },
  sidebar: {
    width: 240, flexShrink: 0, borderLeft: '2px dashed var(--ink)', padding: '18px 14px',
    background: 'var(--paper-dark)', position: 'sticky', top: 0, alignSelf: 'flex-start',
    height: 'calc(100vh - 4px)', overflowY: 'auto',
  },
  sidebarHead: { display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-display)', fontSize: 15, marginBottom: 12, color: 'var(--ink)' },
  matchToggle: { display: 'flex', gap: 6, marginBottom: 14 },
  topicList: { display: 'flex', flexDirection: 'column', gap: 6 },
  drawerDot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--tag-color, var(--stamp))', flexShrink: 0 },
  drawerCount: { fontSize: 11, color: 'var(--ink-soft)', background: 'var(--paper)', borderRadius: 10, padding: '1px 7px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(30,42,56,0.35)', zIndex: 15 },
  main: { flex: 1, padding: '22px 20px', minWidth: 0 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 },
  cardTopRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  difficultyFilterList: { display: 'flex', flexDirection: 'column', gap: 4 },
  difficultyChooser: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  visibilityChooser: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontFamily: 'var(--font-display)', fontSize: 16.5, marginBottom: 6, color: 'var(--ink)' },
  cardBody: { fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 10, minHeight: 40 },
  cardTags: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  emptyState: { textAlign: 'center', padding: '60px 20px', color: 'var(--ink)' },
  emptyHint: { fontSize: 13, color: 'var(--ink-soft)' },
  footer: { textAlign: 'center', fontSize: 11.5, color: 'var(--ink-soft)', padding: '16px 20px 24px' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(30,42,56,0.5)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto' },
  modalCard: { background: 'var(--paper)', border: '2px solid var(--ink)', borderRadius: 10, padding: 24, maxWidth: 640, width: '100%', boxShadow: '6px 6px 0 rgba(30,42,56,0.15)' },
  modalHeadRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  modalTitle: { fontFamily: 'var(--font-display)', fontSize: 21, margin: 0, lineHeight: 1.3 },
  modalBody: { fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: '14px 0' },
  codeBlockWrap: { margin: '10px 0 16px', borderRadius: 8, overflow: 'hidden', border: '1px solid #0003' },
  codeLangLabel: { background: '#16211c', color: '#9fd6b8', fontSize: 11, padding: '4px 10px', fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'left' },
  codeBlock: { margin: 0, background: 'var(--code-bg)', color: '#d8ecd9', padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6, overflowX: 'auto', textAlign: 'left' },
  imageGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 10, margin: '10px 0' },
  image: { width: '100%', borderRadius: 6, border: '1px solid var(--ink)', display: 'block' },
  imageRemoveBtn: { position: 'absolute', top: 4, right: 4, background: 'var(--paper)' },
  answerBox: { marginTop: 8, borderTop: '1px dashed var(--ink-soft)', paddingTop: 14 },
  answerText: { marginTop: 12, fontSize: 14, lineHeight: 1.7, background: 'var(--paper-dark)', border: '1px dashed var(--ink-soft)', borderRadius: 8, padding: 14, whiteSpace: 'pre-wrap' },
  formLabel: { display: 'block', fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 14, marginBottom: 5, fontWeight: 600 },
  formRow2: { display: 'flex', gap: 12 },
  input: { width: '100%', border: '1px solid var(--ink)', borderRadius: 7, padding: '9px 11px', fontSize: 14, fontFamily: 'var(--font-body)', background: 'var(--paper)', color: 'var(--ink)', boxSizing: 'border-box' },
  textarea: { width: '100%', border: '1px solid var(--ink)', borderRadius: 7, padding: '9px 11px', fontSize: 13.5, fontFamily: 'var(--font-body)', background: 'var(--paper)', color: 'var(--ink)', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 },
  tagChooser: { display: 'flex', flexWrap: 'wrap', gap: 7 },
  topicManagerRow: { display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--paper-dark)', borderRadius: 8, padding: '8px 10px' },
  practiceWrap: { flex: 1, padding: '24px 20px', maxWidth: 720, margin: '0 auto', width: '100%' },
  practiceTopBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  practiceProgressTrack: { height: 6, borderRadius: 4, background: 'var(--paper-dark)', overflow: 'hidden', marginBottom: 20, border: '1px solid var(--ink-soft)' },
  practiceProgressFill: { height: '100%', background: '#2F5233', transition: 'width 0.25s ease' },
  practiceCard: { background: 'var(--paper)', border: '2px solid var(--ink)', borderRadius: 10, padding: 24, boxShadow: '5px 5px 0 rgba(35,48,61,0.12)' },
  practiceNavRow: { display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18 },
  practiceDoneCard: { textAlign: 'center', padding: '60px 20px' },
  aiFeedbackSection: { marginTop: 16, borderTop: '1px dashed var(--ink-soft)', paddingTop: 14 },
  aiFeedbackBox: { marginTop: 12, background: '#EAF1F4', border: '1px solid #3E5C76', borderRadius: 8, padding: 14 },
  aiFeedbackLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#3E5C76', marginBottom: 6 },
  presList: { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 },
  presRow: { display: 'flex', alignItems: 'stretch', gap: 8 },
  presNumber: { fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-soft)', minWidth: 30, textAlign: 'center', flexShrink: 0 },
  presAdminCol: { display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, justifyContent: 'center' },
  presEmbedWrap: { position: 'relative', width: '100%', paddingTop: '61%', marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--ink)' },
  presEmbedFrame: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' },
};

/* ==================================================================== */
/* global css                                                            */
/* ==================================================================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=Heebo:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap');

:root {
  --paper: #EDE3CC;
  --paper-dark: #E1D3AF;
  --ink: #23303D;
  --ink-soft: #6B6153;
  --stamp: #A63D40;
  --code-bg: #1B2621;
  --font-display: 'Frank Ruhl Libre', 'Times New Roman', serif;
  --font-body: 'Heebo', system-ui, sans-serif;
  --font-mono: 'Fira Code', 'Courier New', monospace;
}

* { box-sizing: border-box; }

.qb-punch {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--paper);
  border: 1px solid var(--ink-soft);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.25);
  margin-bottom: 10px;
}
.qb-punch-lg { width: 26px; height: 26px; margin: 0 auto; }

.qb-card {
  text-align: right;
  background: var(--paper);
  border: 1px solid var(--ink);
  border-radius: 4px;
  padding: 16px 16px 14px;
  cursor: pointer;
  box-shadow: 3px 3px 0 rgba(35,48,61,0.12);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  font-family: inherit;
  animation: qb-rise 0.35s ease both;
}
.qb-card:hover {
  transform: translateY(-3px) rotate(-0.3deg);
  box-shadow: 5px 6px 0 rgba(35,48,61,0.16);
}
@keyframes qb-rise {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.qb-stamp {
  display: inline-flex; align-items: center;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.02em;
  color: var(--tag-color, var(--stamp));
  border: 1.5px solid var(--tag-color, var(--stamp));
  border-radius: 4px;
  padding: 2px 8px;
  transform: rotate(-1deg);
  background: color-mix(in srgb, var(--tag-color, var(--stamp)) 8%, transparent);
}
.qb-stamp-btn { cursor: pointer; background: var(--paper); }
.qb-stamp-active { background: color-mix(in srgb, var(--tag-color, var(--stamp)) 16%, var(--paper)); }

.qb-drawer-tab {
  display: flex; align-items: center; gap: 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 7px 9px;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 13.5px;
  color: var(--ink);
  text-align: right;
}
.qb-drawer-tab:hover { background: var(--paper); }
.qb-drawer-tab-active { background: var(--paper); border-color: var(--ink); font-weight: 600; }

.qb-btn {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--ink);
  background: var(--paper);
  color: var(--ink);
  border-radius: 7px;
  padding: 8px 13px;
  font-size: 13.5px;
  font-family: var(--font-body);
  cursor: pointer;
  white-space: nowrap;
}
.qb-btn:hover { background: var(--paper-dark); }
.qb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.qb-btn-primary { background: var(--ink); color: var(--paper); }
.qb-btn-primary:hover { background: #34455a; }
.qb-btn-active { background: #2F5233; color: var(--paper); border-color: #2F5233; }
.qb-btn-accent { background: #2F5233; color: var(--paper); border-color: #2F5233; }
.qb-btn-accent:hover { background: #3d6b42; }

.qb-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--ink);
  background: var(--paper);
  color: var(--ink);
  border-radius: 6px;
  width: 32px; height: 32px;
  cursor: pointer;
}
.qb-icon-btn:hover { background: var(--paper-dark); }

.qb-link {
  background: none; border: none; color: var(--stamp); font-size: 12px;
  cursor: pointer; text-decoration: underline; margin-right: auto; font-family: var(--font-body);
}

.qb-chip-toggle {
  flex: 1; font-size: 11px; padding: 6px 4px; border-radius: 6px;
  border: 1px solid var(--ink-soft); background: var(--paper); color: var(--ink-soft); cursor: pointer;
  font-family: var(--font-body);
}
.qb-chip-toggle-active { border-color: var(--ink); color: var(--ink); background: var(--paper-dark); font-weight: 600; }

.qb-toast {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: var(--ink); color: var(--paper); padding: 10px 20px; border-radius: 8px;
  font-size: 13.5px; z-index: 100; box-shadow: 0 4px 14px rgba(0,0,0,0.25);
  font-family: var(--font-body);
  animation: qb-toast-in 0.2s ease;
}
.qb-toast-error { background: var(--stamp); }
.qb-toast-success { background: #2F5233; }
@keyframes qb-toast-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }

.qb-level {
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--level-color, var(--ink));
}
.qb-level-bars { display: flex; align-items: flex-end; gap: 2px; }
.qb-level-bar {
  width: 3.5px; border-radius: 1px;
  background: var(--paper-dark);
  border: 1px solid var(--ink-soft);
}
.qb-level-bar-filled { background: var(--level-color, var(--stamp)); border-color: var(--level-color, var(--stamp)); }
.qb-level-label { font-size: 11.5px; font-weight: 600; }
.qb-level-sm .qb-level-label { font-size: 11px; }
.qb-level-sm .qb-level-bar { width: 3px; }

.qb-diff-btn {
  display: inline-flex; align-items: center;
  border: 1.5px solid var(--ink-soft);
  background: var(--paper);
  border-radius: 7px;
  padding: 7px 10px;
  cursor: pointer;
}
.qb-diff-btn-active { border-color: var(--level-color, var(--ink)); background: color-mix(in srgb, var(--level-color, var(--ink)) 12%, var(--paper)); }

.qb-exam-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.02em;
  color: var(--stamp);
  border: 1.5px dashed var(--stamp);
  border-radius: 4px;
  padding: 2px 7px;
  transform: rotate(-2deg);
  background: color-mix(in srgb, var(--stamp) 10%, transparent);
  white-space: nowrap;
}

.qb-vis-btn {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1.5px solid var(--ink-soft);
  background: var(--paper);
  color: var(--ink);
  border-radius: 7px;
  padding: 8px 12px;
  font-size: 13px;
  font-family: var(--font-body);
  cursor: pointer;
}
.qb-vis-btn-active { border-color: #2F5233; background: color-mix(in srgb, #2F5233 12%, var(--paper)); font-weight: 600; }
.qb-vis-btn-exam.qb-vis-btn-active { border-color: var(--stamp); background: color-mix(in srgb, var(--stamp) 12%, var(--paper)); }
.qb-vis-btn-bagrut.qb-vis-btn-active { border-color: #5C4B8A; background: color-mix(in srgb, #5C4B8A 12%, var(--paper)); }

.qb-bagrut-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.02em;
  color: #5C4B8A;
  border: 1.5px solid #5C4B8A;
  border-radius: 4px;
  padding: 2px 7px;
  background: color-mix(in srgb, #5C4B8A 8%, transparent);
  white-space: nowrap;
}

.qb-image-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--ink-soft);
  border: 1.5px solid var(--ink-soft);
  border-radius: 4px;
  padding: 2px 6px;
  white-space: nowrap;
}

.qb-dropzone {
  border: 2px dashed var(--ink-soft);
  border-radius: 8px;
  padding: 18px 14px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-soft);
  cursor: text;
  background: var(--paper-dark);
  outline: none;
}
.qb-dropzone:focus { border-color: var(--stamp); color: var(--ink); }

.qb-nav-tabs {
  display: flex; gap: 4px; margin-top: 12px;
  border-bottom: 1px solid var(--ink-soft);
}
.qb-nav-tab {
  display: inline-flex; align-items: center; gap: 6px;
  border: none; background: none;
  padding: 8px 14px;
  font-size: 13.5px;
  font-family: var(--font-body);
  color: var(--ink-soft);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.qb-nav-tab:hover { color: var(--ink); }
.qb-nav-tab-active { color: var(--ink); border-bottom-color: var(--stamp); font-weight: 600; }

.qb-pres-card {
  flex: 1;
  display: flex; align-items: center; gap: 12px;
  text-align: right;
  background: var(--paper);
  border: 1px solid var(--ink);
  border-radius: 6px;
  padding: 14px 16px;
  cursor: pointer;
  font-family: inherit;
  box-shadow: 3px 3px 0 rgba(35,48,61,0.1);
}
.qb-pres-card:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 4px 5px 0 rgba(35,48,61,0.14); }
.qb-pres-card:disabled { cursor: not-allowed; }

.qb-lock-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--ink-soft);
  border: 1.5px dashed var(--ink-soft);
  border-radius: 4px;
  padding: 2px 7px;
  white-space: nowrap;
}

.qb-only-mobile { display: none; }

@media (max-width: 780px) {
  .qb-only-desktop { display: none; }
  .qb-only-mobile { display: inline-flex; }
  .qb-sidebar {
    position: fixed !important;
    top: 0; bottom: 0; right: 0;
    height: 100vh !important;
    width: 78vw !important;
    max-width: 300px;
    z-index: 25;
    transform: translateX(100%);
    transition: transform 0.22s ease;
    box-shadow: -4px 0 16px rgba(0,0,0,0.2);
  }
  .qb-sidebar-open { transform: translateX(0); }
}
`;
