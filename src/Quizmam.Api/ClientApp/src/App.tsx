import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppBar,
  Autocomplete,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import TranslateIcon from '@mui/icons-material/Translate';
import ViewCarouselIcon from '@mui/icons-material/ViewCarousel';
import FactCheckIcon from '@mui/icons-material/FactCheck';

type User = { id: string; name: string };
type Language = { id: string; name: string };
type CollectionSummary = {
  id: string;
  name: string;
  ownerName: string;
  sourceLanguage: string;
  targetLanguage: string;
  pairCount: number;
  testCount: number;
  averageScore: number;
};
type WordPair = { id?: string; sourceText: string; targetText: string; sortOrder?: number };
type CollectionDetails = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  sourceLanguageId: string;
  sourceLanguage: string;
  targetLanguageId: string;
  targetLanguage: string;
  pairs: WordPair[];
};
type TestAnswerResult = { wordPairId: string; expectedText: string; enteredText: string; outcome: string };
type TestResult = {
  sessionId: string;
  totalQuestions: number;
  correctCount: number;
  typoCount: number;
  wrongCount: number;
  scorePercent: number;
  answers: TestAnswerResult[];
};
type ProblemWord = {
  wordPairId: string;
  collectionId: string;
  collectionName: string;
  sourceText: string;
  targetText: string;
  typoCount: number;
  wrongCount: number;
  score: number;
};
type ManualResult = {
  outcome: 'correct' | 'typo' | 'wrong';
  expectedText: string;
  enteredText: string;
};

