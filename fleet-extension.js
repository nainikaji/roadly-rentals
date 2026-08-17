// Add reference cars without changing the booking flow already used by Roadly.
cars.push(
  {
    id: 6,
    name: 'Kia Seltos',
    type: 'SUV',
    seats: 5,
    gear: 'Automatic',
    perKm: 21,
    dailyRate: 3000,
    icon: '🚙',
  },
  {
    id: 7,
    name: 'Toyota Innova Crysta',
    type: 'SUV',
    seats: 7,
    gear: 'Manual',
    perKm: 24,
    dailyRate: 3600,
    icon: '🚐',
  },
  {
    id: 8,
    name: 'Mahindra Thar',
    type: 'SUV',
    seats: 4,
    gear: 'Manual',
    perKm: 22,
    dailyRate: 3200,
    icon: '🚙',
  },
  {
    id: 9,
    name: 'Honda Amaze',
    type: 'Sedan',
    seats: 5,
    gear: 'Manual',
    perKm: 15,
    dailyRate: 2100,
    icon: '🚘',
  },
  {
    id: 10,
    name: 'Tata Punch',
    type: 'Hatchback',
    seats: 5,
    gear: 'Manual',
    perKm: 13,
    dailyRate: 1750,
    icon: '🚗',
  },
  {
    id: 11,
    name: 'BMW 3 Series',
    type: 'Sedan',
    seats: 5,
    gear: 'Automatic',
    perKm: 32,
    dailyRate: 5500,
    icon: '🚘',
  }
);
cars.forEach((car) => {
  car.model ||= '2024';
  car.fuel ||= car.type === 'SUV' ? 'Diesel' : 'Petrol';
  car.availableDates ||= 'Available from 20 Aug 2026';
});
drawCars();
