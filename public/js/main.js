let token = localStorage.getItem("devconnect-token");
const savedUser = JSON.parse(localStorage.getItem("devconnect-user") || "null");

if (!token) {
  window.location.replace("/login.html");
  throw new Error("Authentication required.");
}

const state = {
  user: savedUser,
  room: new URLSearchParams(location.search).get("room") || "JavaScript",
  rooms: ["JavaScript", "Python", "UI/UX", "DevOps", "Career Prep", "Open Source"],
  messages: [],
  users: [],
  typingUsers: new Set(),
  typingTimer: null,
  preferences: {
    notificationsEnabled: localStorage.getItem("devconnect-notifications-enabled") !== "false",
    soundEnabled: localStorage.getItem("devconnect-sound-enabled") !== "false",
  },
};

const els = {
  appShell: document.querySelector(".workspace-shell"),
  roomName: document.getElementById("room-name"),
  roomList: document.getElementById("room-list"),
  chatMessages: document.getElementById("chat-messages"),
  emptyState: document.getElementById("empty-state"),
  historyLoader: document.getElementById("history-loader"),
  chatForm: document.getElementById("chat-form"),
  msgInput: document.getElementById("msg"),
  users: document.getElementById("users"),
  memberCount: document.getElementById("member-count"),
  errorBanner: document.getElementById("error-banner"),
  errorMessage: document.getElementById("error-message"),
  connectionChip: document.getElementById("connection-chip"),
  typingIndicator: document.getElementById("typing-indicator"),
  typingText: document.getElementById("typing-text"),
  menuToggle: document.getElementById("menu-toggle"),
  logoutBtn: document.getElementById("logout-btn"),
  profileName: document.getElementById("profile-name"),
  profileAvatar: document.getElementById("profile-avatar"),
  muteBtn: document.getElementById("mute-btn"),
  settingsBtn: document.getElementById("settings-btn"),
  settingsModal: document.getElementById("settings-modal"),
  settingsCloseBtn: document.getElementById("settings-close-btn"),
  notificationsToggle: document.getElementById("notifications-toggle"),
  soundToggle: document.getElementById("sound-toggle"),
  displayNameSetting: document.getElementById("display-name-setting"),
  settingsSaveBtn: document.getElementById("settings-save-btn"),
  settingsLogoutBtn: document.getElementById("settings-logout-btn"),
  toastRegion: document.getElementById("toast-region"),
};

bootstrap();
initPreferences();

const socket = io({
  auth: { token },
  reconnectionAttempts: 5,
  timeout: 7000,
});

setConnectionState("connecting", "Connecting");

socket.on("connect", () => {
  setConnectionState("online", "Connected");
  hideError();
  joinRoom(state.room);
});

socket.on("connect_error", (error) => {
  setConnectionState("offline", "Auth required");
  showError(error.message || "Could not connect to DevConnect.");
  if (error.message && error.message.toLowerCase().includes("session")) {
    logout();
  }
});

socket.on("disconnect", () => {
  setConnectionState("offline", "Offline");
  showError("Connection lost. DevConnect is trying to reconnect...");
});

socket.io.on("reconnect_attempt", () => setConnectionState("connecting", "Reconnecting"));
socket.io.on("reconnect_failed", () => {
  setConnectionState("offline", "Offline");
  showError("Could not reconnect. Refresh the page to try again.");
});

socket.on("messageHistory", (messages) => {
  state.messages = messages;
  els.historyLoader.hidden = true;
  renderMessages();
});

socket.on("message", (message) => {
  state.messages.push(message);
  els.historyLoader.hidden = true;
  renderMessages();
  scrollToLatest();

  if (message.type === "message" && message.username !== state.user.name) {
    notifyIncomingMessage(message);
  }
});

socket.on("roomUsers", ({ room, users }) => {
  state.room = room;
  state.users = users;
  renderRooms();
  renderUsers();
});

socket.on("typing", ({ username, isTyping }) => {
  if (username === state.user.name) return;
  if (isTyping) {
    state.typingUsers.add(username);
  } else {
    state.typingUsers.delete(username);
  }
  renderTyping();
});

socket.on("appError", ({ message }) => showError(message));

els.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = els.msgInput.value.trim();

  if (!text) {
    showError("Type a message before sending.");
    return;
  }

  hideError();
  socket.emit("typing:stop");
  socket.emit("chatMessage", text, (response) => {
    if (!response || !response.ok) {
      showError((response && response.message) || "Message failed to send.");
    }
  });
  els.msgInput.value = "";
  els.msgInput.focus();
});

