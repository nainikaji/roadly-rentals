const cars = [
  ['Maruti Suzuki Swift', 'Hatchback', 5, 'Manual', 12, 1600, '🚗'],
  ['Hyundai Creta', 'SUV', 5, 'Automatic', 20, 2800, '🚙'],
  ['Honda City', 'Sedan', 5, 'Automatic', 17, 2500, '🚘'],
  ['Tata Nexon', 'SUV', 5, 'Manual', 18, 2300, '🚙'],
  ['Maruti Baleno', 'Hatchback', 5, 'Automatic', 14, 1900, '🚗'],
  ['Hyundai Verna', 'Sedan', 5, 'Manual', 16, 2200, '🚘'],
].map((x, id) => ({
  id,
  ...{
    name: x[0],
    type: x[1],
    seats: x[2],
    gear: x[3],
    perKm: x[4],
    dailyRate: x[5],
    icon: x[6],
  },
}));
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  money = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
let plan = null,
  estimate = null,
  filter = 'all',
  user = JSON.parse(sessionStorage.getItem('roadlyUser') || 'null');
const locationInput = $('#location'),
  destinationInput = $('#destination'),
  daysInput = $('#rentalDays'),
  grid = $('#carGrid'),
  toast = $('#toast');
$('#pickup').value = new Date().toISOString().slice(0, 10);
function note(text) {
  toast.textContent = text;
  toast.className = 'show';
  setTimeout(() => (toast.className = ''), 3500);
}
function headers() {
  const token = sessionStorage.getItem('roadlyToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function drawCars() {
  const days = Math.max(1, +daysInput.value || 1);
  grid.innerHTML = cars
    .filter((c) => filter === 'all' || c.type === filter)
    .map((c) => {
      let price = money(c.perKm),
        unit = '/ km',
        detail = '';
      if (plan === 'daily') {
        price = estimate ? money(c.dailyRate * days) : money(c.dailyRate);
        unit = estimate ? 'fixed rental' : '/ day';
        detail = estimate
          ? `<small><br>${days} day${days > 1 ? 's' : ''} rental</small>`
          : '';
      }
      if (plan === 'distance' && estimate) {
        price = money(c.perKm * estimate.distance_km);
        unit = 'estimated trip';
        detail = `<small><br>${estimate.distance_km} km route</small>`;
      }
      return `<article class="car-card"><div class="vehicle-art">${c.icon}</div><div class="car-name"><div><h3>${c.name}</h3><span>${c.type}</span></div><span class="tag">Available</span></div><div class="specs"><span>👤 ${c.seats} seats</span><span>⚙ ${c.gear}</span></div><div class="price-row"><div><strong>${price}</strong> <small>${unit}</small>${detail}</div><button class="book-btn" data-book="${c.id}">Book now</button></div></article>`;
    })
    .join('');
}
function selectPlan(value) {
  plan = value;
  estimate = null;
  $('#destinationField').hidden = value === 'daily';
  destinationInput.required = value === 'distance';
  $$('.plan-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.plan === value)
  );
  drawCars();
  note(
    value === 'daily'
      ? 'Daily fixed-price rental selected.'
      : 'Distance-based rental selected.'
  );
}
$$('.plan-btn').forEach((b) => (b.onclick = () => selectPlan(b.dataset.plan)));
$$('.filter').forEach(
  (b) =>
    (b.onclick = () => {
      filter = b.dataset.filter;
      $$('.filter').forEach((x) => x.classList.toggle('active', x === b));
      drawCars();
    })
);
[locationInput, destinationInput, daysInput].forEach((i) =>
  i.addEventListener('input', () => {
    estimate = null;
    drawCars();
  })
);
$('#searchForm').onsubmit = async (e) => {
  e.preventDefault();
  if (!plan) return note('Please choose a rental option first.');
  const days = Math.max(1, +daysInput.value || 1);
  if (plan === 'daily') {
    estimate = { daily: true };
    drawCars();
    $('#vehicles').scrollIntoView({ behavior: 'smooth' });
    return note(`${days}-day fixed prices are ready.`);
  }
  try {
    const r = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup: locationInput.value,
          destination: destinationInput.value,
        }),
      }),
      data = await r.json();
    if (!r.ok) throw Error(data.error);
    estimate = data;
    drawCars();
    $('#vehicles').scrollIntoView({ behavior: 'smooth' });
    note(`${data.distance_km} km route found. Prices updated.`);
  } catch (err) {
    note(err.message || 'Could not estimate route.');
  }
};
function showLogin(role = 'customer') {
  const dialog = $('#loginDialog'),
    box = $('#loginContent');
  box.innerHTML = `<section class="auth"><p class="eyebrow">ACCOUNT ACCESS</p><h2>${role === 'owner' ? 'Owner portal' : 'Customer portal'}</h2><div class="auth-tabs"><button class="${role === 'customer' ? 'active' : ''}" id="customerTab">Customer</button><button class="${role === 'owner' ? 'active' : ''}" id="ownerTab">Owner</button></div><form id="loginForm" class="form-grid"><label>Email<input name="email" type="email" required placeholder="you@example.com"></label><label>Password<input name="password" type="password" required placeholder="Your password"></label><button class="primary pay">Log in</button></form>${role === 'customer' ? '<p class="auth-note"><button class="text-btn" id="createAccount">Create a customer account</button></p>' : '<p class="auth-note">Demo owner: owner@roadly.com &middot; password: owner123</p>'}</section>`;
  dialog.showModal();
  $('#customerTab').onclick = () => showLogin('customer');
  $('#ownerTab').onclick = () => showLogin('owner');
  $('#createAccount')?.addEventListener('click', showRegister);
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: f.get('email'),
          password: f.get('password'),
          role,
        }),
      }),
      data = await r.json();
    if (!r.ok) return note(data.error);
    user = data.user;
    sessionStorage.setItem('roadlyUser', JSON.stringify(user));
    sessionStorage.setItem('roadlyToken', data.token);
    dialog.close();
    updateAccount();
    note(`Welcome, ${user.name}!`);
  };
}
function showRegister() {
  const box = $('#loginContent');
  box.innerHTML = `<section class="auth"><p class="eyebrow">CUSTOMER ACCOUNT</p><h2>Create account</h2><form id="registerForm" class="form-grid"><label>Full name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Password<input name="password" type="password" minlength="6" required></label><button class="primary pay">Create account</button></form></section>`;
  $('#registerForm').onsubmit = async (e) => {
    e.preventDefault();
    const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
      }),
      data = await r.json();
    if (!r.ok) return note(data.error);
    note('Account created. Please log in.');
    showLogin('customer');
  };
}
function updateAccount() {
  $('#loginOpen').textContent = user
    ? `Hi, ${user.name.split(' ')[0]}`
    : 'Login';
}
$('#loginOpen').onclick = () =>
  user
    ? (sessionStorage.clear(),
      (user = null),
      updateAccount(),
      note('Logged out.'))
    : showLogin();
