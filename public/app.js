const catalog = [
  {
    id: "main-1",
    title: "Soft Landing",
    artist: "Mira Vale",
    duration: 214,
    colorA: "#33d17a",
    colorB: "#7fd6ff",
    energy: 0.58,
    moods: ["evening", "focus"]
  },
  {
    id: "main-2",
    title: "Signal Drift",
    artist: "North Arcade",
    duration: 196,
    colorA: "#7fd6ff",
    colorB: "#f7c767",
    energy: 0.68,
    moods: ["focus", "commute"]
  },
  {
    id: "main-3",
    title: "Late Window",
    artist: "The Pale Static",
    duration: 232,
    colorA: "#ff8f70",
    colorB: "#33d17a",
    energy: 0.52,
    moods: ["evening", "chill"]
  },
  {
    id: "main-4",
    title: "Chrome Garden",
    artist: "Avon Relay",
    duration: 205,
    colorA: "#f7c767",
    colorB: "#7fd6ff",
    energy: 0.71,
    moods: ["afternoon", "focus"]
  }
];

const candidates = [
  {
    id: "disc-1",
    title: "Half Moon Transit",
    artist: "Sola Rue",
    duration: 189,
    colorA: "#33d17a",
    colorB: "#f7c767",
    energy: 0.61,
    moods: ["evening", "chill"]
  },
  {
    id: "disc-2",
    title: "Velvet Circuits",
    artist: "Juno Field",
    duration: 207,
    colorA: "#7fd6ff",
    colorB: "#ff8f70",
    energy: 0.74,
    moods: ["afternoon", "commute"]
  },
  {
    id: "disc-3",
    title: "Room Tone",
    artist: "Glass Orchard",
    duration: 221,
    colorA: "#f7c767",
    colorB: "#33d17a",
    energy: 0.55,
    moods: ["evening", "focus"]
  },
  {
    id: "disc-4",
    title: "Blue Hour Map",
    artist: "Nia Sol",
    duration: 202,
    colorA: "#ff8f70",
    colorB: "#7fd6ff",
    energy: 0.64,
    moods: ["evening", "commute"]
  }
];

const part1Insights = {
  segment: "Comfort Loopers with Discovery Intent / Passive Discoverers",
  userIntent: "Fresh music without losing familiar taste",
  mvpRules: [
    "Controlled novelty over random novelty",
    "Avoid repeated artists and stale recommendations",
    "Match mood, time, activity, and comfort score",
    "Keep discovery low effort and explainable",
    "Use feedback to learn what feels too familiar or too random"
  ]
};

const state = {
  queue: [...catalog],
  currentIndex: 0,
  elapsed: 0,
  playing: true,
  comfortScore: 0,
  metrics: {
    kept: 0,
    saved: 0,
    skipped: 0
  },
  lastFeedback: "none",
  searchQuery: "",
  searchStatus: "idle",
  searchSource: "idle",
  searchError: "",
  searchSuggestions: [],
  visibleSuggestionCount: 6,
  queuedSuggestionIds: new Set(),
  suppressedSuggestionIds: new Set(),
  tasteMismatchIds: new Set(),
  lastQueuedTrack: null,
  discoveryHistory: [],
  insertedIds: new Set(),
  decisionPending: false,
  badgeExpanded: false,
  metadataStatus: "loading",
  username: "Guest"
};

const els = {
  tabs: document.querySelectorAll("[data-tab]"),
  views: {
    home: document.querySelector("#home-view"),
    now: document.querySelector("#now-view"),
    discovery: document.querySelector("#discovery-view")
  },
  albumArt: document.querySelector("#album-art"),
  miniArt: document.querySelector("#mini-art"),
  title: document.querySelector("#track-title"),
  artist: document.querySelector("#track-artist"),
  miniTitle: document.querySelector("#mini-title"),
  miniArtist: document.querySelector("#mini-artist"),
  contextTitle: document.querySelector("#context-title"),
  contextArtist: document.querySelector("#context-artist"),
  contextArtFill: document.querySelector(".context-art-fill"),
  metadataSummary: document.querySelector("#metadata-summary"),
  metadataPills: document.querySelector("#metadata-pills"),
  queueLabel: document.querySelector("#queue-label"),
  elapsed: document.querySelector("#elapsed"),
  duration: document.querySelector("#duration"),
  progressFill: document.querySelector("#progress-fill"),
  homeElapsed: document.querySelector("#home-elapsed"),
  homeDuration: document.querySelector("#home-duration"),
  homeProgressFill: document.querySelector("#home-progress-fill"),
  homePlayButton: document.querySelector("#home-play-button"),
  homePlayIcon: document.querySelector("#home-play-icon"),
  homeNextButton: document.querySelector("#home-next-button"),
  homePreviousButton: document.querySelector("#home-previous-button"),
  playButton: document.querySelector("#play-button"),
  playIcon: document.querySelector("#play-icon"),
  nextButton: document.querySelector("#next-button"),
  previousButton: document.querySelector("#previous-button"),
  queueList: document.querySelector("#queue-list"),
  badge: document.querySelector("#discovery-badge"),
  badgeReason: document.querySelector("#badge-reason"),
  comfortScore: document.querySelector("#comfort-score"),
  gauge: document.querySelector(".gauge"),
  profileLabel: document.querySelector("#profile-label"),
  reasonCard: document.querySelector(".copilot-reason-card"),
  dnaCard: document.querySelector(".dna-card"),
  journeyMap: document.querySelector("#journey-map"),
  progressGauge: document.querySelector("#progress-gauge"),
  progressScore: document.querySelector("#progress-score"),
  progressTitle: document.querySelector("#progress-title"),
  progressCopy: document.querySelector("#progress-copy"),
  userSignal: document.querySelector("#user-signal"),
  contextSignals: document.querySelector("#context-signals"),
  familiarityMix: document.querySelector("#familiarity-mix"),
  noveltyBudget: document.querySelector("#novelty-budget"),
  timingState: document.querySelector("#timing-state"),
  contextState: document.querySelector("#context-state"),
  generatorCopy: document.querySelector("#generator-copy"),
  learningCopy: document.querySelector("#learning-copy"),
  futureCopy: document.querySelector("#future-copy"),
  keptCount: document.querySelector("#kept-count"),
  savedCount: document.querySelector("#saved-count"),
  skippedCount: document.querySelector("#skipped-count"),
  flowCards: document.querySelectorAll(".flow-card"),
  historyList: document.querySelector("#history-list"),
  historyCount: document.querySelector("#history-count"),
  sdkStatus: document.querySelector("#sdk-status"),
  entryDialog: document.querySelector("#entry-dialog"),
  entryForm: document.querySelector("#entry-form"),
  entryUsername: document.querySelector("#entry-username"),
  accountName: document.querySelector("#account-name"),
  accountInitial: document.querySelector("#account-initial")
};

