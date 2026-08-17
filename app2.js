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
const savedOwnerVehicles = JSON.parse(localStorage.getItem('roadlyOwnerVehicles') || '[]');
if (Array.isArray(savedOwnerVehicles)) cars.push(...savedOwnerVehicles);
function saveOwnerVehicles() {
  localStorage.setItem(
    'roadlyOwnerVehicles',
    JSON.stringify(cars.filter((car) => car.ownerListed))
  );
}
function readVehicleImage(file) {
  if (!file) return Promise.resolve('');
  if (file.size > 1500000) {
    note('Please choose an image smaller than 1.5 MB.');
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}
cars.forEach((car) => {
  car.model = '2024';
  car.fuel = car.type === 'SUV' ? 'Diesel' : 'Petrol';
  car.availableDates = 'Available from 20 Aug 2026';
});
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
const vehicleSearch = $('#vehicleSearch'),
  fuelFilter = $('#fuelFilter'),
  gearFilter = $('#gearFilter'),
  priceFilter = $('#priceFilter');
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
function matchesFilters(car) {
  const query = vehicleSearch.value.trim().toLowerCase();
  const maximumPrice = +priceFilter.value || Infinity;
  return (
    (filter === 'all' || car.type === filter) &&
    (!query || car.name.toLowerCase().includes(query)) &&
    (fuelFilter.value === 'all' || car.fuel === fuelFilter.value) &&
    (gearFilter.value === 'all' || car.gear === gearFilter.value) &&
    car.dailyRate <= maximumPrice
  );
}
function drawCars() {
  const days = Math.max(1, +daysInput.value || 1);
  grid.innerHTML = cars
    .filter(matchesFilters)
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
      return `<article class="car-card"><button class="vehicle-art" data-details="${c.id}" aria-label="View ${c.name} details">${c.image ? `<img src="${c.image}" alt="${c.name}">` : c.icon}</button><div class="car-name"><div><h3>${c.name}</h3><span>${c.type} · ${c.fuel}</span></div><span class="tag">Available</span></div><div class="specs"><span>👤 ${c.seats} seats</span><span>⚙ ${c.gear}</span></div><div class="price-row"><div><strong>${price}</strong> <small>${unit}</small>${detail}</div><div class="card-actions"><button class="details-btn" data-details="${c.id}">Details</button><button class="book-btn" data-book="${c.id}">Book now</button></div></div></article>`;
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
[vehicleSearch, fuelFilter, gearFilter, priceFilter].forEach((input) =>
  input.addEventListener('input', drawCars)
);
$('#fleetSearch').onsubmit = (event) => {
  event.preventDefault();
  drawCars();
  note('Vehicle filters applied.');
};
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
  $('#loginOpen').textContent = user ? `Hi, ${user.name.split(' ')[0]}` : 'Login';
  $('#dashboardOpen').hidden = !user || user.role !== 'customer';
}
function downloadReceipt(booking) {
  const receipt = `ROADLY RENTALS RECEIPT\nBooking #VRM${booking.id}\nVehicle: ${booking.car}\nDates: ${booking.rental_dates}\nTotal: ${money(booking.amount)}\nStatus: ${booking.status}`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([receipt], { type: 'text/plain' }));
  link.download = `roadly-receipt-${booking.id}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}
async function showUserDashboard() {
  if (!user || user.role !== 'customer') return showLogin('customer');
  const dialog = $('#userDialog'), box = $('#userContent');
  dialog.showModal();
  box.innerHTML = '<section class="admin"><p class="empty">Loading your bookings…</p></section>';
  const response = await fetch('/api/my-bookings', { headers: headers() });
  const bookings = await response.json();
  if (!response.ok) return (box.innerHTML = `<section class="admin"><p class="empty">${bookings.error}</p></section>`);
  const rows = bookings.map((booking) => `<article class="booking-history"><div><b>Booking #VRM${booking.id}</b><h3>${booking.car}</h3><p>${booking.rental_dates} · ${money(booking.amount)}</p></div><div><span class="status status-${booking.status.toLowerCase()}">${booking.status}</span><div class="history-actions"><button class="details-btn" data-receipt="${booking.id}">Receipt</button>${booking.status !== 'Cancelled' ? `<button class="danger" data-cancel="${booking.id}">Cancel</button>` : ''}</div></div></article>`).join('');
  box.innerHTML = `<section class="admin user-dashboard"><div class="admin-top"><div><p class="eyebrow">MY ACCOUNT</p><h2>Welcome, ${user.name}</h2></div><button class="danger" id="logoutBtn">Logout</button></div><div class="dashboard-tabs"><b>My bookings</b><span>Upcoming bookings</span><span>Previous bookings</span><span>${user.email}</span></div>${rows || '<p class="empty">No bookings yet. Your future rentals will appear here.</p>'}</section>`;
  $('#logoutBtn').onclick = () => { sessionStorage.clear(); user = null; updateAccount(); dialog.close(); note('Logged out.'); };
  $$('[data-receipt]').forEach((button) => (button.onclick = () => downloadReceipt(bookings.find((booking) => booking.id == button.dataset.receipt))));
  $$('[data-cancel]').forEach((button) => (button.onclick = async () => { const response = await fetch(`/api/bookings/${button.dataset.cancel}`, { method: 'DELETE', headers: headers() }); const data = await response.json(); if (!response.ok) return note(data.error); note('Booking cancelled.'); showUserDashboard(); }));
}
$('#loginOpen').onclick = () => user && user.role === 'customer' ? showUserDashboard() : showLogin();
$('#dashboardOpen').onclick = showUserDashboard;
function showVehicleEditor(vehicle = null) {
  const isEditing = Boolean(vehicle);
  const content = $('#vehicleContent');
  content.innerHTML = `<form class="vehicle-editor" id="vehicleEditor"><p class="eyebrow">OWNER VEHICLE LISTING</p><h2>${isEditing ? 'Edit vehicle' : 'List a new vehicle'}</h2><p class="payment-copy">Add a small image, vehicle information, and rental pricing.</p><div class="image-preview" id="imagePreview">${vehicle?.image ? `<img src="${vehicle.image}" alt="Vehicle preview">` : '🚘'}</div><label class="image-upload">Vehicle image <input name="image" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG, JPG, or WebP · maximum 1.5 MB</small></label><div class="form-grid"><label>Vehicle name<input name="name" required value="${vehicle?.name || ''}" placeholder="e.g. Kia Seltos"></label><label>Model<input name="model" required value="${vehicle?.model || '2024'}"></label><label>Vehicle type<select name="type"><option ${vehicle?.type === 'SUV' ? 'selected' : ''}>SUV</option><option ${vehicle?.type === 'Sedan' ? 'selected' : ''}>Sedan</option><option ${vehicle?.type === 'Hatchback' ? 'selected' : ''}>Hatchback</option></select></label><label>Fuel type<select name="fuel"><option ${vehicle?.fuel === 'Petrol' ? 'selected' : ''}>Petrol</option><option ${vehicle?.fuel === 'Diesel' ? 'selected' : ''}>Diesel</option></select></label><label>Seats<input name="seats" type="number" min="2" value="${vehicle?.seats || 5}" required></label><label>Transmission<select name="gear"><option ${vehicle?.gear === 'Manual' ? 'selected' : ''}>Manual</option><option ${vehicle?.gear === 'Automatic' ? 'selected' : ''}>Automatic</option></select></label><label>Price per day<input name="dailyRate" type="number" min="500" value="${vehicle?.dailyRate || 2000}" required></label><label>Price per km<input name="perKm" type="number" min="1" value="${vehicle?.perKm || 15}" required></label></div><button class="primary pay" type="submit">${isEditing ? 'Save vehicle changes' : 'List vehicle'}</button></form>`;
  $('#vehicleDialog').showModal();
  const imageInput = $('#vehicleEditor [name="image"]');
  imageInput.onchange = async () => { const image = await readVehicleImage(imageInput.files[0]); if (!image) return; $('#imagePreview').innerHTML = `<img src="${image}" alt="Vehicle preview">`; };
  $('#vehicleEditor').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const selectedImage = await readVehicleImage(imageInput.files[0]);
    if (selectedImage === null) return;
    const data = Object.fromEntries(form);
    const updatedVehicle = { ...vehicle, id: vehicle?.id || Date.now(), name: data.name, model: data.model, type: data.type, fuel: data.fuel, seats: +data.seats, gear: data.gear, dailyRate: +data.dailyRate, perKm: +data.perKm, icon: data.type === 'SUV' ? '🚙' : data.type === 'Sedan' ? '🚘' : '🚗', availableDates: 'Available from 20 Aug 2026', ownerListed: true, image: selectedImage || vehicle?.image || '' };
    const index = cars.findIndex((item) => item.id === updatedVehicle.id);
    if (index >= 0) cars[index] = updatedVehicle; else cars.push(updatedVehicle);
    saveOwnerVehicles();
    drawCars();
    $('#vehicleDialog').close();
    note(`${updatedVehicle.name} ${isEditing ? 'updated' : 'listed'} successfully.`);
    showAdminDashboard();
  };
}

