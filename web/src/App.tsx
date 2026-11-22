import { Route, Routes } from 'react-router';
import { BookingPage } from './pages/BookingPage.tsx';
import { GuestEventTypesPage } from './pages/GuestEventTypesPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { HostBookingsPage } from './pages/HostBookingsPage.tsx';
import { HostEventTypesPage } from './pages/HostEventTypesPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/book" element={<GuestEventTypesPage />} />
      <Route path="/book/:eventTypeId" element={<BookingPage />} />
      <Route path="/host/event-types" element={<HostEventTypesPage />} />
      <Route path="/host/bookings" element={<HostBookingsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
