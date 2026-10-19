const MANUAL_SESSION_STORAGE_KEY = 'quizmam:last-manual-session';
const VOICE_STORAGE_KEY = 'quizmam:selected-voice';

const state = {
  currentUser: null,
  users: [],
  collections: [],
  languages: [],
  problemWords: [],
  scope: 'my',
  problemLimit: 10,
  selectedCollection: null,
  mode: 'menu',
  direction: 'source-to-target',
  practiceIndex: 0,
  answerInput: '',
  manualQueue: [],
  pendingManualQueue: null,
  manualPromptWordId: null,
  manualResult: null,
  manualSummary: null,
  testAnswers: {},
  testResult: null,
  availableVoices: [],
  selectedVoice: 'auto',
  wizard: {
    editingCollection: null,
    step: 0,
    name: '',
    sourceLanguageId: '',
    targetLanguageId: '',
    pairs: [
      { sourceText: '', targetText: '' },
      { sourceText: '', targetText: '' },
    ],
  },
};

window.__quizmamDebug = {
  getState: () => state,
  getCurrentUser: () => state.currentUser,
  getMode: () => state.mode,
  getSelectedCollection: () => state.selectedCollection,
};

$.ajaxSetup({
  cache: false,
  xhrFields: { withCredentials: true },
  beforeSend(xhr) {
    xhr.setRequestHeader('Accept', 'application/json');
  },
});

$(function () {
  bindUi();
  loadVoices();
  bootstrap();
});

function bindUi() {
  $('#continueButton').on('click', selectOrCreateUser);
  $('#nameInput').on('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      selectOrCreateUser();
    }
  });

  $('#practiceProblematicButton').on('click', startProblemPractice);
  $('#newCollectionButton').on('click', openNewWizard);
  $('#problemLimitSelect').on('change', function () {
    state.problemLimit = Number($(this).val());
    if (state.currentUser) {
      loadProblemWords(state.problemLimit);
    }
  });

  $('button[data-scope]').on('click', function () {
    const nextScope = $(this).data('scope');
    state.scope = nextScope;
    $('button[data-scope]').removeClass('active-tab');
    $(this).addClass('active-tab');
    loadCollections(nextScope);
  });

  $('#voiceSelect').on('change', function () {
    state.selectedVoice = $(this).val() || 'auto';
    localStorage.setItem(VOICE_STORAGE_KEY, state.selectedVoice);
  });

  $('#wizardBackButton').on('click', () => {
    if (state.wizard.step > 0) {
      state.wizard.step -= 1;
      renderWizard();
    }
  });

  $('#wizardNextButton').on('click', () => {
    if (state.wizard.step === 0) {
      state.wizard.step = 1;
      renderWizard();
      return;
    }
  });

  $('#saveCollectionButton').on('click', saveCollection);
  $('#closeCollectionModalButton').on('click', () => {
    hideCollectionModal();
  });
  $('#backToMenuButton').on('click', () => {
    state.mode = 'menu';
    renderCollectionModal();
  });

  $('#practiceDirectionSelect').on('change', function () {
    state.direction = $(this).val();
    renderCollectionModal();
  });

  $(document).on('click', '[data-action="read-word"]', function (event) {
    event.preventDefault();
    const word = $(this).data('word');
    const language = $(this).data('language') || '';
    speakWord(word, language);
  });

  $(document).on('click', '[data-action="open-collection"]', function () {
    const id = $(this).data('id');
    openCollection(id);
  });

  $(document).on('click', '[data-action="edit-collection"]', function () {
    const id = $(this).data('id');
    openEditWizard(id);
  });

  $(document).on('click', '[data-action="delete-collection"]', function () {
    const id = $(this).data('id');
    removeCollection(id);
  });

  $(document).on('click', '[data-mode-select]', function () {
    const mode = $(this).data('mode-select');
    beginPracticeMode(mode);
  });

  $(document).on('click', '#manualCheckButton', submitManualAnswer);
  $(document).on('submit', '#manualAnswerForm', function (event) {
    event.preventDefault();
    submitManualAnswer();
  });

  $(document).on('click', '#nextCardButton', function () {
    nextPracticeWord();
  });

  $(document).on('click', '#submitTestButton', submitTest);

  $(document).on('click', '#nextManualButton', function () {
    continueManualQueue();
  });

  $(document).on('click', '#logoutButton', logout);

  $(document).on('keydown', function (event) {
    if (!state.selectedCollection) return;

    if (state.mode === 'manual' && state.manualResult && (event.key === 'Enter' || event.key === 'NumpadEnter')) {
      event.preventDefault();
      continueManualQueue();
      return;
    }

    if (state.mode === 'cards') {
      if (event.key === 'Enter') {
        event.preventDefault();
        nextPracticeWord();
        return;
      }

      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        const card = $('#cardsPracticeCard');
        if (card.length) {
          const current = card.data('flipped') === true;
          card.data('flipped', !current);
          renderCardsPractice();
        }
      }
    }
  });
}

