import { expect, test } from 'vitest';
import { listSlotDays } from './slots.ts';

// Europe/Moscow is three hours ahead of UTC, so working hours are 06:00Z to 15:00Z.
// 05:00Z on Monday 23 November 2026 is 08:00 in Moscow, before working hours.
const mondayMorning = new Date('2026-11-23T05:00:00Z');

function startsOn(
  date: string,
  input: {
    durationMinutes: number;
    now: Date;
    bookings?: { startTime: string; endTime: string }[];
  },
): string[] {
  const days = listSlotDays({ bookings: [], ...input });
  const day = days.find((candidate) => candidate.date === date);
  if (!day) {
    throw new Error(`No day ${date} in the booking window`);
  }
  return day.slots.map((slot) => slot.startTime);
}

test('the last slot of a day ends exactly at 18:00', () => {
  const days = listSlotDays({ durationMinutes: 60, now: mondayMorning, bookings: [] });

  expect(days[0]).toEqual({
    date: '2026-11-23',
    slots: [
      { startTime: '2026-11-23T06:00:00Z', endTime: '2026-11-23T07:00:00Z' },
      { startTime: '2026-11-23T07:00:00Z', endTime: '2026-11-23T08:00:00Z' },
      { startTime: '2026-11-23T08:00:00Z', endTime: '2026-11-23T09:00:00Z' },
      { startTime: '2026-11-23T09:00:00Z', endTime: '2026-11-23T10:00:00Z' },
      { startTime: '2026-11-23T10:00:00Z', endTime: '2026-11-23T11:00:00Z' },
      { startTime: '2026-11-23T11:00:00Z', endTime: '2026-11-23T12:00:00Z' },
      { startTime: '2026-11-23T12:00:00Z', endTime: '2026-11-23T13:00:00Z' },
      { startTime: '2026-11-23T13:00:00Z', endTime: '2026-11-23T14:00:00Z' },
      { startTime: '2026-11-23T14:00:00Z', endTime: '2026-11-23T15:00:00Z' },
    ],
  });
});

test('a 45 minute duration fills the day, and the last slot ends at 18:00', () => {
  const days = listSlotDays({ durationMinutes: 45, now: mondayMorning, bookings: [] });

  expect(days[0]?.slots).toHaveLength(12);
  expect(days[0]?.slots.slice(0, 2)).toEqual([
    { startTime: '2026-11-23T06:00:00Z', endTime: '2026-11-23T06:45:00Z' },
    { startTime: '2026-11-23T06:45:00Z', endTime: '2026-11-23T07:30:00Z' },
  ]);
  expect(days[0]?.slots.at(-1)).toEqual({
    startTime: '2026-11-23T14:15:00Z',
    endTime: '2026-11-23T15:00:00Z',
  });
});

test('a 50 minute duration leaves out the step that would end after 18:00', () => {
  const days = listSlotDays({ durationMinutes: 50, now: mondayMorning, bookings: [] });

  // 09:00 plus ten steps is 17:20, and a call from 17:20 would end at 18:10.
  expect(days[0]?.slots).toHaveLength(10);
  expect(days[0]?.slots.at(-1)).toEqual({
    startTime: '2026-11-23T13:30:00Z',
    endTime: '2026-11-23T14:20:00Z',
  });
});

test('the longest duration has one slot a day, the whole of working hours', () => {
  const days = listSlotDays({ durationMinutes: 540, now: mondayMorning, bookings: [] });

  expect(days[0]?.slots).toEqual([
    { startTime: '2026-11-23T06:00:00Z', endTime: '2026-11-23T15:00:00Z' },
  ]);
});

test('a start time that is one second ahead is still a slot', () => {
  const starts = startsOn('2026-11-23', {
    durationMinutes: 60,
    now: new Date('2026-11-23T06:59:59Z'),
  });

  expect(starts[0]).toBe('2026-11-23T07:00:00Z');
});

test('a start time that is now is no longer a slot', () => {
  const starts = startsOn('2026-11-23', {
    durationMinutes: 60,
    now: new Date('2026-11-23T07:00:00Z'),
  });

  expect(starts[0]).toBe('2026-11-23T08:00:00Z');
});

test('a start time that has just passed is not a slot', () => {
  const starts = startsOn('2026-11-23', {
    durationMinutes: 60,
    now: new Date('2026-11-23T07:00:00.001Z'),
  });

  expect(starts[0]).toBe('2026-11-23T08:00:00Z');
});

test('the booking window is today and the 13 days after it, in order', () => {
  const days = listSlotDays({ durationMinutes: 60, now: mondayMorning, bookings: [] });

  expect(days.map((day) => day.date)).toEqual([
    '2026-11-23',
    '2026-11-24',
    '2026-11-25',
    '2026-11-26',
    '2026-11-27',
    '2026-11-28',
    '2026-11-29',
    '2026-11-30',
    '2026-12-01',
    '2026-12-02',
    '2026-12-03',
    '2026-12-04',
    '2026-12-05',
    '2026-12-06',
  ]);
});

