const authForm = document.querySelector("[data-auth-form]");
const errorBox = document.querySelector(".form-error");

if (localStorage.getItem("devconnect-token") && location.pathname !== "/signup.html") {
  window.location.replace("/chat.html");
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoading(true);
  showError("");

  const mode = authForm.dataset.authForm;
  const formData = new FormData(authForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Authentication failed.");
    }

    localStorage.setItem("devconnect-token", data.token);
    localStorage.setItem("devconnect-user", JSON.stringify(data.user));
    window.location.replace("/chat.html");
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
});

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function setLoading(isLoading) {
  const button = authForm.querySelector("button[type='submit']");
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = isLoading;
  button.textContent = isLoading ? "Please wait..." : button.dataset.label || button.textContent;
}