async function bootstrap() {
  try {
    const [usersResponse, meResponse] = await Promise.all([
      api('/api/users'),
      fetch('/api/users/me', { credentials: 'include' }),
    ]);

    state.users = usersResponse || [];
    renderUserOptions();

    if (meResponse.ok) {
      state.currentUser = await meResponse.json();
      renderUserPanel();
      showAppScreen();
      loadCollections('my');
      loadLanguages();
      loadProblemWords(state.problemLimit);
      restoreManualSession();
      return;
    }

    renderUserPanel();
    showLoginScreen();
  } catch (error) {
    showError(getMessage(error));
  }
}

async function loadCollections(scope) {
  if (!state.currentUser) return;

  try {
    const items = await api(`/api/collections?scope=${scope}`);
    state.collections = items || [];
    renderCollections();
  } catch (error) {
    showError(getMessage(error));
  }
}

async function loadLanguages() {
  try {
    const items = await api('/api/languages');
    state.languages = items || [];
    renderLanguageSelects();
  } catch (error) {
    showError(getMessage(error));
  }
}

async function loadProblemWords(limit) {
  if (!state.currentUser) return;

  try {
    state.problemWords = await api(`/api/practice/problematic?limit=${limit}`);
    renderProblemWords();
  } catch (error) {
    showError(getMessage(error));
  }
}

