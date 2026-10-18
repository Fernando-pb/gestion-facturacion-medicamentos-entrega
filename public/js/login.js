const form = document.querySelector('#login-form');
const error = document.querySelector('#login-error');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;

  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.elements.username.value,
        password: form.elements.password.value,
      }),
    });
    if (!response.ok) {
      error.textContent = response.status === 429
        ? 'Se han realizado demasiados intentos. Espera antes de volver a intentarlo.'
        : 'No se ha podido iniciar sesión. Comprueba las credenciales.';
      error.hidden = false;
      return;
    }
    window.location.assign('/');
  } catch {
    error.textContent = 'No se ha podido conectar con el servidor.';
    error.hidden = false;
  }
});