els.msgInput.addEventListener("input", () => {
  socket.emit("typing:start");
  clearTimeout(state.typingTimer);
  state.typingTimer = setTimeout(() => socket.emit("typing:stop"), 900);
});

els.menuToggle.addEventListener("click", () => {
  const isOpen = els.appShell.classList.toggle("sidebar-open");
  els.menuToggle.setAttribute("aria-expanded", String(isOpen));
});

els.logoutBtn.addEventListener("click", logout);
els.settingsLogoutBtn.addEventListener("click", logout);

els.muteBtn.addEventListener("click", () => {
  setSoundEnabled(!state.preferences.soundEnabled, true);
});

els.settingsBtn.addEventListener("click", openSettings);
els.settingsCloseBtn.addEventListener("click", closeSettings);
els.settingsModal.addEventListener("click", (event) => {
  if (event.target === els.settingsModal) {
    closeSettings();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.settingsModal.hidden) {
    closeSettings();
  }
});

els.notificationsToggle.addEventListener("change", () => {
  state.preferences.notificationsEnabled = els.notificationsToggle.checked;
  localStorage.setItem(
    "devconnect-notifications-enabled",
    String(state.preferences.notificationsEnabled)
  );
  showToast(state.preferences.notificationsEnabled ? "Notifications enabled" : "Notifications disabled");
});

els.soundToggle.addEventListener("change", () => {
  setSoundEnabled(els.soundToggle.checked, true);
});

els.settingsSaveBtn.addEventListener("click", async () => {
  const displayName = els.displayNameSetting.value.trim();
  if (displayName && state.user) {
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: displayName }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Profile update failed.");
      }

      token = data.token;
      localStorage.setItem("devconnect-token", data.token);
      localStorage.setItem("devconnect-user", JSON.stringify(data.user));
      state.user = data.user;
      els.profileName.textContent = state.user.name;
      els.profileAvatar.textContent = initials(state.user.name);
      socket.emit("profile:update", { name: state.user.name });
      showToast("Profile preferences saved");
    } catch (error) {
      showToast(error.message);
      return;
    }
  }
  closeSettings();
});

function bootstrap() {
  fetch("/api/rooms")
    .then((response) => response.json())
    .then((data) => {
      if (Array.isArray(data.rooms)) state.rooms = data.rooms;
      renderRooms();
    })
    .catch(() => renderRooms());

  if (state.user) {
    els.profileName.textContent = state.user.name;
    els.profileAvatar.textContent = initials(state.user.name);
    els.profileAvatar.style.background = state.user.avatarColor || "#2a9d8f";
  }
  els.roomName.textContent = state.room;
  renderRooms();
}

function joinRoom(room) {
  state.room = room;
  state.messages = [];
  state.typingUsers.clear();
  els.roomName.textContent = room;
  els.historyLoader.hidden = false;
  renderMessages();
  renderTyping();
  socket.emit("joinRoom", { room });
  history.replaceState(null, "", `/chat.html?room=${encodeURIComponent(room)}`);
}

function renderRooms() {
  els.roomList.innerHTML = "";
  state.rooms.forEach((room) => {
    const button = document.createElement("button");
    button.className = `room-item${room === state.room ? " active" : ""}`;
    button.type = "button";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(room === state.room));
    button.innerHTML = `<span class="room-hash">#</span><span>${escapeHtml(room)}</span>`;
    button.addEventListener("click", () => joinRoom(room));
    els.roomList.appendChild(button);
  });
}

function renderMessages() {
  els.chatMessages.innerHTML = "";
  els.emptyState.hidden = state.messages.length > 0 || !els.historyLoader.hidden;

  state.messages.forEach((message, index) => {
    const previous = state.messages[index - 1];
    const grouped =
      previous &&
      previous.username === message.username &&
      previous.type === message.type &&
      Date.parse(message.createdAt) - Date.parse(previous.createdAt) < 5 * 60 * 1000;

    els.chatMessages.appendChild(createMessage(message, grouped));
  });
}