async function selectOrCreateUser() {
  const name = $('#nameInput').val()?.trim();
  if (!name) {
    showError('Name is required.');
    return;
  }

  try {
    const user = await api('/api/users/select-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    state.currentUser = user;
    $('#nameInput').val('');
    clearAlert();
    renderUserPanel();
    showAppScreen();
    loadCollections(state.scope);
    loadLanguages();
    loadProblemWords(state.problemLimit);
    restoreManualSession();
  } catch (error) {
    showError(getMessage(error));
  }
}

async function switchUser(name) {
  try {
    const user = await api('/api/users/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    state.currentUser = user;
    state.selectedCollection = null;
    state.mode = 'menu';
    state.testResult = null;
    renderUserPanel();
    loadCollections(state.scope);
    loadProblemWords(state.problemLimit);
    hideCollectionModal();
  } catch (error) {
    showError(getMessage(error));
  }
}

async function logout() {
  try {
    await api('/api/users/logout', { method: 'POST' });
  } catch (error) {
    console.error(error);
  } finally {
    localStorage.removeItem(MANUAL_SESSION_STORAGE_KEY);
    state.currentUser = null;
    state.collections = [];
    state.problemWords = [];
    state.selectedCollection = null;
    state.mode = 'menu';
    renderUserPanel();
    showLoginScreen();
    clearAlert();
  }
}

function renderUserOptions() {
  const datalist = $('#knownUsers');
  datalist.empty();
  state.users.forEach((user) => {
    $('<option></option>').val(user.name).appendTo(datalist);
  });
}

function renderUserPanel() {
  const $panel = $('#userPanel');
  $panel.empty();

  if (!state.currentUser) {
    return;
  }

  const $name = $('<span class="user-pill">').text(state.currentUser.name);
  const $switch = $('<select class="form-select form-select-sm user-switch-select" aria-label="Switch user">');
  $switch.append($('<option value="">Switch user</option>'));
  state.users.forEach((user) => {
    const option = $('<option></option>').val(user.name).text(user.name);
    if (user.id === state.currentUser.id) {
      option.attr('selected', 'selected');
    }
    option.appendTo($switch);
  });
  $switch.on('change', function () {
    const value = $(this).val();
    if (value) {
      switchUser(value);
      $(this).val('');
    }
  });

  const $logout = $('<button class="btn btn-outline-light btn-sm" id="logoutButton">Logout</button>');

  $name.appendTo($panel);
  $switch.appendTo($panel);
  $logout.appendTo($panel);
}

function showAppScreen() {
  $('#loginScreen').addClass('d-none');
  $('#appScreen').removeClass('d-none');
}

function showLoginScreen() {
  $('#appScreen').addClass('d-none');
  $('#loginScreen').removeClass('d-none');
}

function renderCollections() {
  const $list = $('#collectionsList');
  $list.empty();

  if (!state.collections.length) {
    $list.append('<div class="col-12"><div class="empty-state">No collections yet.</div></div>');
    return;
  }

  state.collections.forEach((collection) => {
    const $card = $(`
      <div class="col-12">
        <div class="collection-card card shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start gap-3">
              <div>
                <h3 class="h5 mb-1">${escapeHtml(collection.name)}</h3>
                <div class="text-muted small mb-2">${escapeHtml(collection.ownerName)} • ${escapeHtml(collection.sourceLanguage)} → ${escapeHtml(collection.targetLanguage)}</div>
                <div class="d-flex flex-wrap gap-2">
                  <span class="badge text-bg-light">${collection.pairCount} pairs</span>
                  <span class="badge text-bg-light">${collection.testCount} tests</span>
                  <span class="badge text-bg-light">avg ${Number(collection.averageScore || 0).toFixed(1)}%</span>
                </div>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-outline-primary btn-sm" data-action="open-collection" data-id="${collection.id}">Open</button>
                ${state.scope === 'my' ? `
                  <button class="btn btn-outline-secondary btn-sm" data-action="edit-collection" data-id="${collection.id}">Edit</button>
                  <button class="btn btn-outline-danger btn-sm" data-action="delete-collection" data-id="${collection.id}">Delete</button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `);
    $list.append($card);
  });
}

function renderProblemWords() {
  const $container = $('#problemWordsList');
  $container.empty();

  if (!state.problemWords.length) {
    $container.append('<div class="text-muted">No mistakes recorded yet.</div>');
    return;
  }

  const items = state.problemWords.slice(0, 5);
  items.forEach((word) => {
    const row = $(`
      <div class="problem-row d-flex justify-content-between align-items-center gap-3 py-2 border-bottom">
        <div>
          <div class="fw-semibold">${escapeHtml(word.sourceText)} → ${escapeHtml(word.targetText)}</div>
          <div class="small text-muted">${escapeHtml(word.collectionName)}</div>
        </div>
        <span class="badge text-bg-warning">score ${word.score}</span>
      </div>
    `);
    $container.append(row);
  });
}

function openNewWizard() {
  const languageDefaults = getDefaultLanguageIds(state.languages);
  state.wizard = {
    editingCollection: null,
    step: 0,
    name: '',
    sourceLanguageId: languageDefaults.sourceLanguageId,
    targetLanguageId: languageDefaults.targetLanguageId,
    pairs: [{ sourceText: '', targetText: '' }],
  };
  renderLanguageSelects();
  renderWizard();
  $('#collectionWizardModal').modal('show');
}

async function openEditWizard(id) {
  try {
    const details = await api(`/api/collections/${id}`);
    state.wizard = {
      editingCollection: details,
      step: 0,
      name: details.name,
      sourceLanguageId: details.sourceLanguageId,
      targetLanguageId: details.targetLanguageId,
      pairs: details.pairs.length ? details.pairs.map((pair) => ({ sourceText: pair.sourceText, targetText: pair.targetText })) : [{ sourceText: '', targetText: '' }],
    };
    renderLanguageSelects();
    renderWizard();
    $('#collectionWizardModal').modal('show');
  } catch (error) {
    showError(getMessage(error));
  }
}

function renderLanguageSelects() {
  const languageDefaults = getDefaultLanguageIds(state.languages);
  const sourceLanguageId = state.wizard.sourceLanguageId || languageDefaults.sourceLanguageId;
  const targetLanguageId = state.wizard.targetLanguageId
    || state.languages.find((language) => language.id !== sourceLanguageId)?.id
    || sourceLanguageId;

  state.wizard.sourceLanguageId = sourceLanguageId;
  state.wizard.targetLanguageId = targetLanguageId;

  const $source = $('#sourceLanguageSelect');
  const $target = $('#targetLanguageSelect');
  $source.empty();
  $target.empty();

  state.languages.forEach((language) => {
    $source.append($('<option></option>').val(language.id).text(language.name));
    $target.append($('<option></option>').val(language.id).text(language.name));
  });

  $source.val(sourceLanguageId);
  $target.val(targetLanguageId);

  $('#sourceLanguageSelect').off('change').on('change', function () {
    state.wizard.sourceLanguageId = $(this).val();
    updateWordPairLanguageHeaders();
  });
  $('#targetLanguageSelect').off('change').on('change', function () {
    state.wizard.targetLanguageId = $(this).val();
    updateWordPairLanguageHeaders();
  });

  $('#collectionNameInput').val(state.wizard.name || '').off('input').on('input', function () {
    state.wizard.name = $(this).val();
  });
}

function renderWizard() {
  const step = state.wizard.step;
  $('#wizard-step-0-tab').toggleClass('active', step === 0);
  $('#wizard-step-1-tab').toggleClass('active', step === 1);
  $('#wizard-step-0').toggleClass('show active', step === 0);
  $('#wizard-step-1').toggleClass('show active', step === 1);

  updateWordPairLanguageHeaders();

  const $pairs = $('#wordPairsContainer');
  $pairs.empty();

  state.wizard.pairs.forEach((pair, index) => {
    $pairs.append(createWizardPairRow(index));
  });

  $('#wizardBackButton').toggleClass('d-none', step === 0);
  $('#wizardNextButton').toggleClass('d-none', step === 1);
  $('#saveCollectionButton').toggleClass('d-none', step !== 1);
  $('#collectionWizardModal .modal-title').text(state.wizard.editingCollection ? 'Edit collection' : 'Create collection');
}

function updateWordPairLanguageHeaders() {
  const sourceLanguage = getLanguageLabel(state.wizard.sourceLanguageId, 'Source');
  const targetLanguage = getLanguageLabel(state.wizard.targetLanguageId, 'Target');
  $('#sourceWordHeader').text(sourceLanguage);
  $('#targetWordHeader').text(targetLanguage);

  $('.pair-source-input').each(function () {
    $(this).attr('aria-label', `${sourceLanguage} ${Number($(this).data('row-index')) + 1}`);
  });
  $('.pair-target-input').each(function () {
    $(this).attr('aria-label', `${targetLanguage} ${Number($(this).data('row-index')) + 1}`);
  });
}

function createWizardPairRow(index) {
  const pair = state.wizard.pairs[index];
  const rowNumber = index + 1;
  const sourceLanguage = getLanguageLabel(state.wizard.sourceLanguageId, 'Source');
  const targetLanguage = getLanguageLabel(state.wizard.targetLanguageId, 'Target');
  const row = $(`
    <tr class="pair-row" data-row-index="${index}">
      <th scope="row">${rowNumber}</th>
      <td>
        <input class="form-control pair-source-input" data-row-index="${index}" aria-label="${escapeAttribute(`${sourceLanguage} ${rowNumber}`)}" value="${escapeAttribute(pair.sourceText)}" placeholder="Source word" />
      </td>
      <td>
        <input class="form-control pair-target-input" data-row-index="${index}" aria-label="${escapeAttribute(`${targetLanguage} ${rowNumber}`)}" value="${escapeAttribute(pair.targetText)}" placeholder="Translation" />
      </td>
    </tr>
  `);

  row.find('.pair-source-input').on('input', function () {
    updateWizardPair(index, 'sourceText', $(this).val());
  });
  row.find('.pair-target-input').on('input', function () {
    updateWizardPair(index, 'targetText', $(this).val());
  });

  return row;
}

function getLanguageLabel(languageId, fallback) {
  const language = state.languages.find((item) => item.id === languageId);
  return language ? language.name : fallback;
}

function updateWizardPair(index, field, value) {
  const item = state.wizard.pairs[index];
  if (!item) return;
  item[field] = value;

  if (completePairAndAppendBlank(state.wizard.pairs, index)) {
    $('#wordPairsContainer').append(createWizardPairRow(state.wizard.pairs.length - 1));
  }
}

async function saveCollection() {
  if (!hasDistinctLanguageIds(state.wizard.sourceLanguageId, state.wizard.targetLanguageId)) {
    showError('Source and target languages must be different.');
    return;
  }

  const cleanPairs = state.wizard.pairs.filter((pair) => pair.sourceText.trim() && pair.targetText.trim());

  if (!state.wizard.name.trim()) {
    showError('Collection name is required.');
    return;
  }

  if (cleanPairs.length < 2) {
    showError('At least two complete pairs are required.');
    return;
  }

  const payload = {
    name: state.wizard.name.trim(),
    sourceLanguageId: state.wizard.sourceLanguageId,
    targetLanguageId: state.wizard.targetLanguageId,
    pairs: cleanPairs.map((pair) => ({ sourceText: pair.sourceText.trim(), targetText: pair.targetText.trim() })),
  };

  try {
    if (state.wizard.editingCollection) {
      await api(`/api/collections/${state.wizard.editingCollection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: state.wizard.editingCollection.id, ...payload }),
      });
    } else {
      await api('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    $('#collectionWizardModal').modal('hide');
    clearAlert();
    loadCollections(state.scope);
  } catch (error) {
    showError(getMessage(error));
  }
}

async function removeCollection(id) {
  try {
    await api(`/api/collections/${id}`, { method: 'DELETE' });
    loadCollections(state.scope);
  } catch (error) {
    showError(getMessage(error));
  }
}

async function openCollection(id) {
  try {
    const details = await api(`/api/collections/${id}`);
    state.selectedCollection = details;
    state.mode = 'menu';
    state.direction = 'source-to-target';
    state.practiceIndex = 0;
    state.answerInput = '';
    state.testAnswers = {};
    state.testResult = null;
    state.manualQueue = details.pairs.map((pair) => pair.id).filter(Boolean);
    state.pendingManualQueue = null;
    state.manualPromptWordId = null;
    state.manualResult = null;
    state.manualSummary = { correct: 0, typo: 0, wrong: 0, total: 0 };
    state.currentCardFlipped = false;
    $('#practiceDirectionSelect').val('source-to-target');
    renderCollectionModal();
    $('#collectionDetailModal').modal('show');
  } catch (error) {
    showError(getMessage(error));
  }
}

async function beginPracticeMode(mode) {
  if (!state.selectedCollection) return;

  state.mode = mode;
  if (mode === 'manual') {
    state.manualQueue = state.selectedCollection.pairs.map((pair) => pair.id).filter(Boolean);
    state.pendingManualQueue = null;
    state.manualPromptWordId = null;
    state.manualResult = null;
    state.manualSummary = { correct: 0, typo: 0, wrong: 0, total: 0 };
    state.answerInput = '';
    saveManualSession();
  }
  if (mode === 'cards') {
    state.practiceIndex = 0;
  }
  if (mode === 'test') {
    state.testAnswers = {};
    state.testResult = null;
  }
  renderCollectionModal();
}

function renderCollectionModal() {
  if (!state.selectedCollection) return;

  $('#collectionDetailTitle').text(state.selectedCollection.name);
  $('#practiceDirectionSelect').val(state.direction);

  if (state.mode === 'menu') {
    $('#practiceModeSelection').removeClass('d-none');
    $('#practiceSection').addClass('d-none');
    const $selection = $('#practiceModeSelection');
    $selection.empty();

    const options = [
      { mode: 'manual', title: 'Manual translation', icon: 'bi-translate', text: 'Type the answer' },
      { mode: 'cards', title: 'Cards', icon: 'bi-card-text', text: 'Flip and review' },
      { mode: 'test', title: 'Test', icon: 'bi-check2-square', text: 'Answer all prompts' },
    ];

    options.forEach((option) => {
      const card = $(`
        <div class="col-md-4">
          <div class="practice-option-card card h-100 shadow-sm" data-mode-select="${option.mode}">
            <div class="card-body d-flex flex-column align-items-center justify-content-center text-center p-4">
              <i class="bi ${option.icon} mb-3"></i>
              <h4 class="h5 mb-1">${option.title}</h4>
              <small class="text-muted">${option.text}</small>
            </div>
          </div>
        </div>
      `);
      $selection.append(card);
    });
    return;
  }

  $('#practiceModeSelection').addClass('d-none');
  $('#practiceSection').removeClass('d-none');

  $('.practice-panel').addClass('d-none');

  if (state.mode === 'manual') {
    renderManualPractice();
    $('#manualPracticeArea').removeClass('d-none');
  }

  if (state.mode === 'cards') {
    renderCardsPractice();
    $('#cardsPracticeArea').removeClass('d-none');
  }

  if (state.mode === 'test') {
    renderTestPractice();
    $('#testPracticeArea').removeClass('d-none');
  }
}

function nextPracticeWord() {
  if (!state.selectedCollection) return;

  const pairs = state.selectedCollection.pairs || [];
  if (!pairs.length) return;

  state.practiceIndex = (state.practiceIndex + 1) % pairs.length;
  const $card = $('#cardsPracticeCard');
  if ($card.length) {
    $card.data('flipped', false);
  }
  renderCardsPractice();
}

function getActiveWord() {
  if (!state.selectedCollection) return null;
  const pairs = state.selectedCollection.pairs;

  if (state.mode === 'manual') {
    const id = state.manualPromptWordId || state.manualQueue[0];
    if (!id) return null;
    return pairs.find((pair) => pair.id === id) || null;
  }

  return pairs[state.practiceIndex % pairs.length] || null;
}

function renderManualPractice() {
  const activeWord = getActiveWord();
  if (!activeWord) {
    $('#manualPracticeArea').html('<div class="text-muted">No words available.</div>');
    return;
  }

  const promptText = state.direction === 'source-to-target' ? activeWord.sourceText : activeWord.targetText;
  const expectedText = state.direction === 'source-to-target' ? activeWord.targetText : activeWord.sourceText;
  const displayText = getManualPracticeDisplayText(promptText, state.manualResult, expectedText);
  const cardColor = state.manualResult ? getOutcomeColor(state.manualResult.outcome) : '#1f2937';

  let content = `
    <div class="manual-practice text-center">
      <div class="practice-header-row">
        <button class="btn btn-outline-primary rounded-circle speaker-btn" data-action="read-word" data-word="${escapeAttribute(expectedText)}" data-language="${escapeAttribute(getExpectedLanguageName())}">
          <i class="bi bi-volume-up"></i>
        </button>
      </div>

      <div class="practice-word-display" style="color: ${cardColor};">${escapeHtml(displayText)}</div>

      ${state.manualResult ? `
        <div class="manual-result-box mt-4">
          <div class="manual-input-preview">${escapeHtml(state.manualResult.enteredText || '')}</div>
          <div class="small text-muted mt-2">${escapeHtml(state.manualResult.outcome === 'correct' ? 'Correct answer' : state.manualResult.outcome === 'typo' ? 'Typo detected' : 'Wrong answer')}</div>
        </div>
      ` : `
        <form id="manualAnswerForm" class="mt-4">
          <input id="manualAnswerInput" class="form-control form-control-lg text-center manual-answer-input" value="${escapeAttribute(state.answerInput)}" autocomplete="off" autofocus />
          <button type="submit" class="btn btn-primary btn-lg mt-3 px-5">${state.manualResult ? 'Next' : 'Check'}</button>
        </form>
      `}

      ${state.manualResult ? '<button id="nextManualButton" class="btn btn-primary btn-lg mt-4">Next</button>' : ''}
    </div>
  `;

  $('#manualPracticeArea').html(content);

  const $manualInput = $('#manualAnswerInput');
  if ($manualInput.length) {
    setTimeout(() => {
      $manualInput.focus();
      const value = $manualInput.val() || '';
      $manualInput[0].setSelectionRange(value.length, value.length);
    }, 0);
  }

  $('#manualAnswerInput').on('input', function () {
    state.answerInput = $(this).val();
    saveManualSession();
  });
}

function renderCardsPractice() {
  const activeWord = getActiveWord();
  if (!activeWord) {
    $('#cardsPracticeArea').html('<div class="text-muted">No words available.</div>');
    return;
  }

  const promptText = state.direction === 'source-to-target' ? activeWord.sourceText : activeWord.targetText;
  const expectedText = state.direction === 'source-to-target' ? activeWord.targetText : activeWord.sourceText;
  const flipped = $('#cardsPracticeCard').data('flipped') === true;
  const displayText = flipped ? expectedText : promptText;
  const language = flipped ? getExpectedLanguageName() : getPromptLanguageName();

  const content = `
    <div class="card-practice-wrapper text-center">
      <div id="cardsPracticeCard" class="flashcard ${flipped ? 'flipped' : ''}" data-flipped="${flipped}">
        <div class="flashcard-body">
          <div class="flashcard-word">${escapeHtml(displayText)}</div>
        </div>
      </div>

      <div class="d-flex justify-content-center gap-3 mt-3">
        <button class="btn btn-outline-primary rounded-circle speaker-btn" data-action="read-word" data-word="${escapeAttribute(displayText)}" data-language="${escapeAttribute(language)}">
          <i class="bi bi-volume-up"></i>
        </button>
      </div>

      <button id="nextCardButton" class="btn btn-primary btn-lg mt-4">Next card</button>
    </div>
  `;

  $('#cardsPracticeArea').html(content);
  $('#cardsPracticeCard').on('click', function () {
    const nextState = $(this).data('flipped') !== true;
    $(this).data('flipped', nextState);
    renderCardsPractice();
  });
}

function renderTestPractice() {
  if (!state.selectedCollection) return;

  const $container = $('#testPracticeArea');
  $container.empty();

  const rows = state.selectedCollection.pairs.map((pair) => {
    const promptText = state.direction === 'source-to-target' ? pair.sourceText : pair.targetText;
    const value = state.testAnswers[pair.id] || '';
    return `
      <div class="test-row d-flex align-items-center gap-3 py-2">
        <div class="test-prompt fw-semibold">${escapeHtml(promptText)}</div>
        <input class="form-control test-answer-input" data-pair-id="${pair.id}" value="${escapeAttribute(value)}" placeholder="Enter translation" />
      </div>
    `;
  }).join('');

  const result = state.testResult ? `
    <div class="alert alert-success mt-3 mb-0">
      Score: ${Number(state.testResult.scorePercent || 0).toFixed(1)}% • Correct: ${state.testResult.correctCount}, Typo: ${state.testResult.typoCount}, Wrong: ${state.testResult.wrongCount}
    </div>
  ` : '';

  $container.html(`
    <div class="test-practice-list">
      ${rows}
    </div>
    <button id="submitTestButton" class="btn btn-primary btn-lg mt-3">Submit test</button>
    ${result}
  `);

  $('.test-answer-input').on('input', function () {
    const id = $(this).data('pair-id');
    state.testAnswers[id] = $(this).val();
  });
}

async function submitManualAnswer() {
  const activeWord = getActiveWord();
  if (!activeWord) return;

  if (state.manualResult) {
    continueManualQueue();
    return;
  }

  try {
    const result = await api('/api/learning/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wordPairId: activeWord.id,
        direction: state.direction,
        enteredText: $('#manualAnswerInput').val() || ''
      }),
    });

    const outcome = result.outcome || 'wrong';
    state.manualSummary = state.manualSummary || { correct: 0, typo: 0, wrong: 0, total: 0 };
    state.manualSummary.total += 1;
    if (outcome === 'correct') {
      state.manualSummary.correct += 1;
    } else if (outcome === 'typo') {
      state.manualSummary.typo += 1;
    } else {
      state.manualSummary.wrong += 1;
    }

    const currentId = activeWord.id;
    const baseQueue = [...state.manualQueue];
    const withoutCurrent = baseQueue.filter((id) => id !== currentId);
    const nextQueue = outcome === 'correct' ? withoutCurrent : [...withoutCurrent, currentId];

    state.manualResult = {
      outcome,
      expectedText: result.expectedText,
      enteredText: result.enteredText,
    };
    state.pendingManualQueue = nextQueue;
    state.manualPromptWordId = currentId;
    state.answerInput = result.enteredText || '';

    speakWord(result.expectedText, getExpectedLanguageName());
    saveManualSession();
    renderManualPractice();
    loadProblemWords(state.problemLimit);
  } catch (error) {
    showError(getMessage(error));
  }
}