els.searchForm = document.querySelector("#search-form");
els.searchInput = document.querySelector("#search-input");
els.homeSearchForm = document.querySelector("#home-search-form");
els.homeSearchInput = document.querySelector("#home-search-input");
els.searchResultsTitle = document.querySelector("#search-results-title");
els.searchResultsStatus = document.querySelector("#search-results-status");
els.suggestionGrid = document.querySelector("#suggestion-grid");
els.loadMoreSuggestions = document.querySelector("#load-more-suggestions");

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function artDataUri(track) {
  const title = encodeURIComponent(track.title);
  const artist = encodeURIComponent(track.artist);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop stop-color="${track.colorA}" />
          <stop offset="1" stop-color="${track.colorB}" />
        </linearGradient>
      </defs>
      <rect width="600" height="600" fill="#11140f" />
      <circle cx="472" cy="112" r="170" fill="${track.colorA}" opacity=".72" />
      <circle cx="142" cy="472" r="210" fill="${track.colorB}" opacity=".72" />
      <path d="M96 342c90-118 188-118 294 0 38 42 78 64 120 66" fill="none" stroke="rgba(255,255,255,.48)" stroke-width="22" stroke-linecap="round" />
      <text x="48" y="500" fill="white" font-family="Arial, sans-serif" font-size="42" font-weight="700">${title}</text>
      <text x="48" y="546" fill="rgba(255,255,255,.74)" font-family="Arial, sans-serif" font-size="25">${artist}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function currentTrack() {
  return state.queue[state.currentIndex];
}

function trackQueueKey(track) {
  if (track.mbid) return `mbid:${track.mbid}`;
  if (track.provider && track.title && track.artist) return `${track.provider}:${track.title}::${track.artist}`.toLowerCase();
  if (track.title && track.artist) return `${track.title}::${track.artist}`.toLowerCase();
  return track.trackId || track.id;
}

function isSuppressedSuggestion(track) {
  const titleArtistKey = track.title && track.artist ? `${track.title}::${track.artist}`.toLowerCase() : "";
  return state.suppressedSuggestionIds.has(trackQueueKey(track)) || state.suppressedSuggestionIds.has(titleArtistKey);
}

function filterSuppressedSuggestions(tracks) {
  return tracks.filter((track) => !isSuppressedSuggestion(track));
}

function removeSuggestion(track) {
  const queueKey = trackQueueKey(track);
  state.searchSuggestions = state.searchSuggestions.filter((candidate) => trackQueueKey(candidate) !== queueKey);
  state.visibleSuggestionCount = Math.min(state.visibleSuggestionCount, Math.max(6, state.searchSuggestions.length));
}

function suppressSuggestion(track) {
  state.suppressedSuggestionIds.add(trackQueueKey(track));
  if (track.title && track.artist) state.suppressedSuggestionIds.add(`${track.title}::${track.artist}`.toLowerCase());
}

function recentTracks() {
  return state.queue
    .slice(Math.max(0, state.currentIndex - 5), state.currentIndex + 1)
    .map(({ id, title, artist, discovery }) => ({ id, title, artist, discovery: Boolean(discovery) }))
    .reverse();
}

function spotifyCatalogContext() {
  const byKey = new Map([...catalog, ...candidates, ...state.queue].map((track) => [trackQueueKey(track), track]));
  return [...byKey.values()].slice(0, 40).map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    moods: track.moods || [],
    energy: track.energy,
    discovery: Boolean(track.discovery)
  }));
}

function searchRequestContext() {
  return {
    context: sessionContext(),
    recentTracks: recentTracks(),
    comfortScore: state.comfortScore,
    feedbackSignals: {
      lastFeedback: state.lastFeedback,
      metrics: state.metrics,
      suppressedCount: state.suppressedSuggestionIds.size,
      tasteMismatchCount: state.tasteMismatchIds.size
    },
    spotifyCatalog: spotifyCatalogContext(),
    part1Insights
  };
}

function sessionContext() {
  const hour = new Date().getHours();
  const mood = hour >= 19 || hour < 5 ? "evening" : hour < 12 ? "morning" : "focus";
  const activity = hour >= 7 && hour <= 10 ? "commute" : hour >= 11 && hour <= 17 ? "work focus" : "lean-back session";
  const appetite = state.comfortScore >= 76 ? "high" : state.comfortScore >= 52 ? "medium" : "low";
  const preferences = state.lastFeedback === "none" ? "learning" : state.lastFeedback;
  return { hour, mood, activity, appetite, preferences };
}