function createMessage(message, grouped) {
  const article = document.createElement("article");
  const isOwn =
    (message.userId && state.user && String(message.userId) === String(state.user.id)) ||
    message.username === state.user.name;
  article.className = `message-row${isOwn ? " own" : ""}${grouped ? " grouped" : ""}${
    message.type === "system" ? " system" : ""
  }`;

  if (message.type === "system") {
    article.innerHTML = `<span>${escapeHtml(message.text)}</span><time>${formatTime(message.createdAt)}</time>`;
    return article;
  }

  article.innerHTML = `
    <div class="avatar message-avatar" style="background:${avatarColor(message.username)}">${initials(message.username)}</div>
    <div class="message-stack">
      ${
        grouped
          ? ""
          : `<div class="message-meta"><strong>${escapeHtml(message.username)}</strong><time>${formatTime(
              message.createdAt
            )}</time></div>`
      }
      <div class="message-bubble">
        <p>${escapeHtml(message.text)}</p>
      </div>
    </div>
  `;
  return article;
}

function renderUsers() {
  els.users.innerHTML = "";
  els.memberCount.textContent = state.users.length;

  state.users.forEach((user) => {
    const item = document.createElement("li");
    item.className = "member-item";
    item.innerHTML = `
      <div class="avatar" style="background:${user.avatarColor || avatarColor(user.username)}">${initials(
      user.username
    )}</div>
      <div>
        <strong>${escapeHtml(user.username)}</strong>
        <span><i></i> ${user.status || "online"}</span>
      </div>
    `;
    els.users.appendChild(item);
  });
}

function renderTyping() {
  const names = [...state.typingUsers];
  els.typingIndicator.hidden = names.length === 0;
  if (!names.length) return;

  els.typingText.textContent =
    names.length === 1 ? `${names[0]} is typing` : `${names.slice(0, 2).join(", ")} are typing`;
}

function initPreferences() {
  els.notificationsToggle.checked = state.preferences.notificationsEnabled;
  els.soundToggle.checked = state.preferences.soundEnabled;
  updateMuteButton();
}

function setSoundEnabled(isEnabled, announce = false) {
  state.preferences.soundEnabled = isEnabled;
  localStorage.setItem("devconnect-sound-enabled", String(isEnabled));
  els.soundToggle.checked = isEnabled;
  updateMuteButton();

  if (announce) {
    showToast(isEnabled ? "Notifications enabled" : "Notifications muted");
  }
}

function updateMuteButton() {
  const isMuted = !state.preferences.soundEnabled;
  els.muteBtn.classList.toggle("is-muted", isMuted);
  els.muteBtn.classList.toggle("is-active", state.preferences.soundEnabled);
  els.muteBtn.setAttribute("aria-pressed", String(isMuted));
  els.muteBtn.setAttribute(
    "aria-label",
    isMuted ? "Enable notification sounds" : "Mute notification sounds"
  );
  els.muteBtn.querySelector("i").className = isMuted ? "fas fa-volume-mute" : "fas fa-bell";
}

function openSettings() {
  els.displayNameSetting.value = state.user ? state.user.name : "";
  els.notificationsToggle.checked = state.preferences.notificationsEnabled;
  els.soundToggle.checked = state.preferences.soundEnabled;
  els.settingsModal.hidden = false;
  els.settingsCloseBtn.focus();
}

function closeSettings() {
  els.settingsModal.hidden = true;
  els.settingsBtn.focus();
}

function notifyIncomingMessage(message) {
  if (state.preferences.notificationsEnabled) {
    showToast(`${message.username}: ${message.text}`);
  }

  if (state.preferences.soundEnabled) {
    playNotificationSound();
  }
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  els.toastRegion.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "opacity 160ms ease, transform 160ms ease";
  }, 2400);

  setTimeout(() => toast.remove(), 2700);
}

function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 620;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
  } catch (error) {
    // Sound is a preference enhancement; browsers may block it until user interaction.
  }
}

function setConnectionState(stateName, label) {
  document.body.classList.remove("is-online", "is-offline", "is-connecting");
  document.body.classList.add(`is-${stateName}`);
  els.connectionChip.querySelector("span:last-child").textContent = label;
}

function showError(message) {
  els.errorMessage.textContent = message;
  els.errorBanner.hidden = false;
}

function hideError() {
  els.errorBanner.hidden = true;
}

function scrollToLatest() {
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function logout() {
  localStorage.removeItem("devconnect-token");
  localStorage.removeItem("devconnect-user");
  window.location.replace("/login.html");
}

function initials(name = "D") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function avatarColor(value = "DevConnect") {
  const palette = ["#2a9d8f", "#22577a", "#8b5cf6", "#f97316", "#e11d48", "#16a34a"];
  const index = [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

function formatTime(value) {
  return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(
    value ? new Date(value) : new Date()
  );
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