$('#adminOpen').onclick = async () => {
  if (!user || user.role !== 'owner') return showLogin('owner');
  const dialog = $('#adminDialog'),
    box = $('#adminContent');
  dialog.showModal();
  box.innerHTML =
    '<section class="admin"><p class="empty">Loading bookings…</p></section>';
  const r = await fetch('/api/bookings', { headers: headers() }),
    data = await r.json();
  if (!r.ok)
    return (box.innerHTML = `<section class="admin"><p class="empty">${data.error}</p></section>`);
  box.innerHTML = `<section class="admin"><div class="admin-top"><div><p class="eyebrow">OWNER CONSOLE</p><h2>Booking dashboard</h2></div><div><span class="admin-stat">${data.length}</span> reservations</div></div>${data.length ? `<table><thead><tr><th>Customer</th><th>Vehicle</th><th>Rental</th><th>Amount</th></tr></thead><tbody>${data.map((b) => `<tr><td>${b.customer}</td><td>${b.car}</td><td>${b.rental_dates}</td><td>${money(b.amount)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">No bookings yet.</p>'}</section>`;
};
grid.onclick = (e) => {
  const id = e.target.dataset.book;
  if (id) bookCar(cars.find((c) => c.id == id));
};
function showPaymentStep(booking) {
  const box = $('#bookingContent');
  box.innerHTML = `
    <form class="booking payment-step" id="paymentForm">
      <button class="back-btn" type="button" id="backToDetails">← Back to details</button>
      <p class="eyebrow">STEP 2 OF 2 · PAYMENT</p>
      <h2>Choose payment option</h2>
      <p class="payment-copy">Your booking is reserved after you confirm this step.</p>
      <div class="summary">
        <span>${booking.car.name}<br><small>${booking.rentalText}</small></span>
        <strong>${money(booking.amount)}</strong>
      </div>
      <fieldset class="payment-options">
        <legend>Payment method</legend>
        <label class="payment-option"><input type="radio" name="paymentMethod" value="UPI" checked><span><b>UPI</b><small>Pay with any UPI app</small></span></label>
        <label class="payment-option"><input type="radio" name="paymentMethod" value="Card"><span><b>Debit / credit card</b><small>Pay securely by card</small></span></label>
        <label class="payment-option"><input type="radio" name="paymentMethod" value="Pay at pickup"><span><b>Pay at pickup</b><small>Pay when you collect the vehicle</small></span></label>
      </fieldset>
      <p class="payment-note">Demo payment screen — no card or UPI details are collected.</p>
      <button class="primary pay" type="submit">Confirm booking ${money(booking.amount)}</button>
    </form>`;
  $('#backToDetails').onclick = () => showCustomerDetails(booking);
  $('#paymentForm').onsubmit = async (event) => {
    event.preventDefault();
    const paymentMethod = new FormData(event.target).get('paymentMethod');
    const end = new Date($('#pickup').value);
    end.setDate(end.getDate() + booking.days);
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({
        ...booking.customer,
        car: booking.car.name,
        rental_dates: `${$('#pickup').value} to ${end.toISOString().slice(0, 10)}`,
        amount: Math.round(booking.amount),
        payment_method: paymentMethod,
      }),
    });
    const data = await response.json();
    if (!response.ok) return note(data.error);
    $('#bookingDialog').close();
    note(`Booking confirmed! Payment option: ${paymentMethod}.`);
  };
}