function continueManualQueue() {
  const nextQueue = state.pendingManualQueue || state.manualQueue;
  if (!nextQueue.length) {
    const summary = state.manualSummary || { correct: 0, typo: 0, wrong: 0, total: 0 };
    state.manualResult = null;
    state.answerInput = '';
    state.pendingManualQueue = null;
    state.manualPromptWordId = null;
    state.manualQueue = [];
    state.manualSummary = null;
    localStorage.removeItem(MANUAL_SESSION_STORAGE_KEY);
    renderManualSummary(summary);
    renderManualPractice();
    return;
  }

  state.manualQueue = nextQueue;
  state.pendingManualQueue = null;
  state.manualResult = null;
  state.answerInput = '';
  state.manualPromptWordId = null;
  saveManualSession();
  renderManualPractice();
}

function renderManualSummary(summary) {
  const total = Number(summary?.total || 0);
  const correct = Number(summary?.correct || 0);
  const typo = Number(summary?.typo || 0);
  const wrong = Number(summary?.wrong || 0);

  $('#manualSummaryTitle').text('Congratulations!');
  $('#manualSummaryBody').html(`
    <div class="text-center mb-3">
      <i class="bi bi-check-circle-fill text-success" style="font-size: 3rem;"></i>
    </div>
    <p class="mb-3">You completed this practice set.</p>
    <div class="row text-center g-2">
      <div class="col-4">
        <div class="border rounded p-3">
          <div class="fw-bold fs-4 text-success">${correct}</div>
          <div class="small text-muted">correct</div>
        </div>
      </div>
      <div class="col-4">
        <div class="border rounded p-3">
          <div class="fw-bold fs-4 text-warning">${typo}</div>
          <div class="small text-muted">typo</div>
        </div>
      </div>
      <div class="col-4">
        <div class="border rounded p-3">
          <div class="fw-bold fs-4 text-danger">${wrong}</div>
          <div class="small text-muted">wrong</div>
        </div>
      </div>
    </div>
    <div class="mt-3 text-center small text-muted">${total} words reviewed</div>
  `);

  $('#manualSummaryModal').modal('show');
}