function contextualFit(track) {
  const context = sessionContext();
  const haystack = `${track.title || ""} ${track.artist || ""} ${(track.moods || []).join(" ")} ${(track.genres || []).join(" ")} ${(track.tags || []).join(" ")}`.toLowerCase();
  const moodFit = haystack.includes(context.mood) || (track.moods || []).includes(context.mood) ? 92 : context.mood === "evening" && (track.energy || 0.6) < 0.7 ? 78 : 66;
  const timeFit = context.hour >= 18 ? Math.round(86 - Math.abs((track.energy || 0.62) - 0.58) * 40) : Math.round(82 - Math.abs((track.energy || 0.7) - 0.72) * 35);
  const activityFit = context.activity.includes("focus") && (track.energy || 0.65) < 0.78 ? 84 : context.activity.includes("commute") && (track.energy || 0.65) > 0.58 ? 82 : 74;
  const appetiteFit = context.appetite === "high" ? 88 : context.appetite === "medium" ? 76 : 62;
  const preferenceFit = context.preferences.includes("skip") ? 58 : context.preferences.includes("saved") ? 88 : context.preferences === "learning" ? 72 : 80;
  const score = Math.round((moodFit + timeFit + activityFit + appetiteFit + preferenceFit) / 5);
  return {
    score,
    context,
    factors: [
      ["Mood", `${context.mood} fit ${moodFit}`],
      ["Time", `${context.hour}:00 fit ${timeFit}`],
      ["Activity", `${context.activity} fit ${activityFit}`],
      ["Appetite", `${context.appetite} novelty fit ${appetiteFit}`],
      ["Preferences", `${context.preferences} fit ${preferenceFit}`]
    ],
    sentence: `Context score ${score}: ${context.mood}, ${context.activity}, ${context.appetite} discovery appetite, and ${context.preferences} preferences.`
  };
}

function render() {
  const track = currentTrack();
  const progress = Math.min(state.elapsed / track.duration, 1);

  const art = artDataUri(track);
  els.albumArt.src = art;
  els.miniArt.src = art;
  els.title.textContent = track.title;
  els.artist.textContent = track.artist;
  els.miniTitle.textContent = track.title;
  els.miniArtist.textContent = track.artist;
  els.contextTitle.textContent = track.title;
  els.contextArtist.textContent = track.artist;
  els.contextArtFill.style.backgroundImage = `linear-gradient(rgba(0,0,0,.1), rgba(0,0,0,.62)), url("${art}")`;
  renderMetadata(track);
  els.queueLabel.textContent = track.discovery ? "AI discovery insert" : "Main queue";
  els.elapsed.textContent = formatTime(state.elapsed);
  els.duration.textContent = formatTime(track.duration);
  els.progressFill.style.width = `${progress * 100}%`;
  els.homeElapsed.textContent = formatTime(state.elapsed);
  els.homeDuration.textContent = formatTime(track.duration);
  els.homeProgressFill.style.width = `${progress * 100}%`;
  els.homePlayButton.setAttribute("aria-label", state.playing ? "Pause" : "Play");
  els.homePlayIcon.innerHTML = state.playing
    ? '<path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z"/>'
    : '<path d="M8 5v14l11-7L8 5Z"/>';
  els.playButton.setAttribute("aria-label", state.playing ? "Pause" : "Play");
  els.playIcon.innerHTML = state.playing
    ? '<path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z"/>'
    : '<path d="M8 5v14l11-7L8 5Z"/>';

  if (track.discovery) {
    els.badge.classList.remove("hidden");
    els.badge.classList.toggle("expanded", state.badgeExpanded);
    els.badge.setAttribute("aria-expanded", String(state.badgeExpanded));
    els.badgeReason.textContent = state.badgeExpanded
      ? `${track.reason} Added automatically because the current session has room for one new artist.`
      : track.reason;
  } else {
    els.badge.classList.add("hidden");
    state.badgeExpanded = false;
  }

  renderQueue();
  renderDiscovery();
}

function renderMetadata(track) {
  const metadata = track.musicbrainz;
  if (metadata) {
    const release = metadata.release?.title || "Unknown release";
    const date = metadata.firstReleaseDate || metadata.release?.date || "date unknown";
    const genreText = [...(metadata.genres || []), ...(metadata.tags || [])].slice(0, 3).join(", ");
    els.metadataSummary.textContent = `${release} • ${date}${genreText ? ` • ${genreText}` : ""}`;
    els.metadataPills.innerHTML = [
      ["MusicBrainz", metadata.mbid?.slice(0, 8)],
      ["Score", metadata.score],
      ["Country", metadata.release?.country],
      ["Status", metadata.release?.status]
    ]
      .filter(([, value]) => value)
      .map(([label, value]) => `<span>${label}: ${value}</span>`)
      .join("");
    return;
  }

  els.metadataSummary.textContent =
    state.metadataStatus === "error"
      ? "MusicBrainz metadata is unavailable; using the local prototype catalog."
      : "Looking up recording metadata from MusicBrainz...";
  els.metadataPills.innerHTML = '<span>Local catalog fallback</span>';
}

function renderQueue() {
  const upcoming = state.queue.slice(state.currentIndex + 1, state.currentIndex + 5);
  els.queueList.innerHTML = upcoming
    .map(
      (track) => `
        <div class="queue-item">
          <img src="${artDataUri(track)}" alt="" />
          <div>
            <strong>${track.title}</strong>
            <span>${track.artist}</span>
          </div>
          <span>${formatTime(track.duration)}</span>
          ${track.discovery ? '<span class="pill">AI</span>' : ""}
        </div>
      `
    )
    .join("");
}