function showCustomerDetails(booking) {
  const box = $('#bookingContent');
  box.innerHTML = `
    <form class="booking" id="bookingForm">
      <p class="eyebrow">STEP 1 OF 2 · ${booking.daily ? 'DAILY FIXED PRICE' : 'DISTANCE BASED'}</p>
      <h2>${booking.car.name}</h2>
      <div class="summary"><span>${booking.rentalText}<br><small>${booking.rateText}</small></span><strong>${money(booking.amount)}</strong></div>
      <div class="form-grid">
        <label>Full name<input name="customer" required value="${booking.customer?.customer || ''}"></label>
        <label>Phone<input name="phone" pattern="[0-9]{10}" required value="${booking.customer?.phone || ''}"></label>
        <label>Email<input name="email" type="email" required value="${booking.customer?.email || ''}"></label>
      </div>
      <button class="primary pay" type="submit">Continue to payment →</button>
    </form>`;
  $('#bookingForm').onsubmit = (event) => {
    event.preventDefault();
    if (!event.target.reportValidity()) return;
    booking.customer = Object.fromEntries(new FormData(event.target));
    showPaymentStep(booking);
  };
}

function bookCar(car) {
  if (!user || user.role !== 'customer') return showLogin('customer');
  if (!plan || !estimate) return note('Choose a rental option and click Find a car first.');
  const days = Math.max(1, +daysInput.value || 1);
  const daily = plan === 'daily';
  const amount = daily ? car.dailyRate * days : car.perKm * estimate.distance_km;
  const rentalText = daily
    ? `${days} day${days > 1 ? 's' : ''} rental`
    : `${estimate.distance_km} km route`;
  const rateText = daily ? `${money(car.dailyRate)} / day` : `${money(car.perKm)} / km`;
  $('#bookingDialog').showModal();
  showCustomerDetails({ car, days, daily, amount, rentalText, rateText, customer: null });
}
$$('[data-close]').forEach(
  (b) => (b.onclick = () => $('#' + b.dataset.close).close())
);
$('#supportBtn').onclick = () => note('Support request received.');
$('#menuBtn').onclick = () => note('Use Explore cars to browse the fleet.');
updateAccount();
drawCars();
