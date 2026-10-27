// The two constants below are replaced at BUILD time, which is the whole point:
// whatever the values were when the bundle was made is what ships.
const API_BASE = '__API_BASE__';
const AUTH_URL = '__AUTH_URL__';

document.getElementById('signin').href = AUTH_URL;

function render(path) {
  document.getElementById('title').textContent =
    path === '/orders' ? 'Your orders' : 'Northwind Orders';
}
document.getElementById('go').addEventListener('click', (e) => {
  e.preventDefault(); history.pushState({}, '', '/orders'); render('/orders');
});
render(location.pathname);

(async () => {
  const state = document.getElementById('state');
  try {
    const r = await fetch(`${API_BASE}/api/orders`);
    const data = await r.json();
    for (const o of data.orders) {
      const li = document.createElement('li');
      li.className = 'order'; li.textContent = `#${o.id} — $${o.total}`;
      document.getElementById('list').append(li);
    }
    state.textContent = 'ready';
  } catch (e) {
    state.textContent = 'failed: ' + e.message;
  }
})();