function renderDiscovery() {
  const track = currentTrack();
  const progress = Math.min(state.elapsed / track.duration, 1);
  const context = sessionContext();
  const hour = context.hour;
  const mood = context.mood[0].toUpperCase() + context.mood.slice(1);
  const appetite = state.comfortScore >= 76 ? "High" : state.comfortScore >= 52 ? "Medium" : "Low";
  const novelty = Math.max(12, Math.min(54, Math.round(100 - state.comfortScore * 0.72)));
  const lastDiscovery = state.lastQueuedTrack || state.discoveryHistory[0];
  const recommendationFit = lastDiscovery ? contextualFit(lastDiscovery) : null;
  const hasDiscoveryContext = Boolean(state.searchQuery || state.searchSuggestions.length || state.discoveryHistory.length || state.lastQueuedTrack);
  const profileScore = hasDiscoveryContext ? Math.round(state.comfortScore) : 0;

  els.comfortScore.textContent = profileScore;
  if (els.gauge) els.gauge.style.setProperty("--score", profileScore);
  els.profileLabel.textContent = hasDiscoveryContext
    ? state.comfortScore >= 76
      ? "Bold Explorer"
      : state.comfortScore >= 52
        ? "Balanced Explorer"
        : "Comfort First"
    : "Not started";
  renderCopilotShell(hasDiscoveryContext, context, mood);
  if (els.userSignal) els.userSignal.textContent = `${track.artist} is playing now. ${state.queue.length - state.currentIndex - 1} tracks remain in queue.`;
  if (els.contextSignals) {
    els.contextSignals.innerHTML = [
      ["Listening History", recentTracks()[0]?.artist || "Starting"],
      ["Search Intent", state.searchQuery || "Passive discovery"],
      ["Mood", mood],
      ["Time", `${hour}:00`],
      ["Activity", context.activity],
      ["Discovery Appetite", appetite],
      ["Preferences", state.lastFeedback === "none" ? "Learning" : state.lastFeedback],
      ["Part 1 Insights", "Controlled novelty, mood fit, low effort"]
    ]
      .map(([label, value]) => `<span><strong>${label}</strong>${value}</span>`)
      .join("");
  }
  if (els.familiarityMix) els.familiarityMix.textContent = `${100 - novelty}%`;
  if (els.noveltyBudget) els.noveltyBudget.textContent = `${novelty}%`;
  if (els.timingState) els.timingState.textContent = progress > 0.72 ? "Insert window" : "Listening";
  if (els.contextState) els.contextState.textContent = mood;
  if (els.generatorCopy) {
    els.generatorCopy.textContent = state.decisionPending
      ? "Generating a one-track discovery candidate."
      : state.searchQuery
        ? `Generating suggestions for "${state.searchQuery}".`
      : progress > 0.72
        ? "Ready to create a micro discovery."
        : "Waiting for a natural transition.";
  }
  if (els.learningCopy) {
    els.learningCopy.textContent =
      state.lastFeedback === "none"
        ? "Part 1 insights tune novelty, mood fit, and repetition."
        : `Last signal: ${state.lastFeedback}. Updating discovery style.`;
  }
  if (els.futureCopy) els.futureCopy.textContent = `Next insert will target ${appetite.toLowerCase()} appetite with ${novelty}% novelty.`;
  if (els.keptCount) els.keptCount.textContent = state.metrics.kept;
  if (els.savedCount) els.savedCount.textContent = state.metrics.saved;
  if (els.skippedCount) els.skippedCount.textContent = state.metrics.skipped;
  els.historyCount.textContent = `${state.discoveryHistory.length} tracks`;
  renderSearchSuggestions();
  renderFlowState(progress, Boolean(lastDiscovery));
  renderQueuedJourney();

  if (state.discoveryHistory.length === 0) {
    els.historyList.innerHTML = "";
    return;
  }

  els.historyList.innerHTML = "";
}

function renderSearchSuggestions() {
  if (!state.searchQuery) {
    els.searchResultsTitle.textContent = "Search-driven Suggestions";
    els.searchResultsStatus.textContent = "Try a song, pattern, or theme from Now";
    els.suggestionGrid.innerHTML = '<div class="empty-state">Search from the Spotify-style home screen to ask Copilot for recommendations.</div>';
    els.loadMoreSuggestions.hidden = true;
    return;
  }

  els.searchResultsTitle.textContent = `Suggestions for "${state.searchQuery}"`;
  const sourceText = state.searchError ? `${state.searchSource}; retrying live lookup when available` : state.searchSource;
  const visibleSuggestions = state.searchSuggestions.slice(0, state.visibleSuggestionCount);
  const remainingCount = Math.max(0, state.searchSuggestions.length - visibleSuggestions.length);
  els.searchResultsStatus.textContent =
    state.searchStatus === "loading"
      ? "Asking the LLM for songs, then validating matches in MusicBrainz"
      : `Showing ${visibleSuggestions.length} of ${state.searchSuggestions.length} suggestions • ${sourceText}${
          state.lastQueuedTrack ? ` • queued "${state.lastQueuedTrack.title}" next` : ""
        }`;

  if (state.searchStatus === "loading" && state.searchSuggestions.length === 0) {
    els.suggestionGrid.innerHTML = `
      <div class="empty-state loading-state" role="status" aria-live="polite">
        <div class="loading-art" aria-hidden="true">
          <div class="loading-sleeve">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="loading-record"></div>
        </div>
        <div class="loading-copy">
          <strong>Finding your next albums</strong>
          <span>Gemini is choosing songs while MusicBrainz checks the recordings.</span>
        </div>
      </div>
    `;
    els.loadMoreSuggestions.hidden = true;
    return;
  }

  if (state.searchStatus === "ready" && state.searchSuggestions.length === 0) {
    els.suggestionGrid.innerHTML = '<div class="empty-state">No more recommendations for this search. Try another song, pattern, or theme.</div>';
    els.loadMoreSuggestions.hidden = true;
    return;
  }

  els.suggestionGrid.innerHTML = visibleSuggestions
    .map(
      (track, index) => {
        const queued = state.queuedSuggestionIds.has(trackQueueKey(track));
        const decision = recommendationDecision(track);
        return `
        <article class="suggestion-card${queued ? " queued" : ""}">
          <img src="${artDataUri(track)}" alt="" />
          <div class="suggestion-main">
            <strong>${escapeHtml(track.title)}</strong>
            <span>${escapeHtml(track.artist)}</span>
            <small>${track.musicbrainz ? "MusicBrainz match — " : track.provider ? `${escapeHtml(track.provider)} match — ` : ""}${escapeHtml(track.reason || "Contextual discovery fit")}</small>
            <div class="context-score">Context Score: <strong>${decision.fit.score}%</strong></div>
          </div>
          <div class="suggestion-context">
            <div class="recommendation-factors">
              ${decision.fit.factors
                .map(([label, value]) => `<span><strong>${label}</strong>${value}</span>`)
                .join("")}
            </div>
            <div class="decision-stack" aria-label="Recommendation decision details">
              ${decision.rows.map(([label, value]) => `<span><strong>${label}</strong>${escapeHtml(value)}</span>`).join("")}
            </div>
          </div>
          <div class="suggestion-feedback" aria-label="One-tap feedback">
            <button type="button" data-card-feedback="play_now" data-suggestion-index="${index}"><span aria-hidden="true">▶</span> Play</button>
            <button type="button" data-card-feedback="saved" data-suggestion-index="${index}"><span aria-hidden="true">♡</span> Save</button>
            <button type="button" data-card-feedback="skip_early" data-suggestion-index="${index}">Skip</button>
            <button type="button" data-card-feedback="doesnt_fit" data-suggestion-index="${index}">Doesn't Fit</button>
            <button type="button" data-card-feedback="surprise_me" data-suggestion-index="${index}">Surprise Me</button>
          </div>
          <button type="button" data-suggestion-index="${index}" ${queued ? "disabled" : ""}>${queued ? "Queued next" : "Insert next"}</button>
        </article>
      `;
      }
    )
    .join("");
  els.loadMoreSuggestions.hidden = remainingCount === 0;
  els.loadMoreSuggestions.textContent = remainingCount > 6 ? "Load 6 more songs" : `Load ${remainingCount} more ${remainingCount === 1 ? "song" : "songs"}`;
}

