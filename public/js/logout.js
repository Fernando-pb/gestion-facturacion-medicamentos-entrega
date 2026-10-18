document.querySelector('#logout').addEventListener('click', async () => {
  const response = await fetch('/auth/logout', { method: 'POST' });
  if (response.ok) window.location.assign('/login.html');
});