async function submitTest() {
  if (!state.selectedCollection) return;

  const answers = state.selectedCollection.pairs.map((pair) => ({
    wordPairId: pair.id,
    promptDirection: state.direction,
    enteredText: state.testAnswers[pair.id] || '',
  }));

  try {
    const result = await api('/api/tests/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collectionId: state.selectedCollection.id,
        answers,
      }),
    });

    state.testResult = result;
    loadCollections(state.scope);
    loadProblemWords(state.problemLimit);
    renderTestPractice();
  } catch (error) {
    showError(getMessage(error));
  }
}

async function startProblemPractice() {
  try {
    const words = await api(`/api/practice/problematic?limit=${state.problemLimit}`);
    state.problemWords = words || [];

    if (!words || !words.length) {
      showInfo('No problematic words yet. Practice or run tests first.');
      renderProblemWords();
      return;
    }

    const fakeCollection = {
      id: 'problematic',
      name: `Top ${state.problemLimit} problematic words`,
      ownerId: state.currentUser.id,
      ownerName: state.currentUser.name,
      sourceLanguageId: '',
      sourceLanguage: 'Mixed',
      targetLanguageId: '',
      targetLanguage: 'Mixed',
      pairs: words.map((word, index) => ({
        id: word.wordPairId,
        sourceText: word.sourceText,
        targetText: word.targetText,
        sortOrder: index,
      })),
    };

    state.selectedCollection = fakeCollection;
    state.mode = 'manual';
    state.direction = 'source-to-target';
    state.manualQueue = fakeCollection.pairs.map((pair) => pair.id).filter(Boolean);
    state.pendingManualQueue = null;
    state.manualPromptWordId = null;
    state.manualResult = null;
    state.manualSummary = { correct: 0, typo: 0, wrong: 0, total: 0 };
    state.answerInput = '';
    renderCollectionModal();
    $('#collectionDetailModal').modal('show');
  } catch (error) {
    showError(getMessage(error));
  }
}