function renderCopilotShell(hasDiscoveryContext, context, mood) {
  if (!hasDiscoveryContext) {
    els.reasonCard.innerHTML = `
      <div class="reason-spark" aria-hidden="true">✦</div>
      <p><strong>No discovery context yet.</strong>Search from Home to build recommendations and context signals.</p>
      <div class="reason-chip"><span>☾</span><strong>Time</strong><small>0</small></div>
      <div class="reason-chip"><span>◎</span><strong>Activity</strong><small>0</small></div>
      <div class="reason-chip"><span>◠</span><strong>Mode</strong><small>0</small></div>
    `;
    els.dnaCard.querySelectorAll("meter").forEach((meter) => {
      meter.value = 0;
    });
    els.dnaCard.querySelectorAll("em").forEach((item) => {
      item.textContent = "0%";
    });
    els.dnaCard.querySelector("p").innerHTML = "<strong>Not started</strong>Search to build your discovery profile.";
    els.progressGauge.style.setProperty("--score", 0);
    els.progressScore.textContent = "0%";
    els.progressTitle.textContent = "No progress yet.";
    els.progressCopy.textContent = "Search to start discovering.";
    return;
  }

  els.reasonCard.innerHTML = `
    <div class="reason-spark" aria-hidden="true">✦</div>
    <p><strong>Because you searched for <span>${escapeHtml(state.searchQuery || "new music")}</span>,</strong>I found songs that match your current context.</p>
    <div class="reason-chip"><span>☾</span><strong>Time</strong><small>${context.hour}:00</small></div>
    <div class="reason-chip"><span>◎</span><strong>Activity</strong><small>${escapeHtml(context.activity)}</small></div>
    <div class="reason-chip"><span>◠</span><strong>Mode</strong><small>${escapeHtml(mood)}</small></div>
  `;
  const values = [72, Math.max(0, Math.round(state.comfortScore)), 35, 78];
  els.dnaCard.querySelectorAll("meter").forEach((meter, index) => {
    meter.value = values[index] || 0;
  });
  els.dnaCard.querySelectorAll("em").forEach((item, index) => {
    item.textContent = `${values[index] || 0}%`;
  });
  els.dnaCard.querySelector("p").innerHTML = `<strong>${els.profileLabel.textContent}</strong>You enjoy a healthy mix of familiar and new.`;
  const progressScore = Math.min(100, Math.max(0, Math.round(state.comfortScore + state.searchSuggestions.length)));
  els.progressGauge.style.setProperty("--score", progressScore);
  els.progressScore.textContent = `${progressScore}%`;
  els.progressTitle.textContent = progressScore ? "Progress started." : "No progress yet.";
  els.progressCopy.textContent = progressScore ? "Your discovery profile is learning from this search." : "Search to start discovering.";
}

function renderQueuedJourney() {
  if (state.discoveryHistory.length === 0) {
    els.journeyMap.innerHTML = '<div class="journey-empty">Queued songs will appear here.</div>';
    return;
  }

  els.journeyMap.innerHTML = state.discoveryHistory
    .slice(0, 10)
    .map(
      (item, index) => `
        <div class="journey-step${index === 0 ? " selected" : ""}">
          <img src="${artDataUri(item)}" alt="" />
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.artist)} • ${escapeHtml(item.outcome || "queued")}</small>
        </div>
      `
    )
    .join("");
}