test('the last day of the booking window has all of its slots', () => {
  const days = listSlotDays({ durationMinutes: 60, now: mondayMorning, bookings: [] });

  expect(days[13]?.slots).toHaveLength(9);
  expect(days[13]?.slots[0]?.startTime).toBe('2026-12-06T06:00:00Z');
  expect(days[13]?.slots.at(-1)?.endTime).toBe('2026-12-06T15:00:00Z');
});

test('the first day is today in Moscow when the UTC date is still yesterday', () => {
  // 21:30Z on 23 November is 00:30 on 24 November in Moscow.
  const days = listSlotDays({
    durationMinutes: 60,
    now: new Date('2026-11-23T21:30:00Z'),
    bookings: [],
  });

  expect(days).toHaveLength(14);
  expect(days[0]?.date).toBe('2026-11-24');
  expect(days[0]?.slots).toHaveLength(9);
  expect(days[13]?.date).toBe('2026-12-07');
});

test('today stays in the window with no slots once working hours are over', () => {
  // 20:59:59Z is 23:59:59 in Moscow, the last second of 23 November.
  const days = listSlotDays({
    durationMinutes: 60,
    now: new Date('2026-11-23T20:59:59Z'),
    bookings: [],
  });

  expect(days).toHaveLength(14);
  expect(days[0]).toEqual({ date: '2026-11-23', slots: [] });
  expect(days[1]?.date).toBe('2026-11-24');
  expect(days[1]?.slots).toHaveLength(9);
  expect(days[13]?.date).toBe('2026-12-06');
});

test('a slot may start at the moment a booking ends, and end where one starts', () => {
  const starts = startsOn('2026-11-23', {
    durationMinutes: 60,
    now: mondayMorning,
    bookings: [{ startTime: '2026-11-23T07:00:00Z', endTime: '2026-11-23T08:00:00Z' }],
  });

  expect(starts.slice(0, 3)).toEqual([
    '2026-11-23T06:00:00Z',
    '2026-11-23T08:00:00Z',
    '2026-11-23T09:00:00Z',
  ]);
  expect(starts).toHaveLength(8);
});

test('a shorter booking of another event type takes the slot it falls inside', () => {
  const starts = startsOn('2026-11-23', {
    durationMinutes: 60,
    now: mondayMorning,
    bookings: [{ startTime: '2026-11-23T07:30:00Z', endTime: '2026-11-23T07:45:00Z' }],
  });

  expect(starts.slice(0, 2)).toEqual(['2026-11-23T06:00:00Z', '2026-11-23T08:00:00Z']);
  expect(starts).toHaveLength(8);
});

test('a booking of another event type takes every slot it overlaps', () => {
  const starts = startsOn('2026-11-23', {
    durationMinutes: 60,
    now: mondayMorning,
    // A 90 minute call off this event type's step, across three of its slots.
    bookings: [{ startTime: '2026-11-23T06:45:00Z', endTime: '2026-11-23T08:15:00Z' }],
  });

  expect(starts[0]).toBe('2026-11-23T09:00:00Z');
  expect(starts).toHaveLength(6);
});

test('a booking takes slots only on its own day', () => {
  const days = listSlotDays({
    durationMinutes: 60,
    now: mondayMorning,
    bookings: [{ startTime: '2026-11-24T06:00:00Z', endTime: '2026-11-24T07:00:00Z' }],
  });

  expect(days[0]?.slots).toHaveLength(9);
  expect(days[1]?.slots).toHaveLength(8);
  expect(days[2]?.slots).toHaveLength(9);
});

test('a booking written with another offset takes the moment it names', () => {
  const starts = startsOn('2026-11-23', {
    durationMinutes: 60,
    now: mondayMorning,
    bookings: [{ startTime: '2026-11-23T10:00:00+03:00', endTime: '2026-11-23T11:00:00+03:00' }],
  });

  expect(starts.slice(0, 2)).toEqual(['2026-11-23T06:00:00Z', '2026-11-23T08:00:00Z']);
});

test.each(['Pacific/Kiritimati', 'America/Los_Angeles', 'Asia/Tokyo', 'UTC'])(
  'the slots are the same when the server process runs in %s',
  (zone) => {
    const original = process.env.TZ;
    process.env.TZ = zone;
    try {
      // Proof that the process zone really changed for this test.
      expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);

      // 21:30Z is past midnight in Moscow and Kiritimati, and still 23 November elsewhere.
      const days = listSlotDays({
        durationMinutes: 60,
        now: new Date('2026-11-23T21:30:00Z'),
        bookings: [],
      });

      expect(days.map((day) => day.date)).toEqual([
        '2026-11-24',
        '2026-11-25',
        '2026-11-26',
        '2026-11-27',
        '2026-11-28',
        '2026-11-29',
        '2026-11-30',
        '2026-12-01',
        '2026-12-02',
        '2026-12-03',
        '2026-12-04',
        '2026-12-05',
        '2026-12-06',
        '2026-12-07',
      ]);
      expect(days[0]?.slots[0]).toEqual({
        startTime: '2026-11-24T06:00:00Z',
        endTime: '2026-11-24T07:00:00Z',
      });
      expect(days[0]?.slots.at(-1)).toEqual({
        startTime: '2026-11-24T14:00:00Z',
        endTime: '2026-11-24T15:00:00Z',
      });
    } finally {
      if (original === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = original;
      }
    }
  },
);