function getExpectedLanguageName() {
  if (!state.selectedCollection) return '';
  return state.direction === 'source-to-target' ? state.selectedCollection.targetLanguage : state.selectedCollection.sourceLanguage;
}

function getPromptLanguageName() {
  if (!state.selectedCollection) return '';
  return state.direction === 'source-to-target' ? state.selectedCollection.sourceLanguage : state.selectedCollection.targetLanguage;
}

function getOutcomeColor(outcome) {
  if (outcome === 'correct') return '#198754';
  if (outcome === 'typo') return '#f0ad4e';
  return '#dc3545';
}

function getOutcomeClass(outcome) {
  if (outcome === 'correct') return 'text-success';
  if (outcome === 'typo') return 'text-warning';
  return 'text-danger';
}

function speakWord(text, languageName) {
  if (!text || !('speechSynthesis' in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const selectedVoice = state.selectedVoice === 'auto'
    ? null
    : state.availableVoices.find((voice) => voice.voiceURI === state.selectedVoice) || null;

  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = getSpeechLang(languageName);
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function getSpeechLang(languageName) {
  const normalized = (languageName || '').toLowerCase();
  if (normalized.includes('pol')) return 'pl-PL';
  if (normalized.includes('ang') || normalized.includes('eng')) return 'en-US';
  return 'en-US';
}

function loadVoices() {
  if (!('speechSynthesis' in window)) {
    $('#voiceSelect').prop('disabled', true);
    return;
  }

  const saved = localStorage.getItem(VOICE_STORAGE_KEY) || 'auto';
  state.selectedVoice = saved;

  const refreshVoices = () => {
    state.availableVoices = window.speechSynthesis.getVoices();
    const $select = $('#voiceSelect');
    $select.empty();
    $select.append('<option value="auto">Auto (browser default)</option>');
    state.availableVoices.forEach((voice) => {
      $select.append($('<option></option>').val(voice.voiceURI).text(`${voice.name} (${voice.lang})`));
    });
    $select.val(state.selectedVoice);
  };

  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

function saveManualSession() {
  if (!state.selectedCollection || state.mode !== 'manual') return;

  const payload = {
    collectionId: state.selectedCollection.id,
    direction: state.direction,
    manualQueue: state.manualQueue,
    pendingManualQueue: state.pendingManualQueue,
    manualPromptWordId: state.manualPromptWordId,
    answerInput: state.answerInput,
    manualResult: state.manualResult,
  };

  localStorage.setItem(MANUAL_SESSION_STORAGE_KEY, JSON.stringify(payload));
}

function restoreManualSession() {
  const raw = localStorage.getItem(MANUAL_SESSION_STORAGE_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    if (!saved.collectionId || !state.currentUser) return;

    const collection = state.collections.find((item) => item.id === saved.collectionId);
    if (!collection) return;

    openCollection(collection.id).then(() => {
      state.direction = saved.direction || 'source-to-target';
      state.mode = 'manual';
      state.manualQueue = saved.manualQueue || [];
      state.pendingManualQueue = saved.pendingManualQueue || null;
      state.manualPromptWordId = saved.manualPromptWordId || null;
      state.answerInput = saved.answerInput || '';
      state.manualResult = saved.manualResult || null;
      renderCollectionModal();
    });
  } catch (error) {
    localStorage.removeItem(MANUAL_SESSION_STORAGE_KEY);
  }
}

async function api(url, init = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Request failed');
  }

  if (response.status === 204) {
    return undefined;
  }

  return response.json();
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function showError(message) {
  renderAlert('danger', message);
}

function showInfo(message) {
  renderAlert('info', message);
}

function clearAlert() {
  $('#alertContainer').empty();
}

function renderAlert(type, message) {
  $('#alertContainer').html(`
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${escapeHtml(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `);
}

function getMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

function hideCollectionModal() {
  $('#collectionDetailModal').modal('hide');
  state.selectedCollection = null;
  state.mode = 'menu';
  state.manualResult = null;
  state.testResult = null;
}