function recommendationDecision(track) {
  const fit = track.contextFit || contextualFit(track);
  const context = fit.context;
  const noveltyBudget = Math.max(12, Math.min(54, Math.round(100 - state.comfortScore * 0.72)));
  const familiarityMix = 100 - noveltyBudget;
  const artistKnown = recentTracks().some((recent) => recent.artist === track.artist);
  return {
    fit,
    rows: [
      ["Context", `${context.mood}, ${context.activity}`],
      ["Planner", `${familiarityMix}% familiar / ${noveltyBudget}% novel`],
      ["Timing", state.playing ? "Fits active session" : "Ready when resumed"],
      ["Insight", artistKnown ? "Avoid repeat artist risk" : "Adjacent new-artist branch"]
    ]
  };
}

function renderFlowState(progress, hasDiscovery) {
  const activeStages = new Set(["user", "context", "copilot", "planner"]);
  if (progress > 0.55 || state.searchQuery) activeStages.add("generator");
  if (hasDiscovery || state.searchSuggestions.length > 0) {
    activeStages.add("learning");
    activeStages.add("future");
    activeStages.add("metrics");
  }

  els.flowCards.forEach((card) => {
    card.classList.toggle("active", activeStages.has(card.dataset.stage));
  });
}

function switchTab(name) {
  els.tabs.forEach((item) => item.classList.toggle("active", item.dataset.tab === name));
  Object.entries(els.views).forEach(([key, view]) => view.classList.toggle("active", key === name));
}

function setUsername(name) {
  const cleanName = String(name || "").trim().slice(0, 24) || "Guest";
  state.username = cleanName;
  els.accountName.textContent = cleanName;
  els.accountInitial.textContent = cleanName.charAt(0).toUpperCase();
}

function initEntryDialog() {
  let savedName = "";
  try {
    savedName = localStorage.getItem("spotifyAiUsername") || localStorage.getItem("discoveryAgentUsername") || "";
  } catch (error) {
    savedName = "";
  }

  if (savedName) {
    setUsername(savedName);
    els.entryUsername.value = savedName;
  }

  els.entryDialog.classList.remove("hidden");
  setTimeout(() => els.entryUsername.focus(), 0);
}

function submitSearch(input) {
  const query = input.value.trim();
  if (!query) return;
  handleSearch(query);
}

function inferSearchMode(query) {
  const lower = query.toLowerCase();
  if (/(rain|night|evening|chill|calm|soft|focus|study|sad|happy|energy|dance|surprise|new|weird|different)/.test(lower)) {
    return "theme";
  }
  if (/(like|similar|pattern|vibe|sounds|tempo|mood)/.test(lower)) return "pattern";
  return "song";
}

function localSuggestions(query, remoteResults = []) {
  const mode = inferSearchMode(query);
  const lower = query.toLowerCase();
  const sourceTracks = [...remoteResults, ...candidates, ...catalog];
  const scored = sourceTracks.map((track, index) => {
    const fit = contextualFit(track);
    const haystack = `${track.title} ${track.artist} ${(track.moods || []).join(" ")} ${(track.genres || []).join(" ")} ${(track.tags || []).join(" ")}`.toLowerCase();
    const textScore = lower
      .split(/\s+/)
      .filter(Boolean)
      .reduce((score, token) => score + (haystack.includes(token) ? 2 : 0), 0);
    const themeScore =
      mode === "theme" && (track.moods || []).some((mood) => lower.includes(mood.toLowerCase())) ? 4 : 0;
    const noveltyScore = track.discovery || track.mbid ? 2 : 0;
    return { track, fit, score: textScore + themeScore + noveltyScore + fit.score / 25 + Math.max(0, 4 - index * 0.2) };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 18)
    .map(({ track, fit }, index) => ({
      ...track,
      id: `search-${track.id}-${index}`,
      discovery: true,
      colorA: track.colorA || ["#33d17a", "#7fd6ff", "#ff8f70", "#f7c767"][index % 4],
      colorB: track.colorB || ["#f7c767", "#ff8f70", "#33d17a", "#7fd6ff"][index % 4],
      energy: track.energy || 0.58 + index * 0.04,
      moods: track.moods || [mode],
      reason:
        mode === "song"
          ? `Song match — ${fit.sentence}`
          : mode === "pattern"
            ? `Pattern match — ${fit.sentence}`
            : `Theme match — ${fit.sentence}`,
      contextFit: fit
    }));
}

function musicBrainzSuggestions(query, remoteResults) {
  const mode = inferSearchMode(query);
  return remoteResults.slice(0, 18).map((track, index) => {
    const enrichedTrack = {
      ...track,
      energy: track.energy || 0.58 + index * 0.04,
      moods: track.moods?.length ? track.moods : [mode]
    };
    const fit = contextualFit(enrichedTrack);
    return {
      ...enrichedTrack,
      id: `search-${track.id}-${index}`,
      discovery: true,
      colorA: track.colorA || ["#33d17a", "#7fd6ff", "#ff8f70", "#f7c767"][index % 4],
      colorB: track.colorB || ["#f7c767", "#ff8f70", "#33d17a", "#7fd6ff"][index % 4],
      reason:
        track.llmReason ||
        (mode === "song"
          ? `MusicBrainz recording match — ${fit.sentence}`
          : mode === "pattern"
            ? `MusicBrainz pattern match — ${fit.sentence}`
            : `MusicBrainz theme match — ${fit.sentence}`),
      contextFit: fit
    };
  });
}

async function handleSearch(query) {
  state.searchQuery = query;
  state.searchStatus = "loading";
  state.searchSource = "Gemini + MusicBrainz";
  state.searchError = "";
  state.visibleSuggestionCount = 6;
  state.searchSuggestions = [];
  switchTab("discovery");
  render();

  let remoteResults = [];
  let remoteSource = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 900));
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, ...searchRequestContext() })
      });
      const payload = await response.json();
      if (payload.error || payload.warning) state.searchError = payload.error || payload.warning;
      remoteSource = payload.source || "";
      remoteResults = (payload.results || []).map((track, index) => ({
        ...track,
        provider: track.provider || payload.source,
        llmReason: track.llmReason,
        llmSuggestion: track.llmSuggestion,
        colorA: ["#33d17a", "#7fd6ff", "#ff8f70", "#f7c767"][index % 4],
        colorB: ["#f7c767", "#ff8f70", "#33d17a", "#7fd6ff"][index % 4],
        musicbrainz: track.mbid
          ? {
              mbid: track.mbid,
              score: track.score,
              title: track.title,
              artist: track.artist,
              lengthMs: track.duration * 1000,
              firstReleaseDate: track.firstReleaseDate,
              release: track.release,
              tags: track.tags || [],
              genres: track.genres || []
            }
          : null,
        moods: [...(track.genres || []), ...(track.tags || [])]
      }));
      if (remoteResults.length === 0 && Array.isArray(payload.llmSuggestions) && payload.llmSuggestions.length > 0) {
        remoteSource = payload.source || "Gemini suggestions";
        remoteResults = payload.llmSuggestions.map((track, index) => ({
          id: track.id || `gemini-${index + 1}`,
          title: track.title,
          artist: track.artist,
          duration: 210,
          score: 0,
          provider: "Gemini suggestion; MusicBrainz pending",
          llmReason: track.reason,
          llmSuggestion: {
            title: track.title,
            artist: track.artist
          },
          colorA: ["#33d17a", "#7fd6ff", "#ff8f70", "#f7c767"][index % 4],
          colorB: ["#f7c767", "#ff8f70", "#33d17a", "#7fd6ff"][index % 4],
          musicbrainz: null,
          moods: [inferSearchMode(query)]
        }));
      }
      if (remoteResults.length > 0) {
        if (remoteResults.some((track) => track.musicbrainz)) state.searchError = "";
        break;
      }
    } catch (error) {
      state.searchError = error.message;
      remoteResults = [];
    }
  }

  state.searchSuggestions = filterSuppressedSuggestions(remoteResults.length > 0 ? musicBrainzSuggestions(query, remoteResults) : []);
  state.searchSource = remoteResults.length > 0 ? remoteSource || "Gemini + MusicBrainz" : "No Gemini/MusicBrainz matches";
  state.searchStatus = "ready";
  render();
}