const MANUAL_SESSION_STORAGE_KEY = 'quizmam:last-manual-session';
const VOICE_STORAGE_KEY = 'quizmam:selected-voice';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<'my' | 'all'>('my');
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionDetails | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [collectionName, setCollectionName] = useState('');
  const [sourceLanguageId, setSourceLanguageId] = useState('');
  const [targetLanguageId, setTargetLanguageId] = useState('');
  const [pairs, setPairs] = useState<WordPair[]>([
    { sourceText: '', targetText: '' },
    { sourceText: '', targetText: '' },
  ]);
  const [selectedCollection, setSelectedCollection] = useState<CollectionDetails | null>(null);
  const [mode, setMode] = useState<'menu' | 'manual' | 'cards' | 'test'>('menu');
  const [direction, setDirection] = useState<'source-to-target' | 'target-to-source'>('source-to-target');
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [answerInput, setAnswerInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [testAnswers, setTestAnswers] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [problemLimit, setProblemLimit] = useState(10);
  const [problemWords, setProblemWords] = useState<ProblemWord[]>([]);
  const [manualResult, setManualResult] = useState<ManualResult | null>(null);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [manualQueue, setManualQueue] = useState<string[]>([]);
  const [pendingManualQueue, setPendingManualQueue] = useState<string[] | null>(null);
  const [manualPromptWordId, setManualPromptWordId] = useState<string | null>(null);
  const [resumeAttempted, setResumeAttempted] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState('auto');

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (currentUser) {
      void Promise.all([loadCollections(scope), loadLanguages(), loadProblemWords(problemLimit)]);
    }
  }, [currentUser, scope]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const savedVoice = localStorage.getItem(VOICE_STORAGE_KEY) || 'auto';
    setSelectedVoiceUri(savedVoice);

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  useEffect(() => {
    if (!currentUser || resumeAttempted) return;

    const raw = localStorage.getItem(MANUAL_SESSION_STORAGE_KEY);
    if (!raw) {
      setResumeAttempted(true);
      return;
    }

    const resume = async () => {
      try {
        const saved = JSON.parse(raw) as {
          collectionId: string;
          direction: 'source-to-target' | 'target-to-source';
          manualQueue: string[];
          pendingManualQueue: string[] | null;
          manualPromptWordId: string | null;
          answerInput: string;
          manualResult: ManualResult | null;
        };

        const details = await api<CollectionDetails>(`/api/collections/${saved.collectionId}`);
        setSelectedCollection(details);
        setMode('manual');
        setDirection(saved.direction);
        setManualQueue(saved.manualQueue ?? []);
        setPendingManualQueue(saved.pendingManualQueue ?? null);
        setManualPromptWordId(saved.manualPromptWordId ?? null);
        setAnswerInput(saved.answerInput ?? '');
        setManualResult(saved.manualResult ?? null);
      } catch {
        localStorage.removeItem(MANUAL_SESSION_STORAGE_KEY);
      } finally {
        setResumeAttempted(true);
      }
    };

    void resume();
  }, [currentUser, resumeAttempted]);

  useEffect(() => {
    if (!selectedCollection || mode !== 'manual') return;

    const payload = {
      collectionId: selectedCollection.id,
      direction,
      manualQueue,
      pendingManualQueue,
      manualPromptWordId,
      answerInput,
      manualResult,
    };

    localStorage.setItem(MANUAL_SESSION_STORAGE_KEY, JSON.stringify(payload));
  }, [selectedCollection, mode, direction, manualQueue, pendingManualQueue, manualPromptWordId, answerInput, manualResult]);

  useEffect(() => {
    if (!selectedCollection) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (mode === 'manual' && manualResult && event.key === 'Enter') {
        event.preventDefault();
        continueManualQueue();
        return;
      }

      if (mode === 'cards') {
        if (event.key === 'Enter') {
          event.preventDefault();
          nextPracticeWord();
          return;
        }

        if (event.code === 'Space' || event.key === ' ') {
          event.preventDefault();
          setCardFlipped((value) => !value);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCollection, mode, manualResult]);

  async function bootstrap() {
    try {
      const [usersResp, meResp] = await Promise.all([api<User[]>('/api/users'), fetch('/api/users/me')]);
      setUsers(usersResp);

      if (meResp.ok) {
        const me = (await meResp.json()) as User;
        setCurrentUser(me);
      }
    } catch (e) {
      setError(getMessage(e));
    }
  }

  async function loadCollections(nextScope: 'my' | 'all') {
    const items = await api<CollectionSummary[]>(`/api/collections?scope=${nextScope}`);
    setCollections(items);
  }

  async function loadLanguages() {
    const items = await api<Language[]>('/api/languages');
    setLanguages(items);

    if (!sourceLanguageId || !targetLanguageId) {
      const polish = items.find((x) => x.name === 'Polski');
      const english = items.find((x) => x.name === 'Angielski');
      if (polish && english) {
        setSourceLanguageId(polish.id);
        setTargetLanguageId(english.id);
      }
    }
  }

  async function loadProblemWords(limit: number) {
    const words = await api<ProblemWord[]>(`/api/practice/problematic?limit=${limit}`);
    setProblemWords(words);
  }

  async function selectOrCreateUser() {
    if (!nameInput.trim()) {
      setError('Name is required.');
      return;
    }
    try {
      const user = await api<User>('/api/users/select-or-create', {
        method: 'POST',
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      setCurrentUser(user);
      setNameInput('');
      setError(null);
      await bootstrap();
    } catch (e) {
      setError(getMessage(e));
    }
  }

  async function switchUser(name: string) {
    try {
      const user = await api<User>('/api/users/switch', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setCurrentUser(user);
      setSelectedCollection(null);
      setMode('menu');
      setTestResult(null);
      await loadCollections(scope);
      await loadProblemWords(problemLimit);
    } catch (e) {
      setError(getMessage(e));
    }
  }

  async function logout() {
    await api<void>('/api/users/logout', { method: 'POST' });
    localStorage.removeItem(MANUAL_SESSION_STORAGE_KEY);
    setCurrentUser(null);
    setSelectedCollection(null);
    setCollections([]);
    setProblemWords([]);
  }

  function openNewWizard() {
    setEditingCollection(null);
    setWizardOpen(true);
    setWizardStep(0);
    setCollectionName('');
    setPairs([
      { sourceText: '', targetText: '' },
      { sourceText: '', targetText: '' },
    ]);
  }

  async function openEditWizard(id: string) {
    const details = await api<CollectionDetails>(`/api/collections/${id}`);
    setEditingCollection(details);
    setWizardOpen(true);
    setWizardStep(0);
    setCollectionName(details.name);
    setSourceLanguageId(details.sourceLanguageId);
    setTargetLanguageId(details.targetLanguageId);
    setPairs(details.pairs.length ? details.pairs.map((x) => ({ sourceText: x.sourceText, targetText: x.targetText })) : [{ sourceText: '', targetText: '' }, { sourceText: '', targetText: '' }]);
  }

  function updatePair(index: number, key: 'sourceText' | 'targetText', value: string) {
    const next = [...pairs];
    next[index] = { ...next[index], [key]: value };
    const row = next[index];
    if (index === next.length - 1 && row.sourceText.trim() && row.targetText.trim()) {
      next.push({ sourceText: '', targetText: '' });
    }
    setPairs(next);
  }

  async function saveCollection() {
    const cleanPairs = pairs.filter((p) => p.sourceText.trim() && p.targetText.trim());
    if (!collectionName.trim()) {
      setError('Collection name is required.');
      return;
    }
    if (cleanPairs.length < 2) {
      setError('At least two complete pairs are required.');
      return;
    }

    const payload = {
      name: collectionName.trim(),
      sourceLanguageId,
      targetLanguageId,
      pairs: cleanPairs,
    };

    try {
      if (editingCollection) {
        await api(`/api/collections/${editingCollection.id}`, {
          method: 'PUT',
          body: JSON.stringify({ id: editingCollection.id, ...payload }),
        });
      } else {
        await api('/api/collections', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setWizardOpen(false);
      await loadCollections(scope);
      setError(null);
    } catch (e) {
      setError(getMessage(e));
    }
  }

  async function removeCollection(id: string) {
    await api(`/api/collections/${id}`, { method: 'DELETE' });
    await loadCollections(scope);
  }

  async function openCollection(id: string) {
    const details = await api<CollectionDetails>(`/api/collections/${id}`);
    setSelectedCollection(details);
    setMode('menu');
    setPracticeIndex(0);
    setAnswerInput('');
    setDirection('source-to-target');
    setTestAnswers({});
    setTestResult(null);
    setMessage(null);
    setManualResult(null);
    setCardFlipped(false);
    setManualQueue(details.pairs.map((pair) => pair.id!).filter(Boolean));
    setPendingManualQueue(null);
    setManualPromptWordId(null);
  }

  const activeWord = useMemo(() => {
    if (!selectedCollection || selectedCollection.pairs.length === 0) return null;
    if (mode === 'manual') {
      const manualWordId = manualPromptWordId ?? manualQueue[0];
      if (!manualWordId) return null;
      return selectedCollection.pairs.find((pair) => pair.id === manualWordId) ?? null;
    }

    return selectedCollection.pairs[practiceIndex % selectedCollection.pairs.length];
  }, [selectedCollection, practiceIndex, mode, manualPromptWordId, manualQueue]);

  const promptText = activeWord
    ? direction === 'source-to-target'
      ? activeWord.sourceText
      : activeWord.targetText
    : '';
  const expectedText = activeWord
    ? direction === 'source-to-target'
      ? activeWord.targetText
      : activeWord.sourceText
    : '';

  function nextPracticeWord() {
    setPracticeIndex((idx) => idx + 1);
    setAnswerInput('');
    setManualResult(null);
    setCardFlipped(false);
  }

  function continueManualQueue() {
    const nextQueue = pendingManualQueue ?? manualQueue;
    if (nextQueue.length === 0) {
      setManualResult(null);
      setAnswerInput('');
      setManualPromptWordId(null);
      setPendingManualQueue(null);
      setMessage('Great job! You translated all words correctly in this set.');
      localStorage.removeItem(MANUAL_SESSION_STORAGE_KEY);
      return;
    }

    setManualQueue(nextQueue);
    setPendingManualQueue(null);
    setManualResult(null);
    setAnswerInput('');
    setManualPromptWordId(null);
  }

  async function submitManualAnswer() {
    if (!activeWord) return;
    if (manualResult) {
      continueManualQueue();
      return;
    }

    try {
      const result = await api<EvaluateAnswerResponse>('/api/learning/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          wordPairId: activeWord.id,
          direction,
          enteredText: answerInput,
        }),
      });

      const outcome = (result.outcome as ManualResult['outcome']) || 'wrong';
      const currentId = activeWord.id!;
      const baseQueue = [...manualQueue];
      const withoutCurrent = baseQueue.filter((id) => id !== currentId);
      const nextQueue = outcome === 'correct' ? withoutCurrent : [...withoutCurrent, currentId];

      setManualResult({
        outcome,
        expectedText: result.expectedText,
        enteredText: result.enteredText,
      });
      setManualPromptWordId(currentId);
      setPendingManualQueue(nextQueue);
      speakWord(result.expectedText, getExpectedLanguageName());
      await loadProblemWords(problemLimit);
    } catch (e) {
      setError(getMessage(e));
    }
  }

  async function submitTest() {
    if (!selectedCollection) return;

    const answers = selectedCollection.pairs.map((pair) => ({
      wordPairId: pair.id!,
      promptDirection: direction,
      enteredText: testAnswers[pair.id!] || '',
    }));

    try {
      const result = await api<TestResult>('/api/tests/submit', {
        method: 'POST',
        body: JSON.stringify({ collectionId: selectedCollection.id, answers }),
      });
      setTestResult(result);
      await loadCollections(scope);
      await loadProblemWords(problemLimit);
    } catch (e) {
      setError(getMessage(e));
    }
  }

  async function startProblemPractice() {
    const words = await api<ProblemWord[]>(`/api/practice/problematic?limit=${problemLimit}`);
    setProblemWords(words);
    if (words.length === 0) {
      setMessage('No problematic words yet. Practice or run tests first.');
      return;
    }

    const fakeCollection: CollectionDetails = {
      id: 'problematic',
      name: `Top ${problemLimit} problematic words`,
      ownerId: currentUser!.id,
      ownerName: currentUser!.name,
      sourceLanguageId: '',
      sourceLanguage: 'Mixed',
      targetLanguageId: '',
      targetLanguage: 'Mixed',
      pairs: words.map((x, index) => ({
        id: x.wordPairId,
        sourceText: x.sourceText,
        targetText: x.targetText,
        sortOrder: index,
      })),
    };

    setSelectedCollection(fakeCollection);
    setMode('manual');
    setPracticeIndex(0);
    setAnswerInput('');
    setMessage(null);
    setManualResult(null);
    setCardFlipped(false);
    setManualQueue(fakeCollection.pairs.map((pair) => pair.id!).filter(Boolean));
    setPendingManualQueue(null);
    setManualPromptWordId(null);
  }

  function getExpectedLanguageName() {
    if (!selectedCollection) return '';
    return direction === 'source-to-target' ? selectedCollection.targetLanguage : selectedCollection.sourceLanguage;
  }

  function getOutcomeColor(outcome: ManualResult['outcome']) {
    if (outcome === 'correct') return 'success.main';
    if (outcome === 'typo') return 'warning.main';
    return 'error.main';
  }

  function speakWord(text: string, languageName: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = selectedVoiceUri === 'auto'
      ? undefined
      : availableVoices.find((voice) => voice.voiceURI === selectedVoiceUri);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = getSpeechLang(languageName);
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function getSpeechLang(languageName: string) {
    const normalized = languageName.toLowerCase();
    if (normalized.includes('pol')) return 'pl-PL';
    if (normalized.includes('ang') || normalized.includes('eng')) return 'en-US';
    return 'en-US';
  }

  function onVoiceChange(voiceUri: string) {
    setSelectedVoiceUri(voiceUri);
    localStorage.setItem(VOICE_STORAGE_KEY, voiceUri);
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f3f5fb' }}>
      <AppBar position="static">
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Quizmam
          </Typography>
          <TextField
            select
            size="small"
            label="Voice"
            value={selectedVoiceUri}
            onChange={(e) => onVoiceChange(e.target.value)}
            sx={{ width: 300, bgcolor: 'white', borderRadius: 1 }}
            disabled={typeof window === 'undefined' || !('speechSynthesis' in window)}
          >
            <MenuItem value="auto">Auto (browser default)</MenuItem>
            {availableVoices.map((voice) => (
              <MenuItem key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </MenuItem>
            ))}
          </TextField>
          {currentUser && (
            <>
              <Typography>{currentUser.name}</Typography>
              <Autocomplete
                options={users.map((u) => u.name)}
                size="small"
                sx={{ width: 200, bgcolor: 'white', borderRadius: 1 }}
                onChange={(_, value) => value && switchUser(value)}
                renderInput={(params) => <TextField {...params} label="Switch user" />}
              />
              <Button color="inherit" onClick={logout}>Logout</Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {error && (
          <Alert sx={{ mb: 2 }} severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {message && (
          <Alert sx={{ mb: 2 }} severity="info" onClose={() => setMessage(null)}>
            {message}
          </Alert>
        )}

        {!currentUser ? (
          <Card sx={{ maxWidth: 560, mx: 'auto' }}>
            <CardContent>
              <Typography variant="h5" gutterBottom>Enter your name</Typography>
              <Stack spacing={2}>
                <Autocomplete
                  freeSolo
                  options={users.map((u) => u.name)}
                  inputValue={nameInput}
                  onInputChange={(_, value) => setNameInput(value)}
                  renderInput={(params) => <TextField {...params} label="Name" />}
                />
                <Button variant="contained" onClick={selectOrCreateUser}>Continue</Button>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={3}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Tabs value={scope} onChange={(_, value) => setScope(value)}>
                <Tab label="My collections" value="my" />
                <Tab label="All collections" value="all" />
              </Tabs>
              <Stack direction="row" spacing={1}>
                <TextField
                  select
                  size="small"
                  label="Problem words"
                  value={problemLimit}
                  onChange={(e) => setProblemLimit(Number(e.target.value))}
                >
                  {[10, 20, 30].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                </TextField>
                <Button variant="outlined" onClick={startProblemPractice}>Practice problematic</Button>
                <Button variant="contained" onClick={openNewWizard}>New collection</Button>
              </Stack>
            </Stack>

            <Stack spacing={2}>
              {collections.map((collection) => (
                <Card key={collection.id}>
                  <CardContent>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="h6">{collection.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {collection.ownerName} • {collection.sourceLanguage} → {collection.targetLanguage}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <Chip label={`${collection.pairCount} pairs`} size="small" />
                          <Chip label={`${collection.testCount} tests`} size="small" />
                          <Chip label={`avg ${collection.averageScore.toFixed(1)}%`} size="small" />
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button variant="outlined" onClick={() => openCollection(collection.id)}>Open</Button>
                        {scope === 'my' && (
                          <>
                            <Button variant="outlined" onClick={() => openEditWizard(collection.id)}>Edit</Button>
                            <IconButton color="error" onClick={() => removeCollection(collection.id)}><DeleteIcon /></IconButton>
                          </>
                        )}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Top problematic words ({problemLimit})
                </Typography>
                {problemWords.length === 0 ? (
                  <Typography color="text.secondary">No mistakes recorded yet.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {problemWords.slice(0, 5).map((word) => (
                      <Typography key={word.wordPairId} variant="body2">
                        {word.sourceText} → {word.targetText} • score {word.score} ({word.collectionName})
                      </Typography>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Stack>
        )}
      </Container>

      <Dialog open={wizardOpen} onClose={() => setWizardOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editingCollection ? 'Edit collection' : 'Create collection'}</DialogTitle>
        <DialogContent>
          <Tabs value={wizardStep} onChange={(_, step) => setWizardStep(step)}>
            <Tab label="Step 1: Metadata" />
            <Tab label="Step 2: Word pairs" />
          </Tabs>

          {wizardStep === 0 ? (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField label="Collection name" value={collectionName} onChange={(e) => setCollectionName(e.target.value)} />
              <Stack direction="row" spacing={2}>
                <TextField select fullWidth label="Source language" value={sourceLanguageId} onChange={(e) => setSourceLanguageId(e.target.value)}>
                  {languages.map((lang) => <MenuItem key={lang.id} value={lang.id}>{lang.name}</MenuItem>)}
                </TextField>
                <TextField select fullWidth label="Target language" value={targetLanguageId} onChange={(e) => setTargetLanguageId(e.target.value)}>
                  {languages.map((lang) => <MenuItem key={lang.id} value={lang.id}>{lang.name}</MenuItem>)}
                </TextField>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={1} sx={{ mt: 2 }}>
              {pairs.map((pair, index) => (
                <Stack direction="row" spacing={1} key={index}>
                  <TextField
                    fullWidth
                    label={`${languages.find((x) => x.id === sourceLanguageId)?.name || 'Source'} #${index + 1}`}
                    value={pair.sourceText}
                    onChange={(e) => updatePair(index, 'sourceText', e.target.value)}
                  />
                  <TextField
                    fullWidth
                    label={`${languages.find((x) => x.id === targetLanguageId)?.name || 'Target'} #${index + 1}`}
                    value={pair.targetText}
                    onChange={(e) => updatePair(index, 'targetText', e.target.value)}
                  />
                </Stack>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWizardOpen(false)}>Cancel</Button>
          <Button onClick={() => setWizardStep((step) => Math.max(step - 1, 0))} disabled={wizardStep === 0}>Back</Button>
          <Button onClick={() => setWizardStep((step) => Math.min(step + 1, 1))} disabled={wizardStep === 1}>Next</Button>
          <Button variant="contained" onClick={saveCollection}>Done</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!selectedCollection} onClose={() => setSelectedCollection(null)} fullWidth maxWidth="md">
        <DialogTitle>{selectedCollection?.name}</DialogTitle>
        <DialogContent>
          {mode === 'menu' && (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 1 }}>
              <Card sx={{ flex: 1, minWidth: 180 }}>
                <CardActionArea
                  sx={{ p: 2, height: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1 }}
                  onClick={() => {
                    setMode('manual');
                    setManualResult(null);
                    setCardFlipped(false);
                    setPendingManualQueue(null);
                    setManualPromptWordId(null);
                    setManualQueue(selectedCollection?.pairs.map((pair) => pair.id!).filter(Boolean) ?? []);
                  }}
                >
                  <TranslateIcon color="primary" fontSize="large" />
                  <Typography variant="button">Manual Translation</Typography>
                </CardActionArea>
              </Card>
              <Card sx={{ flex: 1, minWidth: 180 }}>
                <CardActionArea
                  sx={{ p: 2, height: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1 }}
                  onClick={() => { setMode('cards'); setManualResult(null); setCardFlipped(false); }}
                >
                  <ViewCarouselIcon color="primary" fontSize="large" />
                  <Typography variant="button">Cards</Typography>
                </CardActionArea>
              </Card>
              <Card sx={{ flex: 1, minWidth: 180 }}>
                <CardActionArea
                  sx={{ p: 2, height: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1 }}
                  onClick={() => setMode('test')}
                >
                  <FactCheckIcon color="primary" fontSize="large" />
                  <Typography variant="button">Test</Typography>
                </CardActionArea>
              </Card>
            </Stack>
          )}

          {mode !== 'menu' && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField
                select
                size="small"
                label="Direction"
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'source-to-target' | 'target-to-source')}
              >
                <MenuItem value="source-to-target">Source → Target</MenuItem>
                <MenuItem value="target-to-source">Target → Source</MenuItem>
              </TextField>

              {mode === 'manual' && activeWord && (
                <Box component="form" onSubmit={(e) => { e.preventDefault(); void submitManualAnswer(); }}>
                  <Stack spacing={3} sx={{ mt: 1, alignItems: 'center' }}>
                    <Typography variant="h3" sx={{ textAlign: 'center', fontWeight: 700 }}>
                      {promptText}
                    </Typography>

                    {!manualResult ? (
                      <TextField
                        autoFocus
                        fullWidth
                        label="Your answer"
                        value={answerInput}
                        onChange={(e) => setAnswerInput(e.target.value)}
                        sx={{ maxWidth: 560, '& input': { textAlign: 'center', fontSize: 24 } }}
                      />
                    ) : (
                      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        <IconButton onClick={() => speakWord(manualResult.expectedText, getExpectedLanguageName())} aria-label="Read correct translation">
                          <VolumeUpIcon />
                        </IconButton>
                        <Typography
                          variant="h3"
                          sx={{
                            textAlign: 'center',
                            fontWeight: 800,
                            color: getOutcomeColor(manualResult.outcome),
                          }}
                        >
                          {manualResult.outcome === 'correct'
                            ? (manualResult.enteredText || manualResult.expectedText)
                            : manualResult.expectedText}
                        </Typography>
                      </Stack>
                    )}

                    <Button type="submit" variant="contained" sx={{ minWidth: 220 }}>
                      {manualResult ? 'Next' : 'Check'}
                    </Button>
                  </Stack>
                </Box>
              )}

              {mode === 'cards' && activeWord && (
                <Stack spacing={2} sx={{ mt: 1, alignItems: 'center' }}>
                  <Box
                    onClick={() => setCardFlipped((value) => !value)}
                    sx={{
                      width: '100%',
                      minHeight: 180,
                      maxWidth: 720,
                      border: '1px solid',
                      borderColor: cardFlipped ? 'grey.900' : 'grey.300',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      px: 2,
                      bgcolor: cardFlipped ? 'common.black' : 'grey.100',
                    }}
                  >
                    <Typography
                      variant="h3"
                      sx={{
                        textAlign: 'center',
                        fontWeight: 700,
                        color: cardFlipped ? 'common.white' : 'text.primary',
                      }}
                    >
                      {cardFlipped ? expectedText : promptText}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={2}>
                    <IconButton onClick={() => speakWord(cardFlipped ? expectedText : promptText, cardFlipped ? getExpectedLanguageName() : (direction === 'source-to-target' ? selectedCollection?.sourceLanguage || '' : selectedCollection?.targetLanguage || ''))} aria-label="Read card word">
                      <VolumeUpIcon />
                    </IconButton>
                  </Stack>
                  <Button variant="contained" onClick={nextPracticeWord}>Next card</Button>
                </Stack>
              )}

              {mode === 'test' && selectedCollection && (
                <>
                  {selectedCollection.pairs.map((pair) => (
                    <Stack key={pair.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography sx={{ minWidth: 180 }}>
                        {direction === 'source-to-target' ? pair.sourceText : pair.targetText}
                      </Typography>
                      <TextField
                        fullWidth
                        value={testAnswers[pair.id!] || ''}
                        onChange={(e) => setTestAnswers((prev) => ({ ...prev, [pair.id!]: e.target.value }))}
                        placeholder="Enter translation"
                      />
                    </Stack>
                  ))}
                  <Button variant="contained" onClick={submitTest}>Submit test</Button>
                  {testResult && (
                    <Alert severity="success">
                      Score: {testResult.scorePercent.toFixed(1)}% • Correct: {testResult.correctCount}, Typo: {testResult.typoCount}, Wrong: {testResult.wrongCount}
                    </Alert>
                  )}
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMode('menu')}>Back to menu</Button>
          <Button onClick={() => setSelectedCollection(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

type EvaluateAnswerResponse = {
  wordPairId: string;
  expectedText: string;
  enteredText: string;
  outcome: string;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function getMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

export default App;