async function showAdminDashboard() {
  if (!user || user.role !== 'owner') return showLogin('owner');
  const dialog = $('#adminDialog'), box = $('#adminContent');
  dialog.showModal();
  box.innerHTML = '<section class="admin"><p class="empty">Loading admin dashboard…</p></section>';
  const [bookingResponse, summaryResponse] = await Promise.all([
    fetch('/api/bookings', { headers: headers() }),
    fetch('/api/admin/summary', { headers: headers() }),
  ]);
  const bookings = await bookingResponse.json();
  const summary = await summaryResponse.json();
  if (!bookingResponse.ok || !summaryResponse.ok) return (box.innerHTML = `<section class="admin"><p class="empty">${bookings.error || summary.error}</p></section>`);
  const rows = bookings.map((booking) => `<tr><td>${booking.customer}<br><small>${booking.email}</small></td><td>${booking.car}</td><td>${booking.rental_dates}</td><td>${money(booking.amount)}<br><small>${booking.payment_method}</small></td><td><span class="status status-${booking.status.toLowerCase()}">${booking.status}</span><div class="admin-actions"><button class="details-btn" data-status="Confirmed" data-id="${booking.id}">Approve</button><button class="danger" data-status="Cancelled" data-id="${booking.id}">Reject</button></div></td></tr>`).join('');
  const fleetRows = cars.map((car) => `<li>${car.name} · ${money(car.dailyRate)}/day <button class="details-btn" data-edit-vehicle="${car.id}">Edit</button><button class="danger" data-delete-vehicle="${car.id}">Delete</button></li>`).join('');
  box.innerHTML = `<section class="admin"><div class="admin-top"><div><p class="eyebrow">ADMIN DASHBOARD</p><h2>Rental management</h2></div><button class="details-btn" id="refreshAdmin">Refresh</button></div><div class="admin-stats"><div><b>${summary.vehicles}</b><span>Vehicles</span></div><div><b>${summary.customers}</b><span>Customers</span></div><div><b>${summary.bookings}</b><span>Bookings</span></div><div><b>${money(summary.revenue)}</b><span>Revenue</span></div></div><div class="admin-fleet"><div><b>Fleet management</b><button class="details-btn" id="addVehicle">Add vehicle</button></div><ul class="fleet-list">${fleetRows}</ul></div>${rows ? `<table><thead><tr><th>Customer</th><th>Vehicle</th><th>Rental</th><th>Payment</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="empty">No bookings yet.</p>'}</section>`;
  $('.admin-fleet').insertAdjacentHTML('beforeend', `<form class="vehicle-form" id="vehicleForm" hidden><h3>List a new vehicle</h3><div class="form-grid"><label>Vehicle name<input name="name" required placeholder="e.g. Kia Seltos"></label><label>Model<input name="model" required value="2024"></label><label>Vehicle type<select name="type"><option>SUV</option><option>Sedan</option><option>Hatchback</option></select></label><label>Fuel type<select name="fuel"><option>Petrol</option><option>Diesel</option></select></label><label>Seats<input name="seats" type="number" min="2" value="5" required></label><label>Transmission<select name="gear"><option>Manual</option><option>Automatic</option></select></label><label>Price per day<input name="dailyRate" type="number" min="500" value="2000" required></label><label>Price per km<input name="perKm" type="number" min="1" value="15" required></label></div><button class="primary pay" type="submit">List vehicle</button></form>`);
  $('#refreshAdmin').onclick = showAdminDashboard;
  $('#addVehicle').onclick = () => showVehicleEditor();
  $$('[data-edit-vehicle]').forEach((button) => (button.onclick = () => showVehicleEditor(cars.find((item) => item.id == button.dataset.editVehicle))));
  $$('[data-delete-vehicle]').forEach((button) => (button.onclick = () => { const index = cars.findIndex((item) => item.id == button.dataset.deleteVehicle); if (index < 0 || !confirm(`Delete ${cars[index].name}?`)) return; cars.splice(index, 1); saveOwnerVehicles(); drawCars(); showAdminDashboard(); }));
  $$('[data-status]').forEach((button) => (button.onclick = async () => { const response = await fetch(`/api/bookings/${button.dataset.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() }, body: JSON.stringify({ status: button.dataset.status }) }); const data = await response.json(); if (!response.ok) return note(data.error); note(`Booking ${button.dataset.status.toLowerCase()}.`); showAdminDashboard(); }));
}
$('#adminOpen').onclick = showAdminDashboard;
grid.onclick = (e) => {
  const car = cars.find((item) => item.id == (e.target.dataset.book || e.target.dataset.details));
  if (!car) return;
  if (e.target.dataset.details) showVehicleDetails(car);
  if (e.target.dataset.book) bookCar(car);
};

function showVehicleDetails(car) {
  const content = $('#vehicleContent');
  content.innerHTML = `<section class="vehicle-details"><div class="vehicle-detail-art">${car.image ? `<img src="${car.image}" alt="${car.name}">` : car.icon}</div><p class="eyebrow">VEHICLE DETAILS</p><h2>${car.name}</h2><p class="detail-model">${car.model} model · ${car.type}</p><div class="detail-grid"><span><b>Fuel type</b>${car.fuel}</span><span><b>Seating</b>${car.seats} passengers</span><span><b>Transmission</b>${car.gear}</span><span><b>Availability</b>${car.availableDates}</span></div><div class="detail-price"><span>Starting price</span><strong>${money(car.dailyRate)} <small>/ day</small></strong></div><button class="primary pay" id="detailBook">Book this vehicle →</button></section>`;
  $('#vehicleDialog').showModal();
  $('#detailBook').onclick = () => {
    $('#vehicleDialog').close();
    bookCar(car);
  };
}
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
    box.innerHTML = `<section class="confirmation"><div class="check">✓</div><p class="eyebrow">BOOKING CONFIRMED</p><h2>Your ride is reserved</h2><p>${booking.car.name}<br>${$('#pickup').value} to ${end.toISOString().slice(0, 10)}<br><b>${money(booking.amount)}</b></p><p>Booking ID: <b>VRM${data.id}</b></p><button class="details-btn" id="downloadReceipt">Download receipt</button><button class="primary pay" id="finishBooking">Done</button></section>`;
    $('#downloadReceipt').onclick = () => downloadReceipt({ id: data.id, car: booking.car.name, rental_dates: `${$('#pickup').value} to ${end.toISOString().slice(0, 10)}`, amount: booking.amount, status: 'Confirmed' });
    $('#finishBooking').onclick = () => $('#bookingDialog').close();
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