async function decideIfNeeded() {
  const track = currentTrack();
  const progress = state.elapsed / track.duration;
  if (state.decisionPending || progress < 0.74 || track.discovery) return;

  const availableCandidates = candidates.filter((candidate) => !state.insertedIds.has(candidate.id));
  if (availableCandidates.length === 0) return;

  state.decisionPending = true;
  try {
    const response = await fetch("/api/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        context: {
          hour: new Date().getHours(),
          mood: new Date().getHours() >= 17 ? "evening" : "focus",
          progress,
          queuePosition: state.currentIndex
        },
        recentTracks: recentTracks(),
        comfortScore: state.comfortScore,
        candidates: availableCandidates
      })
    });
    const decision = await response.json();
    if (decision.insert && decision.track) insertDiscoveryTrack(decision.track, decision.reason);
  } finally {
    state.decisionPending = false;
  }
}

function insertDiscoveryTrack(track, reason) {
  const queueKey = trackQueueKey(track);
  const alreadyQueuedIndex = state.queue.findIndex(
    (queuedTrack, index) => index > state.currentIndex && queuedTrack.discovery && trackQueueKey(queuedTrack) === queueKey
  );
  if (alreadyQueuedIndex !== -1) {
    const [alreadyQueued] = state.queue.splice(alreadyQueuedIndex, 1);
    state.queue.splice(state.currentIndex + 1, 0, alreadyQueued);
    state.queuedSuggestionIds.add(queueKey);
    state.lastQueuedTrack = alreadyQueued;
    render();
    return alreadyQueued;
  }

  const discoveryTrack = {
    ...track,
    id: track.id || `queued-${Date.now()}`,
    discovery: true,
    reason: reason || "New sound — fits this moment"
  };
  state.queue.splice(state.currentIndex + 1, 0, discoveryTrack);
  state.insertedIds.add(track.id);
  state.queuedSuggestionIds.add(queueKey);
  state.lastQueuedTrack = discoveryTrack;
  state.discoveryHistory.unshift({ ...discoveryTrack, outcome: "queued" });
  state.discoveryHistory.splice(10);
  render();
  return discoveryTrack;
}

function playQueuedTrack(track, startRatio = 0) {
  const queueKey = trackQueueKey(track);
  const queuedIndex = state.queue.findIndex((queuedTrack) => trackQueueKey(queuedTrack) === queueKey);
  if (queuedIndex === -1) return;

  state.currentIndex = queuedIndex;
  state.elapsed = Math.floor(state.queue[queuedIndex].duration * startRatio);
  state.playing = true;
  state.lastQueuedTrack = state.queue[queuedIndex];
  switchTab("now");
  render();
}

function feedbackTrackForSuggestion(suggestion) {
  return state.queue.find((track) => track.discovery && trackQueueKey(track) === trackQueueKey(suggestion)) || { ...suggestion, discovery: true };
}

function handleSuggestionFeedback(type, suggestion) {
  if (type === "play_now") {
    const queuedTrack = insertDiscoveryTrack(suggestion, suggestion.reason);
    sendFeedback(type, queuedTrack);
    playQueuedTrack(queuedTrack, 0);
    return;
  }

  if (type === "saved") {
    const queuedTrack = insertDiscoveryTrack(suggestion, suggestion.reason);
    sendFeedback(type, queuedTrack);
    return;
  }

  if (type === "surprise_me") {
    const queuedTrack = insertDiscoveryTrack(suggestion, `${suggestion.reason} Surprise sample started halfway through.`);
    sendFeedback(type, queuedTrack);
    playQueuedTrack(queuedTrack, 0.5);
    return;
  }

  const feedbackTrack = feedbackTrackForSuggestion(suggestion);
  if (type === "doesnt_fit") {
    suppressSuggestion(suggestion);
    state.tasteMismatchIds.add(trackQueueKey(suggestion));
    state.lastFeedback = "doesn't fit";
  }

  removeSuggestion(suggestion);
  sendFeedback(type, feedbackTrack);
}

function mergeMusicBrainzMetadata(enriched) {
  const byId = new Map(enriched.map((item) => [item.id, item.musicbrainz]));
  [...catalog, ...candidates, ...state.queue, ...state.discoveryHistory].forEach((track) => {
    if (byId.has(track.id)) track.musicbrainz = byId.get(track.id);
  });
}

async function enrichWithMusicBrainz() {
  const tracks = [...catalog, ...candidates].map(({ id, title, artist }) => ({ id, title, artist }));
  try {
    const response = await fetch("/api/musicbrainz", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tracks })
    });
    if (!response.ok) throw new Error(`MusicBrainz proxy returned ${response.status}`);
    const payload = await response.json();
    mergeMusicBrainzMetadata(payload.enriched || []);
    state.metadataStatus = payload.errors?.length ? "partial" : "ready";
  } catch (error) {
    state.metadataStatus = "error";
  }
  render();
}

async function sendFeedback(type, track) {
  if (!track.discovery) return;
  const apiType = type === "doesnt_fit" ? "skip_early" : type === "surprise_me" || type === "play_now" ? "kept" : type;

  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: apiType, track, comfortScore: state.comfortScore })
  });
  const payload = await response.json();
  state.comfortScore = payload.comfortScore ?? state.comfortScore;
  state.lastFeedback = type.replace("_", " ");
  if (type === "saved") state.metrics.saved += 1;
  else if (type === "skip_early" || type === "doesnt_fit") state.metrics.skipped += 1;
  else state.metrics.kept += 1;

  const historyItem = state.discoveryHistory.find((item) => item.id === track.id);
  if (historyItem) historyItem.outcome = type === "full_listen" ? "kept" : type.replace("_", " ");
  render();
}

function nextTrack(feedbackType = "kept") {
  const track = currentTrack();
  if (track.discovery) sendFeedback(feedbackType, track);
  state.currentIndex = (state.currentIndex + 1) % state.queue.length;
  state.elapsed = 0;
  render();
}

function previousTrack() {
  state.currentIndex = state.currentIndex === 0 ? state.queue.length - 1 : state.currentIndex - 1;
  state.elapsed = 0;
  render();
}

function tick() {
  if (!state.playing) return;
  const track = currentTrack();
  state.elapsed += 1;
  if (state.elapsed >= track.duration) {
    nextTrack(track.discovery ? "full_listen" : "kept");
    return;
  }
  decideIfNeeded();
  render();
}

function initSpotifySdkStatus() {
  window.onSpotifyWebPlaybackSDKReady = () => {
    els.sdkStatus.textContent = "Spotify SDK loaded";
  };
  setTimeout(() => {
    if (window.Spotify) els.sdkStatus.textContent = "Spotify SDK loaded";
  }, 1200);
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    switchTab(tab.dataset.tab);
  });
});

els.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitSearch(els.searchInput);
});

els.homeSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitSearch(els.homeSearchInput);
});

els.entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setUsername(els.entryUsername.value);
  try {
    localStorage.setItem("spotifyAiUsername", state.username);
  } catch (error) {
    // Local storage can be blocked in private browsing; the in-memory name is enough for the prototype.
  }
  els.entryDialog.classList.add("hidden");
  switchTab("home");
});

els.playButton.addEventListener("click", () => {
  state.playing = !state.playing;
  render();
});

els.homePlayButton.addEventListener("click", () => {
  state.playing = !state.playing;
  render();
});

els.nextButton.addEventListener("click", () => {
  const track = currentTrack();
  const earlySkip = track.discovery && state.elapsed / track.duration < 0.35;
  nextTrack(earlySkip ? "skip_early" : "kept");
});

els.homeNextButton.addEventListener("click", () => {
  const track = currentTrack();
  const earlySkip = track.discovery && state.elapsed / track.duration < 0.35;
  nextTrack(earlySkip ? "skip_early" : "kept");
});

els.previousButton.addEventListener("click", previousTrack);
els.homePreviousButton.addEventListener("click", previousTrack);
els.badge.addEventListener("click", () => {
  state.badgeExpanded = !state.badgeExpanded;
  render();
});

els.suggestionGrid.addEventListener("click", (event) => {
  const feedbackButton = event.target.closest("button[data-card-feedback]");
  if (feedbackButton) {
    const suggestion = state.searchSuggestions[Number(feedbackButton.dataset.suggestionIndex)];
    if (!suggestion) return;
    feedbackButton.closest(".suggestion-card")?.querySelectorAll("button[data-card-feedback]").forEach((item) => {
      item.classList.toggle("active", item === feedbackButton);
    });
    handleSuggestionFeedback(feedbackButton.dataset.cardFeedback, suggestion);
    return;
  }

  const button = event.target.closest("button[data-suggestion-index]");
  if (!button || button.disabled) return;
  const suggestion = state.searchSuggestions[Number(button.dataset.suggestionIndex)];
  if (!suggestion) return;
  insertDiscoveryTrack(suggestion, suggestion.reason);
  state.lastFeedback = `searched ${state.searchQuery}`;
  render();
});

els.loadMoreSuggestions.addEventListener("click", () => {
  state.visibleSuggestionCount = Math.min(state.visibleSuggestionCount + 6, state.searchSuggestions.length);
  renderSearchSuggestions();
});

initSpotifySdkStatus();
initEntryDialog();
render();
setInterval(tick, 1000);